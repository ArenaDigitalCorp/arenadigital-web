"use server"

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import {
  assertArenaAdminAccess,
  assertArenaBackofficeAccess,
  assertBookingAccess,
  assertCourtAccess,
  assertPlatformAdminAccess,
} from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  appHomeContentActionSchema,
  arenaHighlightActionSchema,
  arenaPromotionActionSchema,
  openGameActionSchema,
} from '../schemas/mobile-content-action.schema'
import type {
  AppHomeContent,
  MobileContentOption,
  MobileHighlight,
  MobileOpenGame,
  MobilePromotion,
  MobileContentResult,
} from '../types/mobile-content.types'

const MOBILE_CONTENT_REVALIDATE_PATHS = [
  '/dashboard',
  '/dashboard/admin/mobile-content',
  '/dashboard/settings/arenas',
]

function revalidateMobileContent(arenaId?: string) {
  for (const path of MOBILE_CONTENT_REVALIDATE_PATHS) revalidatePath(path)
  if (arenaId) revalidatePath(`/dashboard/arenas/${arenaId}`)
}

function normalizeError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

async function assertAthleteBelongsToArena(arenaId: string, athleteId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('arenas_atleta')
    .select('id_atleta')
    .eq('id_arena', arenaId)
    .eq('id_atleta', athleteId)
    .maybeSingle()

  if (error) throw new Error(`Erro ao validar atleta do jogo aberto: ${error.message}`)
  if (!data) throw new Error('Atleta não pertence à arena informada')
}

export async function listAppHomeContentAction(): Promise<MobileContentResult<AppHomeContent[]>> {
  try {
    await assertPlatformAdminAccess()
    const supabase = getSupabaseAdmin() as any
    const { data, error } = await supabase
      .from('app_home_content')
      .select('*, sports(id, name), municipios(codigo_ibge, nome, estados(uf))')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return { success: true, data: (data ?? []) as AppHomeContent[] }
  } catch (err) {
    return { success: false, data: [], error: normalizeError(err, 'Erro ao listar conteúdos globais') }
  }
}

export async function upsertAppHomeContentAction(input: unknown): Promise<MobileContentResult<AppHomeContent | null>> {
  try {
    const admin = await assertPlatformAdminAccess()
    const parsed = appHomeContentActionSchema.parse(input)
    const supabase = getSupabaseAdmin() as any
    const payload = {
      kind: parsed.kind,
      title: parsed.title,
      description: parsed.description ?? null,
      image_url: parsed.image_url ?? null,
      cta_label: parsed.cta_label ?? null,
      cta_url: parsed.cta_url ?? null,
      cta_kind: parsed.cta_kind ?? 'none',
      city_id: parsed.city_id ?? null,
      sport_id: parsed.sport_id ?? null,
      priority: parsed.priority ?? 0,
      starts_at: parsed.starts_at ?? new Date().toISOString(),
      ends_at: parsed.ends_at ?? null,
      active: parsed.active ?? true,
    }

    const query = parsed.id
      ? supabase.from('app_home_content').update(payload).eq('id', parsed.id)
      : supabase.from('app_home_content').insert({ ...payload, created_by: admin.dbUserId })

    const { data, error } = await query.select('*').single()
    if (error) throw new Error(error.message)
    revalidateMobileContent()
    return { success: true, data: data as AppHomeContent }
  } catch (err) {
    return { success: false, data: null, error: normalizeError(err, 'Erro ao salvar conteúdo global') }
  }
}

export async function setAppHomeContentActiveAction(
  contentId: string,
  active: boolean
): Promise<MobileContentResult<null>> {
  try {
    await assertPlatformAdminAccess()
    const supabase = getSupabaseAdmin() as any
    const { error } = await supabase
      .from('app_home_content')
      .update({ active })
      .eq('id', contentId)

    if (error) throw new Error(error.message)
    revalidateMobileContent()
    return { success: true, data: null }
  } catch (err) {
    return { success: false, data: null, error: normalizeError(err, 'Erro ao alterar conteúdo global') }
  }
}

export async function deleteAppHomeContentAction(contentId: string): Promise<MobileContentResult<null>> {
  try {
    await assertPlatformAdminAccess()
    const supabase = getSupabaseAdmin() as any
    const { error } = await supabase
      .from('app_home_content')
      .delete()
      .eq('id', contentId)

    if (error) throw new Error(error.message)
    revalidateMobileContent()
    return { success: true, data: null }
  } catch (err) {
    return { success: false, data: null, error: normalizeError(err, 'Erro ao excluir conteúdo global') }
  }
}

export async function listArenaPromotionsAction(arenaId: string): Promise<MobileContentResult<MobilePromotion[]>> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const supabase = getSupabaseAdmin() as any
    const { data, error } = await supabase
      .from('arena_promotions')
      .select('*, arenas(id, name), courts(id, name), sports(id, name)')
      .eq('arena_id', arenaId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return { success: true, data: (data ?? []) as MobilePromotion[] }
  } catch (err) {
    return { success: false, data: [], error: normalizeError(err, 'Erro ao listar promoções') }
  }
}

export async function upsertArenaPromotionAction(
  arenaId: string,
  input: unknown
): Promise<MobileContentResult<MobilePromotion | null>> {
  try {
    await assertArenaAdminAccess(arenaId)
    const parsed = arenaPromotionActionSchema.parse(input)
    if (parsed.court_id) await assertCourtAccess(parsed.court_id, arenaId)
    const supabase = getSupabaseAdmin() as any
    const payload = {
      arena_id: arenaId,
      court_id: parsed.court_id ?? null,
      sport_id: parsed.sport_id ?? null,
      title: parsed.title,
      description: parsed.description ?? null,
      image_url: parsed.image_url ?? null,
      price: parsed.price ?? null,
      original_price: parsed.original_price ?? null,
      starts_at: parsed.starts_at ?? new Date().toISOString(),
      ends_at: parsed.ends_at ?? null,
      weekday: parsed.weekday ?? null,
      start_time: parsed.start_time ?? null,
      end_time: parsed.end_time ?? null,
      active: parsed.active ?? true,
      priority: parsed.priority ?? 0,
    }

    const query = parsed.id
      ? supabase.from('arena_promotions').update(payload).eq('id', parsed.id).eq('arena_id', arenaId)
      : supabase.from('arena_promotions').insert(payload)

    const { data, error } = await query.select('*').single()
    if (error) throw new Error(error.message)
    revalidateMobileContent(arenaId)
    return { success: true, data: data as MobilePromotion }
  } catch (err) {
    return { success: false, data: null, error: normalizeError(err, 'Erro ao salvar promoção') }
  }
}

export async function setArenaPromotionActiveAction(
  arenaId: string,
  promotionId: string,
  active: boolean
): Promise<MobileContentResult<null>> {
  try {
    await assertArenaAdminAccess(arenaId)
    const supabase = getSupabaseAdmin() as any
    const { error } = await supabase
      .from('arena_promotions')
      .update({ active })
      .eq('id', promotionId)
      .eq('arena_id', arenaId)

    if (error) throw new Error(error.message)
    revalidateMobileContent(arenaId)
    return { success: true, data: null }
  } catch (err) {
    return { success: false, data: null, error: normalizeError(err, 'Erro ao alterar promoção') }
  }
}

export async function listArenaHighlightsAction(arenaId: string): Promise<MobileContentResult<MobileHighlight[]>> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const supabase = getSupabaseAdmin() as any
    const { data, error } = await supabase
      .from('arena_highlights')
      .select('*, arenas(id, name), sports(id, name), municipios(codigo_ibge, nome)')
      .eq('arena_id', arenaId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return { success: true, data: (data ?? []) as MobileHighlight[] }
  } catch (err) {
    return { success: false, data: [], error: normalizeError(err, 'Erro ao listar destaques') }
  }
}

export async function upsertArenaHighlightAction(
  arenaId: string,
  input: unknown
): Promise<MobileContentResult<MobileHighlight | null>> {
  try {
    await assertArenaAdminAccess(arenaId)
    const parsed = arenaHighlightActionSchema.parse(input)
    const supabase = getSupabaseAdmin() as any
    const payload = {
      arena_id: arenaId,
      title: parsed.title,
      description: parsed.description ?? null,
      image_url: parsed.image_url ?? null,
      starts_at: parsed.starts_at ?? new Date().toISOString(),
      ends_at: parsed.ends_at ?? null,
      city_id: parsed.city_id ?? null,
      sport_id: parsed.sport_id ?? null,
      active: parsed.active ?? true,
      priority: parsed.priority ?? 0,
    }

    const query = parsed.id
      ? supabase.from('arena_highlights').update(payload).eq('id', parsed.id).eq('arena_id', arenaId)
      : supabase.from('arena_highlights').insert(payload)

    const { data, error } = await query.select('*').single()
    if (error) throw new Error(error.message)
    revalidateMobileContent(arenaId)
    return { success: true, data: data as MobileHighlight }
  } catch (err) {
    return { success: false, data: null, error: normalizeError(err, 'Erro ao salvar destaque') }
  }
}

export async function setArenaHighlightActiveAction(
  arenaId: string,
  highlightId: string,
  active: boolean
): Promise<MobileContentResult<null>> {
  try {
    await assertArenaAdminAccess(arenaId)
    const supabase = getSupabaseAdmin() as any
    const { error } = await supabase
      .from('arena_highlights')
      .update({ active })
      .eq('id', highlightId)
      .eq('arena_id', arenaId)

    if (error) throw new Error(error.message)
    revalidateMobileContent(arenaId)
    return { success: true, data: null }
  } catch (err) {
    return { success: false, data: null, error: normalizeError(err, 'Erro ao alterar destaque') }
  }
}

export async function listArenaOpenGamesAction(arenaId: string): Promise<MobileContentResult<MobileOpenGame[]>> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const supabase = getSupabaseAdmin() as any
    const { data, error } = await supabase
      .from('open_games')
      .select('*, arenas(id, name), sports(id, name), atleta:owner_atleta_id(id, nome_perfil)')
      .eq('arena_id', arenaId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) throw new Error(error.message)
    return { success: true, data: (data ?? []) as MobileOpenGame[] }
  } catch (err) {
    return { success: false, data: [], error: normalizeError(err, 'Erro ao listar jogos abertos') }
  }
}

export async function upsertOpenGameAction(
  arenaId: string,
  input: unknown
): Promise<MobileContentResult<MobileOpenGame | null>> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const parsed = openGameActionSchema.parse(input)
    if (parsed.booking_id) await assertBookingAccess(parsed.booking_id, arenaId)
    await assertAthleteBelongsToArena(arenaId, parsed.owner_atleta_id)
    const supabase = getSupabaseAdmin() as any
    const payload = {
      arena_id: arenaId,
      booking_id: parsed.booking_id ?? null,
      sport_id: parsed.sport_id,
      owner_atleta_id: parsed.owner_atleta_id,
      date: parsed.date,
      start_time: parsed.start_time,
      end_time: parsed.end_time,
      needed_players: parsed.needed_players ?? 1,
      current_players: parsed.current_players ?? 0,
      level_min_id: parsed.level_min_id ?? null,
      level_max_id: parsed.level_max_id ?? null,
      status: parsed.status ?? 'open',
      visibility: parsed.visibility ?? 'public',
      notes: parsed.notes ?? null,
    }

    const query = parsed.id
      ? supabase.from('open_games').update(payload).eq('id', parsed.id).eq('arena_id', arenaId)
      : supabase.from('open_games').insert(payload)

    const { data, error } = await query.select('*').single()
    if (error) throw new Error(error.message)
    revalidateMobileContent(arenaId)
    return { success: true, data: data as MobileOpenGame }
  } catch (err) {
    return { success: false, data: null, error: normalizeError(err, 'Erro ao salvar jogo aberto') }
  }
}

export async function listArenaAthletesForMobileContentAction(arenaId: string): Promise<MobileContentResult<MobileContentOption[]>> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const supabase = getSupabaseAdmin() as any
    const { data, error } = await supabase
      .from('arenas_atleta')
      .select('id_atleta, atleta:id_atleta(id, nome_perfil)')
      .eq('id_arena', arenaId)
      .order('data_criacao', { ascending: false })

    if (error) throw new Error(error.message)

    const athletes = (data ?? [])
      .map((row: { id_atleta: string; atleta?: { id?: string; nome_perfil?: string } | null }) => ({
        id: row.atleta?.id ?? row.id_atleta,
        name: row.atleta?.nome_perfil ?? 'Atleta sem nome',
      }))
      .filter((option: MobileContentOption) => Boolean(option.id))

    return { success: true, data: athletes }
  } catch (err) {
    return { success: false, data: [], error: normalizeError(err, 'Erro ao listar atletas da arena') }
  }
}
