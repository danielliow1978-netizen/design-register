import type { Drawing } from '../types'
import { formatSGT } from './dates'

function escapeCsv(val: unknown): string {
  const str = val == null ? '' : String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportTableToCsv(drawings: Drawing[], filename: string): void {
  const headers = [
    'Drawing No.', 'Title', 'Project', 'Category', 'Discipline',
    'Designer', 'Requestor', 'Request Date', 'Start Date', 'End Date',
    'Duration (days)', 'Completed', 'Delay (days)', 'Status',
    'Late Reason', 'Late Reason Detail', 'Notes',
  ]

  const rows = drawings.map(d => [
    d.drawingNumber,
    d.drawingTitle,
    d.project.code,
    d.category.replace('_', '-'),
    d.discipline.replace('_', ' '),
    d.designer.fullName,
    d.requestor.fullName,
    formatSGT(d.requestDate),
    formatSGT(d.startDate),
    formatSGT(d.endDate),
    d.duration ?? '',
    d.actualCompletionDate ? formatSGT(d.actualCompletionDate) : '',
    d.delay ?? '',
    d.status.replace('_', ' '),
    d.lateReason ? d.lateReason.replace(/_/g, ' ') : '',
    d.lateReasonDetail ?? '',
    d.notes ?? '',
  ].map(escapeCsv).join(','))

  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM for Excel
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
