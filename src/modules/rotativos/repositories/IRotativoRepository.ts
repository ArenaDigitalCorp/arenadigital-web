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

export interface IRotativoRepository {
  create(data: CreateRotativoDTO, courtIds: string[]): Promise<Rotativo>;
  update(arenaId: string, rotativoId: string, data: Partial<CreateRotativoDTO>, courtIds: string[]): Promise<Rotativo>;
  setStatus(arenaId: string, rotativoId: string, status: 'ativo' | 'desativado'): Promise<void>;
  findById(arenaId: string, rotativoId: string): Promise<Rotativo | null>;
  findByDate(arenaId: string, date: string): Promise<Rotativo[]>;
  list(arenaId: string, filters?: RotativoListFilters): Promise<{ rows: Rotativo[]; total: number }>;
  findByMonth(arenaId: string, startDate: string, endDate: string): Promise<Record<string, MonthCalendarEntry>>;
  getInscritos(arenaId: string, rotativoId: string): Promise<RotativoInscricao[]>;
  enrollAthleteAtomic(input: {
    arenaId: string;
    rotativoId: string;
    athleteId: string;
    paymentType: 'credito' | 'avulso';
    paymentMethodId: string | null;
    observation: string | null;
    registeredBy: string;
  }): Promise<AtomicRotativoEnrollmentResult>;
  getCourts(arenaId: string): Promise<CourtOption[]>;
  getPacotes(arenaId: string): Promise<RotativoPacote[]>;
  quoteCreditPurchaseValue(arenaId: string, quantity: number): Promise<number>;
  savePacotes(arenaId: string, pacotes: { quantidade: number; valor_reais: number }[]): Promise<RotativoPacote[]>;
  purchaseCreditsAtomic(input: {
    operationId: string;
    arenaId: string;
    athleteId: string;
    quantity: number;
    validityDays: number;
    paymentMethodId: string;
    registeredBy: string;
  }): Promise<AtomicRotativoCreditPurchaseResult>;
  getCreditMovements(arenaId: string, filters?: { search?: string; page?: number; pageSize?: number }): Promise<{ rows: RotativoCreditoMovimento[]; total: number }>;
  getTopAthletesByCredit(arenaId: string, limit?: number): Promise<RotativoCreditoSaldo[]>;
  getAthleteCreditBalance(arenaId: string, athleteId: string): Promise<number>;
  processExpiredCredits(arenaId: string): Promise<number>;
}
