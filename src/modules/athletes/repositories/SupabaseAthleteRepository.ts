import type { SupabaseClient } from '@supabase/supabase-js';
import type { IAthleteRepository } from './IAthleteRepository';
import type { Atleta, AtletaListItem, CreateAtletaDTO, CreateArenaAtletaDTO, CreateAtletaEsporteDTO } from '../types/athlete.types';

export class SupabaseAthleteRepository implements IAthleteRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByArena(arenaId: string, searchTerm?: string): Promise<AtletaListItem[]> {
    let query = this.client
      .from('atleta')
      .select(`
        id,
        nome_perfil,
        cpf,
        telefone,
        users:id_users(email),
        arenas_atleta!inner(id_arena),
        atleta_esportes(sport:id_esporte(name))
      `)
      .eq('arenas_atleta.id_arena', arenaId)
      .order('nome_perfil', { ascending: true });

    if (searchTerm) query = query.ilike('nome_perfil', `%${searchTerm}%`);

    const { data, error } = await query;
    if (error) throw new Error(`SupabaseAthleteRepository.findByArena: ${error.message}`);

    return (data ?? []).map((a: any) => ({
      id: a.id,
      name: a.nome_perfil,
      cpf: a.cpf ?? '---',
      telefone: a.telefone ?? '---',
      email: a.users?.email ?? '---',
      sport: a.atleta_esportes?.[0]?.sport?.name ?? 'N/A',
    }));
  }

  async create(data: CreateAtletaDTO): Promise<Atleta> {
    const { data: row, error } = await this.client
      .from('atleta')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(`SupabaseAthleteRepository.create: ${error.message}`);
    return row;
  }

  async linkToArena(data: CreateArenaAtletaDTO): Promise<void> {
    const { error } = await this.client.from('arenas_atleta').insert(data);
    if (error) throw new Error(`SupabaseAthleteRepository.linkToArena: ${error.message}`);
  }

  async addSport(data: CreateAtletaEsporteDTO): Promise<void> {
    const { error } = await this.client.from('atleta_esportes').insert(data);
    if (error) throw new Error(`SupabaseAthleteRepository.addSport: ${error.message}`);
  }

  async getSports(): Promise<{ id: string; name: string }[]> {
    const { data, error } = await this.client
      .from('sports')
      .select('id, name')
      .order('name');

    if (error) throw new Error(`SupabaseAthleteRepository.getSports: ${error.message}`);
    return data ?? [];
  }
}
