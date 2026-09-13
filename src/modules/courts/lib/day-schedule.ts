/**
 * Matemática do editor de horários de um dia: faixas encadeadas, slots e
 * conversão de/para o `DayConfig` persistido.
 *
 * Extraído de `components/DayScheduleConfig.tsx` sem alteração de comportamento
 * quando a UI passou a ser card + painel — é a parte delicada (funcionamento que
 * cruza a meia-noite, contiguidade das faixas, faixa padrão estável entre
 * releituras) e agora é testável sem renderizar componente.
 *
 * Toda a aritmética usa "minutos de operação": horários anteriores ao início do
 * funcionamento pertencem ao dia seguinte.
 */

export interface CustomPrice {
    id?: string
    start: string
    end: string
    price: number
}

export interface DayConfig {
    day: string
    enabled: boolean
    startTime: string
    endTime: string
    price: number
    customPrices: CustomPrice[]
    /** ID da faixa que usa o valor padrão (`config.price`). */
    defaultTierId?: string
    slotShiftTime?: string | null
}

export interface PriceTier {
    id: string
    start: string
    end: string
    price: number
    isDefault: boolean
}

export function createBandId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `band-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function parseHHMM(t: string): number {
    const [h, m] = (t || "00:00").split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
}

export function minsToHHMM(mins: number): string {
    const normalized = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
    const h = Math.floor(normalized / 60)
    const m = normalized % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function getOperatingEndMins(config: DayConfig): number {
    const startMins = parseHHMM(config.startTime)
    let endMins = parseHHMM(config.endTime)
    if (endMins <= startMins) endMins += 24 * 60
    return endMins
}

/** Converte um horário para "minutos de operação". */
export function toOpMins(time: string, startMins: number): number {
    const mins = parseHHMM(time)
    return mins < startMins ? mins + 24 * 60 : mins
}

/** O funcionamento vira a meia-noite (fecha no dia seguinte). */
export function isOvernight(config: DayConfig): boolean {
    return (
        !!config.startTime && !!config.endTime &&
        parseHHMM(config.endTime) < parseHHMM(config.startTime)
    )
}

/** Primeiro slot deslocado para o :30, alinhado à meia hora. */
export function firstShiftedSlotMins(slotShiftTime: string): number {
    const sm = parseHHMM(slotShiftTime)
    return sm % 60 === 30 ? sm : sm + (30 - sm % 60) % 60
}

export function countSlots(config: DayConfig): number {
    if (!config.enabled || !config.startTime || !config.endTime) return 0
    const startMins = parseHHMM(config.startTime)
    let endMins = parseHHMM(config.endTime)
    if (endMins <= startMins) endMins += 24 * 60

    let firstShiftMins: number | null = null
    if (config.slotShiftTime) {
        firstShiftMins = firstShiftedSlotMins(config.slotShiftTime)
    }

    let count = 0
    let cur = startMins
    let shifted = false
    while (cur < endMins) {
        if (!shifted && firstShiftMins !== null && cur + 60 > firstShiftMins) {
            if (firstShiftMins > cur) cur = firstShiftMins
            shifted = true
        }
        count++
        cur += 60
    }
    return count
}

/** Exemplo dos dois primeiros slots deslocados, para o gestor conferir. */
export function slotShiftExample(slotShiftTime: string | null | undefined): string | null {
    if (!slotShiftTime) return null
    const first = firstShiftedSlotMins(slotShiftTime)
    const a = minsToHHMM(first), b = minsToHHMM(first + 60), c = minsToHHMM(first + 120)
    return `ex: ${a}–${b}, ${b}–${c}…`
}

/** ID único e determinístico para um segmento de faixa padrão (preenche lacunas). */
export function gapTierId(start: string): string {
    return `default-${minsToHHMM(parseHHMM(start))}`
}

/** Converte config salva → faixas encadeadas para edição (sempre contíguas).
 *  Cada faixa recebe um id único; uma só é a padrão. */
export function tiersFromConfig(config: DayConfig): PriceTier[] {
    const startMins = parseHHMM(config.startTime)
    const endMins = getOperatingEndMins(config)

    const customs = config.customPrices
        .map((cp) => ({
            ...cp,
            opStart: toOpMins(cp.start, startMins),
            opEnd: toOpMins(cp.end, startMins),
        }))
        // Descarta faixas inválidas ou fora do funcionamento (dados legados/corrompidos)
        .filter((cp) => cp.opEnd > cp.opStart && cp.opStart < endMins)
        .sort((a, b) => a.opStart - b.opStart)

    const raw: Omit<PriceTier, 'isDefault'>[] = []
    let cursor = startMins

    for (const cp of customs) {
        // Sobreposição com o trecho já consumido → descarta (garante contiguidade)
        if (cp.opStart < cursor) continue

        const opEnd = Math.min(cp.opEnd, endMins)

        if (cp.opStart > cursor) {
            raw.push({
                id: gapTierId(minsToHHMM(cursor)),
                start: minsToHHMM(cursor),
                end: minsToHHMM(cp.opStart),
                price: config.price || 0,
            })
        }

        raw.push({
            id: cp.id ?? `legacy-${cp.start}`,
            start: minsToHHMM(cp.opStart),
            end: minsToHHMM(opEnd),
            price: cp.price,
        })

        cursor = opEnd
        if (cursor >= endMins) break
    }

    if (cursor < endMins) {
        raw.push({
            id: gapTierId(minsToHHMM(cursor)),
            start: minsToHHMM(cursor),
            end: config.endTime,
            price: config.price || 0,
        })
    }

    if (raw.length === 0) {
        raw.push({
            id: gapTierId(config.startTime),
            start: config.startTime,
            end: config.endTime,
            price: config.price || 0,
        })
    }

    // A faixa padrão é a lacuna (default-*) que corresponde ao id salvo;
    // se nenhuma corresponder (dados legados/corrompidos), usa a primeira lacuna;
    // se não houver lacuna, usa a primeira faixa.
    const gapIds = raw.filter((t) => t.id.startsWith('default-')).map((t) => t.id)
    const chosenDefaultId =
        gapIds.find((id) => id === config.defaultTierId) ??
        gapIds[0] ??
        raw[0]?.id

    return raw.map((tier) => ({ ...tier, isDefault: tier.id === chosenDefaultId }))
}

/** Converte faixas encadeadas → config para salvar. */
export function configFromTiers(config: DayConfig, tiers: PriceTier[]): DayConfig {
    const defaultTier = tiers.find((t) => t.isDefault) ?? tiers[0]

    if (!defaultTier) {
        return { ...config, price: 0, customPrices: [], defaultTierId: undefined }
    }

    const customTiers = tiers.filter((t) => !t.isDefault)

    return {
        ...config,
        price: defaultTier.price,
        // A faixa padrão vira a lacuna implícita; guarda o id no formato de gap
        // (baseado no início) para reencontrá-la de forma estável após a releitura.
        defaultTierId: gapTierId(defaultTier.start),
        customPrices: customTiers.map((tier) => ({
            // Faixas customizadas nunca guardam id no formato de gap (default-*),
            // para não interferir na seleção da faixa padrão na releitura.
            // O id derivado do início é estável entre commits — evita remontar a
            // linha (e perder o foco do input) a cada tecla digitada.
            id: tier.id.startsWith('default-') ? `band-${tier.start}` : tier.id,
            start: tier.start,
            end: tier.end,
            price: tier.price,
        })),
    }
}

export function normalizeTime(value: string): string | null {
    if (!value) return null
    const match = value.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return null
    const h = Number(match[1])
    const m = Number(match[2])
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    return minsToHHMM(h * 60 + m)
}

export function normalizeTiers(tiers: PriceTier[], config: DayConfig): PriceTier[] {
    const startMins = parseHHMM(config.startTime)
    const endMins = getOperatingEndMins(config)

    const fallback: PriceTier = {
        id: gapTierId(config.startTime),
        start: config.startTime,
        end: config.endTime,
        price: config.price || 0,
        isDefault: true,
    }

    if (tiers.length === 0) return [fallback]

    // Reconstrói a cadeia contígua em "minutos de operação" (suporta overnight):
    // cada faixa começa onde a anterior terminou; fins inválidos são corrigidos.
    const result: PriceTier[] = []
    let cursor = startMins

    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i]
        const isLast = i === tiers.length - 1

        const tierStart = cursor
        let tierEnd = isLast ? endMins : Math.min(toOpMins(tier.end, startMins), endMins)
        if (tierEnd <= tierStart) tierEnd = Math.min(tierStart + 60, endMins)
        if (isLast) tierEnd = endMins
        if (tierEnd <= tierStart) continue // largura zero → descarta

        result.push({
            ...tier,
            start: minsToHHMM(tierStart),
            end: minsToHHMM(tierEnd),
        })

        cursor = tierEnd
        if (cursor >= endMins) break
    }

    if (result.length === 0) return [fallback]

    result[0].start = config.startTime
    result[result.length - 1].end = config.endTime

    return result
}

export function suggestSplitPoint(tier: PriceTier): string | null {
    const startMins = parseHHMM(tier.start)
    let endMins = parseHHMM(tier.end)
    if (endMins <= startMins) endMins += 24 * 60
    if (endMins - startMins < 120) return null
    const split = startMins + Math.floor((endMins - startMins) / 2 / 60) * 60
    return minsToHHMM(split)
}

/** Índice da maior faixa que ainda comporta divisão (≥ 2h). -1 = nenhuma. */
export function splittableTierIndex(tiers: PriceTier[], config: DayConfig): number {
    const startMins = parseHHMM(config.startTime)
    let best = -1
    let bestLen = 0
    tiers.forEach((tier, index) => {
        if (suggestSplitPoint(tier) === null) return
        const len = toOpMins(tier.end, startMins) - toOpMins(tier.start, startMins)
        if (len > bestLen) {
            bestLen = len
            best = index
        }
    })
    return best
}

export interface DaySummary {
    slots: number
    tierCount: number
    minPrice: number
    maxPrice: number
    overnight: boolean
    /** Faixas com a fração da jornada que cada uma ocupa (soma 1). */
    segments: { id: string; share: number; price: number; start: string; end: string }[]
}

/** Resumo exibido no card do dia, sem abrir o painel. */
export function summarizeDay(config: DayConfig): DaySummary {
    const tiers = tiersFromConfig(config)
    const startMins = parseHHMM(config.startTime)
    const total = getOperatingEndMins(config) - startMins
    const prices = tiers.map((t) => t.price)

    return {
        slots: countSlots(config),
        tierCount: tiers.length,
        minPrice: prices.length ? Math.min(...prices) : 0,
        maxPrice: prices.length ? Math.max(...prices) : 0,
        overnight: isOvernight(config),
        segments: tiers.map((t) => {
            const s = toOpMins(t.start, startMins)
            const e = Math.max(toOpMins(t.end, startMins), s + 1)
            return {
                id: t.id,
                share: total > 0 ? (e - s) / total : 1 / tiers.length,
                price: t.price,
                start: t.start,
                end: t.end,
            }
        }),
    }
}
