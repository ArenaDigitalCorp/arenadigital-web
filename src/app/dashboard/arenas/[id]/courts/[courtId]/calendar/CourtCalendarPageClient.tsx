"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, addDays, subDays, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO, startOfDay, getHours } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { BookingModal } from "@/modules/bookings/components/BookingModal"
import { BookingDetailsModal } from "@/modules/bookings/components/BookingDetailsModal"
import { AvailableTimesModal } from "@/modules/bookings/components/AvailableTimesModal"
import { DayOpportunitiesModal } from "@/modules/bookings/components/DayOpportunitiesModal"
import { getBookingsByCourtAction } from "@/modules/bookings/actions/bookingActions"
import type { Json } from '@/types/supabase.types'

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

const getSportStyles = (sportName: string) => {
    const n = sportName.toLowerCase()
    if (n.includes('beach tennis')) return { bg: 'bg-[#FFF7ED]', border: 'border-[#FB923C]', text: 'text-[#C2410C]', textSecondary: 'text-[#C2410C]/60' }
    if (n.includes('futev')) return { bg: 'bg-[#EFF6FF]', border: 'border-[#60A5FA]', text: 'text-[#1D4ED8]', textSecondary: 'text-[#1D4ED8]/60' }
    if (n.includes('vôlei') || n.includes('volei')) return { bg: 'bg-[#FEFCE8]', border: 'border-[#FACC15]', text: 'text-[#A16207]', textSecondary: 'text-[#A16207]/60' }
    if (n.includes('tênis') || n.includes('tenis')) return { bg: 'bg-[#F0FDF4]', border: 'border-[#4ADE80]', text: 'text-[#15803D]', textSecondary: 'text-[#15803D]/60' }
    if (n.includes('padel')) return { bg: 'bg-[#FAF5FF]', border: 'border-[#C084FC]', text: 'text-[#7E22CE]', textSecondary: 'text-[#7E22CE]/60' }
    return { bg: 'bg-[#F1F5F9]', border: 'border-[#94A3B8]', text: 'text-[#334155]', textSecondary: 'text-[#334155]/60' }
}

function TimeSlot({ date, hour, booking, available, court, className, onClick }: {
    date: Date; hour: number; booking?: Booking; available: boolean; court: Court; className?: string; onClick?: () => void
}) {
    if (!available) {
        return <div className={cn("bg-[#E2E8F0] flex items-center justify-center p-2 opacity-40 border-b border-[#002B40]/5", className)} />
    }
    if (booking) {
        const startH = getHours(parseISO(booking.start_time))
        const endH = getHours(parseISO(booking.end_time))
        const isStart = hour === startH
        const isEnd = hour === endH - 1
        const sportStyles = getSportStyles(booking.sports?.name || court.sports?.[0]?.name || '')
        return (
            <div className={cn("px-1 h-full", isEnd && "border-b border-[#002B40]/5", className)} onClick={onClick}>
                <div className={cn(
                    "w-full h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:brightness-95 transition-all border-l-4",
                    sportStyles.bg, sportStyles.border,
                    isStart ? "rounded-t pt-2 border-t" : "border-t-transparent",
                    isEnd ? "rounded-b pb-2 border-b" : "border-b-transparent",
                    !isStart && !isEnd && "border-y-transparent"
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
        )
    }
    return (
        <div className={cn("p-1 group border-b border-[#002B40]/5", className)} onClick={onClick}>
            <div className="w-full h-full min-h-[40px] flex items-center justify-center rounded hover:bg-emerald-50 cursor-pointer transition-colors group-hover:border-emerald-200 border border-transparent">
                <span className="text-xs font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">Disponível</span>
            </div>
        </div>
    )
}

export function CourtCalendarPageClient({ arenaId, courtId, initialCourt, initialBookings, initialDate }: Props) {
    const router = useRouter()
    const court = initialCourt
    const [bookings, setBookings] = useState<Booking[]>(initialBookings as Booking[])
    const [currentDate, setCurrentDate] = useState(new Date(initialDate))
    const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
    const [isAvailableTimesModalOpen, setIsAvailableTimesModalOpen] = useState(false)
    const [selectedSlotDate, setSelectedSlotDate] = useState<Date>(new Date(initialDate))
    const [selectedSlotHour, setSelectedSlotHour] = useState(0)
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

    const getBookingForSlot = (date: Date, hour: number) => {
        const slotStart = new Date(date)
        slotStart.setHours(hour, 0, 0, 0)
        return bookings.find(b => {
            if (b.status === 'cancelled') return false
            const bookingStart = parseISO(b.start_time)
            const bookingEnd = parseISO(b.end_time)
            return slotStart >= bookingStart && slotStart < bookingEnd
        })
    }

    const getSlotPrice = (date: Date, hour: number) => {
        if (!court.day_config) return court.price || 0
        const dayName = format(date, 'EEEE', { locale: ptBR })
        const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1)
        const config = (court.day_config as any[]).find((d: any) => d.day.toLowerCase() === formattedDayName.toLowerCase())
        if (!config || !config.enabled) return court.price || 0

        const startHour = parseInt(config.startTime.split(':')[0])
        const endHour = parseInt(config.endTime.split(':')[0])
        let currentConfig = config

        if (startHour > endHour && hour < endHour) {
            const prevDate = addDays(date, -1)
            const prevDayName = format(prevDate, 'EEEE', { locale: ptBR })
            const prevConfig = (court.day_config as any[]).find((d: any) =>
                d.day.toLowerCase() === (prevDayName.charAt(0).toUpperCase() + prevDayName.slice(1)).toLowerCase()
            )
            if (prevConfig?.enabled) currentConfig = prevConfig
        }

        const customPrice = currentConfig.customPrices?.find((p: any) => {
            if (!p.start || !p.end) return false
            return hour >= parseInt(p.start.split(':')[0]) && hour < parseInt(p.end.split(':')[0])
        })

        return customPrice ? customPrice.price : (currentConfig.price || court.price || 0)
    }

    const isSlotAvailable = (date: Date, hour: number) => {
        if (!court.day_config) return true
        const dayName = format(date, 'EEEE', { locale: ptBR })
        const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1)
        const config = (court.day_config as any[]).find((d: any) => d.day.toLowerCase() === formattedDayName.toLowerCase())
        if (!config) return false

        const startHour = parseInt(config.startTime.split(':')[0])
        const endHour = parseInt(config.endTime.split(':')[0])

        if (startHour < endHour) return config.enabled && hour >= startHour && hour < endHour
        if (startHour > endHour) {
            if (hour >= startHour) return config.enabled
            if (hour < endHour) {
                const prevDate = addDays(date, -1)
                const prevDayName = format(prevDate, 'EEEE', { locale: ptBR })
                const prevConfig = (court.day_config as any[]).find((d: any) =>
                    d.day.toLowerCase() === (prevDayName.charAt(0).toUpperCase() + prevDayName.slice(1)).toLowerCase()
                )
                const prevStart = parseInt(prevConfig?.startTime.split(':')[0] || "0")
                const prevEnd = parseInt(prevConfig?.endTime.split(':')[0] || "0")
                return prevConfig?.enabled && prevStart > prevEnd && hour < prevEnd
            }
        }
        return false
    }

    const handleSlotClick = (date: Date, hour: number) => {
        const booking = getBookingForSlot(date, hour)
        if (booking) {
            setSelectedBooking(booking)
            setIsBookingDetailsModalOpen(true)
            return
        }
        setSelectedSlotDate(date)
        setSelectedSlotHour(hour)
        setCustomPrice(getSlotPrice(date, hour))
        setIsBookingModalOpen(true)
    }

    const hasBookingInHour = (hour: number) => {
        if (viewMode === 'day') return !!getBookingForSlot(currentDate, hour)
        return weekDays.some(day => !!getBookingForSlot(day, hour))
    }

    const hours = Array.from({ length: 24 }, (_, i) => i)
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i))

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] min-h-screen">
            <header className="bg-white border-b border-[#002B40]/10 px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-16 z-10">
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
                        <Button variant="ghost" size="sm" onClick={() => handleViewMode('day')} className={cn("text-xs font-bold", viewMode === 'day' ? "bg-white shadow-sm text-[#002B40]" : "text-[#002B40]/60")}>Dia</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleViewMode('week')} className={cn("text-xs font-bold", viewMode === 'week' ? "bg-white shadow-sm text-[#002B40]" : "text-[#002B40]/60")}>Semana</Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={handlePrevious} className="h-9 w-9"><ChevronLeft className="w-4 h-4" /></Button>
                        <div className="px-4 font-bold text-[#002B40] min-w-[140px] text-center">
                            {viewMode === 'day'
                                ? format(currentDate, "dd 'de' MMMM", { locale: ptBR })
                                : `${format(weekDays[0], "dd/MM")} - ${format(weekDays[6], "dd/MM")}`}
                        </div>
                        <Button variant="outline" size="icon" onClick={handleNext} className="h-9 w-9"><ChevronRight className="w-4 h-4" /></Button>
                    </div>

                    <Button variant="outline" onClick={handleToday} className="text-[#002B40]">Hoje</Button>
                    <div className="h-6 w-px bg-[#002B40]/10 mx-2" />

                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <Button onClick={() => setIsAvailableTimesModalOpen(true)} className="bg-[#002B40] hover:bg-[#001D2C] text-white font-bold gap-2 text-xs md:text-sm h-9 md:h-10">
                            <Clock className="w-4 h-4" />
                            <span className="hidden sm:inline">Horários disponíveis</span>
                            <span className="sm:hidden">Horários</span>
                        </Button>
                        <Button onClick={() => setIsDayOpportunitiesModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-2 text-xs md:text-sm h-9 md:h-10">
                            <Check className="w-4 h-4" />
                            <span className="hidden sm:inline">Oportunidades</span>
                            <span className="sm:hidden">Oportuns</span>
                        </Button>
                        <Button onClick={() => setIsBookingModalOpen(true)} className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold text-xs md:text-sm h-9 md:h-10">Reservar</Button>
                    </div>
                </div>
            </header>

            <div className="flex-1 p-4 md:p-8 overflow-x-auto overflow-y-auto">
                <Card className="border-none shadow-sm bg-white overflow-hidden min-w-[320px] sm:min-w-[800px] flex flex-col gap-0">
                    <div className="grid grid-cols-[80px_1fr] border-b border-[#002B40]/5">
                        <div className="p-4 border-r border-[#002B40]/5 font-bold text-[#002B40]/40 text-xs text-center flex items-center justify-center bg-[#F8FAFC]">Horário</div>
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

                    {hours.map((hour) => {
                        const hasBooking = hasBookingInHour(hour)
                        return (
                            <div key={hour} className={cn("grid grid-cols-[80px_1fr] last:border-none transition-all", hasBooking ? "min-h-[80px]" : "min-h-[40px]")}>
                                <div className={cn("p-2 border-r border-b border-[#002B40]/5 font-bold text-[#002B40]/60 text-[10px] text-center flex items-center justify-center bg-white", !hasBooking && "text-[#002B40]/30")}>
                                    {String(hour).padStart(2, '0')}:00
                                </div>
                                <div className={cn("grid", viewMode === 'day' ? "grid-cols-1" : "grid-cols-7")}>
                                    {viewMode === 'day' ? (
                                        <TimeSlot date={currentDate} hour={hour} booking={getBookingForSlot(currentDate, hour)} available={isSlotAvailable(currentDate, hour)} court={court} onClick={() => handleSlotClick(currentDate, hour)} className={cn(!hasBooking && "p-0")} />
                                    ) : (
                                        weekDays.map((day, i) => (
                                            <TimeSlot key={i} date={day} hour={hour} booking={getBookingForSlot(day, hour)} available={isSlotAvailable(day, hour)} court={court} className={cn("border-r border-[#002B40]/5 last:border-none", !hasBooking && "p-0")} onClick={() => handleSlotClick(day, hour)} />
                                        ))
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </Card>
            </div>

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
                defaultPrice={customPrice || court.price || 0}
            />

            <AvailableTimesModal
                isOpen={isAvailableTimesModalOpen}
                onClose={() => setIsAvailableTimesModalOpen(false)}
                arenaId={arenaId}
                currentDate={currentDate}
            />

            <DayOpportunitiesModal
                isOpen={isDayOpportunitiesModalOpen}
                onClose={() => setIsDayOpportunitiesModalOpen(false)}
                bookings={bookings.filter(b => isSameDay(parseISO(b.start_time), currentDate))}
                currentDate={currentDate}
            />
        </div>
    )
}
