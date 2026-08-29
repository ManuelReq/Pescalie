export const TERRACE_MIN_CONSUMPTION = 1000
export const MAX_TERRACE_GUESTS = 60

export type TerraceRequestStatus = 'pendiente' | 'confirmada' | 'rechazada'

export type TerraceRequestInput = {
  date: string
  time: string
  guestCount: number
  name: string
  phone: string
  email: string
  notes?: string
}
