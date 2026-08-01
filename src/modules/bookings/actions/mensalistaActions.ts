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

const uuidSchema = z.string().uuid();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

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
