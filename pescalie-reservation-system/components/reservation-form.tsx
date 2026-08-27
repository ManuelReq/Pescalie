'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createReservationAction } from '@/app/actions/reservations'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_SETTINGS,
  MAX_PARTY_SIZE,
  fetchRestaurantSettings,
  formatLongDate,
  generateSlots,
  todayISO,
  type RestaurantSettings,
  type TimeSlot,
} from '@/lib/reservations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Availability =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; remaining: number }
  | { state: 'error' }

export function ReservationForm() {
  const today = useMemo(() => todayISO(), [])

  const [date, setDate] = useState(today)
  const [time, setTime] = useState<string>('')
  const [partySize, setPartySize] = useState(2)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  const [settings, setSettings] = useState<RestaurantSettings>(DEFAULT_SETTINGS)
  const [availability, setAvailability] = useState<Availability>({ state: 'idle' })
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<null | { remaining: number }>(null)

  // Load restaurant settings (aforo, horarios) from Supabase once on mount.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    fetchRestaurantSettings(supabase).then((s) => {
      if (!cancelled) setSettings(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Time slots depend on the selected date (fin de semana vs. resto de días).
  const slots: TimeSlot[] = useMemo(() => generateSlots(date, settings), [date, settings])

  // If the previously selected time is no longer valid for this date
  // (e.g. switched from a weekday to a weekend), clear it.
  useEffect(() => {
    if (time && !slots.some((s) => s.value === time)) {
      setTime('')
    }
  }, [slots, time])

  // Live capacity check against Supabase whenever date/time changes.
  useEffect(() => {
    if (!date || !time) {
      setAvailability({ state: 'idle' })
      return
    }
    let cancelled = false
    setAvailability({ state: 'loading' })
    const supabase = createClient()
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('available_capacity', {
        p_date: date,
        p_time: time,
      })
      if (cancelled) return
      if (error) {
        setAvailability({ state: 'error' })
        return
      }
      setAvailability({ state: 'ready', remaining: Math.max(0, Number(data) || 0) })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [date, time])

  const remaining = availability.state === 'ready' ? availability.remaining : null
  const overCapacity = remaining !== null && partySize > remaining
  const canSubmit =
    !!date &&
    !!time &&
    partySize >= 1 &&
    name.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    availability.state === 'ready' &&
    !overCapacity &&
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
        // Refresh capacity in case the turn filled up.
        setAvailability({ state: 'idle' })
        setTime((t) => t)
      }
    })
  }

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
            No hay horario disponible para este día.
          </p>
        ) : (
          <SlotGroup slots={slots} value={time} onSelect={setTime} />
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
      </div>

      {/* Availability status */}
      <AvailabilityBadge
        availability={availability}
        partySize={partySize}
        time={time}
        maxCapacity={settings.maxCapacity}
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
}: {
  slots: { value: string; label: string }[]
  value: string
  onSelect: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot) => (
        <button
          key={slot.value}
          type="button"
          onClick={() => onSelect(slot.value)}
          aria-pressed={value === slot.value}
          className={cn(
            'rounded-md border px-3 py-1.5 text-sm font-medium tabular-nums transition-colors',
            value === slot.value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background text-foreground hover:border-primary/50 hover:bg-secondary',
          )}
        >
          {slot.label}
        </button>
      ))}
    </div>
  )
}

function AvailabilityBadge({
  availability,
  partySize,
  time,
  maxCapacity,
}: {
  availability: Availability
  partySize: number
  time: string
  maxCapacity: number
}) {
  if (!time || availability.state === 'idle') {
    return (
      <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
        Elige un turno para ver las plazas disponibles.
      </p>
    )
  }
  if (availability.state === 'loading') {
    return (
      <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
        Comprobando disponibilidad…
      </p>
    )
  }
  if (availability.state === 'error') {
    return (
      <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
        No pudimos comprobar el aforo. Asegúrate de haber instalado el esquema SQL.
      </p>
    )
  }

  const { remaining } = availability
  const full = remaining <= 0
  const over = partySize > remaining
  const pct = Math.round(((maxCapacity - remaining) / maxCapacity) * 100)

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border px-4 py-3 text-sm',
        full || over
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-primary/25 bg-primary/5 text-foreground',
      )}
    >
      <div className="flex items-center justify-between font-medium">
        <span>
          {full
            ? 'Turno completo'
            : `${remaining} de ${maxCapacity} plazas disponibles`}
        </span>
        {!full && !over && <span className="text-primary">Disponible</span>}
        {over && !full && <span>Supera el aforo</span>}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full', full || over ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {over && !full && (
        <span className="text-xs">
          Reduce a {remaining} {remaining === 1 ? 'comensal' : 'comensales'} o elige otro turno.
        </span>
      )}
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
