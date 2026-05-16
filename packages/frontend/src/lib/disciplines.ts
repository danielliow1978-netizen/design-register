export const DISCIPLINES = [
  'STRUCTURAL',
  'ARCHITECTURAL',
  'MECHANICAL_WET',
  'MECHANICAL_DRY',
  'PROCESS_WET',
  'PROCESS_DRY',
  'ELECTRICAL',
  'CONTROL_AND_INSTRUMENTATION',
  'FIRE_PROTECTION',
  'PLUMBING_AND_SANITARY',
] as const

export const DISCIPLINE_LABELS: Record<string, string> = {
  STRUCTURAL: 'Structural',
  ARCHITECTURAL: 'Architectural',
  MECHANICAL_WET: 'Mechanical (Wet)',
  MECHANICAL_DRY: 'Mechanical (Dry)',
  PROCESS_WET: 'Process (Wet)',
  PROCESS_DRY: 'Process (Dry)',
  ELECTRICAL: 'Electrical',
  CONTROL_AND_INSTRUMENTATION: 'Control & Instrumentation',
  FIRE_PROTECTION: 'Fire Protection',
  PLUMBING_AND_SANITARY: 'Plumbing & Sanitary',
  // Legacy values (backward compat for existing drawings)
  MECHANICAL: 'Mechanical',
  ELV: 'ELV',
  PLUMBING: 'Plumbing',
}

export function formatDiscipline(value: string): string {
  return DISCIPLINE_LABELS[value] ?? value.replace(/_/g, ' ')
}
