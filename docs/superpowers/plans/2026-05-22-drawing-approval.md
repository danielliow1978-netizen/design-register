# Drawing Approval Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Approval and Approval Date columns to the drawing table, allowing Design Managers to approve or reject completed drawings with a comment, triggering an email to both the designer and the approver.

**Architecture:** Four new nullable fields on the Drawing model (`approvalStatus`, `approvalComment`, `approvalDate`, `approvedById`). A new `POST /drawings/:id/approve` endpoint validates role and status, writes the fields, creates an audit log entry, and fires a notification email. The frontend adds an `ApprovalModal` and two new table columns.

**Tech Stack:** PostgreSQL (Supabase), Prisma, Express/TypeScript, React/TypeScript, Resend (email), Tailwind CSS

---

## File Map

| Action | File |
|---|---|
| Create | `packages/backend/prisma/migrations/20260522100000_add_drawing_approval/migration.sql` |
| Modify | `packages/backend/prisma/schema.prisma` |
| Modify | `packages/backend/src/routes/drawings.ts` |
| Modify | `packages/backend/src/services/emailService.ts` |
| Create | `packages/backend/src/templates/approval-notification.html` |
| Modify | `packages/frontend/src/types/index.ts` |
| Modify | `packages/frontend/src/api/drawings.ts` |
| Create | `packages/frontend/src/modals/ApprovalModal.tsx` |
| Modify | `packages/frontend/src/components/register/DrawingTable.tsx` |

---

## Task 1: Database migration — add 4 approval fields

**Files:**
- Create: `packages/backend/prisma/migrations/20260522100000_add_drawing_approval/migration.sql`
- Modify: `packages/backend/prisma/schema.prisma`

- [ ] **Step 1: Create the migration SQL file**

Create `packages/backend/prisma/migrations/20260522100000_add_drawing_approval/migration.sql` with:

```sql
ALTER TABLE "Drawing" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT;
ALTER TABLE "Drawing" ADD COLUMN IF NOT EXISTS "approvalComment" TEXT;
ALTER TABLE "Drawing" ADD COLUMN IF NOT EXISTS "approvalDate" TIMESTAMP(3);
ALTER TABLE "Drawing" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
```

- [ ] **Step 2: Run the migration in Supabase SQL Editor**

The direct DB URL is not reachable from local. Go to:
`https://supabase.com/dashboard/project/zkhdbpsesuzdreinnjxn/sql/new`

Paste and run the 4 ALTER TABLE statements above. Expected: "Success. No rows returned" for each.

- [ ] **Step 3: Add fields to schema.prisma**

In `packages/backend/prisma/schema.prisma`, inside the `Drawing` model, add after `pdfUrl String?`:

```prisma
  approvalStatus       String?
  approvalComment      String?
  approvalDate         DateTime?
  approvedById         String?
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
cd packages/backend
npx prisma generate
```

Expected output: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/prisma/schema.prisma packages/backend/prisma/migrations/20260522100000_add_drawing_approval/migration.sql
git commit -m "feat: add approval fields to Drawing schema"
```

---

## Task 2: Backend — drawingSelect + approve endpoint

**Files:**
- Modify: `packages/backend/src/routes/drawings.ts`

- [ ] **Step 1: Add approval fields to drawingSelect**

In `packages/backend/src/routes/drawings.ts`, find the `drawingSelect` object (lines ~31–59) and add four fields after `pdfUrl: true`:

```ts
  pdfUrl: true,
  approvalStatus: true,
  approvalComment: true,
  approvalDate: true,
  approvedById: true,
```

- [ ] **Step 2: Add the approveSchema Zod validator**

After the existing `deleteSchema` (around line 116), add:

```ts
const approveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(1000).optional(),
})
```

- [ ] **Step 3: Add the approve endpoint**

Before the `export default router` line at the end of the file, add:

```ts
// ── POST /api/drawings/:id/approve ───────────────────────────────────────────
router.post('/:id/approve', requireAuth, requireRole('DESIGN_MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { status, comment } = approveSchema.parse(req.body)

    const drawing = await prisma.drawing.findUnique({
      where: { id },
      select: {
        id: true, status: true, isDeleted: true,
        drawingNumber: true, drawingTitle: true,
        project: { select: { name: true } },
        designer: { select: { id: true, fullName: true, email: true } },
      },
    })

    if (!drawing || drawing.isDeleted) {
      return res.status(404).json({ error: 'Drawing not found', code: 'NOT_FOUND' })
    }
    if (drawing.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Only completed drawings can be approved or rejected', code: 'NOT_COMPLETED' })
    }

    const now = new Date()

    const updated = await prisma.drawing.update({
      where: { id },
      data: {
        approvalStatus: status,
        approvalComment: comment ?? null,
        approvalDate: now,
        approvedById: req.user!.id,
      },
      select: drawingSelect,
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: status,
        drawingId: id,
        details: JSON.stringify({
          drawingNumber: drawing.drawingNumber,
          drawingTitle: drawing.drawingTitle,
          status,
          comment: comment ?? null,
          approvedBy: req.user!.fullName,
        }),
        ipAddress: req.ip,
      },
    })

    // Fire-and-forget — do not await
    sendApprovalEmail({
      drawingNumber: drawing.drawingNumber,
      drawingTitle: drawing.drawingTitle,
      projectName: drawing.project.name,
      status,
      comment: comment ?? null,
      designerEmail: drawing.designer.email,
      designerName: drawing.designer.fullName,
      approverEmail: req.user!.email,
      approverName: req.user!.fullName,
      approvalDate: now,
    }).catch(err => console.error('[email] approval notification failed:', err))

    const { duration, delay } = computeDurationAndDelay(updated as Parameters<typeof computeDurationAndDelay>[0])
    return res.json({ drawing: { ...updated, duration, delay } })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 4: Add the requireRole import**

At the top of `drawings.ts`, `requireRole` is already exported from auth middleware. Update the import line:

```ts
import { requireAuth, requireRole, canDeleteDrawing } from '../middleware/auth'
```

- [ ] **Step 5: Add the sendApprovalEmail import**

At the top of `drawings.ts`, add:

```ts
import { sendApprovalEmail } from '../services/emailService'
```

- [ ] **Step 6: Verify the backend compiles**

```bash
cd packages/backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/routes/drawings.ts
git commit -m "feat: add POST /drawings/:id/approve endpoint"
```

---

## Task 3: Email template + sendApprovalEmail

**Files:**
- Create: `packages/backend/src/templates/approval-notification.html`
- Modify: `packages/backend/src/services/emailService.ts`

- [ ] **Step 1: Create the email template**

Create `packages/backend/src/templates/approval-notification.html`:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Drawing {{STATUS}}</title>
</head>
<body style="margin:0;padding:0;background:#F3F2EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F2EC;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;border:1px solid rgba(0,0,0,0.12);">
      <!-- Header -->
      <tr>
        <td style="padding:24px 28px 16px;border-bottom:1px solid rgba(0,0,0,0.08);">
          <div style="font-size:20px;font-weight:500;color:#2C2C2A;">📐 Design Register</div>
          <div style="font-size:13px;color:#5F5E5A;margin-top:4px;">Drawing approval notification</div>
        </td>
      </tr>
      <!-- Greeting -->
      <tr>
        <td style="padding:20px 28px 12px;">
          <div style="font-size:15px;font-weight:500;color:#2C2C2A;">Hi {{RECIPIENT_NAME}},</div>
          <div style="font-size:13px;color:#5F5E5A;margin-top:6px;">Drawing <strong>{{DRAWING_NUMBER}}</strong> has been reviewed.</div>
        </td>
      </tr>
      <!-- Status badge -->
      <tr>
        <td style="padding:0 28px 20px;">
          <div style="display:inline-block;padding:8px 20px;background:{{STATUS_BG}};border-radius:6px;font-size:15px;font-weight:600;color:{{STATUS_COLOR}};">
            {{STATUS_ICON}} {{STATUS}}
          </div>
        </td>
      </tr>
      <!-- Drawing details -->
      <tr>
        <td style="padding:0 28px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7F3;border-radius:8px;border:1px solid rgba(0,0,0,0.08);">
            <tr>
              <td style="padding:16px 20px;">
                <div style="font-size:13px;font-weight:600;color:#2C2C2A;">{{DRAWING_NUMBER}}</div>
                <div style="font-size:12px;color:#5F5E5A;margin-top:2px;">{{DRAWING_TITLE}}</div>
                <div style="font-size:11px;color:#8A8984;margin-top:4px;">{{PROJECT_NAME}}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- Comment -->
      <tr>
        <td style="padding:0 28px 20px;">
          <div style="font-size:11px;font-weight:600;color:#5F5E5A;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Comment</div>
          <div style="font-size:13px;color:#2C2C2A;padding:12px 16px;background:#F8F7F3;border-radius:6px;border-left:3px solid {{STATUS_COLOR}};">
            {{COMMENT}}
          </div>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="padding:16px 28px;border-top:1px solid rgba(0,0,0,0.08);">
          <div style="font-size:11px;color:#8A8984;">
            Reviewed by <strong>{{APPROVER_NAME}}</strong> on {{APPROVAL_DATE}}
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>
```

- [ ] **Step 2: Add sendApprovalEmail to emailService.ts**

At the end of `packages/backend/src/services/emailService.ts` (before the end of file), add:

```ts
interface ApprovalEmailParams {
  drawingNumber: string
  drawingTitle: string
  projectName: string
  status: 'APPROVED' | 'REJECTED'
  comment: string | null
  designerEmail: string
  designerName: string
  approverEmail: string
  approverName: string
  approvalDate: Date
}

export async function sendApprovalEmail(params: ApprovalEmailParams): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set, skipping approval notification')
    return
  }

  const {
    drawingNumber, drawingTitle, projectName, status, comment,
    designerEmail, designerName, approverEmail, approverName, approvalDate,
  } = params

  const isApproved = status === 'APPROVED'
  const statusLabel = isApproved ? 'Approved' : 'Rejected'
  const statusIcon = isApproved ? '✅' : '❌'
  const statusColor = isApproved ? '#27500A' : '#791F1F'
  const statusBg = isApproved ? '#EAF3DE' : '#FCEBEB'
  const formattedDate = formatSGT(approvalDate)
  const commentText = comment?.trim() || 'No comment provided'

  const template = loadTemplate('approval-notification.html')

  const recipients = [
    { email: designerEmail, name: designerName },
    { email: approverEmail, name: approverName },
  ]

  // Deduplicate in case designer and approver are the same person
  const unique = recipients.filter((r, i, arr) => arr.findIndex(x => x.email === r.email) === i)

  for (const recipient of unique) {
    const html = replace(template, {
      RECIPIENT_NAME: recipient.name.split(' ')[0],
      DRAWING_NUMBER: drawingNumber,
      DRAWING_TITLE: drawingTitle,
      PROJECT_NAME: projectName,
      STATUS: statusLabel,
      STATUS_ICON: statusIcon,
      STATUS_COLOR: statusColor,
      STATUS_BG: statusBg,
      COMMENT: commentText,
      APPROVER_NAME: approverName,
      APPROVAL_DATE: formattedDate,
    })

    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@designregister.com',
      to: recipient.email,
      subject: `Drawing ${drawingNumber} has been ${statusLabel}`,
      html,
    })
  }
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd packages/backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/services/emailService.ts packages/backend/src/templates/approval-notification.html
git commit -m "feat: add approval notification email template and service"
```

---

## Task 4: Frontend — types and API method

**Files:**
- Modify: `packages/frontend/src/types/index.ts`
- Modify: `packages/frontend/src/api/drawings.ts`

- [ ] **Step 1: Add approval fields to the Drawing interface**

In `packages/frontend/src/types/index.ts`, find the `Drawing` interface and add after `pdfUrl?: string | null`:

```ts
  approvalStatus?: 'APPROVED' | 'REJECTED' | null
  approvalComment?: string | null
  approvalDate?: string | null
  approvedById?: string | null
```

- [ ] **Step 2: Add APPROVED and REJECTED to AuditAction**

In the same file, find:

```ts
export type AuditAction = 'CREATED' | 'EDITED' | 'COMPLETED' | 'COMPLETED_LATE' | 'DELETED' | 'RESTORED' | 'PERMANENTLY_DELETED' | 'LOGIN' | 'LOGOUT'
```

Replace with:

```ts
export type AuditAction = 'CREATED' | 'EDITED' | 'COMPLETED' | 'COMPLETED_LATE' | 'DELETED' | 'RESTORED' | 'PERMANENTLY_DELETED' | 'LOGIN' | 'LOGOUT' | 'APPROVED' | 'REJECTED'
```

- [ ] **Step 3: Add approve method to drawingsApi**

In `packages/frontend/src/api/drawings.ts`, add after the `deletePdf` method:

```ts
  approve: (id: string, payload: { status: 'APPROVED' | 'REJECTED'; comment?: string }) =>
    apiClient.post<{ drawing: Drawing }>(`/drawings/${id}/approve`, payload).then(r => r.data.drawing),
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/types/index.ts packages/frontend/src/api/drawings.ts
git commit -m "feat: add approval types and API method"
```

---

## Task 5: Frontend — ApprovalModal component

**Files:**
- Create: `packages/frontend/src/modals/ApprovalModal.tsx`

- [ ] **Step 1: Create the modal**

Create `packages/frontend/src/modals/ApprovalModal.tsx`:

```tsx
import { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { drawingsApi } from '../api/drawings'
import type { Drawing } from '../types'

interface ApprovalModalProps {
  open: boolean
  drawing: Drawing | null
  action: 'APPROVED' | 'REJECTED'
  onClose: () => void
  onSuccess: (updated: Drawing) => void
}

export function ApprovalModal({ open, drawing, action, onClose, onSuccess }: ApprovalModalProps) {
  const [comment, setComment] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!drawing) return null

  const isApprove = action === 'APPROVED'
  const title = isApprove ? 'Approve Drawing' : 'Reject Drawing'
  const icon = isApprove ? '✅' : '❌'
  const confirmLabel = isApprove ? 'Confirm Approval' : 'Confirm Rejection'
  const confirmVariant = isApprove ? 'success' : 'danger'

  const handleClose = () => {
    setComment('')
    setError(null)
    onClose()
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const updated = await drawingsApi.approve(drawing.id, {
        status: action,
        comment: comment.trim() || undefined,
      })
      setComment('')
      onSuccess(updated)
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setError(apiErr.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = "w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-md text-text focus:outline-none focus:border-info-border transition-colors"
  const labelClass = "block text-[10px] text-text-2 mb-1 font-medium uppercase tracking-wide"

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalHeader onClose={handleClose}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${isApprove ? 'bg-success-bg' : 'bg-danger-bg'}`}>
          {icon}
        </div>
        <div>
          <div className="font-medium text-base">{title}</div>
          <div className="text-xs text-text-2">{drawing.drawingNumber}</div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className={`border rounded-md px-3 py-2.5 mb-4 text-sm ${isApprove ? 'bg-success-bg border-success-border text-success-text' : 'bg-danger-bg border-danger-border text-danger-text'}`}>
          <div className="font-medium">{drawing.drawingTitle}</div>
          <div className="text-xs mt-0.5 opacity-80">{drawing.project?.name}</div>
        </div>

        <div className="mb-3">
          <label className={labelClass}>Comment (optional)</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className={inputClass + ' min-h-[80px] resize-y'}
            placeholder="Add a comment (optional)…"
            maxLength={1000}
          />
        </div>

        {error && (
          <div className="text-xs text-danger-text bg-danger-bg border border-danger-border rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={handleClose} disabled={isLoading}>Cancel</Button>
        <Button variant={confirmVariant} onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Saving…' : confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/modals/ApprovalModal.tsx
git commit -m "feat: add ApprovalModal component"
```

---

## Task 6: Frontend — DrawingTable two new columns

**Files:**
- Modify: `packages/frontend/src/components/register/DrawingTable.tsx`

- [ ] **Step 1: Add the ApprovalModal import and state**

At the top of `DrawingTable.tsx`, add the import after the existing imports:

```ts
import { ApprovalModal } from '../../modals/ApprovalModal'
import { useQueryClient } from '@tanstack/react-query'
```

(`useQueryClient` is already imported — skip if already present.)

Inside the `DrawingTable` function, after the existing state declarations, add:

```ts
const [approvalTarget, setApprovalTarget] = useState<{ drawing: Drawing; action: 'APPROVED' | 'REJECTED' } | null>(null)
```

- [ ] **Step 2: Add two column headers after the PDF header**

Find this block in the `<thead>` section:

```tsx
<th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.3px] bg-surface-2 text-text-2 border-b border-border-strong whitespace-nowrap w-16">
  PDF
</th>
```

After it, insert:

```tsx
<th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.3px] bg-surface-2 text-text-2 border-b border-border-strong whitespace-nowrap w-28">
  Approval
</th>
<th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.3px] bg-surface-2 text-text-2 border-b border-border-strong whitespace-nowrap w-24">
  Approval Date
</th>
```

- [ ] **Step 3: Add two column cells after the PDF cell in each row**

Find this comment inside the `drawings.map(drawing => ...)` loop:

```tsx
{/* PDF column */}
```

After the closing `</td>` of the PDF cell (around line 257), insert:

```tsx
{/* Approval column */}
<td className="px-2 py-2 align-middle text-center whitespace-nowrap">
  {!isCompleted ? (
    <span className="text-text-3 text-[10px]">—</span>
  ) : drawing.approvalStatus === 'APPROVED' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-bg text-success-text text-[10px] font-medium">
      ✓ Approved
    </span>
  ) : drawing.approvalStatus === 'REJECTED' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger-bg text-danger-text text-[10px] font-medium">
      ✕ Rejected
    </span>
  ) : currentUserRole === 'DESIGN_MANAGER' ? (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => setApprovalTarget({ drawing, action: 'APPROVED' })}
        className="px-2 py-0.5 rounded text-[10px] font-medium bg-success-bg text-success-text hover:opacity-80 transition-opacity"
        title="Approve drawing"
      >
        ✓
      </button>
      <button
        onClick={() => setApprovalTarget({ drawing, action: 'REJECTED' })}
        className="px-2 py-0.5 rounded text-[10px] font-medium bg-danger-bg text-danger-text hover:opacity-80 transition-opacity"
        title="Reject drawing"
      >
        ✕
      </button>
    </div>
  ) : (
    <span className="text-text-3 text-[10px] italic">Pending</span>
  )}
</td>

{/* Approval Date column */}
<td className="px-2 py-2 align-middle text-center whitespace-nowrap text-text-2 text-[11px]">
  {drawing.approvalDate ? formatSGTShort(drawing.approvalDate) : <span className="text-text-3">—</span>}
</td>
```

- [ ] **Step 4: Render the ApprovalModal at the bottom of the return**

Inside the `return (...)` block, right before the final closing `</div>` of the component, add:

```tsx
<ApprovalModal
  open={approvalTarget !== null}
  drawing={approvalTarget?.drawing ?? null}
  action={approvalTarget?.action ?? 'APPROVED'}
  onClose={() => setApprovalTarget(null)}
  onSuccess={() => {
    setApprovalTarget(null)
    queryClient.invalidateQueries({ queryKey: ['drawings'] })
  }}
/>
```

- [ ] **Step 5: Increase minWidth to accommodate two new columns**

Find:

```tsx
<table className="w-full border-collapse text-[11px]" style={{ minWidth: 1500 }}>
```

Change to:

```tsx
<table className="w-full border-collapse text-[11px]" style={{ minWidth: 1700 }}>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd packages/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/src/components/register/DrawingTable.tsx
git commit -m "feat: add Approval and Approval Date columns to DrawingTable"
```

---

## Task 7: Deploy

- [ ] **Step 1: Build frontend and deploy to Firebase**

```bash
cd packages/frontend
npm run build
firebase deploy --only hosting
```

Expected: `Deploy complete!` with a hosting URL.

- [ ] **Step 2: Push backend to trigger Render deploy**

```bash
git push origin master
```

Render will auto-deploy from the master branch. Monitor the deploy at:
`https://dashboard.render.com/web/srv-d8400sbeo5us73dqleeg/events`

Expected: "Deploy live" green tick within ~3 minutes.

- [ ] **Step 3: Smoke test**

1. Log in as a user with `DESIGN_MANAGER` role
2. Navigate to the drawing register — confirm **Approval** and **Approval Date** columns are visible
3. Find a drawing with status `COMPLETED` — confirm ✓ and ✕ buttons appear
4. Find a drawing that is `IN_PROGRESS` — confirm `—` shows in the Approval column
5. Click ✓ Approve on a completed drawing → modal opens → add a comment → click "Confirm Approval"
6. Confirm: row now shows green "✓ Approved" badge and today's date in Approval Date
7. Confirm: designer's inbox and Design Manager's inbox both receive the approval email
8. Log in as a non-Design-Manager user — confirm Approval column shows `Pending` for completed drawings (no buttons)
