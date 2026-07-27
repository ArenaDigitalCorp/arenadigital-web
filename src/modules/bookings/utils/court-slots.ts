import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/** Horário de um slot da grade (sempre com passo de 60 min). */
export interface SlotTime {
    hour: number
    minute: number
}

export interface CourtDayConfig {
    day: string
    enabled?: boolean
    startTime: string
    endTime: string
    /** Primeiro horário "quebrado" (ex.: 19:30) a partir do qual a grade desloca. */
    slotShiftTime?: string | null
    price?: number | null
    customPrices?: { start?: string | null; end?: string | null; price: number }[] | null
}

interface BookingLike {
    status?: string | null
    payment_expires_at?: string | null
}

export function parseHHMM(t: string): number {
    const [h, m] = (t || '00:00').split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
}

export function slotLabel(slot: SlotTime): string {
    return `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`
}

export function slotToMinutes(slot: SlotTime): number {
    return slot.hour * 60 + slot.minute
}

/** Nome do dia da semana como gravado em `courts.day_config` (ex.: "Segunda-feira"). */
export function dayConfigNameFor(date: Date): string {
    const name = format(date, 'EEEE', { locale: ptBR })
    return name.charAt(0).toUpperCase() + name.slice(1)
}

export function findDayConfig(
    date: Date,
    dayConfigs: CourtDayConfig[] | null | undefined
): CourtDayConfig | undefined {
    if (!dayConfigs || !Array.isArray(dayConfigs)) return undefined
    const target = dayConfigNameFor(date).toLowerCase()
    return dayConfigs.find((d) => d?.day?.toLowerCase() === target)
}

export function generateSlotsForDayConfig(cfg: CourtDayConfig | undefined | null): SlotTime[] {
    if (!cfg?.enabled) return []
    const startMins = parseHHMM(cfg.startTime)
    let endMins = parseHHMM(cfg.endTime)
    if (endMins <= startMins) endMins += 24 * 60

    // firstShiftMins: primeiro slot :30 — arredonda slotShiftTime para o :30 seguinte
    let firstShiftMins: number | null = null
    if (cfg.slotShiftTime) {
        const sm = parseHHMM(cfg.slotShiftTime)
        firstShiftMins = sm % 60 === 30 ? sm : sm + ((30 - (sm % 60)) % 60)
    }

    const slots: SlotTime[] = []
    let cur = startMins
    let shifted = false
    while (cur < endMins) {
        if (!shifted && firstShiftMins !== null && cur + 60 > firstShiftMins) {
            if (firstShiftMins > cur) cur = firstShiftMins
            shifted = true
        }
        slots.push({ hour: Math.floor(cur / 60) % 24, minute: cur % 60 })
        cur += 60
    }
    return slots
}

/** Sem `day_config` o espaço é tratado como aberto 24h. */
export function generateSlotsForDate(
    date: Date,
    dayConfigs: CourtDayConfig[] | null | undefined
): SlotTime[] {
    if (!dayConfigs || !Array.isArray(dayConfigs) || dayConfigs.length === 0) {
        return Array.from({ length: 24 }, (_, i) => ({ hour: i, minute: 0 }))
    }
    return generateSlotsForDayConfig(findDayConfig(date, dayConfigs))
}

/** O slot está dentro da janela de funcionamento do espaço nesse dia? */
export function isSlotWithinDayConfig(
    date: Date,
    dayConfigs: CourtDayConfig[] | null | undefined,
    slot: SlotTime
): boolean {
    if (!dayConfigs || !Array.isArray(dayConfigs) || dayConfigs.length === 0) return true

    const config = findDayConfig(date, dayConfigs)
    if (!config?.enabled) return false

    const slotMins = slotToMinutes(slot)
    const startMins = parseHHMM(config.startTime)
    let endMins = parseHHMM(config.endTime)
    if (endMins <= startMins) endMins += 24 * 60

    const normalizedSlot = slotMins < startMins ? slotMins + 24 * 60 : slotMins
    return normalizedSlot >= startMins && normalizedSlot < endMins
}

/**
 * Preço do slot: usa `customPrices` da configuração do dia, senão o preço do dia,
 * senão o preço padrão do espaço. Considera virada de madrugada (config do dia anterior).
 */
export function getSlotPrice(
    date: Date,
    dayConfigs: CourtDayConfig[] | null | undefined,
    slot: SlotTime,
    fallbackPrice: number | null | undefined
): number {
    const basePrice = Number(fallbackPrice ?? 0)
    if (!dayConfigs || !Array.isArray(dayConfigs) || dayConfigs.length === 0) return basePrice

    const config = findDayConfig(date, dayConfigs)
    if (!config?.enabled) return basePrice

    const slotMins = slotToMinutes(slot)
    const startMins = parseHHMM(config.startTime)
    let currentConfig = config

    // Slot de madrugada pertencente à janela iniciada no dia anterior
    if (startMins > parseHHMM(config.endTime) && slotMins < parseHHMM(config.endTime)) {
        const prevConfig = findDayConfig(addDays(date, -1), dayConfigs)
        if (prevConfig?.enabled) currentConfig = prevConfig
    }

    const custom = currentConfig.customPrices?.find((p) => {
        if (!p?.start || !p?.end) return false
        const pStart = parseHHMM(p.start)
        let pEnd = parseHHMM(p.end)
        if (pEnd <= pStart) pEnd += 24 * 60
        const normalizedSlot = slotMins < pStart ? slotMins + 24 * 60 : slotMins
        return normalizedSlot >= pStart && normalizedSlot < pEnd
    })

    return custom ? Number(custom.price) : Number(currentConfig.price ?? basePrice)
}

/** A reserva ocupa o horário na grade (pendências de Pix expiradas não ocupam). */
export function blocksAvailability(booking: BookingLike): boolean {
    if (booking.status === 'confirmed' || booking.status === 'reservado') return true
    if (booking.status !== 'pending_payment') return false
    if (!booking.payment_expires_at) return true
    return new Date(booking.payment_expires_at).getTime() > Date.now()
}
