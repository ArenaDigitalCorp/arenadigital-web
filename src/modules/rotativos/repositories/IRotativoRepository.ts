import type { Rotativo, RotativoInscricao, CreateRotativoDTO, MonthCalendarEntry } from '../types/rotativo.types';

export interface IRotativoRepository {
  create(data: CreateRotativoDTO): Promise<Rotativo>;
  findByDate(arenaId: string, date: string): Promise<Rotativo[]>;
  findByMonth(arenaId: string, startDate: string, endDate: string): Promise<Record<string, MonthCalendarEntry>>;
  getInscritos(rotativoId: string): Promise<RotativoInscricao[]>;
  registerAthlete(rotativoId: string, athleteId: string, valuePaid: number): Promise<RotativoInscricao>;
}
