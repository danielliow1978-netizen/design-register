import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Drawing, PdfFormat } from '../types'
import { formatSGT } from './dates'

function getPageDimensions(format: PdfFormat = 'a4-landscape'): { orientation: 'p' | 'l'; format: string } {
  switch (format) {
    case 'a4-portrait':    return { orientation: 'p', format: 'a4' }
    case 'letter-landscape': return { orientation: 'l', format: 'letter' }
    case 'a4-landscape':
    default:              return { orientation: 'l', format: 'a4' }
  }
}

export function exportTableToPdf(drawings: Drawing[], filename: string, pdfDefault?: string): void {
  const { orientation, format } = getPageDimensions(pdfDefault as PdfFormat)
  const doc = new jsPDF({ orientation, format, unit: 'mm' })

  // Header
  doc.setFontSize(14)
  doc.setTextColor(44, 44, 42)
  doc.text('Design Register', 14, 16)

  doc.setFontSize(9)
  doc.setTextColor(95, 94, 90)
  doc.text(`Exported ${formatSGT(new Date(), 'dd MMM yyyy HH:mm')} SGT · ${drawings.length} drawing${drawings.length !== 1 ? 's' : ''}`, 14, 23)

  autoTable(doc, {
    startY: 28,
    head: [[
      'Drawing no.', 'Title', 'Project', 'Cat.', 'Discipline',
      'Request', 'Start', 'End', 'Duration', 'Completed', 'Delay', 'Status',
    ]],
    body: drawings.map(d => [
      d.drawingNumber,
      d.drawingTitle,
      d.project.code,
      d.category.replace('_', '-'),
      d.discipline.replace('_', ' '),
      formatSGT(d.requestDate, 'dd MMM'),
      formatSGT(d.startDate, 'dd MMM'),
      formatSGT(d.endDate, 'dd MMM'),
      d.duration != null ? `${d.duration}d` : '—',
      d.actualCompletionDate ? formatSGT(d.actualCompletionDate, 'dd MMM') : '—',
      d.delay != null ? (d.delay > 0 ? `+${d.delay}d` : `${d.delay}d`) : '—',
      d.status.replace('_', ' '),
    ]),
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [44, 44, 42],
    },
    headStyles: {
      fillColor: [230, 241, 251],
      textColor: [12, 68, 124],
      fontSize: 7,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [243, 242, 236],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28 },
      1: { cellWidth: 40 },
      8: { halign: 'center', fillColor: [230, 241, 251], textColor: [12, 68, 124] },
    },
    didParseCell: (data) => {
      // Color-code status column
      if (data.column.index === 11) {
        const val = String(data.cell.raw)
        if (val.includes('OVERDUE') || val.includes('COMPLETED LATE')) {
          data.cell.styles.textColor = [121, 31, 31]
          data.cell.styles.fillColor = [252, 235, 235]
        } else if (val.includes('COMPLETED')) {
          data.cell.styles.textColor = [39, 80, 10]
          data.cell.styles.fillColor = [234, 243, 222]
        } else {
          data.cell.styles.textColor = [12, 68, 124]
          data.cell.styles.fillColor = [230, 241, 251]
        }
      }
      // Color delay column
      if (data.column.index === 10 && data.section === 'body') {
        const val = String(data.cell.raw)
        if (val.startsWith('+')) {
          data.cell.styles.textColor = [121, 31, 31]
          data.cell.styles.fillColor = [252, 235, 235]
        } else if (val.startsWith('-')) {
          data.cell.styles.textColor = [39, 80, 10]
          data.cell.styles.fillColor = [234, 243, 222]
        }
      }
    },
    margin: { left: 14, right: 14 },
  })

  // Footer with page numbers
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(136, 135, 128)
    const pageWidth = doc.internal.pageSize.getWidth()
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' })
    doc.text('Design Register — Confidential', 14, doc.internal.pageSize.getHeight() - 8)
  }

  doc.save(`${filename}.pdf`)
}

export function exportDashboardToPdf(elementId: string, filename: string): void {
  // Captures HTML element as image in PDF — used by ProductivityPage
  const el = document.getElementById(elementId)
  if (!el) return

  import('html2canvas').then(({ default: html2canvas }) => {
    html2canvas(el, { scale: 2, backgroundColor: '#FAFAF7' }).then(canvas => {
      const imgData = canvas.toDataURL('image/png')
      const doc = new jsPDF({ orientation: 'l', format: 'a4', unit: 'mm' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height) * 0.9
      const w = canvas.width * ratio
      const h = canvas.height * ratio
      doc.addImage(imgData, 'PNG', (pageWidth - w) / 2, 10, w, h)
      doc.save(`${filename}.pdf`)
    })
  })
}
