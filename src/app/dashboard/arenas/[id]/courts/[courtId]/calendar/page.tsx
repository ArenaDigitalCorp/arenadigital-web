"use client"

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, addDays, subDays, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO, startOfDay, getHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CourtService } from "@/modules/courts/services/courtService";
import { BookingService } from "@/modules/bookings/services/bookingService";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { BookingModal } from "@/modules/bookings/components/BookingModal";
import { BookingDetailsModal } from "@/modules/bookings/components/BookingDetailsModal";
import { AvailableTimesModal } from "@/modules/bookings/components/AvailableTimesModal";

interface Court {
    id: string;
    name: string;
    day_config: any[];
    booking_type: 'unique' | 'hourly';
    price: number;
    sports: any[];
}

interface Booking {
    id: string;
    athlete_name: string;
    start_time: string;
    end_time: string;
    status: 'confirmed' | 'cancelled' | 'pending';
    price?: number;
    sports?: {
        id: string;
        name: string;
    };
}

export default function CourtCalendarPage() {
    const params = useParams();
    const router = useRouter();
    const arenaId = params.id as string;
    const courtId = params.courtId as string;

    const [court, setCourt] = useState<Court | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

    // Modal states
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isAvailableTimesModalOpen, setIsAvailableTimesModalOpen] = useState(false);
    const [selectedSlotDate, setSelectedSlotDate] = useState<Date>(new Date());
    const [selectedSlotHour, setSelectedSlotHour] = useState<number>(0);
    const [customPrice, setCustomPrice] = useState<number>(0);

    const [isBookingDetailsModalOpen, setIsBookingDetailsModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

    useEffect(() => {
        loadData();
    }, [courtId, currentDate, viewMode]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const courtData = await CourtService.getCourtById(courtId);
            setCourt(courtData);

            let startStr, endStr;
            if (viewMode === 'day') {
                startStr = startOfDay(currentDate).toISOString();
                const end = new Date(currentDate);
                end.setHours(23, 59, 59, 999);
                endStr = end.toISOString();
            } else {
                startStr = startOfWeek(currentDate, { weekStartsOn: 1 }).toISOString();
                endStr = endOfWeek(currentDate, { weekStartsOn: 1 }).toISOString();
            }

            const bookingsData = await BookingService.getBookingsByCourt(courtId, startStr, endStr);
            setBookings(bookingsData || []);
        } catch (error) {
            console.error("Failed to load data", error);
            toast.error("Erro ao carregar agenda.");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrevious = () => {
        setCurrentDate(prev => viewMode === 'day' ? subDays(prev, 1) : subWeeks(prev, 1));
    };

    const handleNext = () => {
        setCurrentDate(prev => viewMode === 'day' ? addDays(prev, 1) : addWeeks(prev, 1));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const handleSlotClick = (date: Date, hour: number) => {
        const booking = getBookingForSlot(date, hour);
        if (booking) {
            setSelectedBooking(booking);
            setIsBookingDetailsModalOpen(true);
            return;
        }

        const slotPrice = getSlotPrice(date, hour);
        setSelectedSlotDate(date);
        setSelectedSlotHour(hour);
        setCustomPrice(slotPrice);
        setIsBookingModalOpen(true);
    };

    // Helper to check if an hour has any booking in the current view
    const hasBookingInHour = (hour: number) => {
        if (viewMode === 'day') {
            return !!getBookingForSlot(currentDate, hour);
        } else {
            return weekDays.some(day => !!getBookingForSlot(day, hour));
        }
    };

    // Helper to check if a slot is booked
    const getBookingForSlot = (date: Date, hour: number) => {
        return bookings.find(b => {
            const bookingStart = parseISO(b.start_time);
            const bookingEnd = parseISO(b.end_time);

            // Check if same day
            if (!isSameDay(bookingStart, date)) return false;
            if (b.status === 'cancelled') return false;

            const startH = getHours(bookingStart);
            const endH = getHours(bookingEnd);

            // A booking from 14:00 to 16:00 occupies 14:00 and 15:00 slots
            return hour >= startH && hour < endH;
        });
    };

    // Helper to get price for a specific slot
    const getSlotPrice = (date: Date, hour: number) => {
        if (!court?.day_config) return court?.price || 0;

        const dayName = format(date, 'EEEE', { locale: ptBR });
        const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);

        const config = court.day_config.find((d: any) => d.day.toLowerCase() === formattedDayName.toLowerCase());

        if (!config || !config.enabled) return court.price || 0;

        // Check for custom hourly price
        // Custom prices are stored as { start: "HH:mm", end: "HH:mm", price: number }
        const customPrice = config.customPrices?.find((p: any) => {
            if (!p.start || !p.end) return false;
            const startHour = parseInt(p.start.split(':')[0]);
            const endHour = parseInt(p.end.split(':')[0]);
            return hour >= startHour && hour < endHour;
        });

        if (customPrice) return customPrice.price;

        return config.price || court.price || 0;
    };

    // Helper to check if a slot is unavailable based on day_config
    const isSlotAvailable = (date: Date, hour: number) => {
        if (!court?.day_config) return true; // Default available if no config

        const dayName = format(date, 'EEEE', { locale: ptBR });
        // Capitalize first letter to match config (Segunda-feira)
        const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);

        const config = court.day_config.find((d: any) => d.day.toLowerCase() === formattedDayName.toLowerCase());

        if (!config || !config.enabled) return false;

        const startHour = parseInt(config.startTime.split(':')[0]);
        const endHour = parseInt(config.endTime.split(':')[0]);

        return hour >= startHour && hour < endHour;
    };

    const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i);
        return date;
    });

    if (isLoading && !court) {
        return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;
    }

    if (!court) return <div className="p-8">Quadra não encontrada.</div>;

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] min-h-screen">
            {/* Header */}
            <header className="bg-white border-b border-[#002B40]/10 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-[#002B40]/60 hover:bg-[#002B40]/5">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-black text-[#002B40]">{court.name}</h1>
                        <p className="text-sm text-[#002B40]/60 font-medium">Gerenciamento de agenda</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-[#F1F5F9] rounded-lg p-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode('day')}
                            className={cn("text-xs font-bold", viewMode === 'day' ? "bg-white shadow-sm text-[#002B40]" : "text-[#002B40]/60 hover:text-[#002B40]")}
                        >
                            Dia
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode('week')}
                            className={cn("text-xs font-bold", viewMode === 'week' ? "bg-white shadow-sm text-[#002B40]" : "text-[#002B40]/60 hover:text-[#002B40]")}
                        >
                            Semana
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={handlePrevious} className="h-9 w-9">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="px-4 font-bold text-[#002B40] min-w-[140px] text-center">
                            {viewMode === 'day'
                                ? format(currentDate, "dd 'de' MMMM", { locale: ptBR })
                                : `${format(weekDays[0], "dd/MM")} - ${format(weekDays[6], "dd/MM")}`
                            }
                        </div>
                        <Button variant="outline" size="icon" onClick={handleNext} className="h-9 w-9">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>

                    <Button variant="outline" onClick={handleToday} className="text-[#002B40]">Hoje</Button>

                    <div className="h-6 w-px bg-[#002B40]/10 mx-2" />

                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => setIsAvailableTimesModalOpen(true)}
                            className="bg-[#002B40] hover:bg-[#001D2C] text-white font-bold gap-2"
                        >
                            <Clock className="w-4 h-4" />
                            Horários disponíveis
                        </Button>
                        <Button onClick={() => setIsBookingModalOpen(true)} className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold">
                            Cadastrar reserva
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex-1 p-8 overflow-auto">
                <Card className="border-none shadow-sm bg-white overflow-hidden min-w-[800px]">
                    {/* Header Row */}
                    <div className="grid grid-cols-[80px_1fr] border-b border-[#002B40]/5">
                        <div className="p-4 border-r border-[#002B40]/5 font-bold text-[#002B40]/40 text-xs text-center flex items-center justify-center bg-[#F8FAFC]">
                            Horário
                        </div>
                        <div className={cn("grid", viewMode === 'day' ? "grid-cols-1" : "grid-cols-7")}>
                            {viewMode === 'day' ? (
                                <div className="p-4 font-bold text-[#002B40] text-sm text-center bg-[#F8FAFC] capitalize">
                                    {format(currentDate, "EEEE (dd/MM)", { locale: ptBR })}
                                </div>
                            ) : (
                                weekDays.map((day, i) => (
                                    <div key={i} className="p-4 font-bold text-[#002B40] text-sm text-center border-r border-[#002B40]/5 last:border-none bg-[#F8FAFC]">
                                        <div className="capitalize">{format(day, "EEEE", { locale: ptBR })}</div>
                                        <div className="text-[#002B40]/40 text-xs font-normal">({format(day, "dd/MM")})</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Time Slots */}
                    {hours.map((hour) => {
                        const hasBooking = hasBookingInHour(hour);
                        return (
                            <div key={hour} className={cn(
                                "grid grid-cols-[80px_1fr] border-b border-[#002B40]/5 last:border-none transition-all",
                                hasBooking ? "min-h-[80px]" : "min-h-[40px]"
                            )}>
                                {/* Time Column */}
                                <div className={cn(
                                    "p-2 border-r border-[#002B40]/5 font-bold text-[#002B40]/60 text-[10px] text-center flex items-center justify-center bg-white transition-all",
                                    !hasBooking && "text-[#002B40]/30"
                                )}>
                                    {String(hour).padStart(2, '0')}:00
                                </div>

                                {/* Cells */}
                                <div className={cn("grid", viewMode === 'day' ? "grid-cols-1" : "grid-cols-7")}>
                                    {viewMode === 'day' ? (
                                        <TimeSlot
                                            date={currentDate}
                                            hour={hour}
                                            booking={getBookingForSlot(currentDate, hour)}
                                            available={isSlotAvailable(currentDate, hour)}
                                            court={court}
                                            onClick={() => handleSlotClick(currentDate, hour)}
                                            className={cn(!hasBooking && "p-0")}
                                        />
                                    ) : (
                                        weekDays.map((day, i) => (
                                            <TimeSlot
                                                key={i}
                                                date={day}
                                                hour={hour}
                                                booking={getBookingForSlot(day, hour)}
                                                available={isSlotAvailable(day, hour)}
                                                court={court}
                                                className={cn("border-r border-[#002B40]/5 last:border-none", !hasBooking && "p-0")}
                                                onClick={() => handleSlotClick(day, hour)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </Card>
            </div>

            <BookingDetailsModal
                isOpen={isBookingDetailsModalOpen}
                onClose={() => setIsBookingDetailsModalOpen(false)}
                onSuccess={loadData}
                booking={selectedBooking}
                court={court}
            />

            <BookingModal
                isOpen={isBookingModalOpen}
                onClose={() => setIsBookingModalOpen(false)}
                onSuccess={loadData}
                arenaId={arenaId}
                courtId={courtId}
                selectedDate={selectedSlotDate}
                selectedHour={selectedSlotHour}
                defaultPrice={customPrice || court.price || 0}
            />

            <AvailableTimesModal
                isOpen={isAvailableTimesModalOpen}
                onClose={() => setIsAvailableTimesModalOpen(false)}
                arenaId={arenaId}
                currentDate={currentDate}
            />
        </div>
    );
}

const getSportStyles = (sportName: string) => {
    const normalizedName = sportName.toLowerCase();

    if (normalizedName.includes('beach tennis')) {
        return {
            bg: 'bg-[#FFF7ED]',
            border: 'border-[#FB923C]',
            text: 'text-[#C2410C]',
            textSecondary: 'text-[#C2410C]/60'
        };
    }
    if (normalizedName.includes('futev') || normalizedName.includes('futevôlei')) {
        return {
            bg: 'bg-[#EFF6FF]',
            border: 'border-[#60A5FA]',
            text: 'text-[#1D4ED8]',
            textSecondary: 'text-[#1D4ED8]/60'
        };
    }
    if (normalizedName.includes('vôlei') || normalizedName.includes('volei')) {
        return {
            bg: 'bg-[#FEFCE8]',
            border: 'border-[#FACC15]',
            text: 'text-[#A16207]',
            textSecondary: 'text-[#A16207]/60'
        };
    }
    if (normalizedName.includes('tênis') || normalizedName.includes('tenis')) {
        return {
            bg: 'bg-[#F0FDF4]',
            border: 'border-[#4ADE80]',
            text: 'text-[#15803D]',
            textSecondary: 'text-[#15803D]/60'
        };
    }
    if (normalizedName.includes('padel')) {
        return {
            bg: 'bg-[#FAF5FF]',
            border: 'border-[#C084FC]',
            text: 'text-[#7E22CE]',
            textSecondary: 'text-[#7E22CE]/60'
        };
    }

    // Default
    return {
        bg: 'bg-[#F1F5F9]',
        border: 'border-[#94A3B8]',
        text: 'text-[#334155]',
        textSecondary: 'text-[#334155]/60'
    };
};

function TimeSlot({ date, hour, booking, available, court, className, onClick }: { date: Date, hour: number, booking?: Booking, available: boolean, court: Court, className?: string, onClick?: () => void }) {
    if (!available) {
        return (
            <div className={cn("bg-[#E2E8F0] flex items-center justify-center p-2 opacity-40", className)}>
            </div>
        );
    }

    if (booking) {
        const startH = getHours(parseISO(booking.start_time));
        const endH = getHours(parseISO(booking.end_time));
        const isStart = hour === startH;
        const isEnd = hour === endH - 1;

        const sportStyles = getSportStyles(booking.sports?.name || court.sports?.[0]?.name || '');

        return (
            <div className={cn("px-1", className)} onClick={onClick}>
                <div className={cn(
                    "w-full h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:brightness-95 transition-all border-l-4",
                    sportStyles.bg,
                    sportStyles.border,
                    isStart ? "rounded-t pt-2" : "border-t-transparent",
                    isEnd ? "rounded-b pb-2" : "border-b-transparent"
                )}>
                    {isStart && (
                        <>
                            <span className={cn("text-[9px] font-black uppercase tracking-wider leading-none", sportStyles.textSecondary)}>Reservado</span>
                            <span className={cn("text-[11px] font-bold text-center line-clamp-1 px-1", sportStyles.text)}>
                                {booking.athlete_name} {booking.price !== undefined && `| R$ ${booking.price}`}
                            </span>
                            <span className={cn("text-[9px] font-bold leading-none", sportStyles.textSecondary)}>{booking.sports?.name || court.sports?.[0]?.name || 'Esporte'}</span>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("p-1 group", className)} onClick={onClick}>
            <div className="w-full h-full flex items-center justify-center rounded hover:bg-emerald-50 cursor-pointer transition-colors group-hover:border-emerald-200 border border-transparent">
                <span className="text-xs font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">Disponível</span>
            </div>
        </div>
    );
}
