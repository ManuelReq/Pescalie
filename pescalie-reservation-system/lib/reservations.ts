import type { SupabaseClient } from '@supabase/supabase-js'

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

export type RestaurantSettings = {
  maxCapacity: number
  serviceDurationMinutes: number
  kitchenOpenTime: string
  kitchenCloseTime: string
  weekendOpenTime: string
}

/**
 * Valores de reserva SOLO por si Supabase no responde (la web nunca debe
 * quedarse sin horario). La fuente de verdad real es la tabla
 * restaurant_settings en Supabase: para cambiar aforo u horarios se edita
 * ahí, no aquí.
 */
export const DEFAULT_SETTINGS: RestaurantSettings = {
  maxCapacity: 120,
  serviceDurationMinutes: 90,
  kitchenOpenTime: '12:00',
  kitchenCloseTime: '23:00',
  weekendOpenTime: '17:00',
}

/** Lee la configuración real (aforo, horarios) desde Supabase. */
export async function fetchRestaurantSettings(
  supabase: SupabaseClient,
): Promise<RestaurantSettings> {
  const { data, error } = await supabase.from('restaurant_settings').select('*').single()
  if (error || !data) return DEFAULT_SETTINGS
  return {
    maxCapacity: data.max_capacity ?? DEFAULT_SETTINGS.maxCapacity,
    serviceDurationMinutes:
      data.service_duration_minutes ?? DEFAULT_SETTINGS.serviceDurationMinutes,
    kitchenOpenTime: data.kitchen_open_time ?? DEFAULT_SETTINGS.kitchenOpenTime,
    kitchenCloseTime: data.kitchen_close_time ?? DEFAULT_SETTINGS.kitchenCloseTime,
    weekendOpenTime: data.weekend_open_time ?? DEFAULT_SETTINGS.weekendOpenTime,
  }
}

/** Sábado o domingo, a partir de una fecha YYYY-MM-DD. */
export function isWeekend(dateISO: string): boolean {
  const [y, m, d] = dateISO.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay() // 0 = domingo, 6 = sábado
  return day === 0 || day === 6
}

/**
 * Genera las franjas de media hora disponibles para una fecha, respetando
 * el horario de fin de semana (desde weekendOpenTime) o el horario normal
 * (desde kitchenOpenTime), hasta kitchenCloseTime. Servicio continuo, sin
 * hueco entre comida y cena.
 */
export function generateSlots(dateISO: string, settings: RestaurantSettings): TimeSlot[] {
  const openTime = isWeekend(dateISO) ? settings.weekendOpenTime : settings.kitchenOpenTime
  const [openH, openM] = openTime.split(':').map(Number)
  const [closeH, closeM] = settings.kitchenCloseTime.split(':').map(Number)

  const slots: TimeSlot[] = []
  let minutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  while (minutes <= closeMinutes) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    slots.push({ value, label: value })
    minutes += 30
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
