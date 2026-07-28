"use client"

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, getHours, getMinutes, getDay, addDays, subDays, addMonths, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    X,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Filter,
    Check,
    ChevronDown,
    Maximize2,
    Minimize2,
    PanelLeftClose,
    PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getBookingsByArenaWithSportsAction } from "@/modules/bookings/actions/bookingActions";
import type { Booking } from "@/modules/bookings/types/booking.types";
import { BookingModal } from "@/modules/bookings/components/BookingModal";
import { BookingDetailsModal } from "@/modules/bookings/components/BookingDetailsModal";
import {
    blocksAvailability,
    generateSlotsForDate,
    getSlotPrice,
    isSlotWithinDayConfig,
    slotLabel,
    slotToMinutes,
    type CourtDayConfig,
    type SlotTime,
} from "@/modules/bookings/utils/court-slots";

export interface OperationCourt {
    id: string;
    name: string;
    day_config?: unknown;
    price?: number | null;
    booking_type?: string | null;
    sports?: { id: string; name: string }[];
}

interface OperationBooking {
    id: string;
    athlete_name: string | null;
    court_id: string;
    start_time: string;
    end_time: string;
    status: string | null;
    payment_expires_at?: string | null;
    price?: number;
    booking_type?: string | null;
    plano_mensalista_id?: string | null;
    sports?: { id: string; name: string };
    courts?: { id: string; name: string };
    atleta?: { id: string; nome_perfil: string; telefone: string };
}

interface DayOperationBoardProps {
    arenaId: string;
    courts: OperationCourt[];
    /** `modal` ocupa a altura do overlay; `page` se encaixa no conteúdo da aba. */
    variant?: "modal" | "page";
    /** Habilita criar/abrir reservas clicando nos slots da grade. */
    interactive?: boolean;
    /** Quando informado, renderiza o botão de fechar no cabeçalho. */
    onClose?: () => void;
}

export const getSportStyles = (sportName: string) => {
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

const reservadoStyles = {
    bg: 'bg-amber-50',
    border: 'border-amber-400 border-dashed',
    text: 'text-amber-800',
    textSecondary: 'text-amber-600',
    dot: 'bg-amber-400',
};

const pendingPixStyles = {
    bg: 'bg-orange-50',
    border: 'border-orange-400 border-dashed',
    text: 'text-orange-800',
    textSecondary: 'text-orange-600',
    dot: 'bg-orange-400',
};

function dayConfigOf(court: OperationCourt): CourtDayConfig[] | null {
    return Array.isArray(court.day_config) ? (court.day_config as CourtDayConfig[]) : null;
}

export function DayOperationBoard({
    arenaId,
    courts,
    variant = "modal",
    interactive = false,
    onClose,
}: DayOperationBoardProps) {
    const [bookings, setBookings] = useState<OperationBooking[]>([]);
    const [futureBookings, setFutureBookings] = useState<OperationBooking[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [sportFilterOpen, setSportFilterOpen] = useState(false);
    const [selectedSports, setSelectedSports] = useState<Set<string>>(() => new Set());
    const [visibleCourtIds, setVisibleCourtIds] = useState<Set<string>>(
        () => new Set(courts.map(c => c.id))
    );

    // ── Espaço de trabalho: tela cheia e sidebar recolhível ──
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // ── Reserva (avulsa/mensalista) e detalhes ──
    const [bookingCourt, setBookingCourt] = useState<OperationCourt | null>(null);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [bookingToEdit, setBookingToEdit] = useState<OperationBooking | null>(null);
    const [selectedSlotDate, setSelectedSlotDate] = useState<Date>(new Date());
    const [selectedSlotHour, setSelectedSlotHour] = useState(0);
    const [selectedSlotMinute, setSelectedSlotMinute] = useState(0);
    const [slotPrice, setSlotPrice] = useState(0);
    const [detailsCourt, setDetailsCourt] = useState<OperationCourt | null>(null);
    const [selectedBooking, setSelectedBooking] = useState<OperationBooking | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

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
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allVisible = visibleCourtIds.size === sortedCourts.length;

    const toggleAll = () => {
        setVisibleCourtIds(
            allVisible ? new Set() : new Set(sortedCourts.map(c => c.id))
        );
    };

    // Esc sai da tela cheia (sem interferir nos modais de reserva, que tratam o próprio Esc)
    useEffect(() => {
        if (!isExpanded) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (isBookingModalOpen || isDetailsModalOpen) return;
            setIsExpanded(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isExpanded, isBookingModalOpen, isDetailsModalOpen]);

    // Trava o scroll do corpo enquanto a grade ocupa a tela inteira
    useEffect(() => {
        if (!isExpanded) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [isExpanded]);

    const loadBookings = useCallback(async () => {
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
            setBookings(((res.data ?? []) as unknown) as OperationBooking[]);
        } catch (error) {
            console.error("Error loading bookings for day operation", error);
        } finally {
            setIsLoading(false);
        }
    }, [arenaId, currentDate]);

    useEffect(() => {
        if (arenaId) loadBookings();
    }, [arenaId, loadBookings]);

    // Carrega reservas futuras (próximos 60 dias) para indicador de eventos futuros
    const loadFutureBookings = useCallback(async () => {
        const start = addDays(new Date(), 1);
        const end = addMonths(new Date(), 2);
        const res = await getBookingsByArenaWithSportsAction(
            arenaId,
            start.toISOString(),
            end.toISOString()
        );
        if (res.data) {
            setFutureBookings((res.data as unknown as OperationBooking[]).filter(blocksAvailability));
        }
    }, [arenaId]);

    useEffect(() => {
        if (!arenaId) return;
        loadFutureBookings();
    }, [arenaId, loadFutureBookings]);

    const handleBookingSuccess = useCallback(() => {
        loadBookings();
        loadFutureBookings();
    }, [loadBookings, loadFutureBookings]);

    const sportOptions = useMemo(() => {
        const sports = new Set<string>();
        courts.forEach(court => {
            court.sports?.forEach((sport) => {
                if (sport?.name) sports.add(sport.name);
            });
        });
        bookings.forEach(b => {
            if (b.sports?.name) sports.add(b.sports.name);
        });
        return Array.from(sports).sort();
    }, [courts, bookings]);

    const filteredBookings = useMemo(() => {
        if (selectedSports.size === 0) return bookings;

        return bookings.filter(booking => {
            const sportName = booking.sports?.name;
            return sportName ? selectedSports.has(sportName) : false;
        });
    }, [bookings, selectedSports]);

    // Próxima reserva futura no mesmo dia da semana + mesma hora:minuto + mesma quadra
    const getFutureBookingForSlot = (courtId: string, slot: SlotTime): OperationBooking | null => {
        const targetDayOfWeek = getDay(currentDate);
        return futureBookings.find(b => {
            if (b.court_id !== courtId) return false;
            if (selectedSports.size > 0 && (!b.sports?.name || !selectedSports.has(b.sports.name))) return false;
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

    const toggleSportFilter = (sportName: string) => {
        setSelectedSports(prev => {
            const next = new Set(prev);
            if (next.has(sportName)) next.delete(sportName);
            else next.add(sportName);
            return next;
        });
    };

    const removeSportFilter = (sportName: string) => {
        setSelectedSports(prev => {
            const next = new Set(prev);
            next.delete(sportName);
            return next;
        });
    };

    // Build the union of all slots across courts (from day_config) + any booking start times
    const allSlots = useMemo<SlotTime[]>(() => {
        const map = new Map<string, SlotTime>()
        sortedCourts.forEach(court => {
            generateSlotsForDate(currentDate, dayConfigOf(court)).forEach(s => {
                map.set(`${s.hour}:${s.minute}`, s)
            })
        })
        // Include slots from actual bookings so they always appear even outside config
        filteredBookings.forEach(b => {
            if (!blocksAvailability(b)) return
            const bStart = parseISO(b.start_time)
            const h = getHours(bStart), m = getMinutes(bStart)
            map.set(`${h}:${m}`, { hour: h, minute: m })
        })
        return Array.from(map.values()).sort((a, b) => slotToMinutes(a) - slotToMinutes(b))
    }, [sortedCourts, filteredBookings, currentDate])

    const getBookingForSlot = (courtId: string, slot: SlotTime): OperationBooking | undefined => {
        const slotStart = new Date(currentDate);
        slotStart.setHours(slot.hour, slot.minute, 0, 0);

        return filteredBookings.find(b => {
            if (b.court_id !== courtId) return false;
            if (!blocksAvailability(b)) return false;

            const bStart = parseISO(b.start_time);
            const bEnd = parseISO(b.end_time);

            return slotStart >= bStart && slotStart < bEnd;
        });
    };

    const isSlotAvailable = (court: OperationCourt, slot: SlotTime) =>
        isSlotWithinDayConfig(currentDate, dayConfigOf(court), slot);

    const handleEmptySlotClick = (court: OperationCourt, slot: SlotTime) => {
        if (!interactive) return;
        const date = new Date(currentDate);
        date.setHours(slot.hour, slot.minute, 0, 0);
        setBookingCourt(court);
        setSelectedSlotDate(date);
        setSelectedSlotHour(slot.hour);
        setSelectedSlotMinute(slot.minute);
        setSlotPrice(getSlotPrice(currentDate, dayConfigOf(court), slot, court.price));
        setBookingToEdit(null);
        setIsBookingModalOpen(true);
    };

    const handleBookingClick = (court: OperationCourt, booking: OperationBooking) => {
        if (!interactive) return;
        setDetailsCourt(court);
        setSelectedBooking(booking);
        setIsDetailsModalOpen(true);
    };

    const canEditSelectedBooking =
        !!selectedBooking &&
        selectedBooking.booking_type !== "mensalista" &&
        !selectedBooking.plano_mensalista_id &&
        selectedBooking.status !== "cancelled" &&
        selectedBooking.status !== "pending_payment";

    const isModal = variant === "modal";
    const canExpand = !isModal;
    const hiddenCourtsCount = sortedCourts.length - visibleCourtIds.size;

    const board = (
        <div
            className={cn(
                "flex flex-col overflow-hidden bg-white",
                isExpanded
                    ? "fixed left-1/2 top-1/2 z-50 h-[92vh] w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl"
                    : isModal
                        ? "h-full rounded-2xl"
                        : "h-[calc(100dvh-16rem)] min-h-[420px] rounded-xl border border-slate-200 shadow-sm"
            )}
        >
            {/* Header */}
            <header className="bg-white px-5 py-4 flex flex-col gap-4 flex-shrink-0 rounded-t-2xl md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => setIsSidebarOpen(open => !open)}
                                aria-label={isSidebarOpen ? "Ocultar lista de espaços" : "Mostrar lista de espaços"}
                                className="size-9 shrink-0 rounded-md border-slate-200 bg-white text-arena-navy-800 shadow-sm hover:bg-slate-50"
                            >
                                {isSidebarOpen ? (
                                    <PanelLeftClose className="h-4 w-4" />
                                ) : (
                                    <PanelLeftOpen className="h-4 w-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            {isSidebarOpen ? "Ocultar espaços e ganhar largura" : "Mostrar lista de espaços"}
                        </TooltipContent>
                    </Tooltip>

                    <h2 className="truncate font-heading text-lg font-bold tracking-normal text-arena-navy-800">
                        Operação do Dia
                    </h2>

                    {hiddenCourtsCount > 0 && (
                        <span className="hidden shrink-0 rounded-full bg-arena-navy-800/5 px-2 py-0.5 text-[10px] font-bold text-arena-navy-800/50 lg:inline">
                            {visibleCourtIds.size}/{sortedCourts.length} espaços
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-center">
                    <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Dia anterior"
                        onClick={handlePreviousDay}
                        className="size-9 rounded-md border-slate-200 bg-white text-arena-navy-800 shadow-sm hover:bg-slate-50"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                            <button className="flex h-9 min-w-[142px] items-center justify-center rounded-md px-3 text-sm font-semibold text-arena-navy-800 hover:bg-slate-50">
                                {format(currentDate, "dd/MM/yyyy")}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="center"
                            sideOffset={8}
                            className="w-auto overflow-hidden rounded-xl border-slate-200 p-0 shadow-2xl z-[60]"
                        >
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
                            />
                        </PopoverContent>
                    </Popover>

                    <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Próximo dia"
                        onClick={handleNextDay}
                        className="size-9 rounded-md border-slate-200 bg-white text-arena-navy-800 shadow-sm hover:bg-slate-50"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToday}
                        className={cn(
                            "h-9 rounded-md border-slate-200 px-4 text-sm font-semibold text-arena-navy-800 shadow-sm hover:bg-slate-50",
                            isToday(currentDate) && "bg-slate-50 text-arena-navy-800/60"
                        )}
                    >
                        Hoje
                    </Button>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
                    <Filter className="h-5 w-5 text-slate-400" />

                    <Popover open={sportFilterOpen} onOpenChange={setSportFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="h-9 w-[210px] justify-between rounded-md border-slate-200 bg-white px-3 text-sm font-medium text-slate-500 shadow-none hover:bg-slate-50"
                            >
                                Selecionar esportes
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" sideOffset={8} className="w-[260px] rounded-xl border-slate-200 p-0 shadow-xl z-[60]">
                            <Command>
                                <CommandInput placeholder="Buscar esporte..." />
                                <CommandList>
                                    <CommandEmpty>Nenhum esporte encontrado.</CommandEmpty>
                                    <CommandGroup>
                                        {sportOptions.map(sport => {
                                            const checked = selectedSports.has(sport);

                                            return (
                                                <CommandItem
                                                    key={sport}
                                                    value={sport}
                                                    onSelect={() => toggleSportFilter(sport)}
                                                    className="cursor-pointer"
                                                >
                                                    <span className={cn(
                                                        "flex h-4 w-4 items-center justify-center rounded border",
                                                        checked
                                                            ? "border-arena-navy-800 bg-arena-navy-800 text-white"
                                                            : "border-slate-300 bg-white"
                                                    )}>
                                                        {checked && <Check className="h-3 w-3" />}
                                                    </span>
                                                    <span className="font-medium text-arena-navy-800">{sport}</span>
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {Array.from(selectedSports).map(sport => (
                        <button
                            key={sport}
                            type="button"
                            onClick={() => removeSportFilter(sport)}
                            className="inline-flex h-9 items-center gap-2 rounded-md bg-arena-navy-800 px-3 text-xs font-bold text-white transition-colors hover:bg-arena-navy-900"
                        >
                            {sport}
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ))}

                    {canExpand && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={() => setIsExpanded(expanded => !expanded)}
                                    aria-label={isExpanded ? "Sair da tela cheia" : "Expandir para tela cheia"}
                                    className={cn(
                                        "h-9 gap-2 rounded-md px-3 text-sm font-bold shadow-none",
                                        isExpanded
                                            ? "bg-arena-navy-800/10 text-arena-navy-800 hover:bg-arena-navy-800/20"
                                            : "bg-arena-navy-800 text-white hover:bg-[#001D2C]"
                                    )}
                                >
                                    {isExpanded ? (
                                        <Minimize2 className="h-4 w-4" />
                                    ) : (
                                        <Maximize2 className="h-4 w-4" />
                                    )}
                                    <span className="hidden lg:inline">
                                        {isExpanded ? "Reduzir" : "Tela cheia"}
                                    </span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                {isExpanded ? "Sair da tela cheia (Esc)" : "Ver a grade inteira em tela cheia"}
                            </TooltipContent>
                        </Tooltip>
                    )}

                    {onClose && (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onClose}
                            aria-label="Fechar modal"
                            className="size-9 rounded-md text-arena-navy-800 hover:bg-slate-100"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </header>

            {/* Content – sidebar + grid */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── Sidebar de espaços (recolhível para liberar largura da grade) ── */}
                <div
                    className={cn(
                        "flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden transition-all duration-200",
                        isSidebarOpen ? "w-52" : "w-0 border-r-0"
                    )}
                >
                    <div className="px-4 py-3 border-b border-slate-200">
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
                            const hasBooking = filteredBookings.some(
                                b => b.court_id === court.id && blocksAvailability(b)
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
                            {/* w-full faz as colunas esticarem quando há poucos espaços;
                                o min-width por coluna mantém a rolagem horizontal quando há muitos. */}
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr>
                                        <th className="bg-arena-navy-800 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-3 min-w-[70px] w-[70px] text-center border-r border-white/10 sticky left-0 z-20">
                                            Horário
                                        </th>
                                        {visibleCourts.map(court => (
                                            <th
                                                key={court.id}
                                                title={court.name}
                                                className="bg-arena-navy-800 text-white text-xs font-bold px-4 py-3 text-center border-r border-white/10 last:border-r-0 min-w-[150px]"
                                            >
                                                <span className="line-clamp-1">{court.name}</span>
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
                                            const label = slotLabel(slot)

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
                                                    key={label}
                                                    className={cn("transition-all", hasAnyBookingStart ? "h-[72px]" : "h-[40px]")}
                                                >
                                                    <td className={cn(
                                                        "bg-white border-r border-b border-arena-navy-800/5 text-center font-bold text-[11px] sticky left-0 z-10",
                                                        hasAnyBookingStart ? "text-arena-navy-800/80" : "text-arena-navy-800/30"
                                                    )}>
                                                        {label}
                                                    </td>

                                                    {visibleCourts.map(court => {
                                                        const cellKey = `${label}:${court.id}`

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
                                                                skipSlots.add(`${slotLabel(allSlots[i])}:${court.id}`)
                                                            }

                                                            const sportName = booking.sports?.name || ''
                                                            const isReservado = booking.status === 'reservado'
                                                            const isPendingPix = booking.status === 'pending_payment'
                                                            const styles = isPendingPix
                                                                ? pendingPixStyles
                                                                : isReservado
                                                                    ? reservadoStyles
                                                                    : getSportStyles(sportName)
                                                            const responsavel = booking.atleta?.nome_perfil || booking.athlete_name || '—'

                                                            return (
                                                                <td
                                                                    key={court.id}
                                                                    rowSpan={rowspan}
                                                                    className="border-r border-arena-navy-800/5 last:border-r-0 p-1.5"
                                                                    style={{ height: '1px' }}
                                                                >
                                                                    <div
                                                                        role={interactive ? 'button' : undefined}
                                                                        tabIndex={interactive ? 0 : undefined}
                                                                        onClick={() => handleBookingClick(court, booking)}
                                                                        onKeyDown={(e) => {
                                                                            if (!interactive) return
                                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                                e.preventDefault()
                                                                                handleBookingClick(court, booking)
                                                                            }
                                                                        }}
                                                                        className={cn(
                                                                            "w-full h-full flex flex-col gap-0.5 border-l-4 px-2 py-2 rounded-lg",
                                                                            styles.bg,
                                                                            styles.border,
                                                                            interactive && "cursor-pointer transition-all hover:brightness-95"
                                                                        )}
                                                                    >
                                                                        <span className={cn("text-[10px] font-black leading-tight line-clamp-1", styles.text)}>
                                                                            {responsavel}
                                                                        </span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            {booking.price != null && (
                                                                                <span className={cn("text-[9px] font-bold", styles.textSecondary)}>
                                                                                    R$ {Number(booking.price).toFixed(0)}
                                                                                </span>
                                                                            )}
                                                                            <span className={cn("text-[9px] font-bold", styles.textSecondary)}>•</span>
                                                                            <span className={cn("text-[9px] font-bold", styles.textSecondary)}>
                                                                                {sportName || 'Esporte'}
                                                                            </span>
                                                                        </div>
                                                                        <span className={cn("text-[9px] font-medium", styles.textSecondary)}>
                                                                            {format(bStart, 'HH:mm')} – {format(bEnd, 'HH:mm')}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            )
                                                        }

                                                        const futureB = getFutureBookingForSlot(court.id, slot)

                                                        return (
                                                            <td
                                                                key={court.id}
                                                                onClick={() => handleEmptySlotClick(court, slot)}
                                                                className={cn(
                                                                    "bg-white border-r border-b border-arena-navy-800/5 last:border-r-0 relative group/slot p-0",
                                                                    interactive && "cursor-pointer hover:bg-emerald-50 transition-colors"
                                                                )}
                                                            >
                                                                {interactive && (
                                                                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-emerald-600 opacity-0 transition-opacity group-hover/slot:opacity-100">
                                                                        Disponível
                                                                    </span>
                                                                )}
                                                                {futureB && (() => {
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
                                                                                        <p className="text-[12px] font-bold leading-tight">{futureB.atleta?.nome_perfil ?? futureB.athlete_name ?? 'Atleta'}</p>
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

            {interactive && (
                <>
                    <BookingDetailsModal
                        isOpen={isDetailsModalOpen}
                        onClose={() => setIsDetailsModalOpen(false)}
                        onSuccess={handleBookingSuccess}
                        booking={selectedBooking}
                        court={detailsCourt}
                        onEdit={
                            canEditSelectedBooking
                                ? () => {
                                    if (!selectedBooking || !detailsCourt) return
                                    const s = parseISO(selectedBooking.start_time)
                                    setBookingCourt(detailsCourt)
                                    setSelectedSlotDate(s)
                                    setSelectedSlotHour(s.getHours())
                                    setSelectedSlotMinute(s.getMinutes())
                                    setSlotPrice(Number(selectedBooking.price ?? detailsCourt.price ?? 0))
                                    setBookingToEdit(selectedBooking)
                                    setIsDetailsModalOpen(false)
                                    setIsBookingModalOpen(true)
                                }
                                : undefined
                        }
                    />

                    {bookingCourt && (
                        <BookingModal
                            isOpen={isBookingModalOpen}
                            onClose={() => {
                                setIsBookingModalOpen(false)
                                setBookingToEdit(null)
                            }}
                            onSuccess={handleBookingSuccess}
                            arenaId={arenaId}
                            courtId={bookingCourt.id}
                            selectedDate={selectedSlotDate}
                            selectedHour={selectedSlotHour}
                            selectedMinute={selectedSlotMinute}
                            defaultPrice={slotPrice || Number(bookingCourt.price ?? 0)}
                            existingBooking={bookingToEdit as unknown as Booking | null}
                        />
                    )}
                </>
            )}
        </div>
    );

    return (
        <TooltipProvider delayDuration={300}>
            {/* Em tela cheia o quadro sai do fluxo; o wrapper preserva a altura da aba
                para a página não "pular" ao expandir/reduzir. */}
            <div
                className={cn(
                    isExpanded && !isModal && "h-[calc(100dvh-16rem)] min-h-[420px]"
                )}
            >
                {isExpanded && (
                    <div
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsExpanded(false)}
                        aria-hidden
                    />
                )}
                {board}
            </div>
        </TooltipProvider>
    );
}
