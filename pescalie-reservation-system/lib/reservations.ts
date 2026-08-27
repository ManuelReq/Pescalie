export const MAX_CAPACITY = 120
export const MAX_PARTY_SIZE = 20

export type ReservationStatus = 'confirmada' | 'cancelada'

export type Reservation = {
  id: string
  reservation_date: string
  reservation_time: string
  party_size: number
  name: string
  phone: string
  email: string
  notes: string | null
  status: ReservationStatus
  created_at: string
}

export type TimeSlot = { value: string; label: string }

export const LUNCH_SLOTS: TimeSlot[] = [
  { value: '13:00', label: '13:00' },
  { value: '13:30', label: '13:30' },
  { value: '14:00', label: '14:00' },
  { value: '14:30', label: '14:30' },
  { value: '15:00', label: '15:00' },
]

export const DINNER_SLOTS: TimeSlot[] = [
  { value: '20:00', label: '20:00' },
  { value: '20:30', label: '20:30' },
  { value: '21:00', label: '21:00' },
  { value: '21:30', label: '21:30' },
  { value: '22:00', label: '22:00' },
]

export const ALL_SLOTS: TimeSlot[] = [...LUNCH_SLOTS, ...DINNER_SLOTS]

/** YYYY-MM-DD for today in local time, used as the min date for the picker. */
export function todayISO(): string {
  const now = new Date()
  const tz = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - tz).toISOString().slice(0, 10)
}

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
