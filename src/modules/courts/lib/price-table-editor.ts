import type { DayConfig } from '@/modules/courts/components/DayScheduleConfig'
import type {
  CourtPriceDay,
  CourtPriceTable,
} from '@/modules/courts/types/price-table.types'

/** Índice 0=domingo … 6=sábado ↔ nome usado por `DayScheduleConfig`/`day_config`. */
export const DAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

/** Ordem de exibição no editor (segunda → domingo), como no `CourtForm`. */
export const EDITOR_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function emptyDay(diaSemana: number): CourtPriceDay {
  return {
    diaSemana,
    enabled: false,
    startTime: '06:00',
    endTime: '23:00',
    slotShiftTime: null,
    basePrice: 0,
    bands: [],
  }
}

/** Garante os 7 dias (segunda→domingo), preenchendo os ausentes desabilitados. */
export function toEditorDays(days: CourtPriceDay[] | undefined | null): CourtPriceDay[] {
  const byDow = new Map<number, CourtPriceDay>()
  for (const d of days ?? []) byDow.set(d.diaSemana, d)
  return EDITOR_DAY_ORDER.map((dow) => byDow.get(dow) ?? emptyDay(dow))
}

export function courtPriceDayToDayConfig(day: CourtPriceDay): DayConfig {
  return {
    day: DAY_NAMES[day.diaSemana],
    enabled: day.enabled,
    startTime: day.startTime,
    endTime: day.endTime,
    price: day.basePrice,
    slotShiftTime: day.slotShiftTime ?? null,
    customPrices: day.bands.map((b) => ({
      id: b.id,
      start: b.start,
      end: b.end,
      price: b.price,
    })),
  }
}

export function dayConfigToCourtPriceDay(diaSemana: number, config: DayConfig): CourtPriceDay {
  return {
    diaSemana,
    enabled: config.enabled,
    startTime: config.startTime,
    endTime: config.endTime,
    slotShiftTime: config.slotShiftTime ?? null,
    basePrice: Number(config.price) || 0,
    bands: (config.customPrices ?? []).map((cp) => ({
      start: cp.start,
      end: cp.end,
      price: Number(cp.price) || 0,
    })),
  }
}

// Tolerante a hora sem zero à esquerda ("9:00"), que o leitor legado aceita
// via parseHHMM — normaliza para HH:MM para não perder faixa na migração.
const HHMM = /^(\d{1,2}):([0-5]\d)$/

function asTime(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  const match = HHMM.exec(text)
  if (!match) return null
  const hours = Number(match[1])
  if (hours < 0 || hours > 23) return null
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}

function asMoney(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Constrói uma tabela "Padrão" só-cliente a partir de um `day_config` legado.
 * Descarta o que o leitor legado (`getSlotPrice`/`findDayConfig`) também
 * descarta — dia desabilitado, nome de dia desconhecido, horário fora de HH:MM
 * e faixa sem início/fim/preço válidos — para a grade e a tabela nunca
 * divergirem. Dia repetido: vence a primeira ocorrência (igual ao
 * `ON CONFLICT DO NOTHING` do backfill em SQL).
 */
export function priceTableFromLegacyDayConfig(
  courtId: string,
  arenaId: string,
  dayConfig: unknown,
): CourtPriceTable {
  const list = Array.isArray(dayConfig) ? (dayConfig as Record<string, unknown>[]) : []
  const days: CourtPriceDay[] = []
  const seen = new Set<number>()

  for (const el of list) {
    if (!el || el.enabled !== true) continue

    const dow = DAY_NAMES.findIndex(
      (n) => n.toLowerCase() === String(el.day ?? '').toLowerCase(),
    )
    if (dow < 0 || seen.has(dow)) continue

    const startTime = asTime(el.startTime)
    const endTime = asTime(el.endTime)
    if (!startTime || !endTime) continue

    const rawBands = Array.isArray(el.customPrices)
      ? (el.customPrices as Record<string, unknown>[])
      : []

    seen.add(dow)
    days.push({
      diaSemana: dow,
      enabled: true,
      startTime,
      endTime,
      slotShiftTime: asTime(el.slotShiftTime),
      basePrice: asMoney(el.price) ?? 0,
      bands: rawBands.flatMap((b) => {
        const start = asTime(b?.start)
        const end = asTime(b?.end)
        const price = asMoney(b?.price)
        if (!start || !end || price === null) return []
        return [{ start, end, price }]
      }),
    })
  }

  return {
    courtId,
    arenaId,
    nome: 'Padrão',
    tipo: 'padrao',
    isDefault: true,
    aplicaA: ['avulso'],
    ativo: true,
    ordem: 0,
    days,
  }
}

/** Copia horários/faixas/valores de uma tabela de origem para o editor. */
export function copyDaysFrom(source: CourtPriceTable): CourtPriceDay[] {
  return toEditorDays(source.days).map((d) => ({
    ...d,
    bands: d.bands.map((b) => ({ ...b, id: undefined })),
  }))
}

/** `day_config` legado (fonte da grade e do app) a partir dos dias do editor. */
export function dayConfigFromPriceDays(days: CourtPriceDay[]) {
  return days
    .filter((d) => d.enabled)
    .map((d) => ({
      day: DAY_NAMES[d.diaSemana],
      enabled: true,
      startTime: d.startTime,
      endTime: d.endTime,
      slotShiftTime: d.slotShiftTime ?? null,
      price: d.basePrice,
      customPrices: d.bands.map((b) => ({
        start: b.start,
        end: b.end,
        price: b.price,
      })),
    }))
}

/**
 * As 3 tabelas fixas em branco, para o cadastro de um espaço novo. A Padrão é
 * obrigatória; Mensalista e Professor podem ficar vazias e ser preenchidas
 * depois (ou copiadas da Padrão em um clique).
 */
export function draftPriceTables(arenaId: string): CourtPriceTable[] {
  const make = (
    tipo: CourtPriceTable['tipo'],
    nome: string,
    isDefault: boolean,
    aplicaA: CourtPriceTable['aplicaA'],
    ordem: number,
  ): CourtPriceTable => ({
    courtId: '',
    arenaId,
    nome,
    tipo,
    isDefault,
    aplicaA,
    ativo: true,
    ordem,
    days: [],
  })

  return [
    make('padrao', 'Padrão', true, ['avulso'], 0),
    make('mensalista', 'Mensalista', false, ['mensalista'], 1),
    make('professor', 'Professor', false, ['professor'], 2),
  ]
}
