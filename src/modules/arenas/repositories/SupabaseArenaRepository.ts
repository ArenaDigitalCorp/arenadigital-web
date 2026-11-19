import type { SupabaseClient } from '@supabase/supabase-js';
import type { IArenaRepository } from './IArenaRepository';
import type { Arena, CreateArenaDTO, UpdateArenaDTO, Sport, Comodidade } from '../types/arena.types';

const REGISTRATION_FIELDS = 'id,owner_id,name,legal_name,status,address,phone,email,description,banner_url,zip_code,number,complement,neighborhood,id_municipio,cpf_cnpj,facebook,instagram,tiktok,opening_hours,created_at';

const ARENA_WITH_RELATIONS = `
  *,
  sports_relation:arena_sports(sport:sports(*)),
  comodidades_relation:arena_comodidades(comodidade:comodidades(*))
` as const;

function mapRelations(raw: Record<string, unknown>): Arena {
  const { sports_relation, comodidades_relation, ...rest } = raw;
  return {
    ...(rest as unknown as Arena),
    sports: (sports_relation as { sport: Sport }[] | undefined)?.map((s) => s.sport) ?? [],
    comodidades: (comodidades_relation as { comodidade: Comodidade }[] | undefined)?.map((c) => c.comodidade) ?? [],
  };
}

export class SupabaseArenaRepository implements IArenaRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByOwnerId(ownerId: string): Promise<Arena[]> {
    const { data: linkedRows, error: linkedError } = await this.client
      .from('arena_users')
      .select('arena_id')
      .eq('user_id', ownerId)
      .in('status', ['Ativo', 'ativo', 'active']);

    if (linkedError) {
      throw new Error(`SupabaseArenaRepository.findByOwnerId (linked): ${linkedError.message}`);
    }

    const linkedIds = linkedRows?.map((r) => r.arena_id) ?? [];

    let query = this.client
      .from('arenas')
      .select(ARENA_WITH_RELATIONS);

    query = linkedIds.length > 0
      ? query.or(`owner_id.eq.${ownerId},id.in.(${linkedIds.join(',')})`)
      : query.eq('owner_id', ownerId);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new Error(`SupabaseArenaRepository.findByOwnerId: ${error.message}`);
    return (data ?? []).map(mapRelations);
  }

  async findRegistrationById(id: string): Promise<Arena | null> {
    const { data, error } = await this.client.from('arenas')
      .select(`
        ${REGISTRATION_FIELDS},
        sports_relation:arena_sports(sport:sports(id,name)),
        comodidades_relation:arena_comodidades(comodidade:comodidades(id,name))
      `)
      .eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapRelations(data) : null;
  }

  async findById(id: string): Promise<Arena | null> {
    const { data, error } = await this.client
      .from('arenas')
      .select(ARENA_WITH_RELATIONS)
      .eq('id', id)
      .single();

    if (error) return null;
    return mapRelations(data);
  }

  async create(input: CreateArenaDTO): Promise<Arena> {
    const { sports, comodidades, ...arenaData } = input;

    const { data: arena, error } = await this.client
      .from('arenas')
      .insert([arenaData])
      .select()
      .single();

    if (error) throw new Error(`SupabaseArenaRepository.create: ${error.message}`);

    if (sports && sports.length > 0) {
      const { error: sportsError } = await this.client
        .from('arena_sports')
        .insert(sports.map((sport_id) => ({ arena_id: arena.id, sport_id })));
      if (sportsError) throw new Error(`SupabaseArenaRepository.create (sports): ${sportsError.message}`);
    }

    if (comodidades && comodidades.length > 0) {
      const { error: comodidadesError } = await this.client
        .from('arena_comodidades')
        .insert(comodidades.map((comodidade_id) => ({ arena_id: arena.id, comodidade_id })));
      if (comodidadesError) throw new Error(`SupabaseArenaRepository.create (comodidades): ${comodidadesError.message}`);
    }

    return { ...arena, sports: [], comodidades: [] };
  }

  async update(id: string, input: UpdateArenaDTO): Promise<Arena> {
    const { sports, comodidades, ...arenaData } = input;

    const { data, error } = await this.client
      .from('arenas')
      .update(arenaData)
      .eq('id', id)
      .select(REGISTRATION_FIELDS)
      .single();

    if (error) throw new Error(`SupabaseArenaRepository.update: ${error.message}`);

    if (sports !== undefined) {
      await this.client.from('arena_sports').delete().eq('arena_id', id);
      if (sports.length > 0) {
        const { error: sportsError } = await this.client
          .from('arena_sports')
          .insert(sports.map((sport_id) => ({ arena_id: id, sport_id })));
        if (sportsError) throw new Error(`SupabaseArenaRepository.update (sports): ${sportsError.message}`);
      }
    }

    if (comodidades !== undefined) {
      await this.client.from('arena_comodidades').delete().eq('arena_id', id);
      if (comodidades.length > 0) {
        const { error: comodidadesError } = await this.client
          .from('arena_comodidades')
          .insert(comodidades.map((comodidade_id) => ({ arena_id: id, comodidade_id })));
        if (comodidadesError) throw new Error(`SupabaseArenaRepository.update (comodidades): ${comodidadesError.message}`);
      }
    }

    return { ...data, sports: [], comodidades: [] };
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from('arenas').delete().eq('id', id);
    if (error) throw new Error(`SupabaseArenaRepository.delete: ${error.message}`);
  }
}
