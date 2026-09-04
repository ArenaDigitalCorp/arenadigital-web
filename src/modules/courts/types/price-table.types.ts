/**
 * Tabelas de preço por espaço. Espelha o modelo relacional de
 * `arenadigital-db` (`court_price_tables` → `court_price_table_days` →
 * `court_price_table_bands`).
 *
 * Fase 2: o web lê/escreve estas tabelas e usa `resolve_court_price` (via
 * `quoteCourtPriceAction`) só como SUGESTÃO — o valor efetivo continua editável
 * pelo gestor na reserva.
 */

export type CourtPriceTableKind = 'padrao' | 'mensalista' | 'professor' | 'custom'

/** Contexto sugerido para pré-selecionar a tabela no modal de reserva. */
export type PriceTableContext = 'avulso' | 'mensalista' | 'professor'

/** Faixa de exceção de um dia (equivale a um item de `day_config.customPrices`). */
export interface CourtPriceBand {
  id?: string
  /** "HH:MM" */
  start: string
  /** "HH:MM" */
  end: string
  price: number
}

/** Configuração de um dia da semana dentro de uma tabela de preço. */
export interface CourtPriceDay {
  id?: string
  /** 0 = domingo … 6 = sábado (igual a `Date.getDay()` / Postgres `DOW`). */
  diaSemana: number
  enabled: boolean
  /** "HH:MM" */
  startTime: string
  /** "HH:MM" — `<= startTime` cruza a meia-noite. */
  endTime: string
  /** "HH:MM" ou null. */
  slotShiftTime: string | null
  /** Valor padrão do dia; usado quando nenhuma faixa cobre o horário. */
  basePrice: number
  bands: CourtPriceBand[]
}

export interface CourtPriceTable {
  id?: string
  courtId: string
  arenaId: string
  nome: string
  tipo: CourtPriceTableKind
  /** A tabela usada na reserva avulsa e no app. Exatamente uma por espaço. */
  isDefault: boolean
  aplicaA: PriceTableContext[]
  ativo: boolean
  ordem: number
  days: CourtPriceDay[]
}

/** As 3 tabelas permanentes, na ordem de exibição. */
export const RESERVED_PRICE_TABLE_KINDS: CourtPriceTableKind[] = [
  'padrao',
  'mensalista',
  'professor',
]

export const MAX_PRICE_TABLES_PER_COURT = 5

export function isReservedPriceTableKind(tipo: string): boolean {
  return RESERVED_PRICE_TABLE_KINDS.includes(tipo as CourtPriceTableKind)
}

/** Rótulo de exibição por tipo (as 3 default podem ser renomeadas pelo gestor). */
export function defaultPriceTableName(tipo: CourtPriceTableKind): string {
  switch (tipo) {
    case 'padrao':
      return 'Padrão'
    case 'mensalista':
      return 'Mensalista'
    case 'professor':
      return 'Professor'
    default:
      return 'Nova tabela'
  }
}
