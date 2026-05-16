import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { TopBar } from '../components/layout/TopBar'
import { ExportMenu } from '../components/ui/ExportMenu'
import { Pill, categoryPill } from '../components/ui/Pill'
import { dashboardApi } from '../api/dashboard'
import { usersApi } from '../api/users'
import { formatSGT } from '../lib/dates'
import type { DrawingCategory } from '../types'

const CATEGORY_COLORS: Record<string, string> = {
  TENDER: '#BA7517',
  SHOP: '#633806',
  CONSTRUCTION: '#0C447C',
  AS_BUILT: '#888780',
}

function KpiCard({ label, value, unit = '', color = 'info', sublabel }: {
  label: string
  value: number | null | undefined
  unit?: string
  color?: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  sublabel?: string
}) {
  const COLOR_MAP = {
    info:    { bg: 'bg-info-bg', text: 'text-info-text' },
    success: { bg: 'bg-success-bg', text: 'text-success-text' },
    warning: { bg: 'bg-warning-bg', text: 'text-warning-text' },
    danger:  { bg: 'bg-danger-bg', text: 'text-danger-text' },
    neutral: { bg: 'bg-surface-2', text: 'text-text-2' },
  }
  const { bg, text } = COLOR_MAP[color]
  return (
    <div className={`${bg} rounded-lg p-4 flex flex-col`}>
      <div className={`text-3xl font-semibold ${text} mt-1`}>
        {value == null ? '—' : `${value}${unit}`}
      </div>
      <div className="text-[11px] text-text-2 mt-1 font-medium uppercase tracking-wide">{label}</div>
      {sublabel && <div className="text-[10px] text-text-3 mt-1">{sublabel}</div>}
    </div>
  )
}

export default function ProductivityPage() {
  const [selectedDesignerId, setSelectedDesignerId] = useState<string>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const chartRef = useRef<HTMLDivElement>(null)

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const designers = users.filter(u => ['DESIGNER', 'SENIOR_DESIGNER', 'DESIGN_MANAGER'].includes(u.role))

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', { designerId: selectedDesignerId, from, to }],
    queryFn: () => dashboardApi.team({
      designerId: selectedDesignerId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
  })

  const handleExportPng = async () => {
    if (!chartRef.current) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: null })
      const link = document.createElement('a')
      link.download = `ProductivityCharts_${formatSGT(new Date(), 'yyyy-MM-dd')}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('PNG export failed:', err)
    }
  }

  const handleExportCsv = () => {
    if (!data?.perDrawing.length) return
    const rows = data.perDrawing.map(d =>
      [d.drawingNumber, d.drawingTitle, d.category, d.designer.fullName, formatSGT(d.endDate), d.duration ?? '', d.delay ?? ''].join(',')
    )
    const csv = ['Drawing No,Title,Category,Designer,End Date,Duration (d),Delay (d)', ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Productivity_${formatSGT(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[1280px] mx-auto px-6 py-6">
        <TopBar />

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <select
            value={selectedDesignerId}
            onChange={e => setSelectedDesignerId(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none focus:border-info-border"
          >
            <option value="">All designers</option>
            {designers.map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
          </select>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-surface text-text focus:outline-none" />
          <div className="ml-auto">
            <ExportMenu onPng={handleExportPng} onCsv={handleExportCsv} />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-text-3">Loading dashboard…</div>
        ) : (
          <div ref={chartRef}>
            {/* 5 KPI cards */}
            <div className="grid grid-cols-5 gap-3 mb-6">
              <KpiCard label="Completed" value={data?.kpis.completedCount} color="info" />
              <KpiCard label="On-time %" value={data?.kpis.onTimePct} unit="%" color={(data?.kpis.onTimePct ?? 0) >= 80 ? 'success' : 'warning'} />
              <KpiCard label="Avg duration" value={data?.kpis.avgDuration} unit="d" color="neutral" sublabel="calendar days" />
              <KpiCard label="Active workload" value={data?.kpis.activeWorkload} color={(data?.kpis.activeWorkload ?? 0) > 20 ? 'warning' : 'info'} />
              <KpiCard label="Avg delay" value={data?.kpis.avgDelay} unit="d" color={(data?.kpis.avgDelay ?? 0) > 0 ? 'danger' : 'success'} sublabel="late completions only" />
            </div>

            {/* Weekly trend chart */}
            <div className="bg-surface border border-border rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-text mb-4">Weekly completion trend (last 12 weeks)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data?.weeklyTrend || []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="completed" stroke="#0C447C" strokeWidth={2} dot={{ r: 3 }} name="Completed" />
                  <Line type="monotone" dataKey="onTime" stroke="#27500A" strokeWidth={2} dot={{ r: 3 }} name="On-time" />
                  <Line type="monotone" dataKey="late" stroke="#791F1F" strokeWidth={2} dot={{ r: 3 }} name="Late" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Sub-charts row */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* On-time vs Late bar */}
              <div className="bg-surface border border-border rounded-lg p-4">
                <h3 className="text-sm font-medium text-text mb-4">On-time vs late (last 12 weeks)</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data?.weeklyTrend || []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'var(--text-3)' }} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--text-3)' }} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="onTime" stackId="a" fill="#27500A" name="On-time" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="late" stackId="a" fill="#791F1F" name="Late" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Category breakdown pie */}
              <div className="bg-surface border border-border rounded-lg p-4">
                <h3 className="text-sm font-medium text-text mb-4">Drawings by category</h3>
                {data?.categoryBreakdown.length ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={data.categoryBreakdown}
                        dataKey="count"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label={({ category, percent }: { category: string; percent: number }) => `${category} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {data.categoryBreakdown.map((entry) => (
                          <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || '#888'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-text-3 text-sm">No data</div>
                )}
              </div>
            </div>

            {/* Per-drawing table */}
            <div className="bg-surface border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-text mb-3">Per-drawing analysis (completed)</h3>
              {!data?.perDrawing.length ? (
                <div className="py-8 text-center text-text-3 text-sm">No completed drawings yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-border">
                        {['Drawing', 'Title', 'Cat.', 'Designer', 'End date', 'Duration', 'Delay', 'Late reason'].map(h => (
                          <th key={h} className="px-2.5 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-text-3 bg-surface-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.perDrawing.map(d => {
                        const delay = d.delay ?? null
                        return (
                          <tr key={d.id} className="border-b border-border hover:bg-surface-2/50">
                            <td className="px-2.5 py-2 font-medium text-text whitespace-nowrap">{d.drawingNumber}</td>
                            <td className="px-2.5 py-2 text-text-2 max-w-[200px] truncate">{d.drawingTitle}</td>
                            <td className="px-2.5 py-2">{categoryPill(d.category as DrawingCategory)}</td>
                            <td className="px-2.5 py-2 text-text-2">{d.designer.fullName}</td>
                            <td className="px-2.5 py-2 text-text-2 whitespace-nowrap">{formatSGT(d.endDate)}</td>
                            <td className="px-2.5 py-2 text-center text-info-text bg-info-bg font-medium">{d.duration}d</td>
                            <td className={`px-2.5 py-2 text-center font-medium whitespace-nowrap ${delay === null ? 'text-text-3' : delay > 0 ? 'bg-danger-bg text-danger-text' : 'bg-success-bg text-success-text'}`}>
                              {delay === null ? '—' : delay > 0 ? `+${delay}d` : `${delay}d`}
                            </td>
                            <td className="px-2.5 py-2">
                              {d.lateReason ? (
                                <Pill variant="warning">{d.lateReason.replace(/_/g, ' ')}</Pill>
                              ) : (
                                <span className="text-text-3">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
