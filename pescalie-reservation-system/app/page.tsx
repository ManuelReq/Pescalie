import Image from 'next/image'
import Link from 'next/link'
import { ReservationForm } from '@/components/reservation-form'
import { Card } from '@/components/ui/card'
import { MAX_CAPACITY } from '@/lib/reservations'

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-background">
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/pescalie-hero.png"
            alt=""
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
        </div>

        <div className="mx-auto flex max-w-5xl flex-col items-center px-5 pb-10 pt-16 text-center sm:pt-24">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
            Cocina marinera · Desde 1998
          </span>
          <h1 className="text-balance font-serif text-5xl font-light leading-tight text-foreground sm:text-6xl">
            Pescalie
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Producto del mar, de temporada y de lonja. Reserva tu mesa y déjanos
            cuidar cada detalle de tu experiencia.
          </p>
        </div>
      </section>

      {/* Reservation card */}
      <section className="mx-auto -mt-2 max-w-2xl px-5 pb-20">
        <Card className="border-border/70 bg-card/95 p-6 shadow-xl backdrop-blur sm:p-8">
          <div className="mb-6 flex flex-col gap-1">
            <h2 className="font-serif text-2xl text-card-foreground">Reserva tu mesa</h2>
            <p className="text-sm text-muted-foreground">
              Aforo de {MAX_CAPACITY} plazas por turno. Confirmación inmediata según
              disponibilidad.
            </p>
          </div>
          <ReservationForm />
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          ¿Formas parte del equipo?{' '}
          <Link
            href="/admin"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Acceso al panel
          </Link>
        </p>
      </section>
    </main>
  )
}
