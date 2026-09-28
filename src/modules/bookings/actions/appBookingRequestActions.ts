'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination'
import { buildBookingConflictWindows } from '@/modules/bookings/lib/app-booking-conflict-windows'
import {
  assertArenaBackofficeAccess,
  requireAuthenticatedDbUser,
} from '@/lib/server-auth'
import type {
  AppBookingRequestStatus,
  AppBookingRequestGroupView,
  AppBookingRequestView,
} from '@/modules/bookings/types/app-booking-request.types'
import {
  appBookingModeAcceptsPreBookings,
  normalizeAppBookingMode,
} from '@/modules/arenas/domain/app-booking-mode'

const uuidSchema = z.string().uuid()
const offsetSchema = z.number().int().nonnegative()
const REQUEST_PAGE_SIZE = 50
const GROUP_PAGE_SIZE = 25
const REQUEST_IDS_PER_QUERY = 75
const REQUEST_SELECT = `
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
`
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

function isMissingGroupTable(error: { code?: string; message: string }): boolean {
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || error.message.includes('Could not find the table')
}

async function loadLegacyConflictIds(arenaId: string, rows: RequestRow[]): Promise<Set<string>> {
  const supabase = getSupabaseAdmin()
  const windows = buildBookingConflictWindows(rows.map((row) => ({
    courtId: row.court_id,
    startTime: row.start_time,
    endTime: row.end_time,
  })))
  const blocks: Array<{
    court_id: string
    start_time: string
    end_time: string
    status: string | null
    payment_expires_at: string | null
  }> = []

  for (let index = 0; index < windows.length; index += 5) {
    const windowResults = await Promise.all(windows.slice(index, index + 5).map(async (window) => {
      const { data, error } = await fetchAllSupabaseRows(
        supabase
          .from('bookings')
          .select('court_id, start_time, end_time, status, payment_expires_at')
          .eq('arena_id', arenaId)
          .eq('court_id', window.courtId)
          .in('status', ['confirmed', 'reservado', 'pending_payment'])
          .lt('start_time', window.endTime)
          .gt('end_time', window.startTime)
          .order('start_time', { ascending: true }),
      )
      if (error) throw new Error(error.message)
      return data ?? []
    }))
    blocks.push(...windowResults.flat())
  }

  const now = Date.now()
  return new Set(rows.filter((row) => blocks.some((booking) => (
    booking.court_id === row.court_id
    && Date.parse(booking.start_time) < Date.parse(row.end_time)
    && Date.parse(booking.end_time) > Date.parse(row.start_time)
    && (booking.status !== 'pending_payment'
      || Boolean(booking.payment_expires_at && Date.parse(booking.payment_expires_at) > now))
  ))).map((row) => row.id))
}

async function loadConflictIds(arenaId: string, rows: RequestRow[]): Promise<Set<string>> {
  const pendingRows = rows.filter((row) => row.status === 'pending' && Date.parse(row.end_time) > Date.now())
  if (pendingRows.length === 0) return new Set()

  const { dbUserId } = await requireAuthenticatedDbUser()
  const supabase = getSupabaseAdmin()
  const conflictIds = new Set<string>()
  for (let index = 0; index < pendingRows.length; index += REQUEST_IDS_PER_QUERY) {
    const requestIds = pendingRows.slice(index, index + REQUEST_IDS_PER_QUERY).map((row) => row.id)
    const { data, error } = await supabase.rpc('get_app_booking_request_conflicts', {
      p_arena_id: arenaId,
      p_request_ids: requestIds,
      p_reviewer_id: dbUserId,
    })
    if (error?.code === 'PGRST202' || error?.code === '42883') {
      return loadLegacyConflictIds(arenaId, pendingRows)
    }
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      if (row.has_conflict) conflictIds.add(row.request_id)
    }
  }
  return conflictIds
}

async function mapRequestRows(
  arenaId: string,
  rows: RequestRow[],
): Promise<AppBookingRequestView[]> {
  const conflictIds = await loadConflictIds(arenaId, rows)
  return rows.map((row): AppBookingRequestView => {
    const status = normalizeStatus(row.status, row.start_time)
    const hasConflict = status === 'pending' && conflictIds.has(row.id)

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
}

export async function getAppBookingRequestsAction(arenaId: string, offset = 0): Promise<{
  success: boolean
  data: AppBookingRequestView[]
  nextOffset: number | null
  acceptsRequests: boolean
  error?: string
}> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const parsedArenaId = uuidSchema.parse(arenaId)
    const parsedOffset = offsetSchema.parse(offset)
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
        .select(REQUEST_SELECT)
        .eq('arena_id', parsedArenaId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(parsedOffset, parsedOffset + REQUEST_PAGE_SIZE),
    ])

    if (arenaError) throw new Error(arenaError.message)
    if (error) throw new Error(error.message)

    const pageRows = (data ?? []).slice(0, REQUEST_PAGE_SIZE) as unknown as RequestRow[]
    const pageRequestIds = pageRows.map((row) => row.id)
    let groupedRequestIds = new Set<string>()
    if (pageRequestIds.length > 0) {
      const { data: groupLinks, error: groupLinksError } = await supabase
        .from('app_booking_request_group_items')
        .select('request_id')
        .eq('arena_id', parsedArenaId)
        .in('request_id', pageRequestIds)
      if (groupLinksError && !isMissingGroupTable(groupLinksError)) {
        throw new Error(groupLinksError.message)
      }
      groupedRequestIds = new Set((groupLinks ?? []).map((link) => link.request_id))
    }
    const mapped = await mapRequestRows(
      parsedArenaId,
      pageRows.filter((row) => !groupedRequestIds.has(row.id)),
    )

    const appBookingMode = normalizeAppBookingMode(
      'app_booking_mode' in arena ? arena.app_booking_mode : undefined,
      arena.accepts_app_booking_requests ?? false,
    )

    return {
      success: true,
      data: mapped,
      nextOffset: (data ?? []).length > REQUEST_PAGE_SIZE
        ? parsedOffset + REQUEST_PAGE_SIZE
        : null,
      acceptsRequests: appBookingModeAcceptsPreBookings(appBookingMode),
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      nextOffset: null,
      acceptsRequests: false,
      error: error instanceof Error ? error.message : 'Erro ao carregar pré-reservas',
    }
  }
}

export async function getAppBookingRequestGroupsAction(arenaId: string, offset = 0): Promise<{
  success: boolean
  data: AppBookingRequestGroupView[]
  nextOffset: number | null
  error?: string
}> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const parsedArenaId = uuidSchema.parse(arenaId)
    const parsedOffset = offsetSchema.parse(offset)
    const supabase = getSupabaseAdmin()
    const { data: groupPage, error: groupError } = await supabase
      .from('app_booking_request_groups')
      .select('operation_id, arena_id, athlete_id, quoted_total, created_at')
      .eq('arena_id', parsedArenaId)
      .order('created_at', { ascending: false })
      .order('operation_id', { ascending: false })
      .range(parsedOffset, parsedOffset + GROUP_PAGE_SIZE)

    if (groupError && isMissingGroupTable(groupError)) {
      return { success: true, data: [], nextOffset: null }
    }
    if (groupError) throw new Error(groupError.message)

    const pageGroups = (groupPage ?? []).slice(0, GROUP_PAGE_SIZE)
    if (pageGroups.length === 0) {
      return { success: true, data: [], nextOffset: null }
    }

    const groupOperationIds = pageGroups.map((group) => group.operation_id)
    const { data: groupLinks, error: linksError } = await fetchAllSupabaseRows(
      supabase
        .from('app_booking_request_group_items')
        .select('operation_id, request_id, position, arena_id, athlete_id')
        .eq('arena_id', parsedArenaId)
        .in('operation_id', groupOperationIds)
        .order('operation_id', { ascending: true })
        .order('position', { ascending: true }),
    )
    if (linksError) throw new Error(linksError.message)

    const requestIds = (groupLinks ?? []).map((link) => link.request_id)
    const requestChunks: string[][] = []
    for (let index = 0; index < requestIds.length; index += REQUEST_IDS_PER_QUERY) {
      requestChunks.push(requestIds.slice(index, index + REQUEST_IDS_PER_QUERY))
    }
    const requestRows: RequestRow[] = []
    for (let index = 0; index < requestChunks.length; index += 5) {
      const requestPages = await Promise.all(requestChunks.slice(index, index + 5).map(async (requestChunk) => {
        const { data, error } = await supabase
          .from('app_booking_requests')
          .select(REQUEST_SELECT)
          .eq('arena_id', parsedArenaId)
          .in('id', requestChunk)
        if (error) throw new Error(error.message)
        return (data ?? []) as unknown as RequestRow[]
      }))
      requestRows.push(...requestPages.flat())
    }
    const mappedItems = await mapRequestRows(parsedArenaId, requestRows)
    const requestsById = new Map(mappedItems.map((request) => [request.id, request]))
    const linksByGroup = new Map<string, typeof groupLinks>()
    for (const link of groupLinks ?? []) {
      const links = linksByGroup.get(link.operation_id) ?? []
      links.push(link)
      linksByGroup.set(link.operation_id, links)
    }

    const groups = pageGroups.map((group): AppBookingRequestGroupView => {
      const links = linksByGroup.get(group.operation_id) ?? []
      if (links.length === 0) {
        throw new Error('Grupo de pré-reservas sem horários vinculados.')
      }
      const items = links
        .sort((left, right) => left.position - right.position)
        .map((link) => {
          const request = requestsById.get(link.request_id)
          if (!request || request.athleteId !== group.athlete_id) {
            throw new Error('Grupo de pré-reservas com horário indisponível para leitura.')
          }
          return request
        })
      return {
        operationId: group.operation_id,
        quotedTotal: Number(group.quoted_total),
        createdAt: group.created_at,
        items,
      }
    })

    return {
      success: true,
      data: groups,
      nextOffset: (groupPage ?? []).length > GROUP_PAGE_SIZE
        ? parsedOffset + GROUP_PAGE_SIZE
        : null,
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      nextOffset: null,
      error: error instanceof Error ? error.message : 'Erro ao carregar grupos de pré-reservas',
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
