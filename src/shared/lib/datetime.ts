import { format, formatDistanceToNow, isSameDay, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: vi })
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy HH:mm', { locale: vi })
}

export function formatTime(iso: string): string {
  return format(parseISO(iso), 'HH:mm', { locale: vi })
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: vi })
}

export function isSameCalendarDay(isoA: string, isoB: string): boolean {
  return isSameDay(parseISO(isoA), parseISO(isoB))
}

export function todayIso(): string {
  return new Date().toISOString()
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = parseISO(fromIso).getTime()
  const to = parseISO(toIso).getTime()
  return Math.round((to - from) / (1000 * 60 * 60 * 24))
}
