"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess, assertRotativoAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { SupabaseRotativoRepository } from '@/modules/rotativos/repositories/SupabaseRotativoRepository'
import { revalidatePath } from 'next/cache'
import {
  createRotativoInputSchema,
  updateRotativoInputSchema,
  enrollAthleteSchema,
  savePacotesSchema,
  launchCreditSchema,
} from '@/modules/rotativos/schemas/rotativo.schema'
import { CREDITO_PAYMENT_METHOD, type RotativoListFilters } from '@/modules/rotativos/types/rotativo.types'
import { canReactivateRotativo } from '@/modules/rotativos/utils/rotativo.utils'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function revalidateRotativo(arenaId: string) {
  revalidatePath('/dashboard/rotativo')
  revalidatePath(`/dashboard/rotativo/${arenaId}`)
}

async function ensureAthleteBelongsToArena(arenaId: string, athleteId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('arenas_atleta')
    .select('id_atleta')
    .eq('id_arena', arenaId)
    .eq('id_atleta', athleteId)
    .maybeSingle()

  if (error) throw new Error(`Erro ao validar atleta do rotativo: ${error.message}`)
  if (!data) throw new Error('Atleta não pertence à arena informada')
}

export async function createRotativoAction(formData: unknown) {
  const parsed = createRotativoInputSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  try {
    await requireAuthenticatedDbUser()
    const { arenaId, court_ids, ...rest } = parsed.data
    await assertArenaBackofficeAccess(arenaId)

    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    await repo.create({ ...rest, id_arena: arenaId, status: 'ativo' }, court_ids)

    revalidateRotativo(arenaId)
    return { success: true }
  } catch (error: unknown) {
    console.error('Error in createRotativoAction:', error)
    return { success: false, error: getErrorMessage(error, 'Erro ao criar rotativo') }
  }
}

export async function updateRotativoAction(formData: unknown) {
  const parsed = updateRotativoInputSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  try {
    await requireAuthenticatedDbUser()
    const { arenaId, rotativoId, court_ids, ...rest } = parsed.data
    await assertArenaBackofficeAccess(arenaId)
    await assertRotativoAccess(rotativoId, arenaId)

    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    await repo.update(arenaId, rotativoId, rest, court_ids)

    revalidateRotativo(arenaId)
    return { success: true }
  } catch (error: unknown) {
    console.error('Error in updateRotativoAction:', error)
    return { success: false, error: getErrorMessage(error, 'Erro ao atualizar rotativo') }
  }
}

export async function setRotativoStatusAction(arenaId: string, rotativoId: string, status: 'ativo' | 'desativado') {
  try {
    await requireAuthenticatedDbUser()
    await assertArenaBackofficeAccess(arenaId)
    await assertRotativoAccess(rotativoId, arenaId)

    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())

    if (status === 'ativo') {
      const rotativo = await repo.findById(arenaId, rotativoId)
      if (!rotativo) throw new Error('Rotativo não encontrado')
      if (!canReactivateRotativo(rotativo.data)) {
        throw new Error('Não é possível reativar rotativos após a data da sessão.')
      }
    }

    await repo.setStatus(arenaId, rotativoId, status)

    revalidateRotativo(arenaId)
    return { success: true }
  } catch (error: unknown) {
    console.error('Error in setRotativoStatusAction:', error)
    return { success: false, error: getErrorMessage(error, 'Erro ao alterar status do rotativo') }
  }
}

export async function getRotativoByIdAction(arenaId: string, rotativoId: string) {
  try {
    await assertArenaBackofficeAccess(arenaId)
    await assertRotativoAccess(rotativoId, arenaId)
    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const data = await repo.findById(arenaId, rotativoId)
    return { success: true, data, arenaId }
  } catch (error: unknown) {
    console.error('Error in getRotativoByIdAction:', error)
    return { success: false, error: getErrorMessage(error, 'Erro ao buscar rotativo'), data: null }
  }
}

export async function listRotativosAction(arenaId: string, filters: RotativoListFilters = {}) {
  try {
    await requireAuthenticatedDbUser()
    await assertArenaBackofficeAccess(arenaId)

    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const { rows, total } = await repo.list(arenaId, filters)
    return { success: true, data: rows, total }
  } catch (error: unknown) {
    console.error('Error in listRotativosAction:', error)
    return { success: false, error: getErrorMessage(error, 'Erro ao listar rotativos'), data: [], total: 0 }
  }
}

export async function getRotativosAction(arenaId: string, date: string) {
  try {
    await requireAuthenticatedDbUser()
    await assertArenaBackofficeAccess(arenaId)

    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const data = await repo.findByDate(arenaId, date)
    return { success: true, data }
  } catch (error: unknown) {
    console.error('Error in getRotativosAction:', error)
    return { success: false, error: getErrorMessage(error, 'Erro ao buscar rotativos') }
  }
}

export async function getRotativosByMonthAction(arenaId: string, startDate: string, endDate: string) {
  try {
    await requireAuthenticatedDbUser()
    await assertArenaBackofficeAccess(arenaId)

    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const data = await repo.findByMonth(arenaId, startDate, endDate)
    return { success: true, data }
  } catch (error: unknown) {
    console.error('Error in getRotativosByMonthAction:', error)
    return { success: false, error: getErrorMessage(error, 'Erro ao buscar rotativos do mes') }
  }
}

export async function getParticipantsAction(arenaId: string, rotativoId: string) {
  try {
    await assertArenaBackofficeAccess(arenaId)
    await assertRotativoAccess(rotativoId, arenaId)
    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const data = await repo.getInscritos(arenaId, rotativoId)
    return { success: true, data }
  } catch (error: unknown) {
    console.error('Error in getParticipantsAction:', error)
    return { success: false, error: getErrorMessage(error, 'Erro ao buscar participantes') }
  }
}

export async function enrollAthleteAction(formData: unknown) {
  const parsed = enrollAthleteSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  try {
    const { dbUserId } = await requireAuthenticatedDbUser()
    const { rotativoId, arenaId, athleteId, paymentMethod, observacao } = parsed.data
    await assertArenaBackofficeAccess(arenaId)
    await assertRotativoAccess(rotativoId, arenaId)
    await ensureAthleteBelongsToArena(arenaId, athleteId)

    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const isCredit = paymentMethod === CREDITO_PAYMENT_METHOD
    await repo.enrollAthleteAtomic({
      arenaId,
      rotativoId,
      athleteId,
      paymentType: isCredit ? 'credito' : 'avulso',
      paymentMethodId: isCredit ? null : paymentMethod,
      observation: observacao ?? null,
      registeredBy: dbUserId,
    })

    revalidatePath(`/dashboard/finance/${arenaId}`)
    revalidateRotativo(arenaId)
    return { success: true }
  } catch (error: unknown) {
    console.error('Error in enrollAthleteAction:', error)
    return { success: false, error: getErrorMessage(error, 'Erro ao inscrever atleta') }
  }
}

export async function registerAthleteAction(arenaId: string, rotativoId: string, athleteId: string, _value: number) {
  try {
    await assertArenaBackofficeAccess(arenaId)
    await assertRotativoAccess(rotativoId, arenaId)
    await ensureAthleteBelongsToArena(arenaId, athleteId)
    void _value
    return {
      success: false,
      error: 'Fluxo legado desabilitado: use a inscrição com forma de pagamento para gerar a trilha financeira.',
    }
  } catch (error: unknown) {
    console.error('Error in registerAthleteAction:', error)
    return { success: false, error: getErrorMessage(error, 'Erro ao registrar atleta') }
  }
}

export async function getRotativoCourtsAction(arenaId: string) {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const data = await repo.getCourts(arenaId)
    return { success: true, data }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, 'Erro ao buscar quadras'), data: [] }
  }
}

export async function getRotativoPacotesAction(arenaId: string) {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const data = await repo.getPacotes(arenaId)
    return { success: true, data }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, 'Erro ao buscar pacotes'), data: [] }
  }
}

export async function saveRotativoPacotesAction(formData: unknown) {
  const parsed = savePacotesSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  try {
    await requireAuthenticatedDbUser()
    const { arenaId, pacotes } = parsed.data
    await assertArenaBackofficeAccess(arenaId)

    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const data = await repo.savePacotes(arenaId, pacotes)

    revalidateRotativo(arenaId)
    return { success: true, data }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, 'Erro ao salvar pacotes') }
  }
}

export async function launchRotativoCreditAction(formData: unknown) {
  const parsed = launchCreditSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  try {
    const { dbUserId } = await requireAuthenticatedDbUser()
    const { operationId, arenaId, athleteId, quantidade, validityDays, modo_pagamento_id } = parsed.data
    await assertArenaBackofficeAccess(arenaId)
    await ensureAthleteBelongsToArena(arenaId, athleteId)

    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const purchase = await repo.purchaseCreditsAtomic({
      operationId,
      arenaId,
      athleteId,
      quantity: quantidade,
      validityDays,
      paymentMethodId: modo_pagamento_id,
      registeredBy: dbUserId,
    })

    revalidatePath(`/dashboard/finance/${arenaId}`)
    revalidateRotativo(arenaId)
    return { success: true, valorPago: purchase.valor_pago }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, 'Erro ao lançar crédito') }
  }
}

export async function previewCreditPurchaseValueAction(arenaId: string, quantidade: number) {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const valor = await repo.quoteCreditPurchaseValue(arenaId, quantidade)
    return { success: true, valor }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, 'Erro ao calcular valor'), valor: null }
  }
}

export async function getRotativoCreditMovementsAction(
  arenaId: string,
  filters: { search?: string; page?: number; pageSize?: number } = {}
) {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const { rows, total } = await repo.getCreditMovements(arenaId, filters)
    return { success: true, data: rows, total }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, 'Erro ao buscar movimentações'), data: [], total: 0 }
  }
}

export async function getTopRotativoAthletesAction(arenaId: string, limit = 5) {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const data = await repo.getTopAthletesByCredit(arenaId, limit)
    return { success: true, data }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, 'Erro ao buscar ranking'), data: [] }
  }
}

export async function processExpiredRotativoCreditsAction(arenaId: string) {
  try {
    await assertArenaBackofficeAccess(arenaId)
    const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
    const processed = await repo.processExpiredCredits(arenaId)
    if (processed > 0) revalidateRotativo(arenaId)
    return { success: true, processed }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, 'Erro ao processar vencimentos'), processed: 0 }
  }
}
