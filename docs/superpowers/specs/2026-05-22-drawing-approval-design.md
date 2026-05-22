# Drawing Approval Workflow — Design Spec

**Date:** 2026-05-22  
**Status:** Approved  

---

## Overview

Add an approval workflow to the Drawing Register. Once a drawing is marked Completed, a Design Manager can approve or reject it with an optional comment. Both the designer and the Design Manager receive an email notification on every decision.

Two new columns appear in the drawing table after the PDF column:
- **Approval** — action buttons (for Design Managers) or a status badge
- **Approval Date** — auto-populated when a decision is made

---

## Database

Four new nullable fields added to the `Drawing` model:

| Field | Type | Description |
|---|---|---|
| `approvalStatus` | `String?` | `null` = no decision yet, `"APPROVED"` or `"REJECTED"` |
| `approvalComment` | `String?` | Optional free-text comment from the approver |
| `approvalDate` | `DateTime?` | Set to `now()` at the moment of the decision |
| `approvedById` | `String?` | ID of the User who made the decision |

Migration: `ALTER TABLE "Drawing" ADD COLUMN IF NOT EXISTS` for each field (run via Supabase SQL Editor, same pattern as `pdfUrl`).

**Constraints:**
- Approval can only be set when `drawing.status === 'COMPLETED'`
- A decision can be changed (re-approved or re-rejected) by a Design Manager — fields are simply overwritten
- Approval state is preserved if a drawing is soft-deleted (no cascade clear)

---

## Backend

### New endpoint

**`POST /api/drawings/:id/approve`**

- Auth: `requireAuth` + `requireMinRole('DESIGN_MANAGER')`
- Validates: drawing exists, `isDeleted === false`, `status === 'COMPLETED'`
- Request body:
  ```json
  { "status": "APPROVED" | "REJECTED", "comment": "optional string" }
  ```
- Writes `approvalStatus`, `approvalComment`, `approvalDate = now()`, `approvedById = req.user.id` atomically via Prisma update
- Creates an `AuditLog` entry with action `"APPROVED"` or `"REJECTED"` and details `{ comment, approvedBy }`
- Calls `sendApprovalEmail(drawing, approver, status, comment)` — fire-and-forget (does not block the response)
- Returns the updated drawing (full `drawingSelect` shape)

### Email service — new function

**`sendApprovalEmail(drawing, approver, status, comment)`** in `emailService.ts`:

- Recipients: `[drawing.designer.email, approver.email]` (both always receive it)
- Subject: `Drawing {drawingNumber} has been {Approved / Rejected}`
- Uses a new HTML template `src/templates/approval-notification.html`
- Template tokens: `{{DRAWING_NUMBER}}`, `{{DRAWING_TITLE}}`, `{{PROJECT_NAME}}`, `{{STATUS}}`, `{{STATUS_COLOR}}` (green / red), `{{COMMENT}}` (or "No comment provided"), `{{APPROVER_NAME}}`, `{{APPROVAL_DATE}}`
- Gracefully skips (logs warning) if `RESEND_API_KEY` is not set — same pattern as digest emails

### `drawingSelect` update

Add to the shared select object in `drawings.ts`:
```ts
approvalStatus: true,
approvalComment: true,
approvalDate: true,
approvedById: true,
```

---

## Frontend

### Type update — `Drawing` interface

```ts
approvalStatus?: 'APPROVED' | 'REJECTED' | null
approvalComment?: string | null
approvalDate?: string | null
approvedById?: string | null
```

### API — `drawingsApi`

```ts
approve: (id: string, payload: { status: 'APPROVED' | 'REJECTED'; comment?: string }) =>
  apiClient.post<{ drawing: Drawing }>(`/drawings/${id}/approve`, payload).then(r => r.data.drawing)
```

### DrawingTable — two new columns

**Column order:** Actions | PDF | **Approval** | **Approval Date** | Drawing No. | …

#### Approval column

| Drawing state | Viewer role | Cell content |
|---|---|---|
| Not COMPLETED | Any | `—` |
| COMPLETED, no approval | DESIGN_MANAGER | `✓ Approve` + `✗ Reject` buttons (small, outline) |
| COMPLETED, no approval | Other roles | `Pending` (muted text) |
| APPROVED | Any | Green `Approved` badge |
| REJECTED | Any | Red `Rejected` badge |

Clicking either button opens the **ApprovalModal**.

#### Approval Date column

- Shows `DD MMM YYYY` formatted date when `approvalDate` is set
- Shows `—` otherwise

### ApprovalModal component

New file: `src/components/register/ApprovalModal.tsx`

Props:
```ts
{ drawing: Drawing; action: 'APPROVED' | 'REJECTED'; onClose: () => void; onSuccess: (updated: Drawing) => void }
```

Contents:
- Header: "Approve Drawing" or "Reject Drawing"
- Drawing number + title (read-only, for context)
- Optional comment textarea (placeholder: "Add a comment (optional)")
- Action button: "Confirm Approval" (green) or "Confirm Rejection" (red)
- Cancel button
- Loading state while mutation is pending
- Error message if API call fails

On success: calls `onSuccess(updatedDrawing)` which triggers query invalidation in the parent.

---

## Audit Log

Two new `AuditAction` values: `"APPROVED"` and `"REJECTED"`.

Add to frontend `types/index.ts`:
```ts
export type AuditAction = '...' | 'APPROVED' | 'REJECTED'
```

Details stored: `{ drawingNumber, drawingTitle, status, comment, approvedBy }`

---

## Error Handling

| Scenario | HTTP | Message |
|---|---|---|
| Drawing not found | 404 | `Drawing not found` |
| Drawing is deleted | 404 | `Drawing not found` |
| Drawing not completed | 400 | `Only completed drawings can be approved or rejected` |
| Caller not Design Manager | 403 | `Only Design Managers can approve or reject drawings` |
| Invalid status value | 400 | Zod validation error |

---

## Out of Scope

- Per-project approval workflows
- Multi-stage approval (e.g. requires two approvers)
- Revoking/clearing an approval once set (re-approving overwrites)
- Push notifications (email only)
