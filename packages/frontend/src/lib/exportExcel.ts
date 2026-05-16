import type { Drawing } from '../types'
export function exportTableToExcel(drawings: Drawing[], filename: string): void {
  console.log('exportTableToExcel', drawings.length, filename)
}
