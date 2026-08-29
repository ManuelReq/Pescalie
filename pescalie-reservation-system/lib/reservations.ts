export const MAX_PARTY_SIZE = 4
export const MAX_TABLES = 10
export const RESERVATION_DURATION_MINUTES = 150

export const WHATSAPP_NUMBER = '34649940831' // formato internacional para el enlace wa.me
export const WHATSAPP_DISPLAY = '649 94 08 31'

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

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

/**
 * Horario de la cocina.
 * Entre semana: servicio continuo de 12:00 a 23:00.
 * Fin de semana (sábado y domingo): solo desde las 17:00 hasta las 23:00.
 */
const WEEKDAY_OPEN = '12:00'
const WEEKEND_OPEN = '17:00'
const CLOSE_TIME = '23:00'
const SLOT_STEP_MINUTES = 30

function isWeekend(dateISO: string): boolean {
  const [y, m, d] = dateISO.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay() // 0 = domingo, 6 = sábado
  return day === 0 || day === 6
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function toHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function currentMinutesLocal(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

/**
 * Genera los turnos disponibles para una fecha concreta según el horario.
 * Si la fecha es hoy, oculta las horas que ya han empezado o pasado.
 */
export function getSlotsForDate(dateISO: string): TimeSlot[] {
  const open = isWeekend(dateISO) ? WEEKEND_OPEN : WEEKDAY_OPEN
  const start = toMinutes(open)
  const end = toMinutes(CLOSE_TIME)
  const isToday = dateISO === todayISO()
  const nowMinutes = isToday ? currentMinutesLocal() : -1

  const slots: TimeSlot[] = []
  for (let t = start; t <= end; t += SLOT_STEP_MINUTES) {
    if (isToday && t <= nowMinutes) continue
    const value = toHHMM(t)
    slots.push({ value, label: value })
  }
  return slots
}

/** YYYY-MM-DD para hoy en hora local, usado como mínimo del selector de fecha. */
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
