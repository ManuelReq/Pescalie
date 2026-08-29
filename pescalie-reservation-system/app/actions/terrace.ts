'use server'

import { createClient } from '@/lib/supabase/server'
import { getSlotsForDate, formatLongDate } from '@/lib/reservations'
import { MAX_TERRACE_GUESTS, type TerraceRequestInput } from '@/lib/terrace'
import {
  sendTerraceRequestClientEmail,
  sendTerraceRequestAdminAlert,
} from '@/lib/email'

export type CreateTerraceRequestResult =
  | { ok: true }
  | { ok: false; message: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function createTerraceRequestAction(
  input: TerraceRequestInput,
): Promise<CreateTerraceRequestResult> {
  const name = input.name?.trim() ?? ''
  const phone = input.phone?.trim() ?? ''
  const email = input.email?.trim() ?? ''
  const notes = input.notes?.trim() ?? ''
  const guestCount = Number(input.guestCount)

  if (!name || name.length < 2) {
    return { ok: false, message: 'Introduce un nombre válido.' }
  }
  if (!/^[0-9+()\s-]{6,20}$/.test(phone)) {
    return { ok: false, message: 'Introduce un teléfono válido.' }
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: 'Introduce un email válido.' }
  }
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > MAX_TERRACE_GUESTS) {
    return {
      ok: false,
      message: `El número de invitados debe estar entre 1 y ${MAX_TERRACE_GUESTS}.`,
    }
  }
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, message: 'Selecciona una fecha válida.' }
  }

  const validSlots = getSlotsForDate(input.date)
  if (!validSlots.some((s) => s.value === input.time)) {
    return { ok: false, message: 'Selecciona una hora válida.' }
  }

  if (input.date < new Date().toISOString().slice(0, 10)) {
    return { ok: false, message: 'No puedes solicitar una fecha pasada.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('terrace_requests').insert({
    event_date: input.date,
    event_time: input.time,
    guest_count: guestCount,
    name,
    phone,
    email,
    notes: notes || null,
  })

  if (error) {
    console.error('[v0] terrace_requests insert error:', error.message)
    return { ok: false, message: 'No se pudo enviar la solicitud. Inténtalo de nuevo.' }
  }

  const formattedDate = formatLongDate(input.date)
  await Promise.all([
    sendTerraceRequestClientEmail({
      clientEmail: email,
      clientName: name,
      formattedDate,
      time: input.time,
      guestCount,
    }),
    sendTerraceRequestAdminAlert({
      formattedDate,
      time: input.time,
      guestCount,
      clientName: name,
      clientPhone: phone,
      clientEmail: email,
      notes,
    }),
  ])

  return { ok: true }
}
