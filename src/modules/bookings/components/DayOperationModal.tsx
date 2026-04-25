"use client"

import { useEffect, useState, useMemo } from "react";
import { format, parseISO, getHours, getDay, addDays, subDays, addMonths, isToday } from "date-fns";
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

export function DayOperationModal({ isOpen, onClose, arenaId, arenaName, courts }: DayOperationModalProps) {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [futureBookings, setFutureBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarOpen, setCalendarOpen] = useState(false);

    // Sort courts alphabetically
    const sortedCourts = useMemo(() => {
        return [...courts].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [courts]);

    // Reset to today when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentDate(new Date());
        }
    }, [isOpen]);

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

    // Próxima reserva futura no mesmo dia da semana + mesma hora + mesma quadra
    const getFutureBookingForSlot = (courtId: string, hour: number): Booking | null => {
        const targetDayOfWeek = getDay(currentDate);
        return futureBookings.find(b => {
            if (b.court_id !== courtId) return false;
            const bStart = parseISO(b.start_time);
            return getDay(bStart) === targetDayOfWeek
                && getHours(bStart) === hour
                && bStart > currentDate;
        }) ?? null;
    };

    const handlePreviousDay = () => setCurrentDate(prev => subDays(prev, 1));
    const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));
    const handleToday = () => setCurrentDate(new Date());

    const hours = Array.from({ length: 24 }, (_, i) => i);

    const getBookingForSlot = (courtId: string, hour: number): Booking | undefined => {
        const slotStart = new Date(currentDate);
        slotStart.setHours(hour, 0, 0, 0);

        return bookings.find(b => {
            if (b.court_id !== courtId) return false;
            if (b.status === 'cancelled') return false;

            const bStart = parseISO(b.start_time);
            const bEnd = parseISO(b.end_time);

            return slotStart >= bStart && slotStart < bEnd;
        });
    };

    // Check if court is available at given hour (based on day_config)
    const isSlotAvailable = (court: Court, hour: number) => {
        if (!court.day_config || !Array.isArray(court.day_config) || court.day_config.length === 0) {
            return true;
        }

        const dayName = format(currentDate, 'EEEE', { locale: ptBR });
        const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        const config = court.day_config.find((d: any) => d.day.toLowerCase() === formattedDayName.toLowerCase());

        if (!config || !config.enabled) return false;

        const startHour = parseInt(config.startTime.split(':')[0]);
        const endHour = parseInt(config.endTime.split(':')[0]);

        if (startHour < endHour) {
            return hour >= startHour && hour < endHour;
        }

        // Overnight
        if (startHour > endHour) {
            return hour >= startHour || hour < endHour;
        }

        return false;
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
                <header className="bg-gradient-to-r from-[#002B40] to-[#004060] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
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

                {/* Content – scroll both axes */}
                <div className="flex-1 overflow-auto bg-[#F8FAFC]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-[#002B40]/40" />
                            <span className="text-[#002B40]/60 font-medium">Carregando operação...</span>
                        </div>
                    ) : (
                        <div className="inline-block min-w-full">
                            <table className="border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr>
                                        <th className="bg-[#002B40] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-3 min-w-[70px] w-[70px] text-center border-r border-white/10 sticky left-0 z-20">
                                            Horário
                                        </th>
                                        {sortedCourts.map(court => (
                                            <th
                                                key={court.id}
                                                className="bg-[#002B40] text-white text-xs font-bold px-4 py-3 text-center border-r border-white/10 last:border-r-0 min-w-[180px]"
                                            >
                                                {court.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {hours.map(hour => {
                                        const hasAnyBooking = sortedCourts.some(court => !!getBookingForSlot(court.id, hour));
                                        const hasAnyAvailable = sortedCourts.some(court => isSlotAvailable(court, hour));

                                        if (!hasAnyAvailable && !hasAnyBooking) return null;

                                        return (
                                            <tr
                                                key={hour}
                                                className={cn(
                                                    "transition-all",
                                                    hasAnyBooking ? "h-[72px]" : "h-[40px]"
                                                )}
                                            >
                                                <td className={cn(
                                                    "bg-white border-r border-b border-[#002B40]/5 text-center font-bold text-[11px] sticky left-0 z-10",
                                                    hasAnyBooking ? "text-[#002B40]/80" : "text-[#002B40]/30"
                                                )}>
                                                    {String(hour).padStart(2, '0')}:00
                                                </td>

                                                {sortedCourts.map(court => {
                                                    const booking = getBookingForSlot(court.id, hour);
                                                    const available = isSlotAvailable(court, hour);

                                                    if (!available && !booking) {
                                                        return (
                                                            <td key={court.id} className="bg-[#E2E8F0]/50 border-r border-b border-[#002B40]/5 last:border-r-0">
                                                            </td>
                                                        );
                                                    }

                                                    if (booking) {
                                                        const bStart = getHours(parseISO(booking.start_time));
                                                        const bEnd = getHours(parseISO(booking.end_time));
                                                        const isStart = hour === bStart;
                                                        const isEnd = hour === bEnd - 1;
                                                        const sportName = booking.sports?.name || '';
                                                        const sportStyles = getSportStyles(sportName);

                                                        const responsavel = booking.atleta?.nome_perfil || booking.athlete_name || '—';
                                                        const startStr = format(parseISO(booking.start_time), 'HH:mm');
                                                        const endStr = format(parseISO(booking.end_time), 'HH:mm');

                                                        return (
                                                            <td key={court.id} className="border-r border-[#002B40]/5 last:border-r-0 px-1 py-0">
                                                                <div className={cn(
                                                                    "w-full h-full flex flex-col justify-center gap-0.5 border-l-4 px-2",
                                                                    sportStyles.bg,
                                                                    sportStyles.border,
                                                                    isStart ? "rounded-t pt-2 border-t" : "border-t-transparent",
                                                                    isEnd ? "rounded-b pb-2 border-b" : "border-b-transparent",
                                                                    !isStart && !isEnd && "border-y-transparent",
                                                                    hasAnyBooking ? "min-h-[72px]" : "min-h-[40px]"
                                                                )}>
                                                                    {isStart && (
                                                                        <>
                                                                            <span className={cn("text-[10px] font-black leading-tight line-clamp-1", sportStyles.text)}>
                                                                                {responsavel}
                                                                            </span>
                                                                            <div className="flex items-center gap-1.5">
                                                                                {booking.price !== undefined && booking.price !== null && (
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
                                                                                {startStr} – {endStr}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    }

                                                    return (
                                                        <td key={court.id} className="bg-white border-r border-b border-[#002B40]/5 last:border-r-0 relative group/slot">
                                                            {(() => {
                                                                const futureB = getFutureBookingForSlot(court.id, hour);
                                                                if (!futureB) return null;
                                                                const fStart = parseISO(futureB.start_time);
                                                                const fEnd = parseISO(futureB.end_time);
                                                                return (
                                                                    <TooltipProvider delayDuration={200}>
                                                                        <Tooltip>
                                                                            <TooltipTrigger
                                                                                asChild
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <div className="absolute top-1.5 right-1.5 z-10 cursor-default">
                                                                                    <div
                                                                                        className="h-2 w-2 rounded-full bg-indigo-300 animate-pulse"
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
                                                                                        {futureB.athlete_name ?? 'Atleta'}
                                                                                    </p>
                                                                                    <p className="text-[10px] text-white/70 font-medium">
                                                                                        {format(fStart, "EEE, dd/MM", { locale: ptBR })} &middot; {format(fStart, "HH:mm")}&ndash;{format(fEnd, "HH:mm")}
                                                                                    </p>
                                                                                </div>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                );
                                                            })()}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Mobile legend */}
                {uniqueSports.length > 0 && (
                    <div className="md:hidden bg-white border-t border-[#002B40]/10 px-4 py-3 flex flex-wrap items-center gap-3 flex-shrink-0 rounded-b-2xl">
                        {uniqueSports.map(sport => {
                            const styles = getSportStyles(sport);
                            return (
                                <div key={sport} className="flex items-center gap-1.5">
                                    <div className={cn("w-2.5 h-2.5 rounded-full", styles.dot)} />
                                    <span className="text-[#002B40]/70 text-xs font-medium">{sport}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
