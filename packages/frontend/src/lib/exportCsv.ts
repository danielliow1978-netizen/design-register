import type { Drawing } from '../types'
export function exportTableToCsv(drawings: Drawing[], filename: string): void {
  console.log('exportTableToCsv', drawings.length, filename)
}
