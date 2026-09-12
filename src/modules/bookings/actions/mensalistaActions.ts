'use server';

import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  assertArenaBackofficeAccess,
  assertCourtAccess,
  requireAuthenticatedDbUser,
} from '@/lib/server-auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { PlanoMensalistaComDetalhes } from '@/modules/bookings/types/booking.types';

export interface CreatePlanoMensalistaInput {
  court_id: string;
  athlete_id: string;
  athlete_name: string;
  sport_id?: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  sessoes_por_mes: number;
  valor_mensal: number;
  additional_athlete_ids?: string[];
}

/** Uma faixa semanal do plano: espaço, dia da semana e intervalo. */
export interface PlanoMensalistaBlocoInput {
  court_id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
}

export interface CreatePlanoMensalistaBlocosInput {
  athlete_id: string;
  sport_id?: string;
  blocos: PlanoMensalistaBlocoInput[];
  valor_mensal: number;
  additional_athlete_ids?: string[];
}

const uuidSchema = z.string().uuid();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const blocoSchema = z
  .object({
    court_id: uuidSchema,
    dia_semana: z.number().int().min(0).max(6),
    horario_inicio: timeSchema,
    horario_fim: timeSchema,
  })
  .refine((bloco) => bloco.horario_fim > bloco.horario_inicio, {
    message: 'O horário final do bloco deve ser posterior ao inicial',
    path: ['horario_fim'],
  });

const createPlanoBlocosSchema = z.object({
  athlete_id: uuidSchema,
  sport_id: uuidSchema.optional(),
  blocos: z.array(blocoSchema).min(1).max(40),
  valor_mensal: z.number().finite().min(0).max(100_000_000),
  additional_athlete_ids: z.array(uuidSchema).max(50).optional(),
});

const createPlanoSchema = z
  .object({
    court_id: uuidSchema,
    athlete_id: uuidSchema,
    // Kept in the UI contract, but never sent to the RPC. The database derives
    // the canonical identity from atleta after validating arena membership.
    athlete_name: z.string().trim().max(200),
    sport_id: uuidSchema.optional(),
    dia_semana: z.number().int().min(0).max(6),
    horario_inicio: timeSchema,
    horario_fim: timeSchema,
    sessoes_por_mes: z.number().int().min(1).max(8),
    valor_mensal: z.number().finite().min(0).max(100_000_000),
    additional_athlete_ids: z.array(uuidSchema).max(50).optional(),
  })
  .refine((input) => input.horario_fim > input.horario_inicio, {
    message: 'O horário final deve ser posterior ao horário inicial',
    path: ['horario_fim'],
  });

type MonthlyPlanRpcName =
  | 'create_monthly_plan_atomic'
  | 'create_monthly_plan_blocks_atomic'
  | 'cancel_monthly_plan_atomic'
  | 'confirm_monthly_plan_month_atomic';

type MonthlyPlanRpcClient = {
  rpc: (
    name: MonthlyPlanRpcName,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function asMonthlyPlanRpcClient(
  supabase: ReturnType<typeof getSupabaseAdmin>
): MonthlyPlanRpcClient {
  return supabase as unknown as MonthlyPlanRpcClient;
}

function revalidateMonthlyPlanPaths(arenaId: string) {
  revalidatePath(`/dashboard/arenas/${arenaId}`);
  revalidatePath(`/dashboard/arenas/${arenaId}/courts`);
  revalidatePath(`/dashboard/finance/${arenaId}`);
  revalidatePath(`/dashboard/reports/${arenaId}/status-pagamentos`);
}

async function assertMonthlyPlanAthletes(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  arenaId: string,
  responsibleAthleteId: string,
  additionalAthleteIds: string[]
) {
  const athleteIds = Array.from(
    new Set([responsibleAthleteId, ...additionalAthleteIds])
  );
  const { data, error } = await supabase
    .from('arenas_atleta')
    .select('id_atleta')
    .eq('id_arena', arenaId)
    .in('id_atleta', athleteIds);

  if (error) throw new Error(error.message);
  const linkedIds = new Set((data ?? []).map((row) => row.id_atleta));
  if (athleteIds.some((athleteId) => !linkedIds.has(athleteId))) {
    throw new Error('Todos os participantes devem estar vinculados à arena');
  }
}

export async function createPlanoMensalistaAction(
  arenaId: string,
  input: CreatePlanoMensalistaInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId);
    const { dbUserId } = await requireAuthenticatedDbUser();
    const parsed = createPlanoSchema.parse(input);
    await assertCourtAccess(parsed.court_id, arenaId);

    const supabase = getSupabaseAdmin();
    const additionalAthleteIds = Array.from(
      new Set(
        (parsed.additional_athlete_ids ?? []).filter(
          (athleteId) => athleteId !== parsed.athlete_id
        )
      )
    );
    await assertMonthlyPlanAthletes(
      supabase,
      arenaId,
      parsed.athlete_id,
      additionalAthleteIds
    );

    const { error } = await asMonthlyPlanRpcClient(supabase).rpc(
      'create_monthly_plan_atomic',
      {
        p_arena_id: arenaId,
        p_court_id: parsed.court_id,
        p_athlete_id: parsed.athlete_id,
        p_sport_id: parsed.sport_id ?? null,
        p_dia_semana: parsed.dia_semana,
        p_horario_inicio: parsed.horario_inicio,
        p_horario_fim: parsed.horario_fim,
        p_sessoes_por_mes: parsed.sessoes_por_mes,
        p_valor_mensal: parsed.valor_mensal,
        p_additional_athlete_ids: additionalAthleteIds,
        p_registered_by: dbUserId,
      }
    );

    if (error) throw new Error(error.message);

    revalidateMonthlyPlanPaths(arenaId);
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao criar plano mensalista';
    return { success: false, error: message };
  }
}

/**
 * Cria um plano com N faixas semanais e uma única mensalidade.
 *
 * O RPC recusa o plano inteiro se qualquer ocorrência dos três meses colidir
 * com uma reserva existente — a regra "bloqueia o bloco". Nada é criado pela
 * metade, então a tela pode reapresentar o erro e deixar o gestor corrigir.
 */
export async function createPlanoMensalistaBlocosAction(
  arenaId: string,
  input: CreatePlanoMensalistaBlocosInput
): Promise<{ success: boolean; planId?: string; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId);
    const { dbUserId } = await requireAuthenticatedDbUser();
    const parsed = createPlanoBlocosSchema.parse(input);

    const courtIds = Array.from(
      new Set(parsed.blocos.map((bloco) => bloco.court_id))
    );
    for (const courtId of courtIds) {
      await assertCourtAccess(courtId, arenaId);
    }

    const supabase = getSupabaseAdmin();
    const additionalAthleteIds = Array.from(
      new Set(
        (parsed.additional_athlete_ids ?? []).filter(
          (athleteId) => athleteId !== parsed.athlete_id
        )
      )
    );
    await assertMonthlyPlanAthletes(
      supabase,
      arenaId,
      parsed.athlete_id,
      additionalAthleteIds
    );

    const { data, error } = await asMonthlyPlanRpcClient(supabase).rpc(
      'create_monthly_plan_blocks_atomic',
      {
        p_arena_id: arenaId,
        p_athlete_id: parsed.athlete_id,
        p_sport_id: parsed.sport_id ?? null,
        p_blocks: parsed.blocos,
        p_valor_mensal: parsed.valor_mensal,
        p_additional_athlete_ids: additionalAthleteIds,
        p_registered_by: dbUserId,
      }
    );

    if (error) throw new Error(error.message);

    revalidateMonthlyPlanPaths(arenaId);
    const planId = (data as { plan_id?: string } | null)?.plan_id;
    return { success: true, planId };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao criar plano mensalista';
    return { success: false, error: message };
  }
}

export async function cancelPlanoMensalistaAction(
  arenaId: string,
  planoId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId);
    const parsed = z
      .object({ arenaId: uuidSchema, planoId: uuidSchema })
      .parse({ arenaId, planoId });
    const { error } = await asMonthlyPlanRpcClient(getSupabaseAdmin()).rpc(
      'cancel_monthly_plan_atomic',
      {
        p_arena_id: parsed.arenaId,
        p_plan_id: parsed.planoId,
      }
    );

    if (error) throw new Error(error.message);

    revalidateMonthlyPlanPaths(arenaId);
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao cancelar plano mensalista';
    return { success: false, error: message };
  }
}

export async function confirmarMesMensalistaAction(
  arenaId: string,
  planoId: string,
  valorOverride: number | undefined,
  expectedBookingStart: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId);
    const { dbUserId } = await requireAuthenticatedDbUser();
    const parsed = z
      .object({
        arenaId: uuidSchema,
        planoId: uuidSchema,
        expectedBookingStart: z.string().datetime({ offset: true }),
      })
      .parse({ arenaId, planoId, expectedBookingStart });

    // The dialog still supplies its editable value for UI compatibility, but
    // monthly-plan price is canonical and always read from the locked plan row.
    void valorOverride;

    const { error } = await asMonthlyPlanRpcClient(getSupabaseAdmin()).rpc(
      'confirm_monthly_plan_month_atomic',
      {
        p_arena_id: parsed.arenaId,
        p_plan_id: parsed.planoId,
        p_expected_booking_start: parsed.expectedBookingStart,
        p_registered_by: dbUserId,
      }
    );

    if (error) throw new Error(error.message);

    revalidateMonthlyPlanPaths(arenaId);
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao confirmar pagamento';
    return { success: false, error: message };
  }
}

/* Legacy multi-step mutations were intentionally removed. All plan, booking,
 * participant and transaction writes now live in the three RPC transactions. */

export async function getPlanosMensalistaAction(
  arenaId: string,
  courtId?: string
): Promise<{
  success: boolean;
  data?: PlanoMensalistaComDetalhes[];
  error?: string;
}> {
  try {
    await assertArenaBackofficeAccess(arenaId);
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('planos_mensalista')
      .select(
        '*, atleta:athlete_id(id, nome_perfil, telefone), sports:sport_id(id, name), court:court_id(id, name)'
      )
      .eq('arena_id', arenaId)
      .eq('status', 'ativo');

    if (courtId) {
      query = (query as any).eq('court_id', courtId);
    }

    const { data, error } = await (query as any).order('created_at', {
      ascending: false,
    });

    if (error) throw new Error(error.message);

    const now = new Date().toISOString();
    const planosWithNext = await Promise.all(
      (data || []).map(async (plano: any) => {
        const { data: nextReservado } = await supabase
          .from('bookings')
          .select('start_time')
          .eq('plano_mensalista_id', plano.id)
          .eq('status', 'reservado')
          .gte('start_time', now)
          .order('start_time', { ascending: true })
          .limit(1);

        return {
          ...plano,
          proximo_mes_reservado: nextReservado?.[0]?.start_time || null,
        } as PlanoMensalistaComDetalhes;
      })
    );

    return { success: true, data: planosWithNext };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao buscar mensalistas';
    return { success: false, error: message };
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Cancelar UMA sessão do plano (o jogo de um dia), com crédito opcional
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * `court_price_tables` e `planos_mensalista.price_table_id` ainda não estão nos
 * tipos gerados (regenerados no fim da Fase 2) — mesmo cliente destipado que
 * `priceTableActions` usa.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas ainda fora dos tipos gerados */
type LooseClient = {
  from: (table: string) => any;
  rpc: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type SessaoMensalistaQuote = {
  valorSugerido: number;
  /** Nome da tabela de preço usada na sugestão, para a tela poder dizer qual é. */
  tabelaNome: string | null;
  origem: 'plano' | 'mensalista' | 'padrao';
  atletaNome: string | null;
  inicio: string;
  fim: string;
};

/**
 * Quanto vale a sessão que está sendo cancelada, pela tabela de preço que vale
 * para a mensalidade dele. A cadeia é deliberada:
 *
 *   1. `planos_mensalista.price_table_id` — a tabela que de fato originou o
 *      valor mensal (snapshot de quando o plano foi criado);
 *   2. a tabela `tipo='mensalista'` do espaço — planos antigos não têm o
 *      snapshot, e o papel é resolvido por `tipo`, nunca por nome;
 *   3. `null` ⇒ `resolve_court_price` cai na tabela padrão do espaço.
 *
 * O valor sai sempre de `resolve_court_price` no banco, nunca de conta no cliente.
 */
export async function quoteSessaoMensalistaAction(
  arenaId: string,
  bookingId: string
): Promise<{ success: boolean; data?: SessaoMensalistaQuote; error?: string }> {
  try {
    await assertArenaBackofficeAccess(arenaId);
    const parsed = z
      .object({ arenaId: uuidSchema, bookingId: uuidSchema })
      .parse({ arenaId, bookingId });

    const supabase = getSupabaseAdmin() as unknown as LooseClient;

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, court_id, start_time, end_time, plano_mensalista_id, status')
      .eq('id', parsed.bookingId)
      .eq('arena_id', parsed.arenaId)
      .single();
    if (bookingError) throw new Error(bookingError.message);
    if (!booking?.plano_mensalista_id) {
      throw new Error('Esta reserva não pertence a um plano mensalista.');
    }

    const { data: plano, error: planoError } = await supabase
      .from('planos_mensalista')
      .select('id, athlete_name, price_table_id')
      .eq('id', booking.plano_mensalista_id)
      .eq('arena_id', parsed.arenaId)
      .single();
    if (planoError) throw new Error(planoError.message);

    let priceTableId: string | null = plano?.price_table_id ?? null;
    let origem: SessaoMensalistaQuote['origem'] = 'plano';

    if (!priceTableId) {
      const { data: mensalistaTable } = await supabase
        .from('court_price_tables')
        .select('id')
        .eq('court_id', booking.court_id)
        .eq('tipo', 'mensalista')
        .maybeSingle();
      if (mensalistaTable?.id) {
        priceTableId = mensalistaTable.id;
        origem = 'mensalista';
      } else {
        origem = 'padrao';
      }
    }

    const { data: valor, error: quoteError } = await supabase.rpc('resolve_court_price', {
      p_court_id: booking.court_id,
      p_price_table_id: priceTableId,
      p_start: new Date(booking.start_time).toISOString(),
      p_end: new Date(booking.end_time).toISOString(),
    });
    if (quoteError) throw new Error(quoteError.message);

    let tabelaNome: string | null = null;
    if (priceTableId) {
      const { data: tabela } = await supabase
        .from('court_price_tables')
        .select('nome')
        .eq('id', priceTableId)
        .maybeSingle();
      tabelaNome = tabela?.nome ?? null;
    }

    return {
      success: true,
      data: {
        valorSugerido: Number(valor) || 0,
        tabelaNome,
        origem,
        atletaNome: plano?.athlete_name ?? null,
        inicio: booking.start_time,
        fim: booking.end_time,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao calcular o valor da sessão';
    return { success: false, error: message };
  }
}

const cancelarSessaoSchema = z.object({
  arenaId: uuidSchema,
  bookingId: uuidSchema,
  operationId: uuidSchema,
  lancarCredito: z.boolean(),
  valorCredito: z.number().nonnegative().max(1_000_000),
  descricao: z.string().trim().max(500),
});

export type CancelarSessaoInput = z.infer<typeof cancelarSessaoSchema>;

/**
 * Cancela **uma** sessão do plano e, se pedido, lança o crédito na mesma
 * transação. Não encerra o plano, não mexe na mensalidade nem nas cobranças: o
 * mês continua devido e o crédito é a compensação.
 */
export async function cancelarSessaoMensalistaAction(
  input: unknown
): Promise<{
  success: boolean;
  data?: { creditoId: string | null; valorCredito: number; saldo: number };
  error?: string;
}> {
  try {
    const parsed = cancelarSessaoSchema.parse(input);
    await assertArenaBackofficeAccess(parsed.arenaId);
    const { dbUserId } = await requireAuthenticatedDbUser();

    if (parsed.lancarCredito && parsed.valorCredito <= 0) {
      throw new Error('Informe um valor de crédito maior que zero.');
    }

    const supabase = getSupabaseAdmin() as unknown as LooseClient;
    const { data, error } = await supabase.rpc('cancel_mensalista_booking_atomic', {
      p_operation_id: parsed.operationId,
      p_arena_id: parsed.arenaId,
      p_booking_id: parsed.bookingId,
      p_lancar_credito: parsed.lancarCredito,
      p_valor_credito: parsed.lancarCredito ? parsed.valorCredito : 0,
      p_descricao: parsed.lancarCredito ? parsed.descricao : null,
      p_registered_by: dbUserId,
    });
    if (error) throw new Error(error.message);

    const result = (data ?? {}) as {
      credito_id?: string | null;
      valor_credito?: number | string;
      saldo?: number | string;
    };

    revalidateMonthlyPlanPaths(parsed.arenaId);
    // O crédito aparece na tela de Mensalistas do atleta — revalida lá também.
    revalidatePath(`/dashboard/arenas/${parsed.arenaId}/mensalistas`);
    return {
      success: true,
      data: {
        creditoId: result.credito_id ?? null,
        valorCredito: Number(result.valor_credito ?? 0),
        saldo: Number(result.saldo ?? 0),
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erro ao cancelar a sessão';
    return { success: false, error: message };
  }
}
