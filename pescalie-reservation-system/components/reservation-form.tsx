'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createReservationAction } from '@/app/actions/reservations'
import { createClient } from '@/lib/supabase/client'
import {
  getSlotsForDate,
  MAX_PARTY_SIZE,
  MAX_TABLES,
  WHATSAPP_DISPLAY,
  whatsappLink,
  formatLongDate,
  todayISO,
} from '@/lib/reservations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TerraceRequestForm } from '@/components/terrace-request-form'
import { cn } from '@/lib/utils'

export function ReservationForm() {
  const today = useMemo(() => todayISO(), [])

  const [date, setDate] = useState(today)
  const [time, setTime] = useState<string>('')
  const [partySize, setPartySize] = useState(2)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  const slots = useMemo(() => getSlotsForDate(date), [date])

  // Mapa hora -> mesas disponibles para la fecha elegida.
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, number>>({})
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [availabilityError, setAvailabilityError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<null | { remaining: number }>(null)

  // Si cambia la fecha y la hora elegida ya no es válida para ese día, se deselecciona.
  useEffect(() => {
    if (time && !slots.some((s) => s.value === time)) {
      setTime('')
    }
  }, [slots, time])

  // Consulta la disponibilidad de TODAS las horas del día elegido, para poder
  // desactivar en los botones las que ya no tienen mesa.
  useEffect(() => {
    let cancelled = false
    setLoadingAvailability(true)
    setAvailabilityError(false)
    const supabase = createClient()

    Promise.all(
      slots.map(async (slot) => {
        const { data, error } = await supabase.rpc('available_capacity', {
          p_date: date,
          p_time: slot.value,
        })
        if (error) throw error
        return [slot.value, Math.max(0, Number(data) || 0)] as const
      }),
    )
      .then((entries) => {
        if (cancelled) return
        setAvailabilityMap(Object.fromEntries(entries))
      })
      .catch(() => {
        if (cancelled) return
        setAvailabilityError(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingAvailability(false)
      })

    return () => {
      cancelled = true
    }
  }, [date, slots, refreshKey])

  const remaining = time ? availabilityMap[time] : undefined
  const isFull = remaining !== undefined && remaining <= 0

  const canSubmit =
    !!date &&
    !!time &&
    partySize >= 1 &&
    partySize <= MAX_PARTY_SIZE &&
    name.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    remaining !== undefined &&
    !isFull &&
    !availabilityError &&
    !isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    startTransition(async () => {
      const result = await createReservationAction({
        date,
        time,
        partySize,
        name,
        phone,
        email,
        notes,
      })
      if (result.ok) {
        setDone({ remaining: result.remaining })
        toast.success('Reserva confirmada', {
          description: `${name}, te esperamos el ${formatLongDate(date)} a las ${time}.`,
        })
      } else {
        toast.error('No se pudo reservar', { description: result.message })
        // La mesa pudo ocuparse mientras rellenabas el formulario: refrescamos disponibilidad.
        setRefreshKey((k) => k + 1)
      }
    })
  }

  const whatsappMsg = whatsappLink(
    `Hola, quiero reservar mesa para más de ${MAX_PARTY_SIZE} personas` +
      (date ? ` el ${formatLongDate(date)}` : '') +
      (time ? ` a las ${time}` : '') +
      '.',
  )

  if (done) {
    return (
      <div className="flex flex-col items-center gap-6 py-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckIcon />
        </div>
        <div className="space-y-2">
          <h3 className="font-serif text-2xl text-card-foreground">Reserva confirmada</h3>
          <p className="text-pretty text-sm text-muted-foreground">
            Gracias, {name}. Hemos guardado tu mesa para {partySize}{' '}
            {partySize === 1 ? 'persona' : 'personas'} el {formatLongDate(date)} a las {time}.
          </p>
          <p className="text-xs text-muted-foreground">
            Recibirás la confirmación en {email}.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setDone(null)
            setName('')
            setPhone('')
            setEmail('')
            setNotes('')
            setTime('')
            setPartySize(2)
            setRefreshKey((k) => k + 1)
          }}
        >
          Hacer otra reserva
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Date */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Fecha</Label>
        <Input
          id="date"
          type="date"
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      {/* Time slots */}
      <div className="flex flex-col gap-3">
        <Label>Turno</Label>
        {slots.length === 0 ? (
          <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
            No quedan horas disponibles para hoy. Elige otro día.
          </p>
        ) : (
          <SlotGroup
            slots={slots}
            value={time}
            onSelect={setTime}
            availabilityMap={availabilityMap}
            loading={loadingAvailability}
          />
        )}
      </div>

      {/* Party size */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="party">Comensales</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Quitar un comensal"
            onClick={() => setPartySize((p) => Math.max(1, p - 1))}
            disabled={partySize <= 1}
          >
            −
          </Button>
          <div className="min-w-16 rounded-md border border-input bg-background px-4 py-2 text-center font-serif text-lg tabular-nums">
            {partySize}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Añadir un comensal"
            onClick={() => setPartySize((p) => Math.min(MAX_PARTY_SIZE, p + 1))}
            disabled={partySize >= MAX_PARTY_SIZE}
          >
            +
          </Button>
          <span className="text-xs text-muted-foreground">Máx. {MAX_PARTY_SIZE} por reserva</span>
          </div>
        <a
          href={whatsappMsg}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline underline-offset-2"
        >
          ¿Sois más de {MAX_PARTY_SIZE}? Escríbenos por WhatsApp al {WHATSAPP_DISPLAY}
        </a>
      </div>
      <TerraceRequestForm />
      {/* Availability status */}
      <AvailabilityBadge
        hasTime={!!time}
        remaining={remaining}
        error={availabilityError}
      />

      {/* Contact fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">Nombre completo</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Laura Martín"
            autoComplete="name"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="600 123 456"
            autoComplete="tel"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="notes">
            Notas <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Alergias, trona, celebración especial…"
            rows={3}
          />
        </div>
      </div>

      <Button type="submit" size="lg" disabled={!canSubmit} className="w-full">
        {isPending ? 'Confirmando…' : 'Confirmar reserva'}
      </Button>
    </form>
  )
}

function SlotGroup({
  slots,
  value,
  onSelect,
  availabilityMap,
  loading,
}: {
  slots: { value: string; label: string }[]
  value: string
  onSelect: (v: string) => void
  availabilityMap: Record<string, number>
  loading: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot) => {
        const known = availabilityMap[slot.value]
        const full = !loading && known === 0
        return (
          <button
            key={slot.value}
            type="button"
            onClick={() => !full && onSelect(slot.value)}
            aria-pressed={value === slot.value}
            disabled={full}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium tabular-nums transition-colors',
              full
                ? 'cursor-not-allowed border-input bg-muted text-muted-foreground line-through opacity-60'
                : value === slot.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-foreground hover:border-primary/50 hover:bg-secondary',
            )}
          >
            {slot.label}
          </button>
        )
      })}
    </div>
  )
}

function AvailabilityBadge({
  hasTime,
  remaining,
  error,
}: {
  hasTime: boolean
  remaining: number | undefined
  error: boolean
}) {
  if (!hasTime) {
    return (
      <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
        Elige un turno para ver las mesas disponibles.
      </p>
    )
  }
  if (error) {
    return (
      <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
        No pudimos comprobar el aforo. Inténtalo de nuevo en unos segundos.
      </p>
    )
  }
  if (remaining === undefined) {
    return (
      <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
        Comprobando disponibilidad…
      </p>
    )
  }

  const full = remaining <= 0
  const pct = Math.round(((MAX_TABLES - remaining) / MAX_TABLES) * 100)

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border px-4 py-3 text-sm',
        full
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-primary/25 bg-primary/5 text-foreground',
      )}
    >
      <div className="flex items-center justify-between font-medium">
        <span>
          {full
            ? 'Este horario está completo. Por favor, selecciona otro horario.'
            : `🪑 ${remaining} ${remaining === 1 ? 'mesa disponible' : 'mesas disponibles'}`}
        </span>
        {!full && <span className="text-primary">Disponible</span>}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full', full ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
