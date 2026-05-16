interface SortIndicatorProps {
  field: string
  sortColumns: { field: string; direction: 'asc' | 'desc' }[]
}

export function SortIndicator({ field, sortColumns }: SortIndicatorProps) {
  const idx = sortColumns.findIndex(s => s.field === field)
  const col = idx >= 0 ? sortColumns[idx] : null
  const priority = idx + 1

  return (
    <span className="inline-flex flex-col ml-1 align-middle" style={{ fontSize: 8, lineHeight: '7px' }}>
      <span className={`leading-none ${col?.direction === 'asc' ? 'text-info-text font-bold text-[9px]' : 'text-text-3 opacity-50'}`}>▲</span>
      <span className={`leading-none ${col?.direction === 'desc' ? 'text-info-text font-bold text-[9px]' : 'text-text-3 opacity-50'}`}>▼</span>
      {col && priority > 0 && (
        <span className="absolute -top-1 -right-3 bg-info-text text-white text-[8px] rounded-full px-1 font-medium leading-tight">
          {priority}
        </span>
      )}
    </span>
  )
}
