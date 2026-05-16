import type { DrawingStatus, DrawingCategory, AvatarColor } from '../../types'

type PillVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'purple' | 'teal'

interface PillProps {
  variant: PillVariant
  children: React.ReactNode
  className?: string
}

const VARIANT_CLASSES: Record<PillVariant, string> = {
  info:    'bg-info-bg text-info-text',
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger:  'bg-danger-bg text-danger-text',
  neutral: 'bg-surface-2 text-text-2',
  purple:  'bg-purple-bg text-purple-text',
  teal:    'bg-teal-bg text-teal-text',
}

export function Pill({ variant, children, className = '' }: PillProps) {
  return (
    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-md whitespace-nowrap ${VARIANT_CLASSES[variant]} ${className}`}>
      {children}
    </span>
  )
}

export function statusPill(status: DrawingStatus) {
  switch (status) {
    case 'IN_PROGRESS': return <Pill variant="info">In progress</Pill>
    case 'COMPLETED':   return <Pill variant="success">Completed</Pill>
    case 'OVERDUE':     return <Pill variant="danger">Overdue</Pill>
  }
}

export function categoryPill(category: DrawingCategory) {
  const labels: Record<DrawingCategory, string> = {
    TENDER: 'TDR', SHOP: 'SHOP', CONSTRUCTION: 'CON', AS_BUILT: 'AB'
  }
  const variants: Record<DrawingCategory, PillVariant> = {
    TENDER: 'warning', SHOP: 'warning', CONSTRUCTION: 'info', AS_BUILT: 'neutral'
  }
  return <Pill variant={variants[category]}>{labels[category]}</Pill>
}

export function Avatar({ initials, color, size = 'md' }: { initials: string; color: AvatarColor; size?: 'sm' | 'md' | 'lg' }) {
  const COLOR_CLASSES: Record<AvatarColor, string> = {
    info:    'bg-info-bg text-info-text',
    success: 'bg-success-bg text-success-text',
    warning: 'bg-warning-bg text-warning-text',
    danger:  'bg-danger-bg text-danger-text',
    purple:  'bg-purple-bg text-purple-text',
    teal:    'bg-teal-bg text-teal-text',
    neutral: 'bg-surface-2 text-text-2',
  }
  const SIZE_CLASSES = { sm: 'w-5 h-5 text-[9px]', md: 'w-[26px] h-[26px] text-[10px]', lg: 'w-9 h-9 text-xs' }
  return (
    <div className={`rounded-full flex items-center justify-center font-medium shrink-0 ${COLOR_CLASSES[color]} ${SIZE_CLASSES[size]}`}>
      {initials}
    </div>
  )
}
