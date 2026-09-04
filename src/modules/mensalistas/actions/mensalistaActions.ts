'use server'

import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  assertArenaBackofficeAccess,
  requireAuthenticatedDbUser,
} from '@/lib/server-auth'
import { revalidatePath } from 'next/cache'
import { differenceInCalendarDays, format, parseISO, startOfMonth } from 'date-fns'
import {
  configureRateioSchema,
  registrarPagamentoSchema,
  lancarCreditoSchema,
  retirarCreditoSchema,
  setEncerramentoSchema,
  reajustarValorSchema,
  competenciaSchema,
  uuidSchema,
} from '@/modules/mensalistas/schemas/mensalista.schema'
import type {
  AtrasoCompetencia,
  CobrancaRow,
  CreditoRow,
  MensalidadeRow,
  MensalistaDetalhe,
  MensalistaResumo,
  MensalistasOverview,
  PagamentoComContexto,
  PagamentoRow,
  PlanoMensalistaComDetalhes,
  ReajusteRow,
  RecorrenciaResumo,
  SituacaoPagamento,
  StatusPlano,
} from '@/modules/mensalistas/types/mensalista.types'

/** First day of the current real calendar month, as `YYYY-MM-DD`. */
function currentMonthStartISO(): string {
  return format(startOfMonth(new Date()), 'yyyy-MM-dd')
}

const PLANO_SELECT =
  '*, atleta:athlete_id(id, nome_perfil, telefone), sports:sport_id(id, name), court:court_id(id, name)'

function revalidateMensalistaPaths(arenaId: string, athleteId?: string) {
  revalidatePath(`/dashboard/arenas/${arenaId}/mensalistas`)
  if (athleteId) {
    revalidatePath(`/dashboard/arenas/${arenaId}/mensalistas/${athleteId}`)
  }
  revalidatePath(`/dashboard/finance/${arenaId}`)
  revalidatePath(`/dashboard/reports/${arenaId}/status-pagamentos`)
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function derivePlanoStatus(planos: PlanoMensalistaComDetalhes[]): StatusPlano {
  const naoCancelados = planos.filter((p) => p.status !== 'cancelado')
  if (naoCancelados.length === 0) return 'cancelado'
  if (naoCancelados.some((p) => p.data_encerramento_prevista)) return 'encerrando'
  return 'ativo'
}

function deriveSituacao(
  valorMes: number,
  recebidoMes: number
): SituacaoPagamento {
  if (valorMes <= 0) return 'quitado'
  if (recebidoMes + 0.01 >= valorMes) return 'quitado'
  if (recebidoMes > 0) return 'parcial'
  return 'pendente'
}

/** Overview grouped by responsible athlete for one competência (`YYYY-MM`). */
export async function getMensalistasOverviewAction(
  arenaId: string,
  competencia: string
): Promise<{ success: boolean; data?: MensalistasOverview; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()
    const parsedArena = uuidSchema.parse(arenaId)
    const parsedComp = competenciaSchema.parse(competencia)
    const competenciaDate = `${parsedComp}-01`

    const supabase = getSupabaseAdmin()

    const { error: genError } = await supabase.rpc(
      'generate_mensalista_mensalidades_atomic',
      {
        p_arena_id: parsedArena,
        p_competencia: competenciaDate,
        p_registered_by: dbUserId,
      }
    )
    if (genError) throw new Error(genError.message)

    const mesCorrenteISO = currentMonthStartISO()

    const [
      { data: planosData, error: planosError },
      { data: mensalidadesData, error: mensError },
      { data: atrasoMensData, error: atrasoError },
      { data: saldoData, error: saldoError },
    ] = await Promise.all([
      supabase
        .from('planos_mensalista')
        .select(PLANO_SELECT)
        .eq('arena_id', parsedArena)
        .order('created_at', { ascending: true }),
      supabase
        .from('mensalista_mensalidades')
        .select('*')
        .eq('arena_id', parsedArena)
        .eq('competencia', competenciaDate),
      supabase
        .from('mensalista_mensalidades')
        .select('*')
        .eq('arena_id', parsedArena)
        .lt('competencia', mesCorrenteISO)
        .in('status', ['aberto', 'parcial']),
      supabase
        .from('mensalista_credito_saldo')
        .select('atleta_id, saldo')
        .eq('arena_id', parsedArena),
    ])

    if (planosError) throw new Error(planosError.message)
    if (mensError) throw new Error(mensError.message)
    if (atrasoError) throw new Error(atrasoError.message)
    if (saldoError) throw new Error(saldoError.message)

    const planos = (planosData ?? []) as unknown as PlanoMensalistaComDetalhes[]
    const mensalidades = (mensalidadesData ?? []) as MensalidadeRow[]
    const atrasoMensalidades = (atrasoMensData ?? []) as MensalidadeRow[]

    const allMensalidadeIds = Array.from(
      new Set([
        ...mensalidades.map((m) => m.id),
        ...atrasoMensalidades.map((m) => m.id),
      ])
    )
    let cobrancas: CobrancaRow[] = []
    if (allMensalidadeIds.length > 0) {
      const { data: cobrData, error: cobrError } = await supabase
        .from('mensalista_cobrancas')
        .select('*')
        .in('mensalidade_id', allMensalidadeIds)
      if (cobrError) throw new Error(cobrError.message)
      cobrancas = (cobrData ?? []) as CobrancaRow[]
    }

    const saldoByAthlete = new Map<string, number>()
    for (const row of (saldoData ?? []) as { atleta_id: string | null; saldo: number | null }[]) {
      if (row.atleta_id) saldoByAthlete.set(row.atleta_id, Number(row.saldo ?? 0))
    }

    const mensalidadesByAthlete = new Map<string, MensalidadeRow[]>()
    for (const m of mensalidades) {
      const list = mensalidadesByAthlete.get(m.athlete_id) ?? []
      list.push(m)
      mensalidadesByAthlete.set(m.athlete_id, list)
    }
    const cobrancasByMensalidade = new Map<string, CobrancaRow[]>()
    for (const c of cobrancas) {
      const list = cobrancasByMensalidade.get(c.mensalidade_id) ?? []
      list.push(c)
      cobrancasByMensalidade.set(c.mensalidade_id, list)
    }

    const planosByAthlete = new Map<string, PlanoMensalistaComDetalhes[]>()
    for (const p of planos) {
      const list = planosByAthlete.get(p.athlete_id) ?? []
      list.push(p)
      planosByAthlete.set(p.athlete_id, list)
    }

    // Past-due (competências anteriores ao mês corrente ainda em aberto/parcial).
    const atrasoByAthlete = new Map<string, { valor: number; meses: number }>()
    for (const m of atrasoMensalidades) {
      const cbs = (cobrancasByMensalidade.get(m.id) ?? []).filter((c) => c.ativo)
      const restante = round2(
        cbs.reduce(
          (s, c) =>
            s +
            Math.max(
              0,
              Number(c.valor_devido) -
                Number(c.valor_pago) -
                Number(c.credito_aplicado)
            ),
          0
        )
      )
      if (restante <= 0.01) continue
      const cur = atrasoByAthlete.get(m.athlete_id) ?? { valor: 0, meses: 0 }
      atrasoByAthlete.set(m.athlete_id, {
        valor: round2(cur.valor + restante),
        meses: cur.meses + 1,
      })
    }

    const resumos: MensalistaResumo[] = []
    for (const [athleteId, athletePlanos] of planosByAthlete) {
      const athleteMensalidades = mensalidadesByAthlete.get(athleteId) ?? []
      const ativas = athleteMensalidades.filter((m) => m.status !== 'cancelado')

      const valorMes = round2(
        ativas.reduce((acc, m) => acc + Number(m.valor_total), 0)
      )
      const recebidoMes = round2(
        ativas.reduce((acc, m) => {
          const cbs = (cobrancasByMensalidade.get(m.id) ?? []).filter((c) => c.ativo)
          return (
            acc +
            cbs.reduce(
              (s, c) => s + Number(c.valor_pago) + Number(c.credito_aplicado),
              0
            )
          )
        }, 0)
      )

      const primary = athletePlanos[0]
      const nome = primary.atleta?.nome_perfil ?? primary.athlete_name
      const inicio = athletePlanos
        .map((p) => p.data_inicio)
        .sort()[0]
      const encerramentos = athletePlanos
        .filter((p) => p.status !== 'cancelado' && p.data_encerramento_prevista)
        .map((p) => p.data_encerramento_prevista as string)
        .sort()
      const planoComEncerramento = athletePlanos.find(
        (p) => p.data_encerramento_prevista === encerramentos[0]
      )

      const atraso = atrasoByAthlete.get(athleteId) ?? { valor: 0, meses: 0 }

      resumos.push({
        athleteId,
        nome,
        telefone: primary.atleta?.telefone ?? null,
        statusPlano: derivePlanoStatus(athletePlanos),
        recorrenciasCount: athletePlanos.filter((p) => p.status !== 'cancelado').length,
        inicio,
        encerramentoPrevisto: encerramentos[0] ?? null,
        encerramentoObs: planoComEncerramento?.encerramento_observacao ?? null,
        valorMes,
        recebidoMes,
        restanteMes: round2(Math.max(0, valorMes - recebidoMes)),
        situacao: deriveSituacao(valorMes, recebidoMes),
        creditoSaldo: round2(saldoByAthlete.get(athleteId) ?? 0),
        atrasoValor: atraso.valor,
        atrasoMeses: atraso.meses,
      })
    }

    resumos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    const hoje = new Date()
    const totais = {
      aReceber: round2(resumos.reduce((a, r) => a + r.valorMes, 0)),
      recebido: round2(resumos.reduce((a, r) => a + r.recebidoMes, 0)),
      restante: round2(resumos.reduce((a, r) => a + r.restanteMes, 0)),
      atrasoTotal: round2(resumos.reduce((a, r) => a + r.atrasoValor, 0)),
      atrasoMensalistas: resumos.filter((r) => r.atrasoValor > 0).length,
      encerrandoEmBreve: resumos.filter(
        (r) =>
          r.encerramentoPrevisto &&
          differenceInCalendarDays(parseISO(r.encerramentoPrevisto), hoje) <= 60
      ).length,
    }

    return {
      success: true,
      data: { competencia: parsedComp, resumos, totais },
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao carregar mensalistas'
    return { success: false, error: message }
  }
}

/** Full detail of one responsible athlete for a competência. */
export async function getMensalistaDetailAction(
  arenaId: string,
  athleteId: string,
  competencia: string
): Promise<{ success: boolean; data?: MensalistaDetalhe; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()
    const parsedArena = uuidSchema.parse(arenaId)
    const parsedAthlete = uuidSchema.parse(athleteId)
    const parsedComp = competenciaSchema.parse(competencia)
    const competenciaDate = `${parsedComp}-01`

    const supabase = getSupabaseAdmin()

    const { error: genError } = await supabase.rpc(
      'generate_mensalista_mensalidades_atomic',
      {
        p_arena_id: parsedArena,
        p_competencia: competenciaDate,
        p_registered_by: dbUserId,
      }
    )
    if (genError) throw new Error(genError.message)

    const [
      { data: planosData, error: planosError },
      { data: mensalidadesData, error: mensError },
      { data: creditosData, error: creditosError },
      { data: saldoData },
      { data: arenaData },
      { data: fidelidadeData },
    ] = await Promise.all([
      supabase
        .from('planos_mensalista')
        .select(PLANO_SELECT)
        .eq('arena_id', parsedArena)
        .eq('athlete_id', parsedAthlete)
        .order('created_at', { ascending: true }),
      supabase
        .from('mensalista_mensalidades')
        .select('*')
        .eq('arena_id', parsedArena)
        .eq('athlete_id', parsedAthlete)
        .eq('competencia', competenciaDate),
      supabase
        .from('mensalista_creditos')
        .select('*')
        .eq('arena_id', parsedArena)
        .eq('atleta_id', parsedAthlete)
        .order('created_at', { ascending: false }),
      supabase
        .from('mensalista_credito_saldo')
        .select('saldo')
        .eq('arena_id', parsedArena)
        .eq('atleta_id', parsedAthlete)
        .maybeSingle(),
      supabase
        .from('arenas')
        .select('nome_moeda_virtual')
        .eq('id', parsedArena)
        .maybeSingle(),
      supabase
        .from('athlete_loyalty_balance')
        .select('balance')
        .eq('id_arena', parsedArena)
        .eq('id_atleta', parsedAthlete)
        .maybeSingle(),
    ])

    if (planosError) throw new Error(planosError.message)
    if (mensError) throw new Error(mensError.message)
    if (creditosError) throw new Error(creditosError.message)

    const planos = (planosData ?? []) as unknown as PlanoMensalistaComDetalhes[]
    if (planos.length === 0) {
      return { success: false, error: 'Mensalista não encontrado' }
    }
    const mensalidades = (mensalidadesData ?? []) as MensalidadeRow[]
    const creditos = (creditosData ?? []) as CreditoRow[]

    let cobrancas: CobrancaRow[] = []
    if (mensalidades.length > 0) {
      const { data: cobrData, error: cobrError } = await supabase
        .from('mensalista_cobrancas')
        .select('*')
        .in(
          'mensalidade_id',
          mensalidades.map((m) => m.id)
        )
        .order('created_at', { ascending: true })
      if (cobrError) throw new Error(cobrError.message)
      cobrancas = (cobrData ?? []) as CobrancaRow[]
    }

    const { data: pagamentosData, error: pagError } = await supabase
      .from('mensalista_pagamentos')
      .select(
        '*, cobranca:mensalista_cobrancas!inner(nome, mensalidade:mensalista_mensalidades!inner(competencia, athlete_id))'
      )
      .eq('arena_id', parsedArena)
      .eq('cobranca.mensalidade.athlete_id', parsedAthlete)
      .order('created_at', { ascending: false })
      .limit(300)
    if (pagError) throw new Error(pagError.message)

    type PagamentoWithContext = PagamentoRow & {
      cobranca: {
        nome: string
        mensalidade: { competencia: string; athlete_id: string } | null
      } | null
    }
    const historicoPagamentos: PagamentoComContexto[] = (
      (pagamentosData ?? []) as unknown as PagamentoWithContext[]
    ).map((row) => ({
      ...row,
      cobrancaNome: row.cobranca?.nome ?? '—',
      competencia: row.cobranca?.mensalidade?.competencia ?? '',
    }))

    const cobrancasByMensalidade = new Map<string, CobrancaRow[]>()
    for (const c of cobrancas) {
      const list = cobrancasByMensalidade.get(c.mensalidade_id) ?? []
      list.push(c)
      cobrancasByMensalidade.set(c.mensalidade_id, list)
    }
    const mensalidadeByPlano = new Map<string, MensalidadeRow>()
    for (const m of mensalidades) mensalidadeByPlano.set(m.plano_id, m)

    // Past-due months (before the current calendar month, other than the one
    // being viewed) still open/partial for this responsible.
    const mesCorrenteISO = currentMonthStartISO()
    const { data: atrasoMensData, error: atrasoErr } = await supabase
      .from('mensalista_mensalidades')
      .select('*')
      .eq('arena_id', parsedArena)
      .eq('athlete_id', parsedAthlete)
      .lt('competencia', mesCorrenteISO)
      .neq('competencia', competenciaDate)
      .in('status', ['aberto', 'parcial'])
      .order('competencia', { ascending: true })
    if (atrasoErr) throw new Error(atrasoErr.message)

    const atrasoMensalidades = (atrasoMensData ?? []) as MensalidadeRow[]
    let atrasos: AtrasoCompetencia[] = []
    if (atrasoMensalidades.length > 0) {
      const { data: atrasoCobrData, error: atrasoCobrErr } = await supabase
        .from('mensalista_cobrancas')
        .select('*')
        .in(
          'mensalidade_id',
          atrasoMensalidades.map((m) => m.id)
        )
        .order('created_at', { ascending: true })
      if (atrasoCobrErr) throw new Error(atrasoCobrErr.message)

      const atrasoCobrByMens = new Map<string, CobrancaRow[]>()
      for (const c of (atrasoCobrData ?? []) as CobrancaRow[]) {
        const list = atrasoCobrByMens.get(c.mensalidade_id) ?? []
        list.push(c)
        atrasoCobrByMens.set(c.mensalidade_id, list)
      }
      const planoById = new Map(planos.map((p) => [p.id, p]))

      atrasos = atrasoMensalidades
        .map((m) => {
          const cbs = (atrasoCobrByMens.get(m.id) ?? []).filter((c) => c.ativo)
          const valorDevido = round2(
            cbs.reduce((s, c) => s + Number(c.valor_devido), 0)
          )
          const valorPago = round2(
            cbs.reduce(
              (s, c) => s + Number(c.valor_pago) + Number(c.credito_aplicado),
              0
            )
          )
          const plano = planoById.get(m.plano_id)
          return {
            competencia: m.competencia.slice(0, 7),
            mensalidadeId: m.id,
            planoId: m.plano_id,
            quadra:
              (plano?.court as { name?: string } | null)?.name ?? null,
            valorDevido,
            valorPago,
            restante: round2(Math.max(0, valorDevido - valorPago)),
            cobrancas: cbs,
          } satisfies AtrasoCompetencia
        })
        .filter((a) => a.restante > 0.01)
    }

    const { data: reajustesData, error: reajustesErr } = await supabase
      .from('planos_mensalista_reajustes')
      .select('*')
      .eq('arena_id', parsedArena)
      .in('plano_id', planos.map((p) => p.id))
      .order('created_at', { ascending: false })
    if (reajustesErr) throw new Error(reajustesErr.message)
    const reajustesByPlano = new Map<string, ReajusteRow[]>()
    for (const r of (reajustesData ?? []) as unknown as ReajusteRow[]) {
      const list = reajustesByPlano.get(r.plano_id) ?? []
      list.push(r)
      reajustesByPlano.set(r.plano_id, list)
    }

    const recorrencias: RecorrenciaResumo[] = planos.map((plano) => {
      const mensalidade = mensalidadeByPlano.get(plano.id) ?? null
      return {
        plano,
        mensalidade,
        cobrancas: mensalidade
          ? cobrancasByMensalidade.get(mensalidade.id) ?? []
          : [],
        reajustes: reajustesByPlano.get(plano.id) ?? [],
      }
    })

    const ativas = mensalidades.filter((m) => m.status !== 'cancelado')
    const valorMes = round2(
      ativas.reduce((acc, m) => acc + Number(m.valor_total), 0)
    )
    const recebidoMes = round2(
      ativas.reduce((acc, m) => {
        const cbs = (cobrancasByMensalidade.get(m.id) ?? []).filter((c) => c.ativo)
        return (
          acc +
          cbs.reduce(
            (s, c) => s + Number(c.valor_pago) + Number(c.credito_aplicado),
            0
          )
        )
      }, 0)
    )

    const primary = planos[0]
    const encerramentos = planos
      .filter((p) => p.status !== 'cancelado' && p.data_encerramento_prevista)
      .map((p) => p.data_encerramento_prevista as string)
      .sort()
    const creditoSaldo = round2(
      Number((saldoData as { saldo: number | null } | null)?.saldo ?? 0)
    )
    const fidelidade = {
      moeda:
        ((arenaData as { nome_moeda_virtual: string | null } | null)
          ?.nome_moeda_virtual ?? null) || null,
      saldo: round2(
        Number(
          (fidelidadeData as { balance: number | null } | null)?.balance ?? 0
        )
      ),
    }

    const resumo: MensalistaResumo = {
      athleteId: parsedAthlete,
      nome: primary.atleta?.nome_perfil ?? primary.athlete_name,
      telefone: primary.atleta?.telefone ?? null,
      statusPlano: derivePlanoStatus(planos),
      recorrenciasCount: planos.filter((p) => p.status !== 'cancelado').length,
      inicio: planos.map((p) => p.data_inicio).sort()[0],
      encerramentoPrevisto: encerramentos[0] ?? null,
      encerramentoObs:
        planos.find((p) => p.data_encerramento_prevista === encerramentos[0])
          ?.encerramento_observacao ?? null,
      valorMes,
      recebidoMes,
      restanteMes: round2(Math.max(0, valorMes - recebidoMes)),
      situacao: deriveSituacao(valorMes, recebidoMes),
      creditoSaldo,
      atrasoValor: round2(atrasos.reduce((s, a) => s + a.restante, 0)),
      atrasoMeses: atrasos.length,
    }

    return {
      success: true,
      data: {
        competencia: parsedComp,
        resumo,
        recorrencias,
        atrasos,
        historicoPagamentos,
        creditos,
        creditoSaldo,
        fidelidade,
      },
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao carregar mensalista'
    return { success: false, error: message }
  }
}

export async function configureRateioAction(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = configureRateioSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { error } = await getSupabaseAdmin().rpc(
      'configure_mensalista_rateio_atomic',
      {
        p_arena_id: parsed.arenaId,
        p_mensalidade_id: parsed.mensalidadeId,
        p_rateio: parsed.rateio,
        p_participantes: parsed.participantes,
        p_registered_by: dbUserId,
      }
    )
    if (error) throw new Error(error.message)

    revalidateMensalistaPaths(parsed.arenaId)
    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao configurar rateio'
    return { success: false, error: message }
  }
}

export interface RegistrarPagamentoResult {
  excedente: number
  creditoExcedenteLancado: boolean
  status: string
  creditoSaldo: number | null
}

export async function registrarPagamentoAction(
  input: unknown
): Promise<{ success: boolean; data?: RegistrarPagamentoResult; error?: string }> {
  try {
    const parsed = registrarPagamentoSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { data, error } = await getSupabaseAdmin().rpc(
      'register_mensalista_payment_atomic',
      {
        p_operation_id: parsed.operationId,
        p_arena_id: parsed.arenaId,
        p_cobranca_id: parsed.cobrancaId,
        p_valor: parsed.valor,
        p_credito_aplicado: parsed.creditoAplicado,
        p_data: parsed.data,
        p_modo_pagamento_id: parsed.modoPagamentoId,
        p_observacao: parsed.observacao,
        p_registered_by: dbUserId,
        p_lancar_excedente_credito: parsed.lancarExcedenteCredito,
      }
    )
    if (error) throw new Error(error.message)

    const row = (data ?? {}) as Record<string, unknown>
    revalidateMensalistaPaths(parsed.arenaId)
    return {
      success: true,
      data: {
        excedente: Number(row.excedente ?? 0),
        creditoExcedenteLancado: Boolean(row.credito_excedente_lancado ?? false),
        status: String(row.status ?? ''),
        creditoSaldo:
          row.credito_saldo == null ? null : Number(row.credito_saldo),
      },
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao registrar pagamento'
    return { success: false, error: message }
  }
}

export async function lancarCreditoAction(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = lancarCreditoSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { error } = await getSupabaseAdmin().rpc(
      'launch_mensalista_credit_atomic',
      {
        p_operation_id: parsed.operationId,
        p_arena_id: parsed.arenaId,
        p_atleta_id: parsed.atletaId,
        p_valor: parsed.valor,
        p_descricao: parsed.descricao,
        p_registered_by: dbUserId,
      }
    )
    if (error) throw new Error(error.message)

    revalidateMensalistaPaths(parsed.arenaId)
    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao lançar crédito'
    return { success: false, error: message }
  }
}

export async function retirarCreditoAction(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = retirarCreditoSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { error } = await getSupabaseAdmin().rpc(
      'withdraw_mensalista_credit_atomic',
      {
        p_operation_id: parsed.operationId,
        p_arena_id: parsed.arenaId,
        p_atleta_id: parsed.atletaId,
        p_valor: parsed.valor,
        p_descricao: parsed.descricao,
        p_registered_by: dbUserId,
      }
    )
    if (error) throw new Error(error.message)

    revalidateMensalistaPaths(parsed.arenaId)
    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao retirar crédito'
    return { success: false, error: message }
  }
}

export async function setEncerramentoAction(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = setEncerramentoSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { error } = await getSupabaseAdmin().rpc(
      'set_mensalista_termination_atomic',
      {
        p_arena_id: parsed.arenaId,
        p_plan_id: parsed.planoId,
        p_data_prevista: parsed.dataPrevista,
        p_observacao: parsed.observacao,
        p_registered_by: dbUserId,
      }
    )
    if (error) throw new Error(error.message)

    revalidateMensalistaPaths(parsed.arenaId)
    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao registrar encerramento'
    return { success: false, error: message }
  }
}

export interface ReajustarValorResult {
  competenciaVigencia: string
  valorAnterior: number
  valorNovo: number
  mensalidadesAtualizadas: number
  ignoradasRateio: number
  ignoradasPagamento: number
  idempotent: boolean
}

export async function reajustarValorPlanoAction(
  input: unknown
): Promise<{ success: boolean; data?: ReajustarValorResult; error?: string }> {
  try {
    const parsed = reajustarValorSchema.parse(input)
    await assertArenaBackofficeAccess(parsed.arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()

    const { data, error } = await getSupabaseAdmin().rpc(
      'reajustar_plano_mensalista_atomic',
      {
        p_operation_id: parsed.operationId,
        p_arena_id: parsed.arenaId,
        p_plano_id: parsed.planoId,
        p_novo_valor: parsed.novoValor,
        p_escopo: parsed.escopo,
        p_observacao: parsed.observacao,
        p_registered_by: dbUserId,
      }
    )
    if (error) throw new Error(error.message)

    const row = (data ?? {}) as Record<string, unknown>
    revalidateMensalistaPaths(parsed.arenaId)
    return {
      success: true,
      data: {
        competenciaVigencia: String(row.competencia_vigencia ?? ''),
        valorAnterior: Number(row.valor_anterior ?? 0),
        valorNovo: Number(row.valor_novo ?? parsed.novoValor),
        mensalidadesAtualizadas: Number(row.mensalidades_atualizadas ?? 0),
        ignoradasRateio: Number(row.mensalidades_com_rateio_ignoradas ?? 0),
        ignoradasPagamento: Number(row.mensalidades_com_pagamento_ignoradas ?? 0),
        idempotent: Boolean(row.idempotent ?? false),
      },
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao reajustar o valor do plano'
    return { success: false, error: message }
  }
}
