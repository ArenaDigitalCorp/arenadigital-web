'use server'

/* eslint-disable @typescript-eslint/no-explicit-any -- court_price_table* não estão nos tipos gerados até o fim da Fase 2 */

import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  assertArenaAdminAccess,
  assertArenaBackofficeAccess,
  assertCourtAccess,
} from '@/lib/server-auth'
import { revalidatePath } from 'next/cache'
import {
  createPriceTableSchema,
  upsertPriceTableSchema,
  type PriceDayInput,
  type UpsertPriceTableInput,
} from '@/modules/courts/schemas/price-table.schema'
import { dayConfigFromPriceDays } from '@/modules/courts/lib/price-table-editor'
import {
  MAX_PRICE_TABLES_PER_COURT,
  isReservedPriceTableKind,
  type CourtPriceTable,
} from '@/modules/courts/types/price-table.types'

/**
 * Estas tabelas ainda não estão nos tipos gerados (`supabase.types.ts` é
 * regenerado no fim da Fase 2). Até lá, acessamos via cliente destipado —
 * mesmo padrão de `saveBackofficeBookingBundleAction`.
 */
type LooseClient = {
  from: (table: string) => any
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
}

function loose(): LooseClient {
  return getSupabaseAdmin() as unknown as LooseClient
}

type TableRow = {
  id: string
  court_id: string
  arena_id: string
  nome: string
  tipo: CourtPriceTable['tipo']
  is_default: boolean
  aplica_a: string[] | null
  ativo: boolean
  ordem: number
}
type DayRow = {
  id: string
  price_table_id: string
  dia_semana: number
  habilitado: boolean
  hora_inicio: string
  hora_fim: string
  slot_shift_time: string | null
  preco_base: number | string
}
type BandRow = {
  id: string
  price_table_day_id: string
  hora_inicio: string
  hora_fim: string
  preco: number | string
}

function hhmm(value: string | null | undefined): string {
  if (!value) return '00:00'
  const [h, m] = value.split(':')
  return `${(h ?? '00').padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`
}

function assembleTables(
  tables: TableRow[],
  days: DayRow[],
  bands: BandRow[],
): CourtPriceTable[] {
  const bandsByDay = new Map<string, BandRow[]>()
  for (const b of bands) {
    const list = bandsByDay.get(b.price_table_day_id) ?? []
    list.push(b)
    bandsByDay.set(b.price_table_day_id, list)
  }
  const daysByTable = new Map<string, DayRow[]>()
  for (const d of days) {
    const list = daysByTable.get(d.price_table_id) ?? []
    list.push(d)
    daysByTable.set(d.price_table_id, list)
  }

  return tables
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((t) => ({
      id: t.id,
      courtId: t.court_id,
      arenaId: t.arena_id,
      nome: t.nome,
      tipo: t.tipo,
      isDefault: t.is_default,
      aplicaA: (t.aplica_a ?? []) as CourtPriceTable['aplicaA'],
      ativo: t.ativo,
      ordem: t.ordem,
      days: (daysByTable.get(t.id) ?? [])
        .slice()
        .sort((a, b) => a.dia_semana - b.dia_semana)
        .map((d) => ({
          id: d.id,
          diaSemana: d.dia_semana,
          enabled: d.habilitado,
          startTime: hhmm(d.hora_inicio),
          endTime: hhmm(d.hora_fim),
          slotShiftTime: d.slot_shift_time ? hhmm(d.slot_shift_time) : null,
          basePrice: Number(d.preco_base) || 0,
          bands: (bandsByDay.get(d.id) ?? [])
            .slice()
            .sort((a, b) => hhmm(a.hora_inicio).localeCompare(hhmm(b.hora_inicio)))
            .map((band) => ({
              id: band.id,
              start: hhmm(band.hora_inicio),
              end: hhmm(band.hora_fim),
              price: Number(band.preco) || 0,
            })),
        })),
    }))
}

export async function listCourtPriceTablesAction(
  arenaId: string,
  courtId: string,
): Promise<{ success: boolean; data: CourtPriceTable[]; error?: string }> {
  try {
    await assertArenaAdminAccess(arenaId)
    await assertCourtAccess(courtId, arenaId)
    const supabase = loose()

    const { data: tables, error: tablesError } = await supabase
      .from('court_price_tables')
      .select('id, court_id, arena_id, nome, tipo, is_default, aplica_a, ativo, ordem')
      .eq('court_id', courtId)
      .order('ordem', { ascending: true })

    if (tablesError) throw new Error(tablesError.message)
    const tableRows = (tables ?? []) as TableRow[]
    if (tableRows.length === 0) return { success: true, data: [] }

    const tableIds = tableRows.map((t) => t.id)
    const { data: days, error: daysError } = await supabase
      .from('court_price_table_days')
      .select('id, price_table_id, dia_semana, habilitado, hora_inicio, hora_fim, slot_shift_time, preco_base')
      .in('price_table_id', tableIds)

    if (daysError) throw new Error(daysError.message)
    const dayRows = (days ?? []) as DayRow[]

    let bandRows: BandRow[] = []
    if (dayRows.length > 0) {
      const { data: bands, error: bandsError } = await supabase
        .from('court_price_table_bands')
        .select('id, price_table_day_id, hora_inicio, hora_fim, preco')
        .in('price_table_day_id', dayRows.map((d) => d.id))
      if (bandsError) throw new Error(bandsError.message)
      bandRows = (bands ?? []) as BandRow[]
    }

    return { success: true, data: assembleTables(tableRows, dayRows, bandRows) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar tabelas de preço'
    return { success: false, data: [], error: message }
  }
}

export type BookingPriceTableOption = {
  id: string
  nome: string
  tipo: CourtPriceTable['tipo']
  isDefault: boolean
  aplicaA: CourtPriceTable['aplicaA']
  ativo: boolean
}

/**
 * Lista enxuta para o modal de reserva (qualquer perfil de backoffice, não só
 * admin). Sem dias/faixas — o valor vem de `quoteCourtPriceAction`.
 */
export async function listCourtPriceTableOptionsAction(
  arenaId: string,
  courtId: string,
): Promise<{ success: boolean; data: BookingPriceTableOption[]; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    await assertCourtAccess(courtId, arenaId)

    const { data, error } = await loose()
      .from('court_price_tables')
      .select('id, nome, tipo, is_default, aplica_a, ativo')
      .eq('court_id', courtId)
      .eq('ativo', true)
      .order('ordem', { ascending: true })

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<
      Pick<TableRow, 'id' | 'nome' | 'tipo' | 'is_default' | 'aplica_a' | 'ativo'>
    >
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        nome: r.nome,
        tipo: r.tipo,
        isDefault: r.is_default,
        aplicaA: (r.aplica_a ?? []) as CourtPriceTable['aplicaA'],
        ativo: r.ativo,
      })),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar tabelas de preço'
    return { success: false, data: [], error: message }
  }
}

export async function quoteCourtPriceAction(
  arenaId: string,
  courtId: string,
  priceTableId: string | null,
  startISO: string,
  endISO: string,
): Promise<{ success: boolean; value: number; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    await assertCourtAccess(courtId, arenaId)

    const start = new Date(startISO)
    const end = new Date(endISO)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new Error('Intervalo inválido')
    }

    const { data, error } = await loose().rpc('resolve_court_price', {
      p_court_id: courtId,
      p_price_table_id: priceTableId ?? null,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    })

    if (error) throw new Error(error.message)
    return { success: true, value: Number(data) || 0 }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao calcular o valor sugerido'
    return { success: false, value: 0, error: message }
  }
}

export async function createCourtPriceTableAction(
  arenaId: string,
  input: { courtId: string; nome: string },
): Promise<{ success: boolean; data?: CourtPriceTable; error?: string }> {
  try {
    await assertArenaAdminAccess(arenaId)
    const parsed = createPriceTableSchema.parse(input)
    await assertCourtAccess(parsed.courtId, arenaId)
    const supabase = loose()

    const { count, error: countError } = await supabase
      .from('court_price_tables')
      .select('id', { count: 'exact', head: true })
      .eq('court_id', parsed.courtId)
    if (countError) throw new Error(countError.message)
    if ((count ?? 0) >= MAX_PRICE_TABLES_PER_COURT) {
      throw new Error(`Limite de ${MAX_PRICE_TABLES_PER_COURT} tabelas de preço por espaço.`)
    }

    const { data: maxOrdem } = await supabase
      .from('court_price_tables')
      .select('ordem')
      .eq('court_id', parsed.courtId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from('court_price_tables')
      .insert({
        court_id: parsed.courtId,
        arena_id: arenaId,
        nome: parsed.nome,
        tipo: 'custom',
        is_default: false,
        aplica_a: [],
        ativo: true,
        ordem: (maxOrdem?.ordem ?? 2) + 1,
      })
      .select('id, court_id, arena_id, nome, tipo, is_default, aplica_a, ativo, ordem')
      .single()

    if (error) throw new Error(error.message)
    revalidatePath(`/dashboard/arenas/${arenaId}`)
    return { success: true, data: assembleTables([data as TableRow], [], [])[0] }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao criar tabela de preço'
    return { success: false, error: message }
  }
}

export async function deleteCourtPriceTableAction(
  arenaId: string,
  courtId: string,
  tableId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaAdminAccess(arenaId)
    await assertCourtAccess(courtId, arenaId)
    const supabase = loose()

    const { data: row, error: fetchError } = await supabase
      .from('court_price_tables')
      .select('tipo, is_default')
      .eq('id', tableId)
      .eq('court_id', courtId)
      .single()
    if (fetchError) throw new Error(fetchError.message)
    if (isReservedPriceTableKind(row.tipo)) {
      throw new Error('As tabelas Padrão, Mensalista e Professor não podem ser excluídas.')
    }
    if (row.is_default) {
      throw new Error('Defina outra tabela como padrão antes de excluir esta.')
    }

    const { error } = await supabase
      .from('court_price_tables')
      .delete()
      .eq('id', tableId)
      .eq('court_id', courtId)
    if (error) throw new Error(error.message)

    revalidatePath(`/dashboard/arenas/${arenaId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir tabela de preço'
    return { success: false, error: message }
  }
}

export async function setDefaultCourtPriceTableAction(
  arenaId: string,
  courtId: string,
  tableId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaAdminAccess(arenaId)
    await assertCourtAccess(courtId, arenaId)
    const supabase = loose()

    // Limpa antes de marcar para não colidir com o índice único parcial.
    const { error: clearError } = await supabase
      .from('court_price_tables')
      .update({ is_default: false })
      .eq('court_id', courtId)
      .neq('id', tableId)
    if (clearError) throw new Error(clearError.message)

    const { error } = await supabase
      .from('court_price_tables')
      .update({ is_default: true })
      .eq('id', tableId)
      .eq('court_id', courtId)
    if (error) throw new Error(error.message)

    revalidatePath(`/dashboard/arenas/${arenaId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao definir a tabela padrão'
    return { success: false, error: message }
  }
}

/** Substitui dias (cascade apaga as faixas) e reinsere só os habilitados. */
async function writeTableDays(
  supabase: LooseClient,
  arenaId: string,
  tableId: string,
  days: PriceDayInput[],
) {
  const { error: delError } = await supabase
    .from('court_price_table_days')
    .delete()
    .eq('price_table_id', tableId)
  if (delError) throw new Error(delError.message)

  for (const day of days.filter((d) => d.enabled)) {
    const { data: dayRow, error: dayError } = await supabase
      .from('court_price_table_days')
      .insert({
        price_table_id: tableId,
        arena_id: arenaId,
        dia_semana: day.diaSemana,
        habilitado: true,
        hora_inicio: day.startTime,
        hora_fim: day.endTime,
        slot_shift_time: day.slotShiftTime,
        preco_base: day.basePrice,
      })
      .select('id')
      .single()
    if (dayError) throw new Error(dayError.message)

    if (day.bands.length > 0) {
      const { error: bandsError } = await supabase
        .from('court_price_table_bands')
        .insert(
          day.bands.map((band, index) => ({
            price_table_day_id: dayRow.id,
            arena_id: arenaId,
            hora_inicio: band.start,
            hora_fim: band.end,
            preco: band.price,
            ordem: index,
          })),
        )
      if (bandsError) throw new Error(bandsError.message)
    }
  }
}

/** Espelho da tabela Padrão -> day_config / price (transição; sai na Fase 2b). */
async function mirrorPadraoToCourt(
  supabase: LooseClient,
  arenaId: string,
  courtId: string,
  days: PriceDayInput[],
) {
  const dayConfig = dayConfigFromPriceDays(
    days.map((d) => ({
      diaSemana: d.diaSemana,
      enabled: d.enabled,
      startTime: d.startTime,
      endTime: d.endTime,
      slotShiftTime: d.slotShiftTime ?? null,
      basePrice: d.basePrice,
      bands: d.bands,
    })),
  )
  const { error } = await supabase
    .from('courts')
    .update({
      day_config: dayConfig,
      price: dayConfig[0]?.price ?? 0,
      available_days: dayConfig.map((d) => d.day),
    })
    .eq('id', courtId)
    .eq('arena_id', arenaId)
  if (error) throw new Error(error.message)
}

/**
 * Persiste as 3 tabelas fixas logo após criar o espaço. O trigger do banco já
 * semeou Padrão/Mensalista/Professor a partir do `day_config`; aqui gravamos os
 * dias exatamente como o gestor preencheu no formulário (as opcionais vazias
 * simplesmente ficam sem dias).
 */
export async function saveDraftPriceTablesAction(
  arenaId: string,
  courtId: string,
  drafts: { tipo: string; nome: string; days: PriceDayInput[] }[],
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaAdminAccess(arenaId)
    await assertCourtAccess(courtId, arenaId)
    const supabase = loose()

    const { data, error } = await supabase
      .from('court_price_tables')
      .select('id, tipo')
      .eq('court_id', courtId)
    if (error) throw new Error(error.message)

    const byTipo = new Map<string, string>()
    for (const row of (data ?? []) as { id: string; tipo: string }[]) {
      byTipo.set(row.tipo, row.id)
    }

    for (const draft of drafts) {
      const tableId = byTipo.get(draft.tipo)
      if (!tableId) continue

      const nome = draft.nome.trim()
      if (nome) {
        const { error: nameError } = await supabase
          .from('court_price_tables')
          .update({ nome })
          .eq('id', tableId)
          .eq('court_id', courtId)
        if (nameError) throw new Error(nameError.message)
      }

      await writeTableDays(supabase, arenaId, tableId, draft.days)

      if (draft.tipo === 'padrao') {
        await mirrorPadraoToCourt(supabase, arenaId, courtId, draft.days)
      }
    }

    revalidatePath(`/dashboard/arenas/${arenaId}`)
    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao salvar as tabelas de preço'
    return { success: false, error: message }
  }
}

/**
 * Reescreve cabeçalho + dias + faixas de uma tabela. Não é atômico ainda (a RPC
 * transacional entra na Fase 2b); a ordem delete→insert minimiza a janela.
 * Quando a tabela é a `padrao`, espelha `courts.day_config` / `courts.price`
 * para manter a grade e o app consistentes até o trigger de espelho do banco.
 */
export async function upsertCourtPriceTableAction(
  arenaId: string,
  input: UpsertPriceTableInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaAdminAccess(arenaId)
    const parsed = upsertPriceTableSchema.parse(input)
    await assertCourtAccess(parsed.courtId, arenaId)
    const supabase = loose()

    if (!parsed.tableId) {
      throw new Error('Tabela inexistente. Crie a tabela antes de salvar as faixas.')
    }

    const { data: current, error: currentError } = await supabase
      .from('court_price_tables')
      .select('id, tipo')
      .eq('id', parsed.tableId)
      .eq('court_id', parsed.courtId)
      .single()
    if (currentError) throw new Error(currentError.message)

    // Cabeçalho: `tipo` e `is_default` nunca mudam por aqui.
    const { error: headerError } = await supabase
      .from('court_price_tables')
      .update({
        nome: parsed.nome,
        aplica_a: parsed.aplicaA,
        ativo: parsed.ativo,
        ordem: parsed.ordem,
      })
      .eq('id', parsed.tableId)
      .eq('court_id', parsed.courtId)
    if (headerError) throw new Error(headerError.message)

    await writeTableDays(supabase, arenaId, parsed.tableId, parsed.days)

    if (current.tipo === 'padrao') {
      await mirrorPadraoToCourt(supabase, arenaId, parsed.courtId, parsed.days)
    }

    revalidatePath(`/dashboard/arenas/${arenaId}`)
    revalidatePath(`/dashboard/arenas/${arenaId}/courts`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar a tabela de preço'
    return { success: false, error: message }
  }
}
