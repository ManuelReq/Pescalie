'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // Genericize the credential signal to avoid account enumeration.
        setError('Email o contraseña incorrectos.')
        return
      }
      router.replace('/admin')
      router.refresh()
    })
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-12">
      <Card className="w-full max-w-sm border-border/70 p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-1 text-center">
          <span className="font-serif text-3xl font-light text-card-foreground">Pescalie</span>
          <p className="text-sm text-muted-foreground">Panel de reservas · Acceso del equipo</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="underline underline-offset-4 hover:text-foreground">
            Volver a la web
          </Link>
        </p>
      </Card>
    </main>
  )
}
