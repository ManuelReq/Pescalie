'use server'

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_EMAIL = 'Pescalie <no-responder@pescalie.com>'
const ADMIN_EMAIL = 'piratacastillobar@gmail.com'

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY no configurada, email no enviado.')
    return
  }
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[email] Error al enviar:', res.status, text)
    }
  } catch (err) {
    console.error('[email] Excepción al enviar:', err)
  }
}

type ReservationEmailInfo = {
  clientEmail: string
  clientName: string
  formattedDate: string
  time: string
  partySize: number
}

/** Email al cliente cuando confirma su reserva. */
export async function sendReservationConfirmationEmail(info: ReservationEmailInfo) {
  await sendEmail({
    to: info.clientEmail,
    subject: 'Tu reserva en Pescalie está confirmada',
    html: `
      <div style="font-family: sans-serif; color: #1a1a1a;">
        <h2>¡Reserva confirmada!</h2>
        <p>Hola ${info.clientName},</p>
        <p>Hemos guardado tu mesa con estos datos:</p>
        <ul>
          <li><strong>Fecha:</strong> ${info.formattedDate}</li>
          <li><strong>Hora:</strong> ${info.time}</li>
          <li><strong>Comensales:</strong> ${info.partySize}</li>
        </ul>
        <p>Si necesitas cancelar o modificar tu reserva, contacta con nosotros.</p>
        <p>¡Te esperamos!</p>
      </div>
    `,
  })
}

/** Email al cliente cuando el restaurante cancela su reserva. */
export async function sendReservationCancellationEmail(info: ReservationEmailInfo) {
  await sendEmail({
    to: info.clientEmail,
    subject: 'Tu reserva en Pescalie ha sido cancelada',
    html: `
      <div style="font-family: sans-serif; color: #1a1a1a;">
        <h2>Reserva cancelada</h2>
        <p>Hola ${info.clientName},</p>
        <p>Te confirmamos que tu reserva para el <strong>${info.formattedDate}</strong> a las <strong>${info.time}</strong> (${info.partySize} personas) ha sido cancelada.</p>
        <p>Si no lo esperabas o quieres hacer una nueva reserva, contacta con nosotros.</p>
      </div>
    `,
  })
}

/** Email interno cuando entra una reserva nueva. */
export async function sendNewReservationAdminAlert(info: {
  formattedDate: string
  time: string
  partySize: number
  clientName: string
  clientPhone: string
}) {
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Nueva reserva: ${info.formattedDate} a las ${info.time}`,
    html: `
      <div style="font-family: sans-serif; color: #1a1a1a;">
        <h2>Nueva reserva recibida</h2>
        <ul>
          <li><strong>Fecha:</strong> ${info.formattedDate}</li>
          <li><strong>Hora:</strong> ${info.time}</li>
          <li><strong>Comensales:</strong> ${info.partySize}</li>
          <li><strong>Nombre:</strong> ${info.clientName}</li>
          <li><strong>Teléfono:</strong> ${info.clientPhone}</li>
        </ul>
      </div>
    `,
  })
}
