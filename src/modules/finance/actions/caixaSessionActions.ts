'use server';

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { assertArenaCaixaAccess } from '@/lib/server-auth';
import { revalidatePath } from 'next/cache';
import {
  openCaixaSessionActionSchema,
  closeCaixaSessionActionSchema,
} from '@/modules/finance/schemas/caixa-session-action.schema';
import { getArenaBillingAddress } from '@/modules/arenas/usecases/get-arena-billing-address.usecase';
import type {
  CaixaResponsavel,
  CaixaSession,
  CaixaSessionsHistoryFilters,
  Transaction,
} from '@/modules/finance/types/finance.types';

const SESSION_WITH_RELATIONS =
  '*, opened_by_user:users!caixa_sessions_opened_by_fkey(name), closed_by_user:users!caixa_sessions_closed_by_fkey(name)' as const;

const HISTORY_PAGE_SIZES = [10, 25, 50, 100];
const HISTORY_DEFAULT_PAGE_SIZE = 25;

export async function getCurrentCaixaSessionAction(arenaId: string) {
  try {
    await assertArenaCaixaAccess(arenaId);
    const { data, error } = await getSupabaseAdmin()
      .from('caixa_sessions')
      .select(SESSION_WITH_RELATIONS)
      .eq('arena_id', arenaId)
      .eq('status', 'aberta')
      .maybeSingle();

    if (error) throw new Error(error.message);
    return { success: true, data: (data as unknown as CaixaSession) ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar caixa aberto';
    return { success: false, error: message, data: null };
  }
}

export async function getCaixaSessionsHistoryAction(
  arenaId: string,
  filters: CaixaSessionsHistoryFilters = {}
) {
  try {
    await assertArenaCaixaAccess(arenaId);
    const page = Math.max(1, Math.trunc(filters.page ?? 1));
    const pageSize = HISTORY_PAGE_SIZES.includes(filters.pageSize ?? HISTORY_DEFAULT_PAGE_SIZE)
      ? (filters.pageSize ?? HISTORY_DEFAULT_PAGE_SIZE)
      : HISTORY_DEFAULT_PAGE_SIZE;

    let query = getSupabaseAdmin()
      .from('caixa_sessions')
      .select(SESSION_WITH_RELATIONS, { count: 'exact' })
      .eq('arena_id', arenaId)
      .eq('status', 'fechada');

    if (filters.dateFrom) query = query.gte('opened_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('opened_at', filters.dateTo);
    if (filters.openedBy) query = query.eq('opened_by', filters.openedBy);

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query
      .order('opened_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      // range além do total de registros (ex.: filtros mudaram entre requisições)
      if (error.code === 'PGRST103') return { success: true, data: [] as CaixaSession[], total: 0 };
      throw new Error(error.message);
    }
    return { success: true, data: (data ?? []) as unknown as CaixaSession[], total: count ?? 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar histórico de caixa';
    return { success: false, error: message, data: [] as CaixaSession[], total: 0 };
  }
}

export async function getCaixaResponsaveisAction(arenaId: string) {
  try {
    await assertArenaCaixaAccess(arenaId);
    const { data, error } = await getSupabaseAdmin()
      .from('caixa_sessions')
      .select('opened_by, opened_by_user:users!caixa_sessions_opened_by_fkey(name)')
      .eq('arena_id', arenaId);

    if (error) throw new Error(error.message);

    const byId = new Map<string, string>();
    for (const row of data ?? []) {
      const name = (row as unknown as { opened_by_user: { name: string | null } | null }).opened_by_user?.name;
      if (row.opened_by && name) byId.set(row.opened_by, name);
    }

    const responsaveis = Array.from(byId, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { success: true, data: responsaveis as CaixaResponsavel[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar responsáveis pelo caixa';
    return { success: false, error: message, data: [] as CaixaResponsavel[] };
  }
}

export async function getCaixaSessionDetailAction(arenaId: string, sessionId: string) {
  try {
    await assertArenaCaixaAccess(arenaId);
    const supabase = getSupabaseAdmin();

    const [{ data: session, error: sessionError }, { data: transactions, error: transactionsError }] =
      await Promise.all([
        supabase
          .from('caixa_sessions')
          .select(SESSION_WITH_RELATIONS)
          .eq('id', sessionId)
          .eq('arena_id', arenaId)
          .maybeSingle(),
        supabase
          .from('transactions')
          .select('*, registered_by:users(name), atleta:atleta_id(id, nome_perfil), modo_pagamento:modo_pagamento_id(id, nome)')
          .eq('caixa_session_id', sessionId)
          .order('created_at', { ascending: true }),
      ]);

    if (sessionError) throw new Error(sessionError.message);
    if (transactionsError) throw new Error(transactionsError.message);
    if (!session) throw new Error('Sessão de caixa não encontrada');

    return {
      success: true,
      data: {
        session: session as unknown as CaixaSession,
        transactions: (transactions ?? []) as unknown as Transaction[],
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar detalhe do caixa';
    return { success: false, error: message, data: null };
  }
}

export async function getCaixaSessionPrintDataAction(arenaId: string, sessionId: string) {
  try {
    await assertArenaCaixaAccess(arenaId);
    const supabase = getSupabaseAdmin();

    const [
      { data: session, error: sessionError },
      { data: transactions, error: transactionsError },
      { data: arenaRow, error: arenaError },
      billingAddress,
    ] = await Promise.all([
      supabase
        .from('caixa_sessions')
        .select(SESSION_WITH_RELATIONS)
        .eq('id', sessionId)
        .eq('arena_id', arenaId)
        .maybeSingle(),
      supabase
        .from('transactions')
        .select('*, registered_by:users(name), atleta:atleta_id(id, nome_perfil), modo_pagamento:modo_pagamento_id(id, nome)')
        .eq('caixa_session_id', sessionId)
        .order('created_at', { ascending: true }),
      supabase.from('arenas').select('name, phone').eq('id', arenaId).single(),
      getArenaBillingAddress(arenaId),
    ]);

    if (sessionError) throw new Error(sessionError.message);
    if (transactionsError) throw new Error(transactionsError.message);
    if (arenaError) throw new Error(arenaError.message);
    if (!session) throw new Error('Sessão de caixa não encontrada');

    return {
      success: true,
      data: {
        session: session as unknown as CaixaSession,
        transactions: (transactions ?? []) as unknown as Transaction[],
        arena: { ...arenaRow, ...billingAddress },
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar dados para impressão';
    return { success: false, error: message, data: null };
  }
}

export async function openCaixaSessionAction(arenaId: string, input: unknown) {
  try {
    const { dbUserId } = await assertArenaCaixaAccess(arenaId);
    const parsed = openCaixaSessionActionSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Dados de abertura de caixa inválidos');
    }

    const { data, error } = await getSupabaseAdmin().rpc('open_caixa_session', {
      p_arena_id: arenaId,
      p_opened_by: dbUserId,
      p_opening_balance: parsed.data.opening_balance,
      p_opening_notes: parsed.data.opening_notes ?? undefined,
    });

    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/finance/${arenaId}/caixa`);
    return { success: true, data: data as unknown as CaixaSession };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao abrir o caixa';
    return { success: false, error: message, data: null };
  }
}

export async function closeCaixaSessionAction(arenaId: string, input: unknown) {
  try {
    const { dbUserId } = await assertArenaCaixaAccess(arenaId);
    const parsed = closeCaixaSessionActionSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Dados de fechamento de caixa inválidos');
    }

    const { data, error } = await getSupabaseAdmin().rpc('close_caixa_session', {
      p_arena_id: arenaId,
      p_session_id: parsed.data.session_id,
      p_closed_by: dbUserId,
      p_closing_notes: parsed.data.closing_notes ?? undefined,
    });

    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/finance/${arenaId}/caixa`);
    return { success: true, data: data as unknown as CaixaSession };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao fechar o caixa';
    return { success: false, error: message, data: null };
  }
}
