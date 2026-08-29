'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createTerraceRequestAction } from '@/app/actions/terrace'
import { getSlotsForDate, todayISO } from '@/lib/reservations'
import { TERRACE_MIN_CONSUMPTION, MAX_TERRACE_GUESTS } from '@/lib/terrace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export function TerraceRequestForm() {
  const today = useMemo(() => todayISO(), [])
  const [open, setOpen] = useState(false)

  const [date, setDate] = useState(today)
  const [time, setTime] = useState('')
  const [guestCount, setGuestCount] = useState(10)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [accepted, setAccepted] = useState(false)

  const slots = useMemo(() => getSlotsForDate(date), [date])
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)

  const canSubmit =
    !!date &&
    !!time &&
    guestCount >= 1 &&
    guestCount <= MAX_TERRACE_GUESTS &&
    name.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    accepted &&
    !isPending

  // Antes era un onSubmit de <form>. Al vivir dentro del formulario principal
  // de reservas, no puede haber un <form> anidado dentro de otro <form>
  // (no es válido en HTML), así que este botón dispara el envío directamente
  // con onClick en lugar de depender de un submit nativo.
  function handleSend(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (!canSubmit) return
    startTransition(async () => {
      const result = await createTerraceRequestAction({
        date,
        time,
        guestCount,
        name,
        phone,
        email,
        notes,
      })
      if (result.ok) {
        setSent(true)
        toast.success('Solicitud enviada', {
          description: 'Nos pondremos en contacto contigo para confirmar la disponibilidad.',
        })
      } else {
        toast.error('No se pudo enviar', { description: result.message })
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left transition-colors hover:bg-amber-500/15"
      >
        <span className="text-sm font-semibold text-amber-600">
          ¿Evento especial? Reserva la Terraza Superior
        </span>
        <span className="text-xs text-muted-foreground">
          Zona exclusiva para cumpleaños y celebraciones. Consumición mínima de{' '}
          {TERRACE_MIN_CONSUMPTION}€. Sujeto a confirmación de disponibilidad.
        </span>
      </button>
    )
  }

  if (sent) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm">
        <p className="font-medium text-amber-700">Solicitud enviada</p>
        <p className="mt-1 text-muted-foreground">
          Hemos recibido tu solicitud para la Terraza Superior. Nos pondremos en contacto
          contigo en breve para confirmar la disponibilidad.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-amber-700">Terraza Superior — Evento especial</h3>
          <p className="text-xs text-muted-foreground">
            Consumición mínima de {TERRACE_MIN_CONSUMPTION}€. Esta solicitud no se confirma
            automáticamente: te contactaremos para cerrar los detalles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground underline"
        >
          Cerrar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="terrace-date">Fecha</Label>
          <Input
            id="terrace-date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setTime('')
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="terrace-time">Hora</Label>
          <select
            id="terrace-time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecciona una hora</option>
            {slots.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="terrace-guests">Número de invitados</Label>
        <Input
          id="terrace-guests"
          type="number"
          min={1}
          max={MAX_TERRACE_GUESTS}
          value={guestCount}
          onChange={(e) => setGuestCount(Number(e.target.value))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="terrace-name">Nombre completo</Label>
          <Input id="terrace-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="terrace-phone">Teléfono</Label>
          <Input id="terrace-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="terrace-email">Email</Label>
          <Input id="terrace-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="terrace-notes">
            Notas <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="terrace-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tipo de evento, decoración, catering..."
            rows={3}
          />
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          He leído y acepto la consumición mínima de {TERRACE_MIN_CONSUMPTION}€ para la
          Terraza Superior.
        </span>
      </label>

      <Button type="button" onClick={handleSend} disabled={!canSubmit} className={cn('w-full')}>
        {isPending ? 'Enviando…' : 'Enviar solicitud'}
      </Button>
    </div>
  )
}
