'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { assertArenaAdminAccess } from '@/lib/server-auth'
import type {
  ArenaFinancialOverview,
  ArenaPixKeyType,
  ArenaWithdrawal,
} from '@/modules/finance/types/arena-financial-account.types'

type EdgeErrorBody = { message?: unknown }

async function edgeErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context
  if (context && typeof context === 'object' && 'json' in context) {
    try {
      const body = await (context as { json: () => Promise<EdgeErrorBody> }).json()
      if (typeof body.message === 'string' && body.message.trim()) return body.message.trim()
    } catch {
      // The provider body is optional; never expose the raw transport error.
    }
  }
  return fallback
}
async function invokeArenaFinancial<T>(
  arenaId: string,
  body: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  await assertArenaAdminAccess(arenaId)
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.functions.invoke('arena-financial-operations', {
    body: { ...body, arenaId },
  })
  if (error || !data || data.ok === false) {
    throw new Error(
      typeof data?.message === 'string'
        ? data.message
        : await edgeErrorMessage(error, fallback),
    )
  }
  return data as T
}

export async function getArenaFinancialOverviewAction(
  arenaId: string,
  startDate: string,
  finishDate: string,
) {
  try {
    const result = await invokeArenaFinancial<{ overview: ArenaFinancialOverview }>(
      arenaId,
      { action: 'overview', startDate, finishDate },
      'Não foi possível carregar a conta financeira da Arena.',
    )
    return { success: true as const, data: result.overview }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Não foi possível carregar a conta financeira.',
      data: null,
    }
  }
}

export async function configureArenaWithdrawalDestinationAction(
  arenaId: string,
  input: { pixKeyType: ArenaPixKeyType; pixKey: string },
) {
  try {
    const pixKey = input.pixKey.trim()
    if (!['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'].includes(input.pixKeyType) || !pixKey) {
      throw new Error('Informe uma chave Pix válida.')
    }
    await invokeArenaFinancial(
      arenaId,
      { action: 'configure-destination', pixKeyType: input.pixKeyType, pixKey },
      'Não foi possível salvar o destino do saque.',
    )
    revalidatePath(`/dashboard/finance/${arenaId}`)
    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Não foi possível salvar o destino do saque.',
    }
  }
}

export async function requestArenaWithdrawalAction(
  arenaId: string,
  input: { operationId: string; amountCents: number },
) {
  try {
    if (!input.operationId.trim() || !Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new Error('Informe um valor de saque válido.')
    }
    const result = await invokeArenaFinancial<{ withdrawal: ArenaWithdrawal }>(
      arenaId,
      { action: 'withdraw', operationId: input.operationId, amountCents: input.amountCents },
      'Não foi possível solicitar o saque.',
    )
    revalidatePath(`/dashboard/finance/${arenaId}`)
    return { success: true as const, data: result.withdrawal }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Não foi possível solicitar o saque.',
      data: null,
    }
  }
}
