export type Role = 'DRAFTER' | 'SENIOR_DRAFTER' | 'DESIGNER' | 'SENIOR_DESIGNER' | 'PROJECT_ENGINEER' | 'QS_DEPARTMENT' | 'ASSISTANT_DESIGN_MANAGER' | 'DESIGN_MANAGER' | 'PROJECT_MANAGER' | 'DEPARTMENT_HEAD' | 'COO' | 'CEO' | 'ADMIN'
export type Discipline =
  | 'STRUCTURAL' | 'ARCHITECTURAL'
  | 'MECHANICAL_WET' | 'MECHANICAL_DRY'
  | 'PROCESS_WET' | 'PROCESS_DRY'
  | 'ELECTRICAL' | 'CONTROL_AND_INSTRUMENTATION'
  | 'FIRE_PROTECTION' | 'PLUMBING_AND_SANITARY'
  | string  // allows legacy values and custom entries
export type DrawingStatus = 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
export type DrawingCategory = 'TENDER' | 'SHOP' | 'CONSTRUCTION' | 'AS_BUILT'
export type ContractType = 'EPC' | 'EPCM'
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
export type LateReason = 'CLIENT_SCOPE_CHANGE' | 'CLIENT_DELAY' | 'SITE_CHANGE' | 'VENDOR_DELAY' | 'SICK_LEAVE' | 'AWAITING_OTHER_DISCIPLINE' | 'SOFTWARE_ISSUE' | 'OTHER'
export type AuditAction = 'CREATED' | 'EDITED' | 'COMPLETED' | 'COMPLETED_LATE' | 'DELETED' | 'RESTORED' | 'PERMANENTLY_DELETED' | 'LOGIN' | 'LOGOUT' | 'APPROVED' | 'REJECTED'
export type ThemeMode = 'light' | 'dark' | 'auto'
export type PdfFormat = 'a4-portrait' | 'a4-landscape' | 'letter-landscape'
export type AvatarColor = 'info' | 'success' | 'warning' | 'danger' | 'purple' | 'teal' | 'neutral'

export interface User {
  id: string
  email: string
  fullName: string
  initials: string
  avatarColor: AvatarColor
  role: Role
  discipline?: Discipline
  active: boolean
  emailDigestEnabled: boolean
  theme: ThemeMode
  pdfDefault: PdfFormat
  createdAt: string
}

export interface Project {
  id: string
  code: string
  name: string
  client?: string
  contractType?: ContractType
  status: ProjectStatus
  projectManagerId?: string
  projectManager?: Pick<User, 'id' | 'fullName' | 'initials' | 'avatarColor'>
  iconEmoji: string
  iconColor: string
  startDate?: string
  endDate?: string
  createdAt: string
  _count?: { drawings: number }
}

export interface Drawing {
  id: string
  drawingNumber: string
  drawingTitle: string
  projectId: string
  project: Pick<Project, 'id' | 'code' | 'name' | 'iconEmoji' | 'iconColor'>
  discipline: Discipline
  category: DrawingCategory
  designerId: string
  designer: Pick<User, 'id' | 'fullName' | 'initials' | 'avatarColor' | 'role' | 'discipline'>
  requestorId: string
  requestor: Pick<User, 'id' | 'fullName' | 'initials' | 'avatarColor' | 'role'>
  requestDate: string
  startDate: string
  endDate: string
  actualCompletionDate?: string
  lateReason?: LateReason
  lateReasonDetail?: string
  notes?: string
  pdfUrl?: string | null
  approvalStatus?: 'APPROVED' | 'REJECTED' | null
  approvalComment?: string | null
  approvalDate?: string | null
  approvedById?: string | null
  status: DrawingStatus
  isDeleted: boolean
  deletedAt?: string
  deletedById?: string
  deletedReason?: string
  createdAt: string
  updatedAt: string
  createdById: string
  // Computed by API
  duration?: number
  delay?: number | null
}

export interface DrawingDraft {
  id: string
  userId: string
  formData: Record<string, unknown>
  completionPct: number
  lastSavedAt: string
  expiresAt: string
}

export interface AuditEntry {
  id: string
  userId: string
  user: Pick<User, 'id' | 'fullName' | 'initials' | 'avatarColor' | 'role'>
  action: AuditAction
  drawingId?: string
  details: Record<string, unknown>
  ipAddress?: string
  createdAt: string
}

export interface DashboardData {
  kpis: {
    completedCount: number
    onTimePct: number | null
    avgDuration: number | null
    activeWorkload: number
    avgDelay: number | null
  }
  weeklyTrend: { week: string; completed: number; onTime: number; late: number }[]
  categoryBreakdown: { category: DrawingCategory; count: number }[]
  perDrawing: (Drawing & { duration: number; delay: number | null })[]
}

export interface SortColumn {
  field: string
  direction: 'asc' | 'desc'
}

export interface ApiError {
  error: string
  code?: string
  details?: { field: string; message: string }[]
}
