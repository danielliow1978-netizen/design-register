import type { Drawing } from '../types'
export function exportTableToPdf(drawings: Drawing[], filename: string, pdfDefault?: string): void {
  console.log('exportTableToPdf', drawings.length, filename, pdfDefault)
}
export function exportDashboardToPdf(elementId: string, filename: string): void {
  console.log('exportDashboardToPdf', elementId, filename)
}
