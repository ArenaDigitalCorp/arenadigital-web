'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  assertArenaBackofficeAccess,
  requireAuthenticatedDbUser,
} from '@/lib/server-auth'
import type {
  AppBookingRequestStatus,
  AppBookingRequestView,
} from '@/modules/bookings/types/app-booking-request.types'
import {
  appBookingModeAcceptsPreBookings,
  normalizeAppBookingMode,
} from '@/modules/arenas/domain/app-booking-mode'

const uuidSchema = z.string().uuid()
const reviewSchema = z.object({
  arenaId: uuidSchema,
  requestId: uuidSchema,
  decision: z.enum(['approve', 'reject']),
  rejectionReason: z.string().trim().max(500).optional(),
})

type RequestRow = {
  id: string
  arena_id: string
  court_id: string
  athlete_id: string
  sport_id: string
  team_id: string | null
  start_time: string
  end_time: string
  duration_minutes: number
  quoted_rental_price: number
  status: string
  accepted_booking_id: string | null
  rejection_reason: string | null
  reviewed_at: string | null
  created_at: string
  athlete: AppBookingRequestView['athlete'] | AppBookingRequestView['athlete'][]
  court: AppBookingRequestView['court'] | AppBookingRequestView['court'][]
  sport: AppBookingRequestView['sport'] | AppBookingRequestView['sport'][]
  team: AppBookingRequestView['team'] | AppBookingRequestView['team'][]
  participants: Array<{
    id: string
    athlete_id: string
    role: 'responsavel' | 'membro_time' | 'convidado'
    team_id: string | null
    athlete:
      | { id: string; nome_perfil: string; telefone: string | null }
      | Array<{ id: string; nome_perfil: string; telefone: string | null }>
      | null
  }>
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function normalizeStatus(status: string, startTime: string): AppBookingRequestStatus {
  if (status === 'pending' && Date.parse(startTime) <= Date.now()) return 'expired'
  if (status === 'approved' || status === 'rejected' || status === 'expired') return status
  return 'pending'
}

export async function getAppBookingRequestsAction(arenaId: string): Promise<{
  success: boolean
  data: AppBookingRequestView[]
  acceptsRequests: boolean
  error?: string
}> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const parsedArenaId = uuidSchema.parse(arenaId)
    const supabase = getSupabaseAdmin()

    const [{ data: arena, error: arenaError }, { data, error }] = await Promise.all([
      supabase
        .from('arenas')
        // `*` keeps the new web compatible with the previous DB during the
        // ordered rollout; the mode normalizer falls back to the legacy flag.
        .select('*')
        .eq('id', parsedArenaId)
        .single(),
      supabase
        .from('app_booking_requests')
        .select(`
          id, arena_id, court_id, athlete_id, sport_id, team_id,
          start_time, end_time, duration_minutes, quoted_rental_price,
          status, accepted_booking_id, rejection_reason, reviewed_at, created_at,
          athlete:athlete_id(id, nome_perfil, telefone, foto_url),
          court:court_id(id, name, type),
          sport:sport_id(id, name),
          team:team_id(id, nome),
          participants:app_booking_request_participants(
            id, athlete_id, role, team_id,
            athlete:athlete_id(id, nome_perfil, telefone)
          )
        `)
        .eq('arena_id', parsedArenaId)
        .order('created_at', { ascending: false })
        .limit(250),
    ])

    if (arenaError) throw new Error(arenaError.message)
    if (error) throw new Error(error.message)

    const rows = (data ?? []) as unknown as RequestRow[]
    const futureRows = rows.filter((row) => Date.parse(row.end_time) > Date.now())
    const starts = futureRows.map((row) => row.start_time).sort()
    const ends = futureRows.map((row) => row.end_time).sort()
    const minStart = starts[0]
    const maxEnd = ends.at(-1)

    let bookingBlocks: Array<{
      court_id: string
      start_time: string
      end_time: string
      status: string | null
      payment_expires_at: string | null
    }> = []

    if (minStart && maxEnd) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('court_id, start_time, end_time, status, payment_expires_at')
        .eq('arena_id', parsedArenaId)
        .in('status', ['confirmed', 'reservado', 'pending_payment'])
        .lt('start_time', maxEnd)
        .gt('end_time', minStart)

      if (bookingsError) throw new Error(bookingsError.message)
      bookingBlocks = bookings ?? []
    }

    const now = Date.now()
    const mapped = rows.map((row): AppBookingRequestView => {
      const status = normalizeStatus(row.status, row.start_time)
      const hasConflict = status === 'pending' && bookingBlocks.some((booking) => {
        const blocks = booking.status !== 'pending_payment'
          || Boolean(booking.payment_expires_at && Date.parse(booking.payment_expires_at) > now)
        return blocks
          && booking.court_id === row.court_id
          && Date.parse(booking.start_time) < Date.parse(row.end_time)
          && Date.parse(booking.end_time) > Date.parse(row.start_time)
      })

      return {
        id: row.id,
        arenaId: row.arena_id,
        courtId: row.court_id,
        athleteId: row.athlete_id,
        sportId: row.sport_id,
        teamId: row.team_id,
        startTime: row.start_time,
        endTime: row.end_time,
        durationMinutes: row.duration_minutes,
        quotedRentalPrice: Number(row.quoted_rental_price),
        status,
        acceptedBookingId: row.accepted_booking_id,
        rejectionReason: row.rejection_reason,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
        hasConflict,
        athlete: one(row.athlete),
        court: one(row.court),
        sport: one(row.sport),
        team: one(row.team),
        participants: (row.participants ?? []).map((participant) => ({
          id: participant.id,
          athleteId: participant.athlete_id,
          role: participant.role,
          teamId: participant.team_id,
          athlete: one(participant.athlete),
        })),
      }
    })

    const appBookingMode = normalizeAppBookingMode(
      'app_booking_mode' in arena ? arena.app_booking_mode : undefined,
      arena.accepts_app_booking_requests ?? false,
    )

    return {
      success: true,
      data: mapped,
      acceptsRequests: appBookingModeAcceptsPreBookings(appBookingMode),
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      acceptsRequests: false,
      error: error instanceof Error ? error.message : 'Erro ao carregar pré-reservas',
    }
  }
}

export async function reviewAppBookingRequestAction(input: {
  arenaId: string
  requestId: string
  decision: 'approve' | 'reject'
  rejectionReason?: string
}): Promise<{
  success: boolean
  status?: AppBookingRequestStatus
  bookingId?: string | null
  error?: string
}> {
  try {
    const parsed = reviewSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.rpc(
      'review_app_booking_request',
      {
        p_arena_id: parsed.arenaId,
        p_request_id: parsed.requestId,
        p_decision: parsed.decision,
        p_reviewer_id: dbUserId,
        p_rejection_reason: parsed.rejectionReason || undefined,
      }
    )

    if (error) throw new Error(error.message)

    const rpcRow = Array.isArray(data) ? data[0] : data
    if (!rpcRow) throw new Error('A análise da pré-reserva não retornou um resultado.')

    revalidatePath(`/dashboard/arenas/${parsed.arenaId}/pre-reservas`)
    revalidatePath(`/dashboard/arenas/${parsed.arenaId}`)

    return {
      success: true,
      status: normalizeStatus(rpcRow?.status ?? 'pending', new Date(Date.now() + 1).toISOString()),
      bookingId: rpcRow?.accepted_booking_id ?? null,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao analisar pré-reserva',
    }
  }
}
