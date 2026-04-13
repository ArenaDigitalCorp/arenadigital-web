import type { Atleta, AtletaListItem, CreateAtletaDTO, CreateArenaAtletaDTO, CreateAtletaEsporteDTO } from '../types/athlete.types';

export interface IAthleteRepository {
  findByArena(arenaId: string, searchTerm?: string): Promise<AtletaListItem[]>;
  create(data: CreateAtletaDTO): Promise<Atleta>;
  linkToArena(data: CreateArenaAtletaDTO): Promise<void>;
  addSport(data: CreateAtletaEsporteDTO): Promise<void>;
  getSports(): Promise<{ id: string; name: string }[]>;
}
