interface ViewSwitcherProps {
  view: 'designer' | 'project'
  onChange: (view: 'designer' | 'project') => void
}

export function ViewSwitcher({ view, onChange }: ViewSwitcherProps) {
  return (
    <div className="flex bg-surface-2 border border-border rounded-md p-0.5 w-fit mb-3.5">
      {(['designer', 'project'] as const).map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`text-xs px-3.5 py-1.5 rounded flex items-center gap-1.5 transition-all ${
            view === v
              ? 'bg-surface text-info-text font-medium shadow-sm'
              : 'text-text-2 hover:text-text'
          }`}
        >
          {v === 'designer' ? '👤 By designer' : '📁 By project'}
        </button>
      ))}
    </div>
  )
}
