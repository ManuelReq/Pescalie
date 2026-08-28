'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateReservationStatus } from '@/app/actions/admin'
import {
  MAX_CAPACITY,
  formatLongDate,
  type Reservation,
  type ReservationStatus,
} from '@/lib/reservations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Filter = 'todas' | ReservationStatus

export function AdminReservations({
  reservations,
  initialDate,
}: {
  reservations: Reservation[]
  initialDate: string
}) {
  const [date, setDate] = useState(initialDate)
  const [filter, setFilter] = useState<Filter>('todas')
  const [rows, setRows] = useState<Reservation[]>(reservations)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const dayRows = useMemo(
    () => rows.filter((r) => r.reservation_date === date),
    [rows, date],
  )

  const visibleRows = useMemo(
    () => (filter === 'todas' ? dayRows : dayRows.filter((r) => r.status === filter)),
    [dayRows, filter],
  )

  // Group by turn for a readable overview.
  const byTurn = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    for (const r of visibleRows) {
      const list = map.get(r.reservation_time) ?? []
      list.push(r)
      map.set(r.reservation_time, list)
    }
        return Array.from(map.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((time) => ({
        time,
        items: map.get(time)!.sort((a, b) => a.name.localeCompare(b.name)),
      }))
  }, [visibleRows])

  const confirmedGuests = dayRows
    .filter((r) => r.status === 'confirmada')
    .reduce((sum, r) => sum + r.party_size, 0)

  function changeStatus(id: string, status: ReservationStatus) {
    setPendingId(id)
    startTransition(async () => {
      const result = await updateReservationStatus(id, status)
      if (result.ok) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
        toast.success(status === 'cancelada' ? 'Reserva cancelada' : 'Reserva confirmada')
      } else {
        toast.error(result.message)
      }
      setPendingId(null)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-date">Fecha</Label>
          <Input
            id="filter-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full sm:w-56"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['todas', 'confirmada', 'cancelada'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                filter === f
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-foreground hover:bg-secondary',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Reservas del día" value={dayRows.length} />
        <SummaryStat label="Confirmadas" value={dayRows.filter((r) => r.status === 'confirmada').length} />
        <SummaryStat label="Canceladas" value={dayRows.filter((r) => r.status === 'cancelada').length} />
        <SummaryStat label="Comensales" value={confirmedGuests} hint={`aforo/turno ${MAX_CAPACITY}`} />
      </div>

      <p className="text-sm text-muted-foreground">{formatLongDate(date)}</p>

      {/* List */}
      {byTurn.length === 0 ? (
        <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
          No hay reservas para esta fecha con el filtro seleccionado.
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {byTurn.map((turn) => {
            const guests = turn.items
              .filter((r) => r.status === 'confirmada')
              .reduce((s, r) => s + r.party_size, 0)
            return (
              <div key={turn.time} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-lg text-foreground">
                    Turno {turn.time}
                  </h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {guests}/{MAX_CAPACITY} plazas
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {turn.items.map((r) => (
                    <ReservationRow
                      key={r.id}
                      reservation={r}
                      pending={pendingId === r.id}
                      onChangeStatus={changeStatus}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint?: string
}) {
  return (
    <Card className="gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-serif text-2xl tabular-nums text-card-foreground">{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </Card>
  )
}

function ReservationRow({
  reservation: r,
  pending,
  onChangeStatus,
}: {
  reservation: Reservation
  pending: boolean
  onChangeStatus: (id: string, status: ReservationStatus) => void
}) {
  const cancelled = r.status === 'cancelada'
  return (
    <Card
      className={cn(
        'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between',
        cancelled && 'opacity-70',
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('font-medium text-card-foreground', cancelled && 'line-through')}>
            {r.name}
          </span>
          <Badge variant={cancelled ? 'outline' : 'default'} className="capitalize">
            {r.status}
          </Badge>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground tabular-nums">
            {r.party_size} {r.party_size === 1 ? 'pers.' : 'pers.'}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span>{r.phone}</span>
          <span>{r.email}</span>
        </div>
        {r.notes && (
          <p className="mt-1 text-xs italic text-muted-foreground">“{r.notes}”</p>
        )}
      </div>

      <div className="flex gap-2">
        {cancelled ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onChangeStatus(r.id, 'confirmada')}
          >
            Reactivar
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onChangeStatus(r.id, 'cancelada')}
            className="text-destructive hover:text-destructive"
          >
            Cancelar
          </Button>
        )}
      </div>
    </Card>
  )
}
