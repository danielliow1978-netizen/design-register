import * as XLSX from 'xlsx'
import type { Drawing } from '../types'
import { formatSGT } from './dates'

export function exportTableToExcel(drawings: Drawing[], filename: string): void {
  const rows = drawings.map(d => ({
    'Drawing No.': d.drawingNumber,
    'Title': d.drawingTitle,
    'Project': d.project.code,
    'Category': d.category.replace('_', '-'),
    'Discipline': d.discipline.replace('_', ' '),
    'Designer': d.designer.fullName,
    'Requestor': d.requestor.fullName,
    'Request Date': formatSGT(d.requestDate),
    'Start Date': formatSGT(d.startDate),
    'End Date': formatSGT(d.endDate),
    'Duration (days)': d.duration ?? '',
    'Completed': d.actualCompletionDate ? formatSGT(d.actualCompletionDate) : '',
    'Delay (days)': d.delay ?? '',
    'Status': d.status.replace('_', ' '),
    'Late Reason': d.lateReason ? d.lateReason.replace(/_/g, ' ') : '',
    'Late Reason Detail': d.lateReasonDetail ?? '',
    'Notes': d.notes ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 22 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 24 },
    { wch: 30 }, { wch: 30 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Design Register')

  // Add a summary sheet
  const summaryData = [
    ['Design Register Export'],
    ['Exported:', formatSGT(new Date(), 'dd MMM yyyy HH:mm') + ' SGT'],
    ['Total drawings:', drawings.length],
    ['In Progress:', drawings.filter(d => d.status === 'IN_PROGRESS').length],
    ['Completed:', drawings.filter(d => d.status === 'COMPLETED').length],
    ['Overdue:', drawings.filter(d => d.status === 'OVERDUE').length],
    [''],
    ['On-time %:', (() => {
      const completed = drawings.filter(d => d.status === 'COMPLETED')
      if (!completed.length) return 'N/A'
      const onTime = completed.filter(d => d.delay !== null && (d.delay ?? 0) <= 0).length
      return `${Math.round(onTime / completed.length * 100)}%`
    })()],
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  XLSX.writeFile(wb, `${filename}.xlsx`)
}
