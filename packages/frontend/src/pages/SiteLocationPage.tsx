import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Avatar } from '../components/ui/Pill'
import { Button } from '../components/ui/Button'
import { siteLocationsApi, type SiteLocationInput } from '../api/siteLocations'
import { usersApi } from '../api/users'
import { useAuthStore } from '../store/authStore'
import { formatSGT, todaySGT } from '../lib/dates'
import { subMonths, format } from 'date-fns'
import type { SiteLocation, User } from '../types'

const DESIGNER_ROLES = [
  'DRAFTER', 'SENIOR_DRAFTER', 'DESIGNER', 'SENIOR_DESIGNER', 'PROJECT_ENGINEER',
  'ASSISTANT_DESIGN_MANAGER', 'DESIGN_MANAGER',
]

const EMPTY_FORM = { siteName: '', siteArea: '', timeIn: '', timeOut: '', note: '' }

function timeRange(e: SiteLocation) {
  if (e.timeIn && e.timeOut) return `${e.timeIn}–${e.timeOut}`
  if (e.timeIn) return `from ${e.timeIn}`
  if (e.timeOut) return `until ${e.timeOut}`
  return ''
}

export default function SiteLocationPage() {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const today = todaySGT()

  const [mode, setMode] = useState<'daily' | 'history'>('daily')
  const [boardDate, setBoardDate] = useState(today)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)

  // History filters (default: last 6 months)
  const [histFrom, setHistFrom] = useState(format(subMonths(new Date(today), 6), 'yyyy-MM-dd'))
  const [histTo, setHistTo] = useState(today)
  const [histUser, setHistUser] = useState('')

  // My entries for today
  const { data: myEntries = [] } = useQuery({
    queryKey: ['site-locations', { date: today, userId: user?.id }],
    queryFn: () => siteLocationsApi.list({ date: today, userId: user?.id }),
    enabled: !!user?.id,
  })

  // All team entries for the board date
  const { data: boardEntries = [], isLoading: boardLoading } = useQuery({
    queryKey: ['site-locations', { date: boardDate }],
    queryFn: () => siteLocationsApi.list({ date: boardDate }),
  })

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })

  // History: entries across a date range
  const { data: historyEntries = [], isLoading: historyLoading } = useQuery({
    queryKey: ['site-locations', { from: histFrom, to: histTo, userId: histUser }],
    queryFn: () => siteLocationsApi.list({ from: histFrom, to: histTo, userId: histUser || undefined }),
    enabled: mode === 'history',
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['site-locations'] })

  const createMutation = useMutation({
    mutationFn: (data: SiteLocationInput) => siteLocationsApi.create(data),
    onSuccess: () => { invalidate(); setForm(EMPTY_FORM) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SiteLocationInput> }) => siteLocationsApi.update(id, data),
    onSuccess: () => { invalidate(); setForm(EMPTY_FORM); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => siteLocationsApi.delete(id),
    onSuccess: invalidate,
  })

  const canSubmit = form.siteName.trim().length > 0
  const busy = createMutation.isPending || updateMutation.isPending

  const handleSubmit = () => {
    if (!canSubmit) return
    const payload: SiteLocationInput = {
      date: today,
      siteName: form.siteName.trim(),
      siteArea: form.siteArea.trim() || undefined,
      timeIn: form.timeIn || undefined,
      timeOut: form.timeOut || undefined,
      note: form.note.trim() || undefined,
    }
    if (editingId) updateMutation.mutate({ id: editingId, data: payload })
    else createMutation.mutate(payload)
  }

  const startEdit = (e: SiteLocation) => {
    setEditingId(e.id)
    setForm({
      siteName: e.siteName,
      siteArea: e.siteArea ?? '',
      timeIn: e.timeIn ?? '',
      timeOut: e.timeOut ?? '',
      note: e.note ?? '',
    })
  }

  const cancelEdit = () => { setEditingId(null); setForm(EMPTY_FORM) }

  // Build the team board: every designer, plus anyone else who logged an entry that day.
  const designers = users.filter((u: User) =>
    DESIGNER_ROLES.includes(u.role) && !u.email.endsWith('@requestor.local')
  )
  const entriesByUser = new Map<string, SiteLocation[]>()
  for (const e of boardEntries) {
    const arr = entriesByUser.get(e.userId) ?? []
    arr.push(e)
    entriesByUser.set(e.userId, arr)
  }
  const boardUsers: { user: Pick<User, 'id' | 'fullName' | 'initials' | 'avatarColor' | 'role'>; entries: SiteLocation[] }[] = []
  const seen = new Set<string>()
  for (const d of designers) {
    boardUsers.push({ user: d, entries: entriesByUser.get(d.id) ?? [] })
    seen.add(d.id)
  }
  // Include non-designer users who still logged a location (e.g. a manager)
  for (const e of boardEntries) {
    if (!seen.has(e.userId)) {
      boardUsers.push({ user: e.user, entries: entriesByUser.get(e.userId) ?? [] })
      seen.add(e.userId)
    }
  }
  // Sort: people with entries first, then alphabetically
  boardUsers.sort((a, b) => {
    if ((b.entries.length > 0 ? 1 : 0) !== (a.entries.length > 0 ? 1 : 0)) {
      return (b.entries.length > 0 ? 1 : 0) - (a.entries.length > 0 ? 1 : 0)
    }
    return a.user.fullName.localeCompare(b.user.fullName)
  })

  const loggedCount = boardUsers.filter(b => b.entries.length > 0).length

  // History grouped by date (backend already returns newest-first)
  const historyByDate: { date: string; entries: SiteLocation[] }[] = []
  const dateIndex = new Map<string, number>()
  for (const e of historyEntries) {
    let idx = dateIndex.get(e.date)
    if (idx === undefined) {
      idx = historyByDate.length
      dateIndex.set(e.date, idx)
      historyByDate.push({ date: e.date, entries: [] })
    }
    historyByDate[idx].entries.push(e)
  }

  const inputCls = 'w-full text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none focus:border-info-border'
  const labelCls = 'block text-[11px] text-text-2 mb-1'

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[900px] mx-auto px-6 py-6">

        {/* ── Daily / History toggle ── */}
        <div className="flex items-center bg-surface-2 rounded-lg p-0.5 gap-0.5 mb-4 w-fit">
          {(['daily', 'history'] as const).map(m => (
            <button key={m}
              onClick={() => setMode(m)}
              className={`px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                mode === m ? 'bg-surface text-text shadow-sm' : 'text-text-2 hover:text-text'
              }`}
            >
              {m === 'daily' ? 'Daily' : 'History'}
            </button>
          ))}
        </div>

        {mode === 'history' ? (
          /* ── History view ── */
          <div className="bg-surface border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-1">
              <svg className="text-info-text" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <h2 className="text-base font-medium text-text">Site location history</h2>
            </div>
            <p className="text-xs text-text-3 mb-3">{historyEntries.length} record{historyEntries.length === 1 ? '' : 's'} · {formatSGT(histFrom, 'dd MMM yyyy')} – {formatSGT(histTo, 'dd MMM yyyy')}</p>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap items-center mb-4">
              <select value={histUser} onChange={e => setHistUser(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none">
                <option value="">All team</option>
                {designers.map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
              </select>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-text-3">From</span>
                <input type="date" value={histFrom} max={histTo} onChange={e => setHistFrom(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-text-3">To</span>
                <input type="date" value={histTo} min={histFrom} max={today} onChange={e => setHistTo(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none" />
              </div>
              <Button size="sm" onClick={() => { setHistFrom(format(subMonths(new Date(today), 6), 'yyyy-MM-dd')); setHistTo(today); setHistUser('') }}>
                Last 6 months
              </Button>
            </div>

            {historyLoading ? (
              <div className="py-10 text-center text-text-3 text-sm">Loading history…</div>
            ) : historyByDate.length === 0 ? (
              <div className="py-10 text-center text-text-3 text-sm">No site locations recorded in this period</div>
            ) : (
              <div className="flex flex-col gap-4">
                {historyByDate.map(group => (
                  <div key={group.date}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-medium text-text-2">{formatSGT(group.date, 'EEE, dd MMM yyyy')}</span>
                      <span className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-text-3">{group.entries.length} entr{group.entries.length === 1 ? 'y' : 'ies'}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {group.entries.map(e => (
                        <div key={e.id} className="flex items-start gap-3 py-2">
                          <div className="mt-0.5"><Avatar initials={e.user.initials} color={e.user.avatarColor} size="sm" /></div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[12px] text-text-2">{e.user.fullName}</span>
                            <div className="text-[12px] text-text flex items-center gap-1.5">
                              <svg className="text-text-3 shrink-0" style={{ width: 11, height: 11 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
                              <span className="truncate">{e.siteName}{e.siteArea ? ` · ${e.siteArea}` : ''}</span>
                            </div>
                            {e.note && <div className="text-[11px] text-text-3 mt-0.5 truncate">{e.note}</div>}
                          </div>
                          {timeRange(e) && <span className="text-[11px] text-text-3 shrink-0 mt-0.5">{timeRange(e)}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        <>
        {/* ── My site locations today ── */}
        <div className="bg-surface border border-border rounded-lg p-5 mb-4">
          <div className="flex items-center gap-2">
            <svg className="text-info-text" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
            <h2 className="text-base font-medium text-text">My site locations today</h2>
          </div>
          <p className="text-xs text-text-3 mt-0.5 mb-4">{formatSGT(today, 'EEE, dd MMM yyyy')} · {user?.fullName}</p>

          {/* Existing entries */}
          {myEntries.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {myEntries.map(e => (
                <div key={e.id} className="flex items-center gap-3 border border-border rounded-md px-3 py-2 bg-surface-2">
                  <svg className="text-info-text shrink-0" style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-text truncate">{e.siteName}</div>
                    {(e.siteArea || e.note) && (
                      <div className="text-[11px] text-text-2 truncate">{[e.siteArea, e.note].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                  {timeRange(e) && <span className="text-[11px] text-text-3 shrink-0">{timeRange(e)}</span>}
                  <button onClick={() => startEdit(e)} title="Edit" className="text-text-3 hover:text-info-text transition-colors shrink-0">
                    <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button onClick={() => deleteMutation.mutate(e.id)} title="Delete" className="text-text-3 hover:text-danger-text transition-colors shrink-0">
                    <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add / edit form */}
          <div className="border-t border-border pt-3">
            <div className="text-[11px] text-text-2 mb-2">{editingId ? 'Edit site location' : 'Add another site'}</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>Site / project</label>
                <input className={inputCls} placeholder="Seagate W1 Lube Lab"
                  value={form.siteName} onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Site area (optional)</label>
                <input className={inputCls} placeholder="Level 3 AHU room"
                  value={form.siteArea} onChange={e => setForm(f => ({ ...f, siteArea: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '1fr 1fr 2fr' }}>
              <div>
                <label className={labelCls}>Time in</label>
                <input type="time" className={inputCls}
                  value={form.timeIn} onChange={e => setForm(f => ({ ...f, timeIn: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Time out</label>
                <input type="time" className={inputCls}
                  value={form.timeOut} onChange={e => setForm(f => ({ ...f, timeOut: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Note (optional)</label>
                <input className={inputCls} placeholder="Coordinating duct route with contractor"
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {editingId && <Button size="md" onClick={cancelEdit}>Cancel</Button>}
              <Button size="md" variant="primary" onClick={handleSubmit} disabled={!canSubmit || busy}>
                {editingId ? 'Save changes' : '+ Add location'}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Team on site ── */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-medium text-text">
              {boardDate === today ? 'Team on site today' : 'Team on site'}
            </h2>
            <input type="date" value={boardDate} max={today}
              onChange={e => setBoardDate(e.target.value || today)}
              className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none" />
          </div>
          <p className="text-xs text-text-3 mb-3">
            {formatSGT(boardDate, 'EEE, dd MMM yyyy')} · {loggedCount} of {boardUsers.length} logged
          </p>

          {boardLoading ? (
            <div className="py-10 text-center text-text-3 text-sm">Loading…</div>
          ) : boardUsers.length === 0 ? (
            <div className="py-10 text-center text-text-3 text-sm">No team members found</div>
          ) : (
            <div className="divide-y divide-border">
              {boardUsers.map(({ user: u, entries }) => (
                <div key={u.id} className={`flex items-start gap-3 py-2.5 ${entries.length === 0 ? 'opacity-55' : ''}`}>
                  <div className="mt-0.5"><Avatar initials={u.initials} color={u.avatarColor} size="md" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-text">{u.fullName}</div>
                    {entries.length === 0 ? (
                      <div className="text-[11px] text-text-3 mt-0.5">Not updated yet</div>
                    ) : (
                      <div className="mt-0.5 flex flex-col gap-0.5">
                        {entries.map(e => (
                          <div key={e.id} className="text-[11px] text-text-2 flex items-center gap-1.5">
                            <svg className="text-text-3 shrink-0" style={{ width: 11, height: 11 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
                            <span className="truncate">
                              {e.siteName}{e.siteArea ? ` · ${e.siteArea}` : ''}
                              {timeRange(e) && <span className="text-text-3"> · {timeRange(e)}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {entries.length > 1 && (
                    <span className="text-[10px] text-info-text bg-info-bg px-2 py-0.5 rounded-full shrink-0">{entries.length} sites</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}

      </div>
    </div>
  )
}
