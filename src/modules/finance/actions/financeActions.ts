'use server';

import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  assertArenaAdminAccess,
  assertArenaScopedResourceAccess,
} from '@/lib/server-auth';
import { SupabaseFinanceRepository } from '@/modules/finance/repositories/SupabaseFinanceRepository';
import { revalidatePath } from 'next/cache';
import { transactionActionSchema } from '@/modules/finance/schemas/transaction-action.schema';
import { BOOKING_COBRANCAS_SELECT } from '@/modules/bookings/lib/booking-rateio';
import {
  buildAvulsoItem,
  type AvulsoBookingRow,
  type AvulsoReservaItem,
} from '@/modules/finance/lib/avulsos-list';

export async function getFinanceDashboardAction(arenaId: string) {
  try {
    await assertArenaAdminAccess(arenaId);
    const repo = new SupabaseFinanceRepository(getSupabaseAdmin());
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - 29);

    const [summary, recentIn, recentOut, series] = await Promise.all([
      repo.getSummary(arenaId),
      repo.findRecent(arenaId, 'entrada', 4),
      repo.findRecent(arenaId, 'saída', 4),
      repo.getDailyTotals(
        arenaId,
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0]
      ),
    ]);

    return { success: true, data: { summary, recentIn, recentOut, series } };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao carregar financeiro';
    return { success: false, error: message, data: null };
  }
}

export async function getModoPagamentoAction() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('modo_pagamento')
      .select('id, nome')
      .order('nome');

    if (error) throw new Error(error.message);
    return { success: true, data: data ?? [] };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Erro ao carregar modos de pagamento';
    return { success: false, error: message, data: [] };
  }
}

export async function getTransactionsAction(
  arenaId: string,
  type?: 'entrada' | 'saída',
  startDate?: string,
  endDate?: string
) {
  try {
    await assertArenaAdminAccess(arenaId);
    const repo = new SupabaseFinanceRepository(getSupabaseAdmin());
    const data = await repo.findByArena(arenaId, type, startDate, endDate);
    return { success: true, data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao buscar lançamentos';
    return { success: false, error: message, data: [] };
  }
}

export async function createTransactionAction(
  arenaId: string,
  input: unknown
) {
  try {
    const { dbUserId } = await assertArenaAdminAccess(arenaId);
    const parsed = transactionActionSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Dados do lançamento inválidos');
    }
    const safeInput = {
      ...parsed.data,
      total_value: Number(Math.max(0, parsed.data.quantity * parsed.data.unit_value - parsed.data.discount).toFixed(2)),
      atleta_id: parsed.data.atleta_id ?? null,
      modo_pagamento_id: parsed.data.modo_pagamento_id ?? null,
    };
    const repo = new SupabaseFinanceRepository(getSupabaseAdmin());
    const data = await repo.create({
      ...safeInput,
      arena_id: arenaId,
      registered_by: dbUserId,
    });
    revalidatePath(`/dashboard/finance/${arenaId}`);
    return { success: true, data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao criar lançamento';
    return { success: false, error: message };
  }
}

export async function updateTransactionAction(
  arenaId: string,
  transactionId: string,
  input: unknown
) {
  try {
    await assertArenaAdminAccess(arenaId);
    await assertArenaScopedResourceAccess('transactions', transactionId, { expectedArenaId: arenaId });
    const parsed = transactionActionSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Dados do lançamento inválidos');
    }
    const safeInput = {
      ...parsed.data,
      total_value: Number(Math.max(0, parsed.data.quantity * parsed.data.unit_value - parsed.data.discount).toFixed(2)),
      atleta_id: parsed.data.atleta_id ?? null,
      modo_pagamento_id: parsed.data.modo_pagamento_id ?? null,
    };
    const repo = new SupabaseFinanceRepository(getSupabaseAdmin());
    const data = await repo.update(transactionId, safeInput);
    revalidatePath(`/dashboard/finance/${arenaId}`);
    return { success: true, data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao atualizar lançamento';
    return { success: false, error: message };
  }
}

export async function deleteTransactionAction(
  arenaId: string,
  transactionId: string
) {
  try {
    await assertArenaAdminAccess(arenaId);
    await assertArenaScopedResourceAccess('transactions', transactionId, { expectedArenaId: arenaId });
    const repo = new SupabaseFinanceRepository(getSupabaseAdmin());
    await repo.delete(transactionId);
    revalidatePath(`/dashboard/finance/${arenaId}`);
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao excluir lançamento';
    return { success: false, error: message };
  }
}

export type { AvulsoReservaItem, AvulsoStatus } from '@/modules/finance/lib/avulsos-list';

export async function getAvulsosTodosAction(arenaId: string) {
  try {
    await assertArenaAdminAccess(arenaId);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('bookings')
      .select(
        `
                id,
                start_time,
                end_time,
                price,
                status,
                athlete_name,
                cobranca_por_participante,
                atleta:athlete_id(id, nome_perfil, telefone),
                court:court_id(id, name),
                sports:sport_id(id, name),
                ${BOOKING_COBRANCAS_SELECT}
            `
      )
      .eq('arena_id', arenaId)
      .is('plano_mensalista_id', null)
      .in('status', ['reservado', 'confirmed', 'cancelled'])
      .order('start_time', { ascending: false });

    if (error) throw new Error(error.message);

    const items = ((data ?? []) as unknown as AvulsoBookingRow[]).map(buildAvulsoItem);
    return { success: true, data: items };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao buscar cobranças avulsas';
    return { success: false, error: message, data: [] as AvulsoReservaItem[] };
  }
}
