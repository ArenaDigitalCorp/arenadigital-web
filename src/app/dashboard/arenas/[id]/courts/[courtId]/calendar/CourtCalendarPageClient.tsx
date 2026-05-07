"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { format, addDays, subDays, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO, startOfDay, getHours, getMinutes, getDay, addMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeft, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { BookingModal } from "@/modules/bookings/components/BookingModal"
import { BookingDetailsModal } from "@/modules/bookings/components/BookingDetailsModal"
import { DayOpportunitiesModal } from "@/modules/bookings/components/DayOpportunitiesModal"
import { getBookingsByCourtAction } from "@/modules/bookings/actions/bookingActions"
import type { Json } from '@/types/supabase.types'
import { arenaDashboardPath } from "@/lib/arena-dashboard-navigation"

interface Court {
    id: string
    name: string
    day_config: Json | null
    booking_type: string | null
    price: number | null
    sports: { id: string; name: string }[]
}

interface Booking {
    id: string
    athlete_name: string | null
    start_time: string
    end_time: string
    status: string | null
    booking_type?: string | null
    plano_mensalista_id?: string | null
    price?: number | null
    sports?: { id: string; name: string }
    atleta?: { id: string; nome_perfil: string; telefone: string } | null
}

interface Props {
    arenaId: string
    courtId: string
    initialCourt: Court
    initialBookings: Booking[]
    initialDate: string
}

interface SlotTime { hour: number; minute: number }

function parseHHMM(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
}

function generateSlotsForDayConfig(cfg: any): SlotTime[] {
    if (!cfg?.enabled) return []
    const startMins = parseHHMM(cfg.startTime)
    let endMins = parseHHMM(cfg.endTime)
    if (endMins <= startMins) endMins += 24 * 60

    // firstShiftMins: the first :30 slot — round slotShiftTime up to nearest :30
    let firstShiftMins: number | null = null
    if (cfg.slotShiftTime) {
        const sm = parseHHMM(cfg.slotShiftTime)
        firstShiftMins = sm % 60 === 30 ? sm : sm + (30 - sm % 60) % 60
    }

    const slots: SlotTime[] = []
    let cur = startMins
    let shifted = false

    while (cur < endMins) {
        // If the next :00 step would exceed the first :30 slot, jump to it
        if (!shifted && firstShiftMins !== null && cur + 60 > firstShiftMins) {
            if (firstShiftMins > cur) cur = firstShiftMins
            shifted = true
        }
        slots.push({ hour: Math.floor(cur / 60) % 24, minute: cur % 60 })
        cur += 60
    }
    return slots
}

function generateSlotsForDate(date: Date, dayConfigs: any[] | null): SlotTime[] {
    if (!dayConfigs) return Array.from({ length: 24 }, (_, i) => ({ hour: i, minute: 0 }))
    const name = format(date, 'EEEE', { locale: ptBR })
    const formatted = name.charAt(0).toUpperCase() + name.slice(1)
    const cfg = dayConfigs.find((d: any) => d.day.toLowerCase() === formatted.toLowerCase())
    if (!cfg?.enabled) return []
    return generateSlotsForDayConfig(cfg)
}

const getSportStyles = (sportName: string) => {
    const n = sportName.toLowerCase()
    if (n.includes('beach tennis')) return { bg: 'bg-[#FFF7ED]', border: 'border-[#FB923C]', text: 'text-[#C2410C]', textSecondary: 'text-[#C2410C]/60' }
    if (n.includes('futev')) return { bg: 'bg-[#EFF6FF]', border: 'border-[#60A5FA]', text: 'text-[#1D4ED8]', textSecondary: 'text-[#1D4ED8]/60' }
    if (n.includes('vôlei') || n.includes('volei')) return { bg: 'bg-[#FEFCE8]', border: 'border-[#FACC15]', text: 'text-[#A16207]', textSecondary: 'text-[#A16207]/60' }
    if (n.includes('tênis') || n.includes('tenis')) return { bg: 'bg-[#F0FDF4]', border: 'border-[#4ADE80]', text: 'text-[#15803D]', textSecondary: 'text-[#15803D]/60' }
    if (n.includes('padel')) return { bg: 'bg-[#FAF5FF]', border: 'border-[#C084FC]', text: 'text-[#7E22CE]', textSecondary: 'text-[#7E22CE]/60' }
    return { bg: 'bg-[#F1F5F9]', border: 'border-[#94A3B8]', text: 'text-[#334155]', textSecondary: 'text-[#334155]/60' }
}

function SingleBookingCard({ booking, court, slot, isEnd, onClick }: {
    booking: Booking; court: Court; slot: SlotTime; isEnd: boolean; onClick?: () => void
}) {
    const bStart = parseISO(booking.start_time)
    const isStart = slot.hour === getHours(bStart) && slot.minute === getMinutes(bStart)
    const isReservado = booking.status === 'reservado'
    const sportStyles = getSportStyles(booking.sports?.name || court.sports?.[0]?.name || '')
    const reservadoStyles = {
        bg: 'bg-amber-50',
        border: 'border-amber-400 border-dashed',
        text: 'text-amber-800',
        textSecondary: 'text-amber-600',
    }
    const styles = isReservado ? reservadoStyles : sportStyles
    return (
        <div
            className={cn(
                "flex-1 h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:brightness-95 transition-all border-l-4",
                styles.bg, styles.border,
                isStart ? "rounded-t pt-2 border-t" : "border-t-transparent",
                isEnd ? "rounded-b pb-2 border-b" : "border-b-transparent",
                !isStart && !isEnd && "border-y-transparent"
            )}
            onClick={onClick}
        >
            {isStart && (
                <>
                    <span className={cn("text-[9px] font-black uppercase tracking-wider leading-none", styles.textSecondary)}>
                        {isReservado ? 'Ag. Confirmação' : 'Confirmado'}
                    </span>
                    <span className={cn("text-[11px] font-bold text-center line-clamp-1 px-1", styles.text)}>
                        {booking.athlete_name} {!isReservado && booking.price !== undefined && `| R$ ${booking.price}`}
                    </span>
                    <span className={cn("text-[9px] font-bold leading-none", styles.textSecondary)}>{booking.sports?.name || court.sports?.[0]?.name || 'Esporte'}</span>
                </>
            )}
        </div>
    )
}

function TimeSlot({ slot, bookings: slotBookings, available, court, className, onBookingClick, onEmptyClick, futureBooking }: {
    slot: SlotTime; bookings: Booking[]; available: boolean; court: Court; className?: string
    onBookingClick?: (b: Booking) => void; onEmptyClick?: () => void
    futureBooking?: Booking | null
}) {
    if (!available) {
        return <div className={cn("bg-[#E2E8F0] flex items-center justify-center p-2 opacity-40", className)} />
    }
    if (slotBookings.length > 0) {
        const firstBooking = slotBookings[0]
        const bEnd = parseISO(firstBooking.end_time)
        const endMins = getHours(bEnd) * 60 + getMinutes(bEnd)
        const slotEndMins = slot.hour * 60 + slot.minute + 60
        const isEnd = slotEndMins >= endMins
        const hasConflict = slotBookings.length > 1
        const bStart = parseISO(firstBooking.start_time)
        const isConflictStart = slot.hour === getHours(bStart) && slot.minute === getMinutes(bStart)
        return (
            <div className={cn("px-1 h-full relative", className)}>
                {hasConflict && isConflictStart && (
                    <div className="absolute top-0 left-0 right-0 flex justify-center z-10 pointer-events-none">
                        <span className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-b-md tracking-wider shadow">
                            ⚠ Conflito
                        </span>
                    </div>
                )}
                <div className="w-full h-full flex gap-0.5">
                    {slotBookings.map((b) => (
                        <SingleBookingCard
                            key={b.id}
                            booking={b}
                            court={court}
                            slot={slot}
                            isEnd={isEnd}
                            onClick={() => onBookingClick?.(b)}
                        />
                    ))}
                </div>
            </div>
        )
    }
    // Slot vazio
    const futureStart = futureBooking ? parseISO(futureBooking.start_time) : null
    const futureEnd = futureBooking ? parseISO(futureBooking.end_time) : null
    return (
        <div
            className={cn("p-1 group relative", className)}
            onClick={onEmptyClick}
        >
            <div className="w-full h-full min-h-[40px] flex items-center justify-center rounded hover:bg-emerald-50 cursor-pointer transition-colors group-hover:border-emerald-200 border border-transparent">
                <span className="text-xs font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">Disponível</span>
            </div>
            {futureBooking && futureStart && futureEnd && (
                <TooltipProvider delayDuration={200}>
                    <Tooltip>
                        <TooltipTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute top-1.5 right-1.5 cursor-default z-10">
                                {/* Ponto pulse — visível por padrão */}
                                <div
                                    className="h-2 w-2 rounded-full bg-indigo-300 animate-pulse group-hover:scale-110 transition-transform"
                                    style={{ boxShadow: '0 0 0 3px rgba(129,140,248,0.15)' }}
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent
                            side="right"
                            sideOffset={8}
                            className="bg-[#1E293B] border-none text-white rounded-xl px-3.5 py-2.5 shadow-xl max-w-[200px]"
                        >
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-wider text-indigo-300">
                                    Próximo evento
                                </p>
                                <p className="text-[12px] font-bold leading-tight">
                                    {futureBooking.athlete_name ?? 'Atleta'}
                                </p>
                                <p className="text-[10px] text-white/70 font-medium">
                                    {format(futureStart, "EEE, dd/MM", { locale: ptBR })} &middot; {format(futureStart, "HH:mm")}–{format(futureEnd, "HH:mm")}
                                </p>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    )
}

export function CourtCalendarPageClient({ arenaId, courtId, initialCourt, initialBookings, initialDate }: Props) {
    const court = initialCourt
    const [bookings, setBookings] = useState<Booking[]>(initialBookings as Booking[])
    const [futureBookings, setFutureBookings] = useState<Booking[]>([])
    const [currentDate, setCurrentDate] = useState(new Date(initialDate))
    const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
    const [selectedSlotDate, setSelectedSlotDate] = useState<Date>(new Date(initialDate))
    const [selectedSlotHour, setSelectedSlotHour] = useState(0)
    const [selectedSlotMinute, setSelectedSlotMinute] = useState(0)
    const [customPrice, setCustomPrice] = useState(0)
    const [isBookingDetailsModalOpen, setIsBookingDetailsModalOpen] = useState(false)
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
    const [isDayOpportunitiesModalOpen, setIsDayOpportunitiesModalOpen] = useState(false)

    const loadBookings = useCallback(async (date: Date, mode: 'day' | 'week') => {
        let startStr: string, endStr: string
        if (mode === 'day') {
            startStr = startOfDay(date).toISOString()
            const end = new Date(date)
            end.setHours(23, 59, 59, 999)
            endStr = end.toISOString()
        } else {
            startStr = startOfWeek(date, { weekStartsOn: 1 }).toISOString()
            endStr = endOfWeek(date, { weekStartsOn: 1 }).toISOString()
        }
        const res = await getBookingsByCourtAction(arenaId, courtId, startStr, endStr)
        if (res.success) setBookings(res.data as Booking[])
        else toast.error("Erro ao carregar agenda.")
    }, [arenaId, courtId])

    // Carrega reservas futuras (próximos 60 dias) para indicador de eventos futuros
    useEffect(() => {
        const loadFutureBookings = async () => {
            const start = addDays(new Date(), 1)
            const end = addMonths(new Date(), 2)
            const res = await getBookingsByCourtAction(arenaId, courtId, start.toISOString(), end.toISOString())
            if (res.success && res.data) {
                setFutureBookings((res.data as Booking[]).filter(b => b.status !== 'cancelled'))
            }
        }
        loadFutureBookings()
    }, [arenaId, courtId])

    const handlePrevious = () => {
        const next = viewMode === 'day' ? subDays(currentDate, 1) : subWeeks(currentDate, 1)
        setCurrentDate(next)
        loadBookings(next, viewMode)
    }

    const handleNext = () => {
        const next = viewMode === 'day' ? addDays(currentDate, 1) : addWeeks(currentDate, 1)
        setCurrentDate(next)
        loadBookings(next, viewMode)
    }

    const handleToday = () => {
        const today = new Date()
        setCurrentDate(today)
        loadBookings(today, viewMode)
    }

    const handleViewMode = (mode: 'day' | 'week') => {
        setViewMode(mode)
        loadBookings(currentDate, mode)
    }

    const getBookingsForSlot = (date: Date, slot: SlotTime) => {
        const slotStart = new Date(date)
        slotStart.setHours(slot.hour, slot.minute, 0, 0)
        return bookings.filter(b => {
            if (b.status === 'cancelled') return false
            const bookingStart = parseISO(b.start_time)
            const bookingEnd = parseISO(b.end_time)
            return slotStart >= bookingStart && slotStart < bookingEnd
        })
    }

    const getFutureBookingForSlot = (date: Date, slot: SlotTime): Booking | null => {
        const targetDayOfWeek = getDay(date)
        return futureBookings.find(b => {
            const bStart = parseISO(b.start_time)
            return getDay(bStart) === targetDayOfWeek
                && getHours(bStart) === slot.hour
                && getMinutes(bStart) === slot.minute
                && bStart > date
        }) ?? null
    }

    const getSlotPrice = (date: Date, slot: SlotTime) => {
        if (!court.day_config) return court.price || 0
        const dayName = format(date, 'EEEE', { locale: ptBR })
        const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1)
        const config = (court.day_config as any[]).find((d: any) => d.day.toLowerCase() === formattedDayName.toLowerCase())
        if (!config || !config.enabled) return court.price || 0

        const slotMins = slot.hour * 60 + slot.minute
        const startMins = parseHHMM(config.startTime)
        let endMins = parseHHMM(config.endTime)
        if (endMins <= startMins) endMins += 24 * 60
        let currentConfig = config

        if (startMins > parseHHMM(config.endTime) && slotMins < parseHHMM(config.endTime)) {
            const prevDate = addDays(date, -1)
            const prevDayName = format(prevDate, 'EEEE', { locale: ptBR })
            const prevConfig = (court.day_config as any[]).find((d: any) =>
                d.day.toLowerCase() === (prevDayName.charAt(0).toUpperCase() + prevDayName.slice(1)).toLowerCase()
            )
            if (prevConfig?.enabled) currentConfig = prevConfig
        }

        const customPrice = currentConfig.customPrices?.find((p: any) => {
            if (!p.start || !p.end) return false
            const pStart = parseHHMM(p.start)
            let pEnd = parseHHMM(p.end)
            if (pEnd <= pStart) pEnd += 24 * 60
            const normalizedSlot = slotMins < pStart ? slotMins + 24 * 60 : slotMins
            return normalizedSlot >= pStart && normalizedSlot < pEnd
        })

        return customPrice ? customPrice.price : (currentConfig.price || court.price || 0)
    }

    const handleSlotClick = (date: Date, slot: SlotTime) => {
        const slotBookings = getBookingsForSlot(date, slot)
        if (slotBookings.length > 0) {
            setSelectedBooking(slotBookings[0])
            setIsBookingDetailsModalOpen(true)
            return
        }
        setSelectedSlotDate(date)
        setSelectedSlotHour(slot.hour)
        setSelectedSlotMinute(slot.minute)
        setCustomPrice(getSlotPrice(date, slot))
        setIsBookingModalOpen(true)
    }

    const hasBookingInSlot = (slot: SlotTime) => {
        if (viewMode === 'day') return getBookingsForSlot(currentDate, slot).length > 0
        return weekDays.some(day => getBookingsForSlot(day, slot).length > 0)
    }

    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i))

    const slotsDay = generateSlotsForDate(currentDate, court.day_config as any[] | null)
    const slotsWeek = (() => {
        const map = new Map<string, SlotTime>()
        weekDays.forEach(d =>
            generateSlotsForDate(d, court.day_config as any[] | null).forEach(s => {
                map.set(`${s.hour}:${s.minute}`, s)
            })
        )
        return Array.from(map.values()).sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute))
    })()
    const slots = viewMode === 'day' ? slotsDay : slotsWeek

    return (
        <div className="mx-auto flex h-[calc(100dvh-8.5rem)] min-h-0 w-full max-w-[1600px] flex-col gap-2 overflow-hidden md:h-[calc(100dvh-4.5rem)]">
            <div className="shrink-0">
                <Button
                    variant="ghost"
                    asChild
                    className="h-auto w-fit justify-start gap-1.5 rounded-md px-0 py-0 text-sm font-medium text-arena-navy-800/70 hover:bg-transparent hover:text-arena-navy-800"
                >
                    <Link href={arenaDashboardPath(arenaId, "espacos")} className="inline-flex items-center gap-1.5">
                        <ArrowLeft className="size-4 shrink-0 text-arena-navy-800" aria-hidden />
                        Voltar
                    </Link>
                </Button>
            </div>

            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                <div className="flex shrink-0 flex-col gap-4 border-b border-border px-4 py-4 md:flex-row md:items-start md:justify-between md:gap-6 md:px-5 md:py-4">
                    <h1 className="font-heading text-2xl font-black tracking-tight text-arena-navy-800 md:text-3xl">
                        {court.name}
                    </h1>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                        <div className="inline-flex w-fit items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-1">
                            <button
                                type="button"
                                onClick={() => handleViewMode("day")}
                                className={cn(
                                    "h-8 rounded-md px-3 text-xs font-bold transition-colors",
                                    viewMode === "day"
                                        ? "border border-border bg-white text-arena-navy-800 shadow-sm"
                                        : "bg-transparent text-arena-navy-800/60 hover:text-arena-navy-800"
                                )}
                            >
                                Dia
                            </button>
                            <button
                                type="button"
                                onClick={() => handleViewMode("week")}
                                className={cn(
                                    "h-8 rounded-md px-3 text-xs font-bold transition-colors",
                                    viewMode === "week"
                                        ? "border border-border bg-white text-arena-navy-800 shadow-sm"
                                        : "bg-transparent text-arena-navy-800/60 hover:text-arena-navy-800"
                                )}
                            >
                                Semana
                            </button>
                        </div>

                        <div className="inline-flex items-center rounded-lg border border-border bg-white">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handlePrevious}
                                className="h-9 w-9 shrink-0 rounded-none border-r border-border"
                                aria-label="Período anterior"
                            >
                                <ChevronLeft className="size-4" />
                            </Button>
                            <div className="min-w-34 px-3 text-center text-sm font-bold text-arena-navy-800 sm:min-w-40 sm:px-4">
                                {viewMode === "day"
                                    ? format(currentDate, "dd 'de' MMMM", { locale: ptBR })
                                    : `${format(weekDays[0], "dd/MM")} – ${format(weekDays[6], "dd/MM")}`}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleNext}
                                className="h-9 w-9 shrink-0 rounded-none border-l border-border"
                                aria-label="Próximo período"
                            >
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>

                        <Button
                            variant="outline"
                            onClick={handleToday}
                            className="h-9 border-border font-bold text-arena-navy-800 hover:bg-muted/50"
                        >
                            Hoje
                        </Button>

                        <Button
                            type="button"
                            onClick={() => setIsDayOpportunitiesModalOpen(true)}
                            className="h-10 gap-2 rounded-md border-0 bg-arena-calendar-teal px-4 text-sm font-bold text-white shadow-none hover:bg-arena-calendar-teal-hover"
                        >
                            <Lightbulb className="size-4 shrink-0" aria-hidden />
                            Ver oportunidades do dia
                        </Button>

                        <Button
                            type="button"
                            onClick={() => setIsBookingModalOpen(true)}
                            className="h-10 rounded-md bg-arena-button px-4 text-sm font-bold text-white shadow-none hover:bg-arena-button-hover"
                        >
                            Cadastrar reserva
                        </Button>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain">
                        <div className="min-w-[320px] sm:min-w-[720px]">
                            <div className="sticky top-0 z-2 grid grid-cols-[80px_1fr] border-b border-border bg-muted/95 backdrop-blur supports-backdrop-filter:bg-muted/80">
                                <div className="flex items-center justify-center border-r border-border p-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    Horário
                                </div>
                                <div className={cn("grid", viewMode === "day" ? "grid-cols-1" : "grid-cols-7")}>
                                    {viewMode === "day" ? (
                                        <div className="p-3 text-center text-sm font-bold capitalize text-arena-navy-800">
                                            {format(currentDate, "EEEE (dd/MM)", { locale: ptBR })}
                                        </div>
                                    ) : (
                                        weekDays.map((day, i) => (
                                            <div
                                                key={i}
                                                className="border-r border-border p-3 text-center last:border-r-0"
                                            >
                                                <div className="text-sm font-bold capitalize text-arena-navy-800">
                                                    {format(day, "EEEE", { locale: ptBR })}
                                                </div>
                                                <div className="mt-0.5 text-xs font-medium text-muted-foreground">
                                                    ({format(day, "dd/MM")})
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {slots.map((slot, slotIndex) => {
                                const slotKey = `${slot.hour}:${slot.minute}`
                                const hasBooking = hasBookingInSlot(slot)
                                const stripe = slotIndex % 2 === 0 ? "bg-white" : "bg-muted/25"
                                return (
                                    <div
                                        key={slotKey}
                                        className={cn(
                                            "grid grid-cols-[80px_1fr] border-b border-border transition-colors last:border-b-0",
                                            stripe,
                                            hasBooking ? "min-h-[80px]" : "min-h-[40px]"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "flex items-center justify-center border-r border-border p-2 text-center text-[11px] font-semibold tabular-nums text-muted-foreground",
                                                !hasBooking && "text-muted-foreground/70"
                                            )}
                                        >
                                            {String(slot.hour).padStart(2, "0")}:{String(slot.minute).padStart(2, "0")}
                                        </div>
                                        <div className={cn("grid", viewMode === "day" ? "grid-cols-1" : "grid-cols-7")}>
                                            {viewMode === "day" ? (
                                                <TimeSlot
                                                    slot={slot}
                                                    bookings={getBookingsForSlot(currentDate, slot)}
                                                    available
                                                    court={court}
                                                    onBookingClick={(b) => {
                                                        setSelectedBooking(b)
                                                        setIsBookingDetailsModalOpen(true)
                                                    }}
                                                    onEmptyClick={() => handleSlotClick(currentDate, slot)}
                                                    className={cn(!hasBooking && "p-0")}
                                                    futureBooking={
                                                        getBookingsForSlot(currentDate, slot).length === 0
                                                            ? getFutureBookingForSlot(currentDate, slot)
                                                            : null
                                                    }
                                                />
                                            ) : (
                                                weekDays.map((day, i) => {
                                                    const daySlots = generateSlotsForDate(day, court.day_config as any[] | null)
                                                    const isAvailable = daySlots.some(
                                                        (s) => s.hour === slot.hour && s.minute === slot.minute
                                                    )
                                                    return (
                                                        <TimeSlot
                                                            key={i}
                                                            slot={slot}
                                                            bookings={isAvailable ? getBookingsForSlot(day, slot) : []}
                                                            available={isAvailable}
                                                            court={court}
                                                            className={cn(
                                                                "border-r border-border last:border-r-0",
                                                                !hasBooking && "p-0"
                                                            )}
                                                            onBookingClick={(b) => {
                                                                setSelectedBooking(b)
                                                                setIsBookingDetailsModalOpen(true)
                                                            }}
                                                            onEmptyClick={() => handleSlotClick(day, slot)}
                                                            futureBooking={
                                                                isAvailable && getBookingsForSlot(day, slot).length === 0
                                                                    ? getFutureBookingForSlot(day, slot)
                                                                    : null
                                                            }
                                                        />
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </Card>

            <BookingDetailsModal
                isOpen={isBookingDetailsModalOpen}
                onClose={() => setIsBookingDetailsModalOpen(false)}
                onSuccess={() => loadBookings(currentDate, viewMode)}
                booking={selectedBooking}
                court={court}
            />

            <BookingModal
                isOpen={isBookingModalOpen}
                onClose={() => setIsBookingModalOpen(false)}
                onSuccess={() => loadBookings(currentDate, viewMode)}
                arenaId={arenaId}
                courtId={courtId}
                selectedDate={selectedSlotDate}
                selectedHour={selectedSlotHour}
                selectedMinute={selectedSlotMinute}
                defaultPrice={customPrice || court.price || 0}
            />

            <DayOpportunitiesModal
                isOpen={isDayOpportunitiesModalOpen}
                onClose={() => setIsDayOpportunitiesModalOpen(false)}
                arenaId={arenaId}
                courtId={courtId}
                currentDate={currentDate}
                todayBookings={bookings.filter((b) => isSameDay(parseISO(b.start_time), currentDate))}
            />
        </div>
    )
}
