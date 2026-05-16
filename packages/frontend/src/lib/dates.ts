import { format, differenceInCalendarDays, isAfter, addDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const SGT = 'Asia/Singapore'

export function toSGT(date: Date | string): Date {
  return toZonedTime(new Date(date), SGT)
}

export function formatSGT(date: Date | string, fmt = 'dd MMM yyyy'): string {
  return format(toSGT(date), fmt)
}

export function formatSGTShort(date: Date | string): string {
  return format(toSGT(date), 'dd MMM')
}

export function diffDays(a: Date | string, b: Date | string): number {
  return differenceInCalendarDays(new Date(a), new Date(b))
}

export function isOverdue(endDate: string, completionDate?: string): boolean {
  if (completionDate) return false
  return isAfter(new Date(), new Date(endDate))
}

export function isUpcomingDue(endDate: string, withinDays = 3): boolean {
  const end = new Date(endDate)
  const now = new Date()
  return !isAfter(now, end) && !isAfter(end, addDays(now, withinDays))
}

export function todaySGT(): string {
  return format(toSGT(new Date()), 'yyyy-MM-dd')
}
