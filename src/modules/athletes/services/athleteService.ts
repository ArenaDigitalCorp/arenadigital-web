import { supabase } from '@/shared/database/supabaseClient';
import { SupabaseAthleteRepository } from '../repositories/SupabaseAthleteRepository';

export type { Atleta, AtletaListItem, CreateAtletaDTO as AtletaInput, CreateArenaAtletaDTO as ArenaAtletaInput, CreateAtletaEsporteDTO as AtletaEsporteInput } from '../types/athlete.types';

const repo = new SupabaseAthleteRepository(supabase);

export class AthleteService {
  static createAtleta(input: Parameters<typeof repo.create>[0]) {
    return repo.create(input);
  }

  static linkToArena(input: Parameters<typeof repo.linkToArena>[0]) {
    return repo.linkToArena(input);
  }

  static addSport(input: Parameters<typeof repo.addSport>[0]) {
    return repo.addSport(input);
  }

  static getAthletesByArena(arenaId: string, searchTerm?: string) {
    return repo.findByArena(arenaId, searchTerm);
  }

  static getSports() {
    return repo.getSports();
  }
}
