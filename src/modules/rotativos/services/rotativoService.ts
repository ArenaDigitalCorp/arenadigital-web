import { supabase } from '@/shared/database/supabaseClient';
import { SupabaseRotativoRepository } from '../repositories/SupabaseRotativoRepository';

export type { Rotativo, RotativoInscricao, CreateRotativoDTO, MonthCalendarEntry } from '../types/rotativo.types';

const repo = new SupabaseRotativoRepository(supabase);

export class RotativoService {
  static createRotativo(input: Parameters<typeof repo.create>[0]) {
    return repo.create(input);
  }

  static getRotativosByDate(arenaId: string, date: string) {
    return repo.findByDate(arenaId, date);
  }

  static getRotativosByMonth(arenaId: string, startDate: string, endDate: string) {
    return repo.findByMonth(arenaId, startDate, endDate);
  }

  static getRotativoInscritos(rotativoId: string) {
    return repo.getInscritos(rotativoId);
  }

  static registerAthlete(rotativoId: string, athleteId: string, valuePaid: number) {
    return repo.registerAthlete(rotativoId, athleteId, valuePaid);
  }
}
