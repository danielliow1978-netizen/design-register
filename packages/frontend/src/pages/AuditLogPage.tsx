import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Avatar } from '../components/ui/Pill'
import { Button } from '../components/ui/Button'
import { auditApi } from '../api/audit'
import { usersApi } from '../api/users'
import { formatSGT } from '../lib/dates'
import type { AuditAction } from '../types'

const ACTION_ICONS: Record<AuditAction, string> = {
  CREATED: '✨',
  EDITED: '✏️',
  COMPLETED: '✅',
  COMPLETED_LATE: '⚠️',
  DELETED: '🗑',
  RESTORED: '♻️',
  PERMANENTLY_DELETED: '💀',
  LOGIN: '🔑',
  LOGOUT: '🚪',
  APPROVED: '✅',
  REJECTED: '❌',
}

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATED: 'text-success-text bg-success-bg',
  EDITED: 'text-info-text bg-info-bg',
  COMPLETED: 'text-success-text bg-success-bg',
  COMPLETED_LATE: 'text-warning-text bg-warning-bg',
  DELETED: 'text-danger-text bg-danger-bg',
  RESTORED: 'text-teal-text bg-teal-bg',
  PERMANENTLY_DELETED: 'text-danger-text bg-danger-bg',
  LOGIN: 'text-neutral-500 bg-surface-2',
  LOGOUT: 'text-neutral-500 bg-surface-2',
  APPROVED: 'text-success-text bg-success-bg',
  REJECTED: 'text-danger-text bg-danger-bg',
}

const AUDIT_ACTIONS: AuditAction[] = [
  'CREATED', 'EDITED', 'COMPLETED', 'COMPLETED_LATE', 'DELETED',
  'RESTORED', 'PERMANENTLY_DELETED', 'LOGIN', 'LOGOUT', 'APPROVED', 'REJECTED',
]

const PAGE_SIZE = 50

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('')
  const [userFilter, setUserFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['audit', { action: actionFilter, userId: userFilter, from, to, search, limit: PAGE_SIZE, offset }],
    queryFn: () => auditApi.list({
      action: actionFilter || undefined,
      userId: userFilter || undefined,
      from: from || undefined,
      to: to || undefined,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
  })

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })

  const entries = data?.entries ?? []
  const total = data?.total ?? 0

  const renderDetails = (action: AuditAction, details: Record<string, unknown>) => {
    if (action === 'EDITED' && details) {
      const changes = Object.entries(details)
        .filter(([key]) => key !== 'drawingNumber')
        .map(([field, change]) => {
          const c = change as { from: unknown; to: unknown }
          return `${field}: "${c?.from}" → "${c?.to}"`
        })
      return changes.length > 0 ? (
        <div className="text-[10px] text-text-3 mt-1 space-y-0.5">
          {changes.map((ch, i) => <div key={i} className="font-mono">{ch}</div>)}
        </div>
      ) : null
    }
    if ((action === 'COMPLETED_LATE' || action === 'COMPLETED') && details.lateReason) {
      return <div className="text-[10px] text-warning-text mt-1">Reason: {String(details.lateReason).replace(/_/g, ' ')}</div>
    }
    if (action === 'DELETED' && details.reason) {
      return <div className="text-[10px] text-text-3 mt-1">Reason: {String(details.reason)}</div>
    }
    return null
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[1280px] mx-auto px-6 py-6">
        

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-medium text-text">Audit log</h2>
            <p className="text-xs text-text-3 mt-0.5">Immutable record of all actions · 7-year retention</p>
          </div>
          <div className="text-xs text-text-3">{total.toLocaleString()} entries total</div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value as AuditAction | ''); setOffset(0) }}
            className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none"
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{ACTION_ICONS[a]} {a.replace(/_/g, ' ')}</option>)}
          </select>
          <select
            value={userFilter}
            onChange={e => { setUserFilter(e.target.value); setOffset(0) }}
            className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none"
          >
            <option value="">All users</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setOffset(0) }}
            className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none" />
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setOffset(0) }}
            className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none" />
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-text-3" style={{width:12,height:12}} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setOffset(0) }}
              placeholder="Search drawing no., title…"
              className="text-xs pl-7 pr-3 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none w-48"
            />
          </div>
          {(actionFilter || userFilter || from || to || search) && (
            <Button size="sm" onClick={() => { setActionFilter(''); setUserFilter(''); setFrom(''); setTo(''); setSearch(''); setOffset(0) }}>
              Clear filters
            </Button>
          )}
        </div>

        {/* Log entries */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="py-12 text-center text-text-3 text-sm">Loading audit log…</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-text-3 text-sm">No audit entries found</div>
          ) : (
            <div className="divide-y divide-border">
              {entries.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors">
                  {/* Action icon */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 ${ACTION_COLORS[entry.action]}`}>
                    {ACTION_ICONS[entry.action]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Avatar initials={entry.user.initials} color={entry.user.avatarColor} size="sm" />
                      <span className="text-xs font-medium text-text">{entry.user.fullName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ACTION_COLORS[entry.action]}`}>
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                      {entry.details?.drawingNumber != null && (
                        <span className="text-xs text-text-2 font-mono">{String(entry.details.drawingNumber)}</span>
                      )}
                    </div>
                    {renderDetails(entry.action, entry.details)}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-text-3">{formatSGT(entry.createdAt, 'dd MMM yyyy HH:mm')}</span>
                      {entry.ipAddress && (
                        <span className="text-[10px] text-text-3 font-mono">{entry.ipAddress}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-text-3">
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))} disabled={offset === 0}>← Previous</Button>
              <Button size="sm" onClick={() => setOffset(o => o + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total}>Next →</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
