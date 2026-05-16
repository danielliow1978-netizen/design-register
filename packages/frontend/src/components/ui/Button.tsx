import { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: ReactNode
  children?: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default:  'bg-transparent text-text border-border-strong hover:bg-surface-2',
  primary:  'bg-info-bg text-info-text border-info-border hover:opacity-90',
  success:  'bg-success-bg text-success-text border-success-border hover:opacity-90',
  danger:   'bg-danger-bg text-danger-text border-danger-border hover:opacity-90',
  warning:  'bg-warning-bg text-warning-text border-warning-border hover:opacity-90',
  ghost:    'bg-transparent text-text-2 border-transparent hover:bg-surface-2',
}

export function Button({ variant = 'default', size = 'md', icon, children, className = '', ...props }: ButtonProps) {
  const sizeClass = size === 'sm' ? 'px-1.5 py-1 text-[11px]' : 'px-3 py-1.5 text-[11px]'
  return (
    <button
      className={`inline-flex items-center gap-1 border rounded-md cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${sizeClass} ${className}`}
      {...props}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  )
}
