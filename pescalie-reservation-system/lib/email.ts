'use server'

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_EMAIL = 'Pescalie <no-responder@pescalie.com>'
const ADMIN_EMAIL = 'cofradiacastilloelpirata@gmail.com'
const GOOGLE_REVIEW_LINK = 'https://share.google/8nZbNldDVabWGZsxk'
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
  console.log('[email] Intentando enviar a:', to, '| asunto:', subject, '| apiKey presente:', !!apiKey)
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
    const text = await res.text()

  console.log('[email] Resend respuesta:', {
    status: res.status,
    body: text,
    to,
  })
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
      <div style="font-family: sans-serif; color: #1a1a1a; line-height: 1.6;">
        <h2>¡Reserva confirmada!</h2>
        <p>Estimado/a ${info.clientName},</p>
        <p>Le confirmamos que su mesa ha quedado reservada con los siguientes datos:</p>
        <ul>
          <li><strong>Fecha:</strong> ${info.formattedDate}</li>
          <li><strong>Hora:</strong> ${info.time}</li>
          <li><strong>Comensales:</strong> ${info.partySize}</li>
        </ul>
        <p>Será un placer atenderle. Como muestra de agradecimiento, si comparte su experiencia con una reseña en Google tras su visita, le invitamos a un chupito de ron miel de la casa.</p>
        <p>
          <a href="${GOOGLE_REVIEW_LINK}" style="color: #0a7d5f;">Dejar una reseña en Google</a>
        </p>
        <p>Si necesita cancelar o modificar su reserva, no dude en contactar con nosotros.</p>
        <p>Un cordial saludo,<br>Pescalie</p>
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


/** Email al cliente cuando solicita la terraza superior (aún no confirmado). */
export async function sendTerraceRequestClientEmail(info: {
  clientEmail: string
  clientName: string
  formattedDate: string
  time: string
  guestCount: number
}) {
  await sendEmail({
    to: info.clientEmail,
    subject: 'Hemos recibido tu solicitud para la Terraza Superior',
    html: `
      <div style="font-family: sans-serif; color: #1a1a1a; line-height: 1.6;">
        <h2>Solicitud recibida</h2>
        <p>Estimado/a ${info.clientName},</p>
        <p>Hemos recibido su solicitud para celebrar un evento especial en nuestra Terraza Superior:</p>
        <ul>
          <li><strong>Fecha:</strong> ${info.formattedDate}</li>
          <li><strong>Hora:</strong> ${info.time}</li>
          <li><strong>Invitados:</strong> ${info.guestCount}</li>
        </ul>
        <p>Esta zona requiere confirmación de disponibilidad por nuestra parte. Nos pondremos en contacto con usted en breve para confirmar los detalles.</p>
        <p>Un cordial saludo,<br>Pescalie</p>
      </div>
    `,
  })
}

/** Email interno cuando llega una solicitud de terraza superior. */
export async function sendTerraceRequestAdminAlert(info: {
  formattedDate: string
  time: string
  guestCount: number
  clientName: string
  clientPhone: string
  clientEmail: string
  notes: string
}) {
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Nueva solicitud Terraza Superior: ${info.formattedDate} a las ${info.time}`,
    html: `
      <div style="font-family: sans-serif; color: #1a1a1a;">
        <h2>Solicitud de evento especial — Terraza Superior</h2>
        <p>Recuerda contactar con el cliente para confirmar disponibilidad.</p>
        <ul>
          <li><strong>Fecha:</strong> ${info.formattedDate}</li>
          <li><strong>Hora:</strong> ${info.time}</li>
          <li><strong>Invitados:</strong> ${info.guestCount}</li>
          <li><strong>Nombre:</strong> ${info.clientName}</li>
          <li><strong>Teléfono:</strong> ${info.clientPhone}</li>
          <li><strong>Email:</strong> ${info.clientEmail}</li>
          ${info.notes ? `<li><strong>Notas:</strong> ${info.notes}</li>` : ''}
        </ul>
      </div>
    `,
  })
}
