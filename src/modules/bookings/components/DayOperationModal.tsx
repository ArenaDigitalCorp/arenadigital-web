"use client"

import { useEffect, useState, useMemo } from "react";
import { format, parseISO, getHours, getMinutes, getDay, addDays, subDays, addMonths, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, CalendarDays, CalendarIcon, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { getBookingsByArenaWithSportsAction } from "@/modules/bookings/actions/bookingActions";

interface Court {
    id: string;
    name: string;
    day_config?: any[];
    sports?: any[];
}

interface Booking {
    id: string;
    athlete_name: string | null;
    court_id: string;
    start_time: string;
    end_time: string;
    status: string | null;
    price?: number;
    sports?: {
        id: string;
        name: string;
    };
    courts?: {
        id: string;
        name: string;
    };
    atleta?: {
        id: string;
        nome_perfil: string;
        telefone: string;
    };
}

interface DayOperationModalProps {
    isOpen: boolean;
    onClose: () => void;
    arenaId: string;
    arenaName: string;
    courts: Court[];
}

const getSportStyles = (sportName: string) => {
    const normalizedName = sportName.toLowerCase();

    if (normalizedName.includes('beach tennis')) {
        return {
            bg: 'bg-[#FFF7ED]',
            border: 'border-[#FB923C]',
            text: 'text-[#C2410C]',
            textSecondary: 'text-[#C2410C]/60',
            dot: 'bg-[#FB923C]',
        };
    }
    if (normalizedName.includes('futev') || normalizedName.includes('futevôlei')) {
        return {
            bg: 'bg-[#EFF6FF]',
            border: 'border-[#60A5FA]',
            text: 'text-[#1D4ED8]',
            textSecondary: 'text-[#1D4ED8]/60',
            dot: 'bg-[#60A5FA]',
        };
    }
    if (normalizedName.includes('vôlei') || normalizedName.includes('volei')) {
        return {
            bg: 'bg-[#FEFCE8]',
            border: 'border-[#FACC15]',
            text: 'text-[#A16207]',
            textSecondary: 'text-[#A16207]/60',
            dot: 'bg-[#FACC15]',
        };
    }
    if (normalizedName.includes('tênis') || normalizedName.includes('tenis')) {
        return {
            bg: 'bg-[#F0FDF4]',
            border: 'border-[#4ADE80]',
            text: 'text-[#15803D]',
            textSecondary: 'text-[#15803D]/60',
            dot: 'bg-[#4ADE80]',
        };
    }
    if (normalizedName.includes('padel')) {
        return {
            bg: 'bg-[#FAF5FF]',
            border: 'border-[#C084FC]',
            text: 'text-[#7E22CE]',
            textSecondary: 'text-[#7E22CE]/60',
            dot: 'bg-[#C084FC]',
        };
    }
    if (normalizedName.includes('futebol') || normalizedName.includes('society')) {
        return {
            bg: 'bg-[#ECFDF5]',
            border: 'border-[#34D399]',
            text: 'text-[#065F46]',
            textSecondary: 'text-[#065F46]/60',
            dot: 'bg-[#34D399]',
        };
    }
    if (normalizedName.includes('basquete') || normalizedName.includes('basket')) {
        return {
            bg: 'bg-[#FFF1F2]',
            border: 'border-[#FB7185]',
            text: 'text-[#BE123C]',
            textSecondary: 'text-[#BE123C]/60',
            dot: 'bg-[#FB7185]',
        };
    }
    if (normalizedName.includes('handebol')) {
        return {
            bg: 'bg-[#FDF2F8]',
            border: 'border-[#F472B6]',
            text: 'text-[#BE185D]',
            textSecondary: 'text-[#BE185D]/60',
            dot: 'bg-[#F472B6]',
        };
    }

    return {
        bg: 'bg-[#F1F5F9]',
        border: 'border-[#94A3B8]',
        text: 'text-[#334155]',
        textSecondary: 'text-[#334155]/60',
        dot: 'bg-[#94A3B8]',
    };
};

// ── Slot generation (mirrors CourtCalendarPageClient logic) ─────────────────

interface SlotTime { hour: number; minute: number }

function parseHHMM(t: string): number {
    const [h, m] = (t || "00:00").split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
}

function generateSlotsForDayConfig(cfg: any): SlotTime[] {
    if (!cfg?.enabled) return []
    const startMins = parseHHMM(cfg.startTime)
    let endMins = parseHHMM(cfg.endTime)
    if (endMins <= startMins) endMins += 24 * 60

    let firstShiftMins: number | null = null
    if (cfg.slotShiftTime) {
        const sm = parseHHMM(cfg.slotShiftTime)
        firstShiftMins = sm % 60 === 30 ? sm : sm + (30 - sm % 60) % 60
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

function generateSlotsForDate(date: Date, dayConfigs: any[] | null): SlotTime[] {
    if (!dayConfigs) return Array.from({ length: 24 }, (_, i) => ({ hour: i, minute: 0 }))
    const name = format(date, 'EEEE', { locale: ptBR })
    const formatted = name.charAt(0).toUpperCase() + name.slice(1)
    const cfg = dayConfigs.find((d: any) => d.day.toLowerCase() === formatted.toLowerCase())
    if (!cfg?.enabled) return []
    return generateSlotsForDayConfig(cfg)
}

// ────────────────────────────────────────────────────────────────────────────

export function DayOperationModal({ isOpen, onClose, arenaId, arenaName, courts }: DayOperationModalProps) {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [futureBookings, setFutureBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [visibleCourtIds, setVisibleCourtIds] = useState<Set<string>>(
        () => new Set(courts.map(c => c.id))
    );

    // Sort courts alphabetically
    const sortedCourts = useMemo(() => {
        return [...courts].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [courts]);

    // Courts actually shown in the grid
    const visibleCourts = useMemo(
        () => sortedCourts.filter(c => visibleCourtIds.has(c.id)),
        [sortedCourts, visibleCourtIds]
    );

    const toggleCourt = (id: string) => {
        setVisibleCourtIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const allVisible = visibleCourtIds.size === sortedCourts.length;

    const toggleAll = () => {
        setVisibleCourtIds(
            allVisible ? new Set() : new Set(sortedCourts.map(c => c.id))
        );
    };

    // Reset visibility and date when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentDate(new Date());
            setVisibleCourtIds(new Set(courts.map(c => c.id)));
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (isOpen && arenaId) {
            loadBookings();
        }
    }, [isOpen, arenaId, currentDate]);

    const loadBookings = async () => {
        setIsLoading(true);
        try {
            const start = new Date(currentDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(currentDate);
            end.setHours(23, 59, 59, 999);

            const res = await getBookingsByArenaWithSportsAction(
                arenaId,
                start.toISOString(),
                end.toISOString()
            );
            setBookings(((res.data ?? []) as unknown) as Booking[]);
        } catch (error) {
            console.error("Error loading bookings for day operation", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Carrega reservas futuras (próximos 60 dias) para indicador de eventos futuros
    useEffect(() => {
        if (!isOpen || !arenaId) return;
        const loadFutureBookings = async () => {
            const start = addDays(new Date(), 1);
            const end = addMonths(new Date(), 2);
            const res = await getBookingsByArenaWithSportsAction(
                arenaId,
                start.toISOString(),
                end.toISOString()
            );
            if (res.data) {
                setFutureBookings((res.data as unknown as Booking[]).filter(b => b.status !== 'cancelled'));
            }
        };
        loadFutureBookings();
    }, [isOpen, arenaId]);

    // Próxima reserva futura no mesmo dia da semana + mesma hora:minuto + mesma quadra
    const getFutureBookingForSlot = (courtId: string, slot: SlotTime): Booking | null => {
        const targetDayOfWeek = getDay(currentDate);
        return futureBookings.find(b => {
            if (b.court_id !== courtId) return false;
            const bStart = parseISO(b.start_time);
            return getDay(bStart) === targetDayOfWeek
                && getHours(bStart) === slot.hour
                && getMinutes(bStart) === slot.minute
                && bStart > currentDate;
        }) ?? null;
    };

    const handlePreviousDay = () => setCurrentDate(prev => subDays(prev, 1));
    const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));
    const handleToday = () => setCurrentDate(new Date());

    // Build the union of all slots across courts (from day_config) + any booking start times
    const allSlots = useMemo<SlotTime[]>(() => {
        const map = new Map<string, SlotTime>()
        sortedCourts.forEach(court => {
            generateSlotsForDate(currentDate, court.day_config ?? null).forEach(s => {
                map.set(`${s.hour}:${s.minute}`, s)
            })
        })
        // Include slots from actual bookings so they always appear even outside config
        bookings.forEach(b => {
            if (b.status === 'cancelled') return
            const bStart = parseISO(b.start_time)
            const h = getHours(bStart), m = getMinutes(bStart)
            map.set(`${h}:${m}`, { hour: h, minute: m })
        })
        return Array.from(map.values()).sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute))
    }, [sortedCourts, bookings, currentDate])

    const getBookingForSlot = (courtId: string, slot: SlotTime): Booking | undefined => {
        const slotStart = new Date(currentDate);
        slotStart.setHours(slot.hour, slot.minute, 0, 0);

        return bookings.find(b => {
            if (b.court_id !== courtId) return false;
            if (b.status === 'cancelled') return false;

            const bStart = parseISO(b.start_time);
            const bEnd = parseISO(b.end_time);

            return slotStart >= bStart && slotStart < bEnd;
        });
    };

    const isSlotAvailable = (court: Court, slot: SlotTime) => {
        if (!court.day_config || !Array.isArray(court.day_config) || court.day_config.length === 0) {
            return true;
        }

        const dayName = format(currentDate, 'EEEE', { locale: ptBR });
        const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        const config = court.day_config.find((d: any) => d.day.toLowerCase() === formattedDayName.toLowerCase());

        if (!config || !config.enabled) return false;

        const slotMins = slot.hour * 60 + slot.minute;
        const startMins = parseHHMM(config.startTime);
        let endMins = parseHHMM(config.endTime);
        if (endMins <= startMins) endMins += 24 * 60;

        const normalizedSlot = slotMins < startMins ? slotMins + 24 * 60 : slotMins;
        return normalizedSlot >= startMins && normalizedSlot < endMins;
    };

    // Get unique sport names for the legend
    const uniqueSports = useMemo(() => {
        const sports = new Set<string>();
        bookings.forEach(b => {
            if (b.sports?.name) sports.add(b.sports.name);
        });
        return Array.from(sports).sort();
    }, [bookings]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-[90vw] h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <header className="bg-gradient-to-r from-arena-navy-800 to-arena-navy-700 px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 p-2 rounded-lg">
                            <CalendarDays className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-lg tracking-tight">
                                Operação do Dia
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePreviousDay}
                                    className="text-white/50 hover:text-white hover:bg-white/10 rounded p-0.5 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>

                                {/* Data clicável que abre o calendário */}
                                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <button
                                            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium capitalize px-2 py-1 rounded-md hover:bg-white/10 transition-colors group"
                                        >
                                            <CalendarIcon className="w-3.5 h-3.5 text-white/50 group-hover:text-white/80 transition-colors" />
                                            {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        align="start"
                                        sideOffset={8}
                                        className="w-auto p-0 border-none shadow-2xl rounded-xl overflow-hidden z-[60]"
                                    >
                                        <div className="bg-[#1E293B] rounded-xl">
                                            <Calendar
                                                mode="single"
                                                selected={currentDate}
                                                onSelect={(date) => {
                                                    if (date) {
                                                        setCurrentDate(date);
                                                        setCalendarOpen(false);
                                                    }
                                                }}
                                                locale={ptBR}
                                                initialFocus
                                                classNames={{
                                                    months: "flex flex-col",
                                                    month: "space-y-3",
                                                    month_caption: "flex justify-center items-center h-8 mb-2 px-2",
                                                    caption_label: "text-sm font-bold text-white capitalize",
                                                    nav: "flex items-center",
                                                    button_previous: "h-7 w-7 bg-white/10 hover:bg-white/20 text-white rounded-md p-0 flex items-center justify-center absolute left-2 top-3 z-20 transition-colors",
                                                    button_next: "h-7 w-7 bg-white/10 hover:bg-white/20 text-white rounded-md p-0 flex items-center justify-center absolute right-2 top-3 z-20 transition-colors",
                                                    month_grid: "w-full border-collapse",
                                                    weekdays: "flex mb-1",
                                                    weekday: "text-white/40 rounded-md w-9 font-medium text-[0.7rem] flex items-center justify-center",
                                                    week: "flex w-full mt-1 justify-between",
                                                    day: "h-9 w-9 text-center text-sm p-0 relative",
                                                    day_button: "h-9 w-9 p-0 font-medium w-full h-full flex items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white transition-colors",
                                                    selected: "bg-indigo-500 text-white hover:bg-indigo-400 rounded-md",
                                                    today: "bg-white/10 text-white font-bold rounded-md",
                                                    outside: "text-white/20 opacity-50",
                                                    disabled: "text-white/20 opacity-30",
                                                    hidden: "invisible",
                                                }}
                                            />
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <button
                                    onClick={handleNextDay}
                                    className="text-white/50 hover:text-white hover:bg-white/10 rounded p-0.5 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                {!isToday(currentDate) && (
                                    <button
                                        onClick={handleToday}
                                        className="text-white/60 hover:text-white text-[10px] font-bold uppercase bg-white/10 hover:bg-white/20 rounded px-2 py-0.5 ml-1 transition-colors"
                                    >
                                        Hoje
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Legend */}
                        {uniqueSports.length > 0 && (
                            <div className="hidden md:flex items-center gap-3 bg-white/10 rounded-lg px-4 py-2">
                                {uniqueSports.map(sport => {
                                    const styles = getSportStyles(sport);
                                    return (
                                        <div key={sport} className="flex items-center gap-1.5">
                                            <div className={cn("w-2.5 h-2.5 rounded-full", styles.dot)} />
                                            <span className="text-white/80 text-xs font-medium">{sport}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-white/60 hover:text-white hover:bg-white/10 h-9 w-9"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </header>

                {/* Content – sidebar + grid */}
                <div className="flex-1 flex overflow-hidden">

                    {/* ── Sidebar de espaços ── */}
                    <div className="w-52 flex-shrink-0 bg-white border-r border-arena-navy-800/10 flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-arena-navy-800/8">
                            <p className="text-[10px] font-black uppercase tracking-wider text-arena-navy-800/40 mb-2">
                                Espaços
                            </p>
                            <button
                                onClick={toggleAll}
                                className="text-[11px] font-semibold text-arena-button hover:text-arena-button-hover transition-colors"
                            >
                                {allVisible ? 'Desmarcar todos' : 'Selecionar todos'}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto py-2">
                            {sortedCourts.map(court => {
                                const checked = visibleCourtIds.has(court.id)
                                const hasBooking = bookings.some(
                                    b => b.court_id === court.id && b.status !== 'cancelled'
                                )
                                return (
                                    <button
                                        key={court.id}
                                        onClick={() => toggleCourt(court.id)}
                                        className={cn(
                                            "w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-arena-navy-800/5",
                                            checked ? "opacity-100" : "opacity-40"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                            checked
                                                ? "bg-arena-button border-arena-button"
                                                : "border-arena-navy-800/30 bg-white"
                                        )}>
                                            {checked && (
                                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                                                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-xs font-semibold text-arena-navy-800 leading-tight truncate flex-1">
                                            {court.name}
                                        </span>
                                        {hasBooking && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-arena-button flex-shrink-0" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                        {visibleCourtIds.size < sortedCourts.length && (
                            <div className="px-4 py-2.5 border-t border-arena-navy-800/8 bg-arena-navy-800/[0.02]">
                                <p className="text-[10px] text-arena-navy-800/40 font-medium">
                                    {visibleCourtIds.size} de {sortedCourts.length} visíveis
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── Grid de horários ── */}
                    <div className="flex-1 overflow-auto bg-arena-soft">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-arena-navy-800/40" />
                            <span className="text-arena-navy-800/60 font-medium">Carregando operação...</span>
                        </div>
                    ) : visibleCourts.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-arena-navy-800/30 font-semibold text-sm">Nenhum espaço selecionado.</p>
                        </div>
                    ) : (
                        <div className="inline-block min-w-full">
                            <table className="border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr>
                                        <th className="bg-arena-navy-800 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-3 min-w-[70px] w-[70px] text-center border-r border-white/10 sticky left-0 z-20">
                                            Horário
                                        </th>
                                        {visibleCourts.map(court => (
                                            <th
                                                key={court.id}
                                                className="bg-arena-navy-800 text-white text-xs font-bold px-4 py-3 text-center border-r border-white/10 last:border-r-0 min-w-[180px]"
                                            >
                                                {court.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        // skipSlots tracks cells already covered by a rowspan
                                        // key format: `${slotLabel}:${courtId}`
                                        const skipSlots = new Set<string>()

                                        return allSlots.map((slot, slotIdx) => {
                                            const slotLabel = `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`

                                            // A booking "starts" at this slot (used for row height)
                                            const hasAnyBookingStart = visibleCourts.some(court => {
                                                const b = getBookingForSlot(court.id, slot)
                                                if (!b) return false
                                                const bs = parseISO(b.start_time)
                                                return slot.hour === getHours(bs) && slot.minute === getMinutes(bs)
                                            })
                                            const hasAnyAvailable = visibleCourts.some(court => isSlotAvailable(court, slot))
                                            const hasAnyCoveredByBooking = visibleCourts.some(court => !!getBookingForSlot(court.id, slot))

                                            if (!hasAnyAvailable && !hasAnyCoveredByBooking) return null

                                            return (
                                                <tr
                                                    key={slotLabel}
                                                    className={cn("transition-all", hasAnyBookingStart ? "h-[72px]" : "h-[40px]")}
                                                >
                                                    <td className={cn(
                                                        "bg-white border-r border-b border-arena-navy-800/5 text-center font-bold text-[11px] sticky left-0 z-10",
                                                        hasAnyBookingStart ? "text-arena-navy-800/80" : "text-arena-navy-800/30"
                                                    )}>
                                                        {slotLabel}
                                                    </td>

                                                    {visibleCourts.map(court => {
                                                        const cellKey = `${slotLabel}:${court.id}`

                                                        // This cell is absorbed by a rowspan from a previous row — omit the td
                                                        if (skipSlots.has(cellKey)) return null

                                                        const booking = getBookingForSlot(court.id, slot)
                                                        const available = isSlotAvailable(court, slot)

                                                        if (!available && !booking) {
                                                            return <td key={court.id} className="bg-[#E2E8F0]/50 border-r border-b border-arena-navy-800/5 last:border-r-0" />
                                                        }

                                                        if (booking) {
                                                            const bStart = parseISO(booking.start_time)
                                                            const bEnd = parseISO(booking.end_time)
                                                            const isBookingStart = slot.hour === getHours(bStart) && slot.minute === getMinutes(bStart)

                                                            // Only render the td on the booking's first slot; skip it on continuations
                                                            if (!isBookingStart) return null

                                                            // Count how many grid slots this booking spans
                                                            const rowspan = Math.max(1, allSlots.filter(s => {
                                                                const sm = new Date(currentDate)
                                                                sm.setHours(s.hour, s.minute, 0, 0)
                                                                return sm >= bStart && sm < bEnd
                                                            }).length)

                                                            // Mark future cells for this court as covered
                                                            for (let i = slotIdx + 1; i < slotIdx + rowspan && i < allSlots.length; i++) {
                                                                const s = allSlots[i]
                                                                const fl = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`
                                                                skipSlots.add(`${fl}:${court.id}`)
                                                            }

                                                            const sportName = booking.sports?.name || ''
                                                            const sportStyles = getSportStyles(sportName)
                                                            const responsavel = booking.atleta?.nome_perfil || booking.athlete_name || '—'

                                                            return (
                                                                <td
                                                                    key={court.id}
                                                                    rowSpan={rowspan}
                                                                    className="border-r border-arena-navy-800/5 last:border-r-0 p-1.5"
                                                                    style={{ height: '1px' }}
                                                                >
                                                                    <div className={cn(
                                                                        "w-full h-full flex flex-col gap-0.5 border-l-4 px-2 py-2 rounded-lg",
                                                                        sportStyles.bg,
                                                                        sportStyles.border,
                                                                    )}>
                                                                        <span className={cn("text-[10px] font-black leading-tight line-clamp-1", sportStyles.text)}>
                                                                            {responsavel}
                                                                        </span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            {booking.price != null && (
                                                                                <span className={cn("text-[9px] font-bold", sportStyles.textSecondary)}>
                                                                                    R$ {Number(booking.price).toFixed(0)}
                                                                                </span>
                                                                            )}
                                                                            <span className={cn("text-[9px] font-bold", sportStyles.textSecondary)}>•</span>
                                                                            <span className={cn("text-[9px] font-bold", sportStyles.textSecondary)}>
                                                                                {sportName || 'Esporte'}
                                                                            </span>
                                                                        </div>
                                                                        <span className={cn("text-[9px] font-medium", sportStyles.textSecondary)}>
                                                                            {format(bStart, 'HH:mm')} – {format(bEnd, 'HH:mm')}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            )
                                                        }

                                                        return (
                                                            <td key={court.id} className="bg-white border-r border-b border-arena-navy-800/5 last:border-r-0 relative group/slot">
                                                                {(() => {
                                                                    const futureB = getFutureBookingForSlot(court.id, slot)
                                                                    if (!futureB) return null
                                                                    const fStart = parseISO(futureB.start_time)
                                                                    const fEnd = parseISO(futureB.end_time)
                                                                    return (
                                                                        <TooltipProvider delayDuration={200}>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                                    <div className="absolute top-1.5 right-1.5 z-10 cursor-default">
                                                                                        <div className="h-2 w-2 rounded-full bg-indigo-300 animate-pulse" style={{ boxShadow: '0 0 0 3px rgba(129,140,248,0.15)' }} />
                                                                                    </div>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent side="right" sideOffset={8} className="bg-[#1E293B] border-none text-white rounded-xl px-3.5 py-2.5 shadow-xl max-w-[200px]">
                                                                                    <div className="space-y-1">
                                                                                        <p className="text-[9px] font-black uppercase tracking-wider text-indigo-300">Próximo evento</p>
                                                                                        <p className="text-[12px] font-bold leading-tight">{futureB.athlete_name ?? 'Atleta'}</p>
                                                                                        <p className="text-[10px] text-white/70 font-medium">
                                                                                            {format(fStart, "EEE, dd/MM", { locale: ptBR })} &middot; {format(fStart, "HH:mm")}&ndash;{format(fEnd, "HH:mm")}
                                                                                        </p>
                                                                                    </div>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                    )
                                                                })()}
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                            )
                                        })
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    )}
                    </div>{/* end grid */}
                </div>{/* end sidebar+grid flex */}

                {/* Mobile legend */}
                {uniqueSports.length > 0 && (
                    <div className="md:hidden bg-white border-t border-arena-navy-800/10 px-4 py-3 flex flex-wrap items-center gap-3 flex-shrink-0 rounded-b-2xl">
                        {uniqueSports.map(sport => {
                            const styles = getSportStyles(sport);
                            return (
                                <div key={sport} className="flex items-center gap-1.5">
                                    <div className={cn("w-2.5 h-2.5 rounded-full", styles.dot)} />
                                    <span className="text-arena-navy-800/70 text-xs font-medium">{sport}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
