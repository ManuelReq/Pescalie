'use server'

import { createClient } from '@/lib/supabase/server'
import { getSlotsForDate, MAX_PARTY_SIZE } from '@/lib/reservations'

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
      message: `El número de comensales debe estar entre 1 y ${MAX_PARTY_SIZE}.`,
    }
  }

  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, message: 'Selecciona una fecha válida.' }
  }

  // Validate that the selected time is valid for the selected date.
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
      const remaining = result.remaining ?? 0

      return {
        ok: false,
        message:
          remaining > 0
            ? `Solo quedan ${remaining} plazas en ese turno. Reduce los comensales o elige otro horario.`
            : 'Ese turno está completo. Por favor elige otro horario.',
      }
    }

    return {
      ok: false,
      message: 'No se pudo completar la reserva. Revisa los datos.',
    }
  }

  return {
    ok: true,
    remaining: result.remaining ?? 0,
  }
}
