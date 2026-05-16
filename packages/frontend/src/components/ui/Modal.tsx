import { useEffect, useRef, ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, children, maxWidth = 'max-w-lg' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/45"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={`bg-surface rounded-lg border border-border w-full ${maxWidth} shadow-xl`}>
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
      <div className="flex items-center gap-2.5">{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-text-3 hover:text-text text-lg leading-none">✕</button>
      )}
    </div>
  )
}

export function ModalBody({ children }: { children: ReactNode }) {
  return <div className="p-6">{children}</div>
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 p-6 pt-4 border-t border-border">{children}</div>
}
