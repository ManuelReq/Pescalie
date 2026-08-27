import { redirect } from 'next/navigation'
import { signOutAction } from '@/app/actions/admin'
import { AdminReservations } from '@/components/admin-reservations'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { todayISO, type Reservation } from '@/lib/reservations'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware already guards this, but double-check at the data layer.
  if (!user) {
    redirect('/admin/login')
  }

  const { data, error } = await supabase
    .from('reservations')
    .select(
      'id, reservation_date, reservation_time, party_size, name, phone, email, notes, status, created_at',
    )
    .order('reservation_date', { ascending: false })
    .order('reservation_time', { ascending: true })

  const reservations = (data ?? []) as Reservation[]

  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <div className="flex flex-col">
            <span className="font-serif text-xl text-card-foreground">Pescalie</span>
            <span className="text-xs text-muted-foreground">Panel de reservas</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <form action={signOutAction}>
              <Button variant="outline" size="sm" type="submit">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            No se pudieron cargar las reservas. Asegúrate de haber ejecutado el script
            <code className="mx-1 rounded bg-background px-1 py-0.5">scripts/001_pescalie_schema.sql</code>
            en Supabase.
          </div>
        ) : (
          <AdminReservations reservations={reservations} initialDate={todayISO()} />
        )}
      </div>
    </main>
  )
}
