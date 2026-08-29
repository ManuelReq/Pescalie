'use server'

import { createClient } from '@/lib/supabase/server'
import { getSlotsForDate, MAX_PARTY_SIZE, formatLongDate } from '@/lib/reservations'
import { sendReservationConfirmationEmail, sendNewReservationAdminAlert } from '@/lib/email'

export type CreateReservationInput = {
  date: string
  time: string
  partySize: number
  name: string
  phone: string
  email: string
  notes?: string
}

export type CreateReservationResult =
  | { ok: true; remaining: number }
  | { ok: false; message: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function createReservationAction(
  input: CreateReservationInput,
): Promise<CreateReservationResult> {
  // --- Server-side validation (never trust the client) ---
  const name = input.name?.trim() ?? ''
  const phone = input.phone?.trim() ?? ''
  const email = input.email?.trim() ?? ''
  const notes = input.notes?.trim() ?? ''
  const partySize = Number(input.partySize)

  if (!name || name.length < 2) {
    return { ok: false, message: 'Introduce un nombre válido.' }
  }
  if (!/^[0-9+()\s-]{6,20}$/.test(phone)) {
    return { ok: false, message: 'Introduce un teléfono válido.' }
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: 'Introduce un email válido.' }
  }
  if (
    !Number.isInteger(partySize) ||
    partySize < 1 ||
    partySize > MAX_PARTY_SIZE
  ) {
    return {
      ok: false,
      message: `El número de comensales debe estar entre 1 y ${MAX_PARTY_SIZE}. Para grupos más grandes, escríbenos por WhatsApp.`,
    }
  }
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, message: 'Selecciona una fecha válida.' }
  }

  const validSlots = getSlotsForDate(input.date)
  if (!validSlots.some((s) => s.value === input.time)) {
    return { ok: false, message: 'Selecciona un turno válido.' }
  }

  if (input.date < new Date().toISOString().slice(0, 10)) {
    return { ok: false, message: 'No puedes reservar en una fecha pasada.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_reservation', {
    p_date: input.date,
    p_time: input.time,
    p_party_size: partySize,
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_notes: notes,
  })

  if (error) {
    console.error('[v0] create_reservation error:', error.message)
    return {
      ok: false,
      message:
        'No se pudo completar la reserva. Comprueba que el esquema esté instalado e inténtalo de nuevo.',
    }
  }

  const result = data as {
    ok: boolean
    remaining?: number
    error?: string
  }

  if (!result?.ok) {
    if (result?.error === 'no_capacity') {
      return {
        ok: false,
        message: 'Ese horario está completo. Por favor, elige otro horario.',
      }
    }
    if (result?.error === 'slot_not_allowed') {
      return {
        ok: false,
        message: 'Ese horario ya no está disponible. Elige otro turno.',
      }
    }
    if (result?.error === 'party_size_invalid') {
      return {
        ok: false,
        message: `El número de comensales debe estar entre 1 y ${MAX_PARTY_SIZE}.`,
      }
    }
    if (result?.error === 'missing_fields') {
      return {
        ok: false,
        message: 'Faltan datos obligatorios. Revisa el formulario.',
      }
    }
    return {
      ok: false,
      message: 'No se pudo completar la reserva. Revisa los datos.',
    }
  }

  // Reserva creada con éxito: enviamos los emails (si fallan, no rompen la reserva).
  const formattedDate = formatLongDate(input.date)
  await Promise.all([
    sendReservationConfirmationEmail({
      clientEmail: email,
      clientName: name,
      formattedDate,
      time: input.time,
      partySize,
    }),
    sendNewReservationAdminAlert({
      formattedDate,
      time: input.time,
      partySize,
      clientName: name,
      clientPhone: phone,
    }),
  ])

  return {
    ok: true,
    remaining: result.remaining ?? 0,
  }
}
