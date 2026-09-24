"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAdminAccess } from '@/lib/server-auth'
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination'
import type {
  PaymentStatusRow,
  PaymentStatusSummary,
  CourtFilter,
  SportFilter,
  PaymentStatusFilters,
  AthleteDebtSummary,
  PaymentStatusAthleteSummary,
} from '@/modules/reports/types/report.types'
import { PAYMENT_STATUS_SUMMARY_EXCLUDED_SERVICOS } from '@/modules/reports/types/report.types'
import {
  resolveReportSourceFlags,
  shouldIncludeBookingRow,
  shouldIncludeTransactionRow,
} from '@/modules/reports/payment-report-sources'
import {
  buildMensalidadeRows,
  buildRateioBreakdownRows,
  liquidacaoDaCobranca,
  ratearMensalidadeNasReservas,
  resumoDaMensalidade,
  statusDaReservaDeMensalista,
  type MensalidadeContexto,
  type MensalistaCobranca,
} from '@/modules/reports/mensalidade-rows'
import {
  buildAthleteSummaries,
  contribuicaoDaLinha,
  type AthleteContribution,
} from '@/modules/reports/athlete-summary'
import { buildUsageLines, saoPauloWallClock } from '@/modules/reports/usage-lines'
import { matchPriceDay, priceAtInstant } from '@/modules/courts/lib/court-price-resolver'
import type { CourtPriceDay } from '@/modules/courts/types/price-table.types'
import type { PerfilAtleta } from '@/modules/athletes/types/perfil.types'

/**
 * `planos_mensalista_blocos` (blocos por recorrência) e a mensalidade/cobrança
 * embutidas por relação ainda não estão nos tipos gerados — mesmo cliente
 * destipado usado em `modules/bookings/actions/mensalistaActions.ts`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas/relações ainda fora dos tipos gerados */
type LooseClient = { from: (table: string) => any }
/* eslint-enable @typescript-eslint/no-explicit-any */

async function getStationTypeNames(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string[]> {
  const { data: stationTypes } = await supabase.from('station_types').select('name')
  return (stationTypes ?? [])
    .map((row) => row.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0)
}

/** Atleta filtrado casa como responsável OU como participante de qualquer natureza. */
function matchesAtleta(ids: Array<string | null | undefined>, atletaId?: string): boolean {
  if (!atletaId) return true
  return ids.some((id) => id === atletaId)
}

/**
 * Perfil filtrado casa se qualquer um dos ids (responsável OU participante)
 * tiver aquele perfil efetivo. Atleta ausente do mapa (sem papel detectado nem
 * definição manual) vale "Cliente padrão" — mesmo default de `listPerfisAtletaAction`.
 * Id `null`/`undefined` (participante avulso sem cadastro) nunca casa, porque
 * não há perfil para atribuir a ele.
 */
function matchesPerfil(
  ids: Array<string | null | undefined>,
  perfilFiltro: PerfilAtleta | undefined,
  perfilPorAtleta: Map<string, PerfilAtleta>
): boolean {
  if (!perfilFiltro) return true
  return ids.some((id) => id != null && (perfilPorAtleta.get(id) ?? 'padrao') === perfilFiltro)
}

/** Perfil efetivo de cada atleta da arena, para o filtro "Perfil de Atleta" do relatório. */
async function loadPerfilPorAtleta(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  arenaId: string
): Promise<Map<string, PerfilAtleta>> {
  const { data, error } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    }
  ).rpc('list_atleta_perfis', { p_arena_id: arenaId })

  if (error) {
    console.error(`[getPaymentStatusReportAction] list_atleta_perfis: ${error.message}`)
    return new Map()
  }

  const mapa = new Map<string, PerfilAtleta>()
  for (const linha of (data ?? []) as { atleta_id: string; perfil_efetivo: string }[]) {
    mapa.set(linha.atleta_id, (linha.perfil_efetivo as PerfilAtleta) ?? 'padrao')
  }
  return mapa
}

/** Grades de preço de um espaço, prontas para o extrato de ocupação. */
interface CourtPricing {
  bookingType: 'hourly' | 'unique'
  /** Grade por id de tabela — o snapshot gravado na reserva/plano. */
  porTabela: Map<string, CourtPriceDay[]>
  /** Grade por tipo ('mensalista', 'professor', …) — plano antigo, sem snapshot. */
  porTipo: Map<string, CourtPriceDay[]>
  /** Grade da tabela padrão do espaço: último recurso antes de desistir. */
  padrao: CourtPriceDay[] | null
}

function hhmm(value: string | null | undefined): string {
  return (value ?? '').slice(0, 5)
}

/**
 * Carrega, em 4 consultas, a grade de preço de todos os espaços da arena.
 * Só é chamado no modo extrato — o relatório normal não precisa de preço de hora.
 */
async function loadArenaPricing(
  loose: LooseClient,
  arenaId: string
): Promise<Map<string, CourtPricing>> {
  const [{ data: courts }, { data: tables }] = await Promise.all([
    loose.from('courts').select('id, booking_type').eq('arena_id', arenaId),
    loose
      .from('court_price_tables')
      .select('id, court_id, tipo, is_default')
      .eq('arena_id', arenaId),
  ])

  const tableRows = (tables ?? []) as {
    id: string
    court_id: string
    tipo: string
    is_default: boolean
  }[]

  let dayRows: {
    id: string
    price_table_id: string
    dia_semana: number
    habilitado: boolean
    hora_inicio: string
    hora_fim: string
    slot_shift_time: string | null
    preco_base: number
  }[] = []
  let bandRows: {
    price_table_day_id: string
    hora_inicio: string
    hora_fim: string
    preco: number
  }[] = []

  if (tableRows.length > 0) {
    const { data: days } = await loose
      .from('court_price_table_days')
      .select('id, price_table_id, dia_semana, habilitado, hora_inicio, hora_fim, slot_shift_time, preco_base')
      .in('price_table_id', tableRows.map((t) => t.id))
    dayRows = (days ?? []) as typeof dayRows

    if (dayRows.length > 0) {
      const { data: bands } = await loose
        .from('court_price_table_bands')
        .select('price_table_day_id, hora_inicio, hora_fim, preco')
        .in('price_table_day_id', dayRows.map((d) => d.id))
      bandRows = (bands ?? []) as typeof bandRows
    }
  }

  const bandsByDay = new Map<string, { start: string; end: string; price: number }[]>()
  for (const band of bandRows) {
    const list = bandsByDay.get(band.price_table_day_id) ?? []
    list.push({ start: hhmm(band.hora_inicio), end: hhmm(band.hora_fim), price: Number(band.preco) || 0 })
    bandsByDay.set(band.price_table_day_id, list)
  }

  const daysByTable = new Map<string, CourtPriceDay[]>()
  for (const day of dayRows) {
    const list = daysByTable.get(day.price_table_id) ?? []
    list.push({
      diaSemana: day.dia_semana,
      enabled: day.habilitado,
      startTime: hhmm(day.hora_inicio),
      endTime: hhmm(day.hora_fim),
      slotShiftTime: day.slot_shift_time ? hhmm(day.slot_shift_time) : null,
      basePrice: Number(day.preco_base) || 0,
      bands: bandsByDay.get(day.id) ?? [],
    })
    daysByTable.set(day.price_table_id, list)
  }

  const pricing = new Map<string, CourtPricing>()
  for (const court of (courts ?? []) as { id: string; booking_type: string | null }[]) {
    pricing.set(court.id, {
      bookingType: court.booking_type === 'unique' ? 'unique' : 'hourly',
      porTabela: new Map(),
      porTipo: new Map(),
      padrao: null,
    })
  }

  for (const table of tableRows) {
    const court = pricing.get(table.court_id)
    if (!court) continue
    const days = daysByTable.get(table.id) ?? []
    court.porTabela.set(table.id, days)
    court.porTipo.set(table.tipo, days)
    if (table.is_default) court.padrao = days
  }

  return pricing
}

/**
 * Faixa de horário da recorrência por trás de cada transação de Mensalidade,
 * para a linha de pagamento mostrar "20:00 às 21:00" como a de reserva mostra.
 *
 * O caminho até o plano depende de quem criou a transação:
 *  - `mensalista_pagamento` → pagamento → cobrança → mensalidade → plano
 *    (um embed aninhado só, sem consulta por linha);
 *  - `monthly_plan_month`   → o id do plano já está no próprio `source_id`.
 *
 * Devolve `null` para a transação sem plano resolvível (lançamento manual, por
 * exemplo): a tela mostra "—" em vez de derivar uma hora de `launch_date`, que
 * é uma data e renderiza como um horário fantasma.
 */
async function loadHorarioDaRecorrencia(
  loose: LooseClient,
  transactions: { id: string; category: string | null; source_type: string | null; source_id: string | null }[]
): Promise<Map<string, string | null>> {
  const horarios = new Map<string, string | null>()
  const mensalidades = transactions.filter((t) => t.category === 'Mensalidade')
  if (mensalidades.length === 0) return horarios

  const pagamentoIds = new Set<string>()
  const planoPorTransacao = new Map<string, string>()

  for (const t of mensalidades) {
    horarios.set(t.id, null)
    if (t.source_type === 'mensalista_pagamento' && t.source_id) {
      pagamentoIds.add(t.source_id)
    } else if (t.source_type === 'monthly_plan_month' && t.source_id) {
      // source_id = "<plano_id>:YYYY-MM"
      planoPorTransacao.set(t.id, t.source_id.split(':')[0])
    }
  }

  const planoPorPagamento = new Map<string, string>()
  if (pagamentoIds.size > 0) {
    const { data: pagamentos } = await loose
      .from('mensalista_pagamentos')
      .select('id, cobranca:cobranca_id(mensalidade:mensalidade_id(plano_id))')
      .in('id', [...pagamentoIds])
    for (const pagamento of (pagamentos ?? []) as {
      id: string
      cobranca?: { mensalidade?: { plano_id?: string } | null } | null
    }[]) {
      const planoId = pagamento.cobranca?.mensalidade?.plano_id
      if (planoId) planoPorPagamento.set(pagamento.id, planoId)
    }
    for (const t of mensalidades) {
      if (t.source_type !== 'mensalista_pagamento' || !t.source_id) continue
      const planoId = planoPorPagamento.get(t.source_id)
      if (planoId) planoPorTransacao.set(t.id, planoId)
    }
  }

  const planoIds = [...new Set(planoPorTransacao.values())]
  if (planoIds.length === 0) return horarios

  const [{ data: planos }, { data: blocos }] = await Promise.all([
    loose.from('planos_mensalista').select('id, horario_inicio, horario_fim').in('id', planoIds),
    loose
      .from('planos_mensalista_blocos')
      .select('plano_id, horario_inicio, horario_fim')
      .in('plano_id', planoIds),
  ])

  const faixasPorPlano = new Map<string, Set<string>>()
  for (const bloco of (blocos ?? []) as { plano_id: string; horario_inicio: string; horario_fim: string }[]) {
    const faixas = faixasPorPlano.get(bloco.plano_id) ?? new Set<string>()
    faixas.add(`${hhmm(bloco.horario_inicio)}-${hhmm(bloco.horario_fim)}`)
    faixasPorPlano.set(bloco.plano_id, faixas)
  }

  const rotuloPorPlano = new Map<string, string>()
  for (const plano of (planos ?? []) as {
    id: string
    horario_inicio: string
    horario_fim: string
  }[]) {
    // Professor com vários blocos não cabe numa faixa só — dizer qual seria mentira.
    rotuloPorPlano.set(
      plano.id,
      (faixasPorPlano.get(plano.id)?.size ?? 0) > 1
        ? 'Vários horários'
        : `${hhmm(plano.horario_inicio)} às ${hhmm(plano.horario_fim)}`
    )
  }

  for (const [transacaoId, planoId] of planoPorTransacao) {
    horarios.set(transacaoId, rotuloPorPlano.get(planoId) ?? null)
  }

  return horarios
}

/**
 * Preço da hora de uma reserva de mensalista. A cascata é a mesma de
 * `quoteSessaoMensalistaAction`: snapshot da reserva → snapshot do plano →
 * tabela do tipo mensalista do espaço → tabela padrão. A padrão também entra
 * como rede quando a tabela escolhida existe mas está sem grade — Mensalista e
 * Professor nascem vazias, e uma linha zerada no extrato seria pior que o
 * preço padrão do espaço.
 */
function buildPrecoDaHora(
  pricing: CourtPricing | undefined,
  tableIds: (string | null | undefined)[],
  tipoPreferido: string | null,
  startISO: string,
  endISO: string
): (instant: Date) => number | null {
  if (!pricing) return () => null

  const candidatos: (CourtPriceDay[] | null)[] = [
    ...tableIds.map((id) => (id ? pricing.porTabela.get(id) ?? null : null)),
    tipoPreferido ? pricing.porTipo.get(tipoPreferido) ?? null : null,
    pricing.padrao,
  ]

  const wallStart = saoPauloWallClock(new Date(startISO))
  const wallEnd = saoPauloWallClock(new Date(endISO))

  for (const days of candidatos) {
    if (!days || days.length === 0) continue
    const match = matchPriceDay(days, wallStart, wallEnd)
    if (match) return (instant: Date) => priceAtInstant(match, instant)
  }

  return () => null
}

/**
 * Ids de `planos_mensalista` que têm algum bloco (ou a coluna legada) na
 * quadra/esporte informados. `null` = sem restrição de espaço/esporte.
 */
async function resolveAllowedPlanoIds(
  loose: LooseClient,
  arenaId: string,
  opts: { courtId?: string; sportId?: string }
): Promise<Set<string> | null> {
  if (!opts.courtId && !opts.sportId) return null

  let planoQuery = loose.from('planos_mensalista').select('id, court_id, sport_id').eq('arena_id', arenaId)
  if (opts.sportId) planoQuery = planoQuery.eq('sport_id', opts.sportId)
  const { data: planos } = await planoQuery

  let allowed = new Set<string>((planos ?? []).map((p: { id: string }) => p.id))

  if (opts.courtId) {
    const legacyMatch = new Set<string>(
      (planos ?? []).filter((p: { court_id: string }) => p.court_id === opts.courtId).map((p: { id: string }) => p.id)
    )
    const { data: blocos } = await loose
      .from('planos_mensalista_blocos')
      .select('plano_id')
      .eq('arena_id', arenaId)
      .eq('court_id', opts.courtId)
    const blocoMatch = new Set<string>((blocos ?? []).map((b: { plano_id: string }) => b.plano_id))
    allowed = new Set([...allowed].filter((id) => legacyMatch.has(id) || blocoMatch.has(id)))
  }

  return allowed
}

/**
 * As mensalidades de uma competência com plano, espaço e cobranças resolvidos.
 *
 * É a fonte de verdade da cobrança do mensalista — o que o gestor vê na tela de
 * Mensalistas. O relatório lê daqui em vez das transações de Mensalidade porque
 * a transação lançada na criação do plano carrega o mensal CHEIO, enquanto a
 * competência de estreia é proporcional ao que sobrou do mês.
 */
async function loadMensalidadesDaCompetencia(
  loose: LooseClient,
  arenaId: string,
  competencia: string,
  opts: { courtId?: string; sportId?: string; atletaId?: string; planoIds?: string[] },
  contexto: string
): Promise<MensalidadeContexto[]> {
  const allowedPlanoIds = await resolveAllowedPlanoIds(loose, arenaId, opts)

  let mensalidadeQuery = loose
    .from('mensalista_mensalidades')
    .select('id, plano_id, athlete_id, competencia, valor_total, status')
    .eq('arena_id', arenaId)
    .eq('competencia', competencia)
  if (opts.atletaId) mensalidadeQuery = mensalidadeQuery.eq('athlete_id', opts.atletaId)
  if (opts.planoIds) mensalidadeQuery = mensalidadeQuery.in('plano_id', opts.planoIds)

  const { data: mensalidadesRaw, error: mensalidadeError } = await mensalidadeQuery
  if (mensalidadeError) {
    console.error(`[${contexto}] mensalidades: ${mensalidadeError.message}`)
    return []
  }

  const mensalidades = (mensalidadesRaw ?? []).filter(
    (m: { plano_id: string }) => !allowedPlanoIds || allowedPlanoIds.has(m.plano_id)
  )
  if (mensalidades.length === 0) return []

  const planoIds = [...new Set(mensalidades.map((m: { plano_id: string }) => m.plano_id))]
  const mensalidadeIds = mensalidades.map((m: { id: string }) => m.id)

  const [{ data: planos }, { data: blocos }, { data: cobrancas }] = await Promise.all([
    loose
      .from('planos_mensalista')
      .select('id, athlete_id, athlete_name, court_id, sport_id, horario_inicio, horario_fim, courts:court_id(name), sports:sport_id(name), atleta:athlete_id(telefone)')
      .in('id', planoIds),
    loose.from('planos_mensalista_blocos').select('plano_id').in('plano_id', planoIds),
    loose
      .from('mensalista_cobrancas')
      .select('id, mensalidade_id, atleta_id, nome, valor_devido, valor_pago, credito_aplicado, pago_em, ativo')
      .in('mensalidade_id', mensalidadeIds)
      .eq('ativo', true),
  ])

  const planoMap = new Map((planos ?? []).map((p: { id: string }) => [p.id, p]))
  const blocosPorPlano = new Map<string, number>()
  for (const b of blocos ?? []) {
    blocosPorPlano.set(b.plano_id, (blocosPorPlano.get(b.plano_id) ?? 0) + 1)
  }
  const cobrancasPorMensalidade = new Map<string, MensalistaCobranca[]>()
  for (const c of (cobrancas ?? []) as MensalistaCobranca[]) {
    const list = cobrancasPorMensalidade.get(c.mensalidade_id) ?? []
    list.push(c)
    cobrancasPorMensalidade.set(c.mensalidade_id, list)
  }

  return mensalidades.map(
    (m: { id: string; plano_id: string; competencia: string; valor_total: number; status: string }) => {
      const plano = planoMap.get(m.plano_id) as
        | {
            athlete_id?: string | null
            athlete_name: string
            horario_inicio?: string | null
            horario_fim?: string | null
            courts?: { name: string } | null
            sports?: { name: string } | null
            atleta?: { telefone: string | null } | null
          }
        | undefined
      const nBlocos = blocosPorPlano.get(m.plano_id) ?? 0

      return {
        id: m.id,
        planoId: m.plano_id,
        competencia: m.competencia,
        valorTotal: Number(m.valor_total ?? 0),
        status: m.status,
        atletaId: plano?.athlete_id ?? null,
        atleta: plano?.athlete_name ?? null,
        telefone: plano?.atleta?.telefone ?? null,
        espaco: nBlocos > 1 ? `${nBlocos} horários` : plano?.courts?.name ?? null,
        esporte: plano?.sports?.name ?? null,
        horario:
          nBlocos > 1
            ? 'Vários horários'
            : plano?.horario_inicio && plano?.horario_fim
              ? `${hhmm(plano.horario_inicio)} às ${hhmm(plano.horario_fim)}`
              : null,
        cobrancas: cobrancasPorMensalidade.get(m.id) ?? [],
      }
    }
  )
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Competência (`YYYY-MM-01`) de um instante, no fuso da arena. */
function competenciaDe(iso: string): string {
  const wall = saoPauloWallClock(new Date(iso))
  return `${wall.getFullYear()}-${String(wall.getMonth() + 1).padStart(2, '0')}-01`
}

/** Meia-noite de São Paulo do dia `YYYY-MM-DD` (o Brasil não tem mais horário de verão). */
function inicioDoDiaSP(date: string): string {
  return `${date}T00:00:00-03:00`
}

function proximaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  return mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`
}

/** Mensalidade de um plano num mês, pronta para o extrato por hora. */
interface MensalidadeDoExtrato {
  mensalidade: MensalidadeContexto
  resumo: ReturnType<typeof resumoDaMensalidade>
  /** Parte do valor do mês que cabe a cada reserva (id → valor). */
  partes: Map<string, number>
}

/** Contribuição de uma mensalidade (visão agregada) para o resumo por atleta: vale o responsável pelo plano. */
function contribuicaoDaMensalidade(
  m: MensalidadeContexto,
  resumo: ReturnType<typeof resumoDaMensalidade>
): AthleteContribution {
  const cancelada = resumo.status === 'Cancelado'
  return {
    atletaId: m.atletaId,
    atleta: m.atleta,
    telefone: m.telefone,
    tipo: 'financeiro',
    devido: cancelada ? 0 : resumo.devido,
    pago: resumo.pago,
    emAberto: resumo.emAberto,
    cancelado: cancelada,
  }
}

/**
 * No extrato por hora, a reserva de mensalista herda da mensalidade do seu mês
 * o status (pago/pendente/cancelado) e o valor — o devido do mês rateado pela
 * duração das reservas não canceladas do plano naquele mês.
 *
 * As reservas do rateio vêm de uma consulta própria, sem os filtros da tela:
 * com Espaço filtrado, um plano de dois blocos mostraria só um, e ratear o mês
 * inteiro nas horas de um bloco dobraria o valor delas.
 *
 * Chave do mapa: `<plano_id>:<competência>`. Plano sem mensalidade gerada
 * (anterior à camada de cobrança) fica fora, e o chamador cai na tabela de preço.
 */
async function loadMensalidadesDoExtrato(
  loose: LooseClient,
  arenaId: string,
  bookings: { plano_mensalista_id: string | null; start_time: string }[]
): Promise<Map<string, MensalidadeDoExtrato>> {
  const extrato = new Map<string, MensalidadeDoExtrato>()

  const planosPorCompetencia = new Map<string, Set<string>>()
  for (const b of bookings) {
    if (!b.plano_mensalista_id || !b.start_time) continue
    const competencia = competenciaDe(b.start_time)
    const planos = planosPorCompetencia.get(competencia) ?? new Set<string>()
    planos.add(b.plano_mensalista_id)
    planosPorCompetencia.set(competencia, planos)
  }
  if (planosPorCompetencia.size === 0) return extrato

  const mensalidades = (
    await Promise.all(
      [...planosPorCompetencia].map(([competencia, planos]) =>
        loadMensalidadesDaCompetencia(
          loose,
          arenaId,
          competencia,
          { planoIds: [...planos] },
          'getPaymentStatusReportAction:extrato'
        )
      )
    )
  ).flat()
  if (mensalidades.length === 0) return extrato

  const competencias = [...planosPorCompetencia.keys()].sort()
  const { data: reservasDoPlano, error } = await fetchAllSupabaseRows(
    loose
      .from('bookings')
      .select('id, plano_mensalista_id, start_time, end_time, status')
      .eq('arena_id', arenaId)
      .in('plano_mensalista_id', [...new Set(mensalidades.map((m) => m.planoId))])
      .gte('start_time', inicioDoDiaSP(competencias[0]))
      .lt('start_time', inicioDoDiaSP(proximaCompetencia(competencias[competencias.length - 1])))
      .order('start_time', { ascending: true })
      .order('id', { ascending: true })
  )
  if (error) console.error(`[getPaymentStatusReportAction] reservas do extrato: ${error.message}`)

  const reservasPorChave = new Map<string, { id: string; inicioISO: string; horas: number }[]>()
  for (const r of (reservasDoPlano ?? []) as {
    id: string
    plano_mensalista_id: string
    start_time: string
    end_time: string | null
    status: string | null
  }[]) {
    if (r.status === 'cancelled' || !r.end_time) continue
    const horas = (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 3_600_000
    const chave = `${r.plano_mensalista_id}:${competenciaDe(r.start_time)}`
    const lista = reservasPorChave.get(chave) ?? []
    lista.push({ id: r.id, inicioISO: r.start_time, horas })
    reservasPorChave.set(chave, lista)
  }

  for (const m of mensalidades) {
    const chave = `${m.planoId}:${m.competencia}`
    const resumo = resumoDaMensalidade(m)
    extrato.set(chave, {
      mensalidade: m,
      resumo,
      partes: ratearMensalidadeNasReservas(resumo.devido, reservasPorChave.get(chave) ?? []),
    })
  }

  return extrato
}

/** "Quanto o atleta deve" de Mensal e de Avulso na competência — usado pelos
 * cards que só aparecem quando o filtro de Atleta está selecionado. Não
 * respeita espaço/esporte: dívida é do atleta, não de uma quadra específica. */
async function computeAthleteDebtSummary(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  arenaId: string,
  atletaId: string,
  competenciaStart: string,
  competenciaEnd: string
): Promise<AthleteDebtSummary> {
  const loose = supabase as unknown as LooseClient

  const avulsoQuery = supabase
    .from('bookings')
    .select('id, athlete_id, price, status, plano_mensalista_id, cobranca_por_participante, booking_participants(atleta_id, funcao, valor, pago_em)')
    .eq('arena_id', arenaId)
    .is('plano_mensalista_id', null)
    .in('status', ['reservado', 'pending_payment'])
    .gte('start_time', competenciaStart)
    .lte('start_time', competenciaEnd + 'T23:59:59')

  const cobrancaQuery = loose
    .from('mensalista_cobrancas')
    .select('id, valor_devido, valor_pago, credito_aplicado, ativo, mensalidade:mensalidade_id!inner(arena_id, competencia)')
    .eq('atleta_id', atletaId)
    .eq('ativo', true)
    .eq('mensalidade.arena_id', arenaId)
    .eq('mensalidade.competencia', competenciaStart)

  const [avulsoResult, cobrancaResult] = await Promise.all([avulsoQuery, cobrancaQuery])

  if (avulsoResult.error) console.error(`[computeAthleteDebtSummary] avulso: ${avulsoResult.error.message}`)
  if (cobrancaResult.error) console.error(`[computeAthleteDebtSummary] mensal: ${cobrancaResult.error.message}`)

  let avulso = 0
  for (const b of (avulsoResult.data ?? []) as Array<{
    athlete_id: string | null
    price: number | null
    cobranca_por_participante: boolean
    booking_participants: Array<{ atleta_id: string; funcao: string; valor: number | null; pago_em: string | null }>
  }>) {
    const participants = (b.booking_participants ?? []).filter(
      (p) => p.funcao === 'responsavel' || p.funcao === 'convidado'
    )
    if (b.cobranca_por_participante && participants.length > 0) {
      const mine = participants.find((p) => p.atleta_id === atletaId && !p.pago_em)
      if (mine) avulso += Number(mine.valor ?? b.price ?? 0)
    } else if (b.athlete_id === atletaId) {
      avulso += Number(b.price ?? 0)
    }
  }

  let mensal = 0
  for (const c of (cobrancaResult.data ?? []) as Array<{
    valor_devido: number
    valor_pago: number
    credito_aplicado: number
  }>) {
    mensal += Math.max(0, Number(c.valor_devido ?? 0) - Number(c.valor_pago ?? 0) - Number(c.credito_aplicado ?? 0))
  }

  return { mensal: round2(mensal), avulso: round2(avulso) }
}

export async function getPaymentStatusReportAction(
  arenaId: string,
  filters: PaymentStatusFilters = {}
): Promise<{
  success: boolean
  rows?: PaymentStatusRow[]
  summary?: PaymentStatusSummary
  courts?: CourtFilter[]
  sports?: SportFilter[]
  athleteDebt?: AthleteDebtSummary | null
  athleteSummaries?: PaymentStatusAthleteSummary[]
  error?: string
}> {
  try {
    await assertArenaAdminAccess(arenaId)
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('bookings')
      .select('id, start_time, end_time, status, price, athlete_name, plano_mensalista_id, court_id, sport_id, cobranca_por_participante, courts!bookings_court_id_fkey(id, name), sports(id, name), atleta:athlete_id(id, nome_perfil, telefone), booking_participants(id, atleta_id, funcao, pago_em, valor)')
      .eq('arena_id', arenaId)
      .order('start_time', { ascending: false })
      .order('id', { ascending: false })

    if (filters.startDate) query = query.gte('start_time', filters.startDate)
    if (filters.endDate) query = query.lte('start_time', filters.endDate + 'T23:59:59')
    if (filters.courtId) query = query.eq('court_id', filters.courtId)
    if (filters.sportId) query = query.eq('sport_id', filters.sportId)
    if (filters.tipo === 'avulso') query = query.is('plano_mensalista_id', null)
    if (filters.tipo === 'mensal') query = query.not('plano_mensalista_id', 'is', null)

    let stationPaymentsQuery = supabase
      .from('station_payments')
      .select(`
        id,
        amount,
        payment_method,
        paid_by_name,
        created_at,
        station_orders!inner(
          arena_id,
          order_number,
          status,
          customer_name,
          atleta:atleta(id, nome_perfil, telefone),
          station:stations!station_orders_station_id_fkey(name, station_type:station_types(name))
        )
      `)
      .eq('station_orders.arena_id', arenaId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })

    if (filters.startDate) stationPaymentsQuery = stationPaymentsQuery.gte('created_at', filters.startDate)
    if (filters.endDate) stationPaymentsQuery = stationPaymentsQuery.lte('created_at', filters.endDate + 'T23:59:59')

    let rotativoInscricoesQuery = supabase
      .from('rotativo_inscricoes')
      .select(`
        id,
        valor_pago,
        data_inscricao,
        tipo_pagamento,
        atleta:id_atleta(id, nome_perfil, telefone),
        modo_pagamento:modo_pagamento_id(nome),
        rotativo:rotativos!inner(
          id_arena,
          status,
          data,
          esporte:id_esporte(name)
        )
      `)
      .eq('tipo_pagamento', 'avulso')
      .eq('rotativo.id_arena', arenaId)
      .order('data_inscricao', { ascending: false })
      .order('id', { ascending: false })

    if (filters.startDate) rotativoInscricoesQuery = rotativoInscricoesQuery.gte('data_inscricao', filters.startDate)
    if (filters.endDate) rotativoInscricoesQuery = rotativoInscricoesQuery.lte('data_inscricao', filters.endDate + 'T23:59:59')
    if (filters.sportId) rotativoInscricoesQuery = rotativoInscricoesQuery.eq('rotativo.id_esporte', filters.sportId)

    let rotativoCreditosQuery = supabase
      .from('rotativo_credito_movimentos')
      .select(`
        id,
        quantidade,
        valor_pago,
        created_at,
        atleta:atleta_id(id, nome_perfil, telefone),
        modo_pagamento:modo_pagamento_id(nome)
      `)
      .eq('arena_id', arenaId)
      .eq('tipo', 'compra')
      .not('valor_pago', 'is', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })

    if (filters.startDate) rotativoCreditosQuery = rotativoCreditosQuery.gte('created_at', filters.startDate)
    if (filters.endDate) rotativoCreditosQuery = rotativoCreditosQuery.lte('created_at', filters.endDate + 'T23:59:59')

    const sourceFlags = resolveReportSourceFlags(filters)
    const stationTypeNames = await getStationTypeNames(supabase)
    // Rateio troca as linhas agregadas de transação pela quebra linha a linha —
    // a consulta de transactions vira redundante nesse modo (economiza 1 query).
    const wantsRateioBreakdown = filters.tipo === 'mensal' && filters.rateio === true
    const detalharPorHora = filters.detalharPorHora === true

    let transactionsQuery = supabase
      .from('transactions')
      .select(`
        id,
        category,
        description,
        total_value,
        launch_date,
        source_type,
        source_id,
        atleta:atleta_id(id, nome_perfil, telefone),
        modo_pagamento:modo_pagamento_id(nome)
      `)
      .eq('arena_id', arenaId)
      .eq('type', 'entrada')
      .order('launch_date', { ascending: false })
      .order('id', { ascending: false })

    if (filters.startDate) transactionsQuery = transactionsQuery.gte('launch_date', filters.startDate)
    if (filters.endDate) transactionsQuery = transactionsQuery.lte('launch_date', filters.endDate)

    const [bookingsResult, courtsResult, sportsResult, stationPaymentsResult, rotativoInscricoesResult, rotativoCreditosResult, transactionsResult] = await Promise.all([
      fetchAllSupabaseRows(query),
      supabase.from('courts').select('id, name').eq('arena_id', arenaId).order('name'),
      supabase
        .from('court_sports')
        .select('sports(id, name)')
        .in('court_id',
          (await supabase.from('courts').select('id').eq('arena_id', arenaId)).data?.map(c => c.id) ?? []
        ),
      sourceFlags.includeStationPayments ? fetchAllSupabaseRows(stationPaymentsQuery) : Promise.resolve({ data: [], error: null }),
      sourceFlags.includeRotativoInscricoes ? fetchAllSupabaseRows(rotativoInscricoesQuery) : Promise.resolve({ data: [], error: null }),
      sourceFlags.includeRotativoCreditos ? fetchAllSupabaseRows(rotativoCreditosQuery) : Promise.resolve({ data: [], error: null }),
      sourceFlags.includeTransactions && !wantsRateioBreakdown
        ? fetchAllSupabaseRows(transactionsQuery)
        : Promise.resolve({ data: [], error: null }),
    ])

    // Bookings é a fonte principal e de onde vêm os filtros — se falhar, o relatório não tem como funcionar.
    if (bookingsResult.error) throw new Error(bookingsResult.error.message)

    // Fontes complementares: uma falha isolada (ex.: relacionamento inválido) não deve
    // derrubar o relatório inteiro. Registra o erro e segue com as demais fontes.
    const logSourceError = (source: string, error: { message: string } | null) => {
      if (error) console.error(`[getPaymentStatusReportAction] Falha na fonte "${source}": ${error.message}`)
    }
    logSourceError('station_payments', stationPaymentsResult.error)
    logSourceError('rotativo_inscricoes', rotativoInscricoesResult.error)
    logSourceError('rotativo_creditos', rotativoCreditosResult.error)
    logSourceError('transactions', transactionsResult.error)

    const perfilPorAtleta = filters.perfil
      ? await loadPerfilPorAtleta(supabase, arenaId)
      : new Map<string, PerfilAtleta>()

    const escopoMensalista = {
      courtId: filters.courtId,
      sportId: filters.sportId,
      atletaId: filters.atletaId,
    }

    // A mensalidade do mês entra pela cobrança, não pela transação: é o único
    // lugar que sabe o valor proporcional da estreia e se já foi recebida.
    // No extrato de ocupação ela sai — lá o mês aparece hora a hora nas reservas.
    // Com Espaço/Esporte filtrado ela também entra (restrita aos planos com
    // bloco ali, via `resolveAllowedPlanoIds`) — senão o mensalista aparecia
    // pelas reservas `reservado`, que não têm preço nem status de pagamento.
    const mensalidadesDoMes =
      filters.tipo !== 'avulso' && !detalharPorHora
        ? await loadMensalidadesDaCompetencia(
            supabase as unknown as LooseClient,
            arenaId,
            filters.startDate ?? '',
            escopoMensalista,
            'getPaymentStatusReportAction'
          )
        : []

    const planosComMensalidade = new Set(mensalidadesDoMes.map((m) => m.planoId))

    // Perfil filtra diferente dependendo da visão: agregado é 1 linha por
    // mensalidade (vale o perfil do responsável pelo plano); rateio é 1 linha
    // por cobrança (cada uma pode ser de um atleta diferente do responsável).
    const mensalidadesParaLinhas = !filters.perfil
      ? mensalidadesDoMes
      : wantsRateioBreakdown
        ? mensalidadesDoMes
            .map((m) => ({
              ...m,
              cobrancas: m.cobrancas.filter((c) =>
                matchesPerfil([c.atleta_id], filters.perfil, perfilPorAtleta)
              ),
            }))
            .filter((m) => m.cobrancas.length > 0)
        : mensalidadesDoMes.filter((m) => matchesPerfil([m.atletaId], filters.perfil, perfilPorAtleta))

    const mensalidadeRows = wantsRateioBreakdown
      ? buildRateioBreakdownRows(mensalidadesParaLinhas)
      : buildMensalidadeRows(mensalidadesParaLinhas)

    const bookingsFiltradas = (bookingsResult.data ?? [])
      .filter((b: any) => shouldIncludeBookingRow(b, { detalharPorHora }))
      // Mês já representado pela mensalidade: as sessões dele não são cobranças
      // à parte. Sem isso, um mês cujas reservas ainda estão "reservado" (os
      // meses à frente) apareceria como a mensalidade MAIS cada sessão.
      .filter(
        (b: { plano_mensalista_id: string | null }) =>
          !b.plano_mensalista_id || !planosComMensalidade.has(b.plano_mensalista_id)
      )
      .filter((b: { atleta?: { id: string } | null; booking_participants?: { atleta_id: string }[] }) => {
        const ids = [b.atleta?.id, ...(b.booking_participants ?? []).map((p) => p.atleta_id)]
        return matchesAtleta(ids, filters.atletaId) && matchesPerfil(ids, filters.perfil, perfilPorAtleta)
      })

    // Grade de preço só é necessária no extrato, e só para reserva de mensalista
    // (o avulso vale o que foi cobrado nele). Os planos entram para resolver o
    // snapshot de tabela de quem foi criado com tabela escolhida (ex.: Professor).
    const pricingPorEspaco = detalharPorHora
      ? await loadArenaPricing(supabase as unknown as LooseClient, arenaId)
      : new Map<string, CourtPricing>()

    const tabelaPorPlano = new Map<string, string | null>()
    if (detalharPorHora) {
      const planoIds = [
        ...new Set(
          bookingsFiltradas
            .map((b: { plano_mensalista_id: string | null }) => b.plano_mensalista_id)
            .filter((id: string | null): id is string => Boolean(id))
        ),
      ]
      if (planoIds.length > 0) {
        const { data: planos } = await (supabase as unknown as LooseClient)
          .from('planos_mensalista')
          .select('id, price_table_id')
          .in('id', planoIds)
        for (const plano of (planos ?? []) as { id: string; price_table_id: string | null }[]) {
          tabelaPorPlano.set(plano.id, plano.price_table_id)
        }
      }
    }

    // Extrato: status e valor da hora de mensalista vêm da mensalidade do mês.
    const mensalidadesDoExtrato = detalharPorHora
      ? await loadMensalidadesDoExtrato(
          supabase as unknown as LooseClient,
          arenaId,
          bookingsFiltradas as { plano_mensalista_id: string | null; start_time: string }[]
        )
      : new Map<string, MensalidadeDoExtrato>()

    // Resumo por atleta: as mensalidades contam pela cobrança (uma vez por
    // plano/mês) e as horas das reservas delas entram só como uso.
    const contribuicoesExtras: AthleteContribution[] = []
    const linhasSemDinheiroProprio = new Set<string>()
    const mensalidadesNoResumo = new Set<string>()

    const bookingRows: PaymentStatusRow[] = []
    for (const b of bookingsFiltradas as any[]) {
      let status: PaymentStatusRow['status'] = 'Pendente'
      if (b.status === 'confirmed') status = 'Pago'
      else if (b.status === 'cancelled') status = 'Cancelado'

      const billingParticipants = (b.booking_participants ?? []).filter(
        (p: { funcao?: string }) => p.funcao === 'responsavel' || p.funcao === 'convidado'
      )
      let valor: number | null = b.price ?? null
      if (b.cobranca_por_participante && billingParticipants.length > 0) {
        if (b.status === 'reservado') {
          const unpaid = billingParticipants.filter((p: { pago_em?: string | null }) => !p.pago_em)
          valor = unpaid.reduce(
            (sum: number, p: { valor?: number | null }) =>
              sum + Number(p.valor ?? b.price ?? 0),
            0
          )
        } else {
          valor = billingParticipants.reduce(
            (sum: number, p: { valor?: number | null }) =>
              sum + Number(p.valor ?? b.price ?? 0),
            0
          )
        }
      }

      const ehMensal = Boolean(b.plano_mensalista_id)
      const doExtrato =
        detalharPorHora && ehMensal && b.start_time
          ? mensalidadesDoExtrato.get(`${b.plano_mensalista_id}:${competenciaDe(b.start_time)}`)
          : undefined
      if (doExtrato) status = statusDaReservaDeMensalista(b.status, doExtrato.resumo.status)

      const base = {
        // Reserva de quem não tem cadastro guarda o nome digitado pelo gestor —
        // melhor mostrá-lo do que cair no rótulo genérico "Avulsa" da tela.
        atleta: b.atleta?.nome_perfil ?? (b.athlete_name || null),
        atletaId: b.atleta?.id ?? null,
        telefone: b.atleta?.telefone ?? null,
        // Mesmo rótulo da linha de mensalidade: é o mesmo serviço nas duas visões.
        servico: (ehMensal ? 'Mensalista' : 'Avulso') as PaymentStatusRow['servico'],
        espaco: b.courts?.name ?? null,
        esporte: b.sports?.name ?? null,
        status,
      }

      if (!detalharPorHora) {
        const horas =
          b.end_time && b.start_time
            ? (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3_600_000
            : null
        bookingRows.push({
          id: b.id,
          data: b.start_time,
          fim: b.end_time ?? null,
          horas: horas != null && horas > 0 ? Math.round(horas * 100) / 100 : null,
          valor,
          ...base,
        })
        continue
      }

      const pricing = pricingPorEspaco.get(b.court_id)

      if (doExtrato) {
        // Sessão cancelada fica sem valor: não entrou no rateio do mês.
        const parte = b.status === 'cancelled' ? null : doExtrato.partes.get(b.id) ?? null
        const linhasDoMes = buildUsageLines({
          startISO: b.start_time,
          endISO: b.end_time,
          valorReserva: parte,
          bookingType: pricing?.bookingType ?? 'hourly',
        })
        linhasDoMes.forEach((linha, index) => {
          const id = linhasDoMes.length > 1 ? `${b.id}-h${index}` : b.id
          linhasSemDinheiroProprio.add(id)
          bookingRows.push({
            id,
            data: linha.inicioISO,
            fim: linha.fimISO,
            horas: linha.horas,
            valor: linha.valor,
            ...base,
          })
          if (status !== 'Cancelado') {
            contribuicoesExtras.push({
              atletaId: base.atletaId,
              atleta: base.atleta,
              telefone: base.telefone,
              horas: linha.horas,
              tipo: 'uso',
            })
          }
        })

        const { mensalidade, resumo } = doExtrato
        if (!mensalidadesNoResumo.has(mensalidade.id)) {
          mensalidadesNoResumo.add(mensalidade.id)
          contribuicoesExtras.push(contribuicaoDaMensalidade(mensalidade, resumo))
        }
        continue
      }

      const linhas = buildUsageLines({
        startISO: b.start_time,
        endISO: b.end_time,
        // Mensalista: a reserva guarda a fatia da mensalidade, não o preço da
        // hora — quem vale é a tabela. Avulso: vale o que foi cobrado.
        valorReserva: ehMensal ? null : valor,
        valorFallback: valor,
        bookingType: pricing?.bookingType ?? 'hourly',
        // `bookings.price_table_id` existe no banco mas ninguém escreve nele
        // ainda (só o plano guarda o snapshot), então a cascata começa no plano.
        precoDaHora: buildPrecoDaHora(
          pricing,
          [ehMensal ? tabelaPorPlano.get(b.plano_mensalista_id) ?? null : null],
          ehMensal ? 'mensalista' : null,
          b.start_time,
          b.end_time
        ),
      })

      linhas.forEach((linha, index) => {
        bookingRows.push({
          id: linhas.length > 1 ? `${b.id}-h${index}` : b.id,
          data: linha.inicioISO,
          fim: linha.fimISO,
          horas: linha.horas,
          valor: linha.valor,
          ...base,
        })
      })
    }

    const stationPaymentRows: PaymentStatusRow[] = (stationPaymentsResult.data ?? [])
      .filter((payment: { station_orders?: { atleta?: { id: string } | null } | null }) => {
        const ids = [payment.station_orders?.atleta?.id]
        return matchesAtleta(ids, filters.atletaId) && matchesPerfil(ids, filters.perfil, perfilPorAtleta)
      })
      .map((payment: any) => {
      const order = payment.station_orders
      const station = order?.station
      const stationTypeName = station?.station_type?.name ?? null

      let status: PaymentStatusRow['status'] = 'Pago'
      if (order?.status === 'cancelled') status = 'Cancelado'

      return {
        id: `station-payment-${payment.id}`,
        data: payment.created_at,
        atleta: payment.paid_by_name ?? order?.atleta?.nome_perfil ?? order?.customer_name ?? null,
        atletaId: order?.atleta?.id ?? null,
        telefone: order?.atleta?.telefone ?? null,
        servico: 'Comanda',
        espaco: station?.name ?? stationTypeName,
        esporte: payment.payment_method ?? null,
        valor: payment.amount ?? null,
        status,
      }
    })

    const rotativoInscricaoRows: PaymentStatusRow[] = (rotativoInscricoesResult.data ?? [])
      .filter((inscricao: { atleta?: { id: string } | null }) => {
        const ids = [inscricao.atleta?.id]
        return matchesAtleta(ids, filters.atletaId) && matchesPerfil(ids, filters.perfil, perfilPorAtleta)
      })
      .map((inscricao: any) => {
      const rotativo = inscricao.rotativo
      let status: PaymentStatusRow['status'] = 'Pago'
      if (rotativo?.status === 'desativado') status = 'Cancelado'

      return {
        id: `rotativo-inscricao-${inscricao.id}`,
        data: inscricao.data_inscricao,
        atleta: inscricao.atleta?.nome_perfil ?? null,
        atletaId: inscricao.atleta?.id ?? null,
        telefone: inscricao.atleta?.telefone ?? null,
        servico: 'Rotativo',
        espaco: rotativo?.esporte?.name ?? null,
        esporte: inscricao.modo_pagamento?.nome ?? null,
        valor: inscricao.valor_pago ?? null,
        status,
      }
    })

    const rotativoCreditoRows: PaymentStatusRow[] = (rotativoCreditosResult.data ?? [])
      .filter((mov: { atleta?: { id: string } | null }) => {
        const ids = [mov.atleta?.id]
        return matchesAtleta(ids, filters.atletaId) && matchesPerfil(ids, filters.perfil, perfilPorAtleta)
      })
      .map((mov: any) => ({
      id: `rotativo-credito-${mov.id}`,
      data: mov.created_at,
      atleta: mov.atleta?.nome_perfil ?? null,
      atletaId: mov.atleta?.id ?? null,
      telefone: mov.atleta?.telefone ?? null,
      servico: 'Crédito rotativo',
      espaco: `${mov.quantidade} crédito${mov.quantidade !== 1 ? 's' : ''}`,
      esporte: mov.modo_pagamento?.nome ?? null,
      valor: mov.valor_pago ?? null,
      status: 'Pago' as const,
    }))

    const transacoesFiltradas = (transactionsResult.data ?? [])
      .filter((t: any) =>
        shouldIncludeTransactionRow(t.category ?? '', t.description, sourceFlags.mode, stationTypeNames, {
          detalharPorHora,
          sourceType: t.source_type,
        })
      )
      .filter((t: { atleta?: { id: string } | null }) => {
        const ids = [t.atleta?.id]
        return matchesAtleta(ids, filters.atletaId) && matchesPerfil(ids, filters.perfil, perfilPorAtleta)
      })

    const horarioPorTransacao = await loadHorarioDaRecorrencia(
      supabase as unknown as LooseClient,
      transacoesFiltradas as {
        id: string
        category: string | null
        source_type: string | null
        source_id: string | null
      }[]
    )

    const transactionRows: PaymentStatusRow[] = transacoesFiltradas.map((t: any) => ({
      id: `transaction-${t.id}`,
      data: t.launch_date,
      // `launch_date` é uma data (guardada à meia-noite): sem rótulo da
      // recorrência, a coluna Horário mostra "—" em vez de um horário fantasma.
      horario: horarioPorTransacao.get(t.id) ?? null,
      atleta: t.atleta?.nome_perfil ?? null,
      atletaId: t.atleta?.id ?? null,
      telefone: t.atleta?.telefone ?? null,
      servico: t.category === 'Mensalidade' ? 'Mensalista' : 'Entrada Manual',
      espaco: t.category === 'Mensalidade' ? (t.description ?? null) : (t.category ?? null),
      esporte: t.modo_pagamento?.nome ?? null,
      valor: t.total_value ?? null,
      status: 'Pago' as const,
    }))


    const rows: PaymentStatusRow[] = [
      ...bookingRows,
      ...stationPaymentRows,
      ...rotativoInscricaoRows,
      ...rotativoCreditoRows,
      ...transactionRows,
      ...mensalidadeRows,
    ].sort(
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
    )

    if (wantsRateioBreakdown) {
      for (const m of mensalidadesParaLinhas) {
        const cancelada = resumoDaMensalidade(m).status === 'Cancelado'
        for (const c of m.cobrancas) {
          const { settled, remaining, isPago } = liquidacaoDaCobranca(c)
          contribuicoesExtras.push({
            atletaId: c.atleta_id,
            atleta: c.nome,
            tipo: 'financeiro',
            devido: cancelada ? 0 : Number(c.valor_devido ?? 0),
            pago: settled,
            emAberto: cancelada || isPago ? 0 : remaining,
            cancelado: cancelada,
          })
        }
      }
    } else {
      for (const m of mensalidadesParaLinhas) {
        contribuicoesExtras.push(contribuicaoDaMensalidade(m, resumoDaMensalidade(m)))
      }
    }
    for (const r of mensalidadeRows) linhasSemDinheiroProprio.add(r.id)

    const athleteSummaries = buildAthleteSummaries([
      ...contribuicoesExtras,
      ...rows
        .filter(
          (r) =>
            !linhasSemDinheiroProprio.has(r.id) &&
            !PAYMENT_STATUS_SUMMARY_EXCLUDED_SERVICOS.includes(r.servico)
        )
        .map(contribuicaoDaLinha),
    ])

    const athleteDebt = filters.atletaId
      ? await computeAthleteDebtSummary(
          supabase,
          arenaId,
          filters.atletaId,
          filters.startDate ?? '',
          filters.endDate ?? filters.startDate ?? ''
        )
      : null

    const summary: PaymentStatusSummary = rows.reduce(
      (acc, r) => {
        if (PAYMENT_STATUS_SUMMARY_EXCLUDED_SERVICOS.includes(r.servico)) return acc
        if (r.status === 'Pago') {
          acc.totalPago += r.valor ?? 0
          acc.countPago++
        } else if (r.status === 'Pendente') {
          acc.totalPendente += r.valor ?? 0
          acc.countPendente++
        } else if (r.status === 'Cancelado') {
          acc.totalCancelado += r.valor ?? 0
          acc.countCancelado++
        }
        // "Quanto cobrar" e horas ocupadas ignoram o que foi cancelado.
        if (r.status !== 'Cancelado') {
          acc.totalACobrar += r.valor ?? 0
          acc.totalHoras += r.horas ?? 0
        }
        return acc
      },
      {
        totalPago: 0,
        totalPendente: 0,
        totalCancelado: 0,
        countPago: 0,
        countPendente: 0,
        countCancelado: 0,
        totalACobrar: 0,
        totalHoras: 0,
      }
    )
    summary.totalACobrar = Math.round(summary.totalACobrar * 100) / 100
    summary.totalHoras = Math.round(summary.totalHoras * 100) / 100

    const courts: CourtFilter[] = courtsResult.data ?? []

    const sportsMap = new Map<string, SportFilter>()
    for (const item of sportsResult.data ?? []) {
      const s = Array.isArray(item.sports) ? item.sports[0] : item.sports
      if (s?.id) sportsMap.set(s.id, { id: s.id, name: s.name })
    }
    const sports: SportFilter[] = [...sportsMap.values()]

    return { success: true, rows, summary, courts, sports, athleteDebt, athleteSummaries }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar relatório'
    return { success: false, error: message }
  }
}
