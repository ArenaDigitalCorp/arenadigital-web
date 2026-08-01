import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRotativoRepository } from './IRotativoRepository';
import type {
  Rotativo,
  RotativoInscricao,
  CreateRotativoDTO,
  MonthCalendarEntry,
  RotativoListFilters,
  RotativoPacote,
  RotativoCreditoMovimento,
  RotativoCreditoSaldo,
  CourtOption,
  AtomicRotativoEnrollmentResult,
  AtomicRotativoCreditPurchaseResult,
} from '../types/rotativo.types';

type RotativoRpcClient = {
  rpc: (
    name:
      | 'enroll_backoffice_rotativo_athlete'
      | 'purchase_backoffice_rotativo_credits'
      | 'quote_backoffice_rotativo_credits'
      | 'replace_backoffice_rotativo_packages'
      | 'expire_backoffice_rotativo_credits',
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const ROTATIVO_SELECT = `
  *,
  esporte:id_esporte(name),
  rotativo_courts(court:courts(id, name))
` as const;

function mapRotativo(row: Record<string, unknown>): Rotativo {
  const courts = (row.rotativo_courts as Array<{ court: { id: string; name: string } | null }> | null)
    ?.map((rc) => rc.court)
    .filter((c): c is { id: string; name: string } => Boolean(c)) ?? [];

  const rest = { ...row };
  delete rest.rotativo_courts;
  return { ...rest, courts } as unknown as Rotativo;
}

async function attachInscricoesCount(client: SupabaseClient, rows: Rotativo[]): Promise<Rotativo[]> {
  return Promise.all(
    rows.map(async (r) => {
      const { count } = await client
        .from('rotativo_inscricoes')
        .select('*', { count: 'exact', head: true })
        .eq('id_rotativo', r.id);
      return { ...r, inscricoes_count: count ?? 0 };
    })
  );
}

export class SupabaseRotativoRepository implements IRotativoRepository {
  constructor(private readonly client: SupabaseClient) {}

  private get rpc(): RotativoRpcClient {
    return this.client as unknown as RotativoRpcClient;
  }

  private async assertCourtsBelongToArena(arenaId: string, courtIds: string[]): Promise<string[]> {
    const uniqueCourtIds = [...new Set(courtIds)];
    if (uniqueCourtIds.length > 0) {
      const { data: scopedCourts, error: courtsError } = await this.client
        .from('courts')
        .select('id')
        .eq('arena_id', arenaId)
        .in('id', uniqueCourtIds);
      if (courtsError) throw new Error(`SupabaseRotativoRepository.syncCourts: ${courtsError.message}`);
      if ((scopedCourts ?? []).length !== uniqueCourtIds.length) {
        throw new Error('Uma ou mais quadras não pertencem à arena informada');
      }
    }
    return uniqueCourtIds;
  }

  private async syncCourts(arenaId: string, rotativoId: string, courtIds: string[]) {
    const { data: scopedRotativo, error: rotativoError } = await this.client
      .from('rotativos')
      .select('id')
      .eq('id', rotativoId)
      .eq('id_arena', arenaId)
      .maybeSingle();
    if (rotativoError) throw new Error(`SupabaseRotativoRepository.syncCourts: ${rotativoError.message}`);
    if (!scopedRotativo) throw new Error('Rotativo não pertence à arena informada');

    const { error: deleteError } = await this.client
      .from('rotativo_courts')
      .delete()
      .eq('rotativo_id', rotativoId);
    if (deleteError) throw new Error(`SupabaseRotativoRepository.syncCourts: ${deleteError.message}`);
    if (courtIds.length === 0) return;
    const { error } = await this.client
      .from('rotativo_courts')
      .insert(courtIds.map((court_id) => ({ rotativo_id: rotativoId, court_id })));
    if (error) throw new Error(`SupabaseRotativoRepository.syncCourts: ${error.message}`);
  }

  async create(data: CreateRotativoDTO, courtIds: string[]): Promise<Rotativo> {
    const scopedCourtIds = await this.assertCourtsBelongToArena(data.id_arena, courtIds);
    const { data: row, error } = await this.client
      .from('rotativos')
      .insert({ ...data, status: data.status ?? 'ativo' })
      .select(ROTATIVO_SELECT)
      .single();

    if (error) throw new Error(`SupabaseRotativoRepository.create: ${error.message}`);
    await this.syncCourts(data.id_arena, row.id, scopedCourtIds);
    const refreshed = await this.findById(data.id_arena, row.id);
    return refreshed ?? mapRotativo(row);
  }

  async update(arenaId: string, rotativoId: string, data: Partial<CreateRotativoDTO>, courtIds: string[]): Promise<Rotativo> {
    const scopedCourtIds = await this.assertCourtsBelongToArena(arenaId, courtIds);
    const { data: updated, error } = await this.client
      .from('rotativos')
      .update(data)
      .eq('id', rotativoId)
      .eq('id_arena', arenaId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`SupabaseRotativoRepository.update: ${error.message}`);
    if (!updated) throw new Error('Rotativo não pertence à arena informada');
    await this.syncCourts(arenaId, rotativoId, scopedCourtIds);
    const refreshed = await this.findById(arenaId, rotativoId);
    if (!refreshed) throw new Error('Rotativo não encontrado após atualização');
    return refreshed;
  }

  async setStatus(arenaId: string, rotativoId: string, status: 'ativo' | 'desativado'): Promise<void> {
    const { data: updated, error } = await this.client
      .from('rotativos')
      .update({ status })
      .eq('id', rotativoId)
      .eq('id_arena', arenaId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`SupabaseRotativoRepository.setStatus: ${error.message}`);
    if (!updated) throw new Error('Rotativo não pertence à arena informada');
  }

  async findById(arenaId: string, rotativoId: string): Promise<Rotativo | null> {
    const { data, error } = await this.client
      .from('rotativos')
      .select(ROTATIVO_SELECT)
      .eq('id', rotativoId)
      .eq('id_arena', arenaId)
      .maybeSingle();

    if (error) throw new Error(`SupabaseRotativoRepository.findById: ${error.message}`);
    if (!data) return null;

    const [mapped] = await attachInscricoesCount(this.client, [mapRotativo(data)]);
    return mapped;
  }

  async findByDate(arenaId: string, date: string): Promise<Rotativo[]> {
    const { data, error } = await this.client
      .from('rotativos')
      .select(ROTATIVO_SELECT)
      .eq('id_arena', arenaId)
      .eq('data', date)
      .order('hora_inicio', { ascending: true });

    if (error) throw new Error(`SupabaseRotativoRepository.findByDate: ${error.message}`);
    const mapped = (data ?? []).map(mapRotativo);
    return attachInscricoesCount(this.client, mapped);
  }

  async list(arenaId: string, filters: RotativoListFilters = {}): Promise<{ rows: Rotativo[]; total: number }> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client
      .from('rotativos')
      .select(ROTATIVO_SELECT, { count: 'exact' })
      .eq('id_arena', arenaId)
      .order('data', { ascending: false })
      .order('hora_inicio', { ascending: false });

    if (filters.status && filters.status !== 'todos') {
      query = query.eq('status', filters.status);
    }

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      const { data: arenaAthletes } = await this.client
        .from('arenas_atleta')
        .select('id_atleta')
        .eq('id_arena', arenaId);

      const arenaAthleteIds = (arenaAthletes ?? []).map((a) => a.id_atleta);
      if (arenaAthleteIds.length === 0) return { rows: [], total: 0 };

      const { data: matchingAthletes } = await this.client
        .from('atleta')
        .select('id')
        .in('id', arenaAthleteIds)
        .ilike('nome_perfil', `%${term}%`);

      const athleteIds = (matchingAthletes ?? []).map((a) => a.id);
      if (athleteIds.length === 0) return { rows: [], total: 0 };

      const { data: inscricaoMatches } = await this.client
        .from('rotativo_inscricoes')
        .select('id_rotativo')
        .in('id_atleta', athleteIds);

      const rotativoIds = [
        ...new Set((inscricaoMatches ?? []).map((i) => i.id_rotativo)),
      ];

      if (rotativoIds.length === 0) return { rows: [], total: 0 };
      query = query.in('id', rotativoIds);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw new Error(`SupabaseRotativoRepository.list: ${error.message}`);

    const mapped = (data ?? []).map(mapRotativo);
    const rows = await attachInscricoesCount(this.client, mapped);
    return { rows, total: count ?? 0 };
  }

  async findByMonth(arenaId: string, startDate: string, endDate: string): Promise<Record<string, MonthCalendarEntry>> {
    const { data, error } = await this.client
      .from('rotativos')
      .select('id, data')
      .eq('id_arena', arenaId)
      .gte('data', startDate)
      .lte('data', endDate);

    if (error) throw new Error(`SupabaseRotativoRepository.findByMonth: ${error.message}`);

    const results = await Promise.all(
      (data ?? []).map(async (r) => {
        const { count } = await this.client
          .from('rotativo_inscricoes')
          .select('*', { count: 'exact', head: true })
          .eq('id_rotativo', r.id);
        return { data: r.data, inscricoes_count: count ?? 0 };
      })
    );

    const byDate: Record<string, MonthCalendarEntry> = {};
    for (const r of results) {
      if (!byDate[r.data]) byDate[r.data] = { hasRotativo: true, hasInscriptions: false };
      if (r.inscricoes_count > 0) byDate[r.data].hasInscriptions = true;
    }
    return byDate;
  }

  async getInscritos(arenaId: string, rotativoId: string): Promise<RotativoInscricao[]> {
    const { data, error } = await this.client
      .from('rotativo_inscricoes')
      .select('*, rotativo:rotativos!inner(id_arena), atleta:id_atleta(nome_perfil), modo_pagamento:modo_pagamento_id(nome)')
      .eq('id_rotativo', rotativoId)
      .eq('rotativo.id_arena', arenaId)
      .order('data_inscricao', { ascending: true });

    if (error) throw new Error(`SupabaseRotativoRepository.getInscritos: ${error.message}`);
    return (data ?? []) as unknown as RotativoInscricao[];
  }

  async enrollAthleteAtomic(input: {
    arenaId: string;
    rotativoId: string;
    athleteId: string;
    paymentType: 'credito' | 'avulso';
    paymentMethodId: string | null;
    observation: string | null;
    registeredBy: string;
  }): Promise<AtomicRotativoEnrollmentResult> {
    const { data, error } = await this.rpc.rpc('enroll_backoffice_rotativo_athlete', {
      p_arena_id: input.arenaId,
      p_rotativo_id: input.rotativoId,
      p_athlete_id: input.athleteId,
      p_payment_type: input.paymentType,
      p_payment_method_id: input.paymentMethodId,
      p_observation: input.observation,
      p_registered_by: input.registeredBy,
    });

    if (error) throw new Error(`SupabaseRotativoRepository.enrollAthleteAtomic: ${error.message}`);
    return data as AtomicRotativoEnrollmentResult;
  }

  async getCourts(arenaId: string): Promise<CourtOption[]> {
    const { data, error } = await this.client
      .from('courts')
      .select('id, name')
      .eq('arena_id', arenaId)
      .order('name');

    if (error) throw new Error(`SupabaseRotativoRepository.getCourts: ${error.message}`);
    return data ?? [];
  }

  async getPacotes(arenaId: string): Promise<RotativoPacote[]> {
    const { data, error } = await this.client
      .from('rotativo_pacotes')
      .select('*')
      .eq('arena_id', arenaId)
      .order('ordem', { ascending: true });

    if (error) throw new Error(`SupabaseRotativoRepository.getPacotes: ${error.message}`);
    return (data ?? []) as RotativoPacote[];
  }

  async quoteCreditPurchaseValue(arenaId: string, quantity: number): Promise<number> {
    const { data, error } = await this.rpc.rpc('quote_backoffice_rotativo_credits', {
      p_arena_id: arenaId,
      p_quantity: quantity,
    });
    if (error) throw new Error(`SupabaseRotativoRepository.quoteCreditPurchaseValue: ${error.message}`);
    return Number(data);
  }

  async savePacotes(arenaId: string, pacotes: { quantidade: number; valor_reais: number }[]): Promise<RotativoPacote[]> {
    const { data, error } = await this.rpc.rpc('replace_backoffice_rotativo_packages', {
      p_arena_id: arenaId,
      p_packages: pacotes,
    });

    if (error) throw new Error(`SupabaseRotativoRepository.savePacotes: ${error.message}`);
    return (data ?? []) as RotativoPacote[];
  }

  async purchaseCreditsAtomic(input: {
    operationId: string;
    arenaId: string;
    athleteId: string;
    quantity: number;
    validityDays: number;
    paymentMethodId: string;
    registeredBy: string;
  }): Promise<AtomicRotativoCreditPurchaseResult> {
    const { data, error } = await this.rpc.rpc('purchase_backoffice_rotativo_credits', {
      p_operation_id: input.operationId,
      p_arena_id: input.arenaId,
      p_athlete_id: input.athleteId,
      p_quantity: input.quantity,
      p_validity_days: input.validityDays,
      p_payment_method_id: input.paymentMethodId,
      p_registered_by: input.registeredBy,
    });

    if (error) throw new Error(`SupabaseRotativoRepository.purchaseCreditsAtomic: ${error.message}`);
    return data as AtomicRotativoCreditPurchaseResult;
  }

  async getCreditMovements(
    arenaId: string,
    filters: { search?: string; page?: number; pageSize?: number } = {}
  ): Promise<{ rows: RotativoCreditoMovimento[]; total: number }> {
    await this.processExpiredCredits(arenaId);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client
      .from('rotativo_credito_movimentos')
      .select('*', { count: 'exact' })
      .eq('arena_id', arenaId)
      .order('created_at', { ascending: false });

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      const { data: arenaAthletes } = await this.client
        .from('arenas_atleta')
        .select('id_atleta')
        .eq('id_arena', arenaId);

      const arenaAthleteIds = (arenaAthletes ?? []).map((a) => a.id_atleta);
      if (arenaAthleteIds.length === 0) return { rows: [], total: 0 };

      const { data: matchingAthletes } = await this.client
        .from('atleta')
        .select('id')
        .in('id', arenaAthleteIds)
        .ilike('nome_perfil', `%${term}%`);

      const athleteIds = (matchingAthletes ?? []).map((a) => a.id);
      if (athleteIds.length === 0) return { rows: [], total: 0 };
      query = query.in('atleta_id', athleteIds);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw new Error(`SupabaseRotativoRepository.getCreditMovements: ${error.message}`);

    const rows = (data ?? []) as Array<{
      id: string;
      arena_id: string;
      atleta_id: string;
      tipo: 'compra' | 'uso' | 'vencimento';
      quantidade: number;
      lote_id: string | null;
      inscricao_id: string | null;
      created_at: string;
    }>;

    if (rows.length === 0) return { rows: [], total: count ?? 0 };

    const athleteIds = [...new Set(rows.map((r) => r.atleta_id))];
    const loteIds = [...new Set(rows.map((r) => r.lote_id).filter((id): id is string => Boolean(id)))];

    const [{ data: atletas }, { data: lotes }] = await Promise.all([
      this.client.from('atleta').select('id, nome_perfil').in('id', athleteIds),
      loteIds.length > 0
        ? this.client.from('rotativo_credito_lotes').select('id, data_vencimento').in('id', loteIds)
        : Promise.resolve({ data: [] as { id: string; data_vencimento: string }[] }),
    ]);

    const atletaMap = new Map((atletas ?? []).map((a) => [a.id, a]));
    const loteMap = new Map((lotes ?? []).map((l) => [l.id, l]));

    return {
      rows: rows.map((row) => ({
        ...row,
        atleta: atletaMap.get(row.atleta_id) ?? null,
        lote: row.lote_id ? loteMap.get(row.lote_id) ?? null : null,
      })) as unknown as RotativoCreditoMovimento[],
      total: count ?? 0,
    };
  }

  async getTopAthletesByCredit(arenaId: string, limit = 5): Promise<RotativoCreditoSaldo[]> {
    await this.processExpiredCredits(arenaId);

    const { data: saldos, error } = await this.client
      .from('rotativo_credito_saldo')
      .select('arena_id, atleta_id, saldo')
      .eq('arena_id', arenaId)
      .gt('saldo', 0)
      .order('saldo', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`SupabaseRotativoRepository.getTopAthletesByCredit: ${error.message}`);
    if (!saldos?.length) return [];

    const athleteIds = saldos.map((s) => s.atleta_id);
    const { data: atletas } = await this.client
      .from('atleta')
      .select('id, nome_perfil')
      .in('id', athleteIds);

    const atletaMap = new Map((atletas ?? []).map((a) => [a.id, a]));

    return saldos.map((s) => ({
      ...s,
      atleta: atletaMap.get(s.atleta_id) ?? null,
    })) as RotativoCreditoSaldo[];
  }

  async getAthleteCreditBalance(arenaId: string, athleteId: string): Promise<number> {
    await this.processExpiredCredits(arenaId);

    const { data, error } = await this.client
      .from('rotativo_credito_saldo')
      .select('saldo')
      .eq('arena_id', arenaId)
      .eq('atleta_id', athleteId)
      .maybeSingle();

    if (error) throw new Error(`SupabaseRotativoRepository.getAthleteCreditBalance: ${error.message}`);
    return data?.saldo ?? 0;
  }

  async processExpiredCredits(arenaId: string): Promise<number> {
    const { data, error } = await this.rpc.rpc('expire_backoffice_rotativo_credits', {
      p_arena_id: arenaId,
    });
    if (error) throw new Error(`SupabaseRotativoRepository.processExpiredCredits: ${error.message}`);
    return Number(data ?? 0);
  }
}
