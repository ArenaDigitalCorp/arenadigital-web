import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';
import type { IAthleteRepository } from './IAthleteRepository';
import type { Atleta, AtletaListItem, CreateAtletaDTO, CreateArenaAtletaDTO, CreateAtletaEsporteDTO } from '../types/athlete.types';

type AthleteByArenaRow = {
  id: string;
  nome_perfil: string;
  cpf: string | null;
  telefone: string | null;
  users: { email: string } | { email: string }[] | null;
  atleta_esportes: { sport: { name: string } | { name: string }[] | null }[] | null;
};

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
      .order('nome_perfil', { ascending: true })
      .order('id', { ascending: true });

    if (searchTerm) query = query.ilike('nome_perfil', `%${searchTerm}%`);

    const { data, error } = await fetchAllSupabaseRows(query);
    if (error) throw new Error(`SupabaseAthleteRepository.findByArena: ${error.message}`);

    return ((data ?? []) as unknown as AthleteByArenaRow[]).map((a) => {
      const user = Array.isArray(a.users) ? a.users[0] : a.users;
      const firstSport = a.atleta_esportes?.[0]?.sport;
      const sport = Array.isArray(firstSport) ? firstSport[0]?.name : firstSport?.name;

      return {
        id: a.id,
        name: a.nome_perfil,
        cpf: a.cpf ?? '---',
        telefone: a.telefone ?? '---',
        email: user?.email ?? '---',
        sport: sport ?? 'N/A',
      };
    });
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
    const { error } = await this.client
      .from('arenas_atleta')
      .upsert(data, { onConflict: 'id_arena,id_atleta', ignoreDuplicates: true });
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
