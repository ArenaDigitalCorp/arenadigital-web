export type AppBookingRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface AppBookingRequestParticipantView {
  id: string
  athleteId: string
  role: 'responsavel' | 'membro_time' | 'convidado'
  teamId: string | null
  athlete: {
    id: string
    nome_perfil: string
    telefone: string | null
  } | null
}

export interface AppBookingRequestView {
  id: string
  arenaId: string
  courtId: string
  athleteId: string
  sportId: string
  teamId: string | null
  startTime: string
  endTime: string
  durationMinutes: number
  quotedRentalPrice: number
  status: AppBookingRequestStatus
  acceptedBookingId: string | null
  rejectionReason: string | null
  reviewedAt: string | null
  createdAt: string
  hasConflict: boolean
  athlete: {
    id: string
    nome_perfil: string
    telefone: string | null
    foto_url: string | null
  } | null
  court: { id: string; name: string; type: string | null } | null
  sport: { id: string; name: string } | null
  team: { id: string; nome: string } | null
  participants: AppBookingRequestParticipantView[]
}
