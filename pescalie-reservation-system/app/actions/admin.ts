'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { formatLongDate, type ReservationStatus } from '@/lib/reservations'
import { sendReservationCancellationEmail } from '@/lib/email'

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}

export type UpdateStatusResult = { ok: true } | { ok: false; message: string }

export async function updateReservationStatus(
  id: string,
  status: ReservationStatus,
): Promise<UpdateStatusResult> {
  if (status !== 'confirmada' && status !== 'cancelada') {
    return { ok: false, message: 'Estado no válido.' }
  }

  const supabase = await createClient()

  // Only authenticated staff can reach here (RLS + middleware enforce it).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const { data, error } = await supabase
    .from('reservations')
    .update({ status })
    .eq('id', id)
    .select('name, email, reservation_date, reservation_time, party_size')
    .single()

  if (error) {
    console.error('[v0] updateReservationStatus error:', error.message)
    return { ok: false, message: 'No se pudo actualizar el estado.' }
  }

  // Si se acaba de cancelar, avisamos al cliente por email.
  if (status === 'cancelada' && data) {
    await sendReservationCancellationEmail({
      clientEmail: data.email,
      clientName: data.name,
      formattedDate: formatLongDate(data.reservation_date),
      time: data.reservation_time,
      partySize: data.party_size,
    })
  }

  revalidatePath('/admin')
  return { ok: true }
}
