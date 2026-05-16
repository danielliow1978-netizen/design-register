import { useState, useRef, useEffect } from 'react'
import { Button } from './Button'

interface ExportMenuProps {
  onPdf?: () => void
  onExcel?: () => void
  onCsv?: () => void
  onPng?: () => void
}

export function ExportMenu({ onPdf, onExcel, onCsv, onPng }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const item = (label: string, onClick?: () => void) =>
    onClick ? (
      <button
        key={label}
        onClick={() => { onClick(); setOpen(false) }}
        className="w-full text-left px-3 py-2 text-xs text-text hover:bg-surface-2 transition-colors"
      >
        {label}
      </button>
    ) : null

  return (
    <div className="relative" ref={ref}>
      <Button onClick={() => setOpen(o => !o)}>⤓ Export ▾</Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-md shadow-lg z-20 min-w-[140px] overflow-hidden">
          {item('📄 PDF', onPdf)}
          {item('📊 Excel', onExcel)}
          {item('📋 CSV', onCsv)}
          {item('🖼 PNG', onPng)}
        </div>
      )}
    </div>
  )
}
