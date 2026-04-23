"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { format, startOfDay, subYears } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, MessageCircle, Loader2, Users } from "lucide-react"
import { getBookingsByCourtAction } from "@/modules/bookings/actions/bookingActions"

interface Booking {
    id: string
    athlete_name: string | null
    athlete_id?: string | null
    start_time: string
    end_time: string
    status: string | null
    atleta?: {
        id: string
        nome_perfil: string
        telefone: string
    } | null
    sports?: { id: string; name: string }
}

interface Lead {
    key: string
    athleteId: string | null
    athleteName: string
    phone: string
    freeSlots: number[]
    lastBookingDate: string
}

interface Props {
    isOpen: boolean
    onClose: () => void
    arenaId: string
    courtId: string
    currentDate: Date
    todayBookings: Booking[]
}

export function DayOpportunitiesModal({ isOpen, onClose, arenaId, courtId, currentDate, todayBookings }: Props) {
    const [leads, setLeads] = useState<Lead[]>([])
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (isOpen) {
            loadOpportunities()
        }
    }, [isOpen])

    async function loadOpportunities() {
        setIsLoading(true)
        setLeads([])
        try {
            const historyStart = subYears(currentDate, 1).toISOString()
            const historyEnd = startOfDay(currentDate).toISOString()

            const result = await getBookingsByCourtAction(arenaId, courtId, historyStart, historyEnd)
            if (!result.success || !result.data) return

            const targetDayOfWeek = currentDate.getDay()

            // All hours occupied today (by the hour block they start/span)
            const occupiedHours = new Set<number>()
            for (const b of todayBookings) {
                if (b.status === 'cancelled') continue
                const startH = new Date(b.start_time).getHours()
                const endH = new Date(b.end_time).getHours()
                for (let h = startH; h < endH; h++) occupiedHours.add(h)
            }

            // Athlete IDs already booked today (to exclude them from leads)
            const todayAthleteIds = new Set<string>(
                todayBookings
                    .filter(b => b.status !== 'cancelled' && b.athlete_id)
                    .map(b => b.athlete_id!)
            )

            // Build leads map: athlete key → Lead
            const athleteMap = new Map<string, Lead>()

            for (const b of result.data) {
                if (b.status === 'cancelled') continue
                if (!b.atleta?.telefone) continue

                const bDate = new Date(b.start_time)
                if (bDate.getDay() !== targetDayOfWeek) continue

                const bHour = bDate.getHours()
                if (occupiedHours.has(bHour)) continue

                if (b.athlete_id && todayAthleteIds.has(b.athlete_id)) continue

                const key = b.athlete_id ?? (b.atleta?.nome_perfil || b.athlete_name || '')
                const name = b.atleta?.nome_perfil || b.athlete_name || ''
                const phone = b.atleta.telefone

                if (!key || !phone) continue

                if (!athleteMap.has(key)) {
                    athleteMap.set(key, {
                        key,
                        athleteId: b.athlete_id ?? null,
                        athleteName: name,
                        phone,
                        freeSlots: [bHour],
                        lastBookingDate: b.start_time,
                    })
                } else {
                    const existing = athleteMap.get(key)!
                    if (!existing.freeSlots.includes(bHour)) existing.freeSlots.push(bHour)
                    if (new Date(b.start_time) > new Date(existing.lastBookingDate)) {
                        existing.lastBookingDate = b.start_time
                    }
                }
            }

            const sorted = Array.from(athleteMap.values()).sort(
                (a, b) => new Date(b.lastBookingDate).getTime() - new Date(a.lastBookingDate).getTime()
            )
            setLeads(sorted)
        } finally {
            setIsLoading(false)
        }
    }

    const handleWhatsApp = (phone: string, name: string, freeSlots: number[]) => {
        const cleanPhone = phone.replace(/\D/g, '')
        const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone
        const dayName = format(currentDate, "EEEE", { locale: ptBR })
        const slotsStr = [...freeSlots].sort((a, b) => a - b)
            .map(h => `${String(h).padStart(2, '0')}h`)
            .join(', ')
        const message = `Olá ${name}! Temos horário(s) disponível(is) na Arena nesta ${dayName}: ${slotsStr}. Gostaria de agendar?`
        window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, '_blank')
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-[#F8FAFC]">
                <DialogHeader className="p-6 bg-white border-b border-[#002B40]/5">
                    <div className="space-y-1">
                        <DialogTitle className="text-xl font-black text-[#002B40] tracking-tight">
                            Oportunidades
                        </DialogTitle>
                        <p className="text-sm font-medium text-[#002B40]/60 flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4" />
                            {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} · horários livres
                        </p>
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                            <p className="text-sm text-[#002B40]/60 font-medium">Buscando oportunidades...</p>
                        </div>
                    ) : leads.length > 0 ? (
                        <div className="space-y-3">
                            <p className="text-xs font-bold uppercase text-[#002B40]/40 tracking-wider pb-1">
                                {leads.length} atleta{leads.length !== 1 ? 's' : ''} com histórico nos horários livres
                            </p>
                            {leads.map((lead) => (
                                <div key={lead.key} className="bg-white p-4 rounded-2xl border border-[#002B40]/5 shadow-sm flex items-center justify-between gap-4 hover:border-emerald-200 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                            <Users className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-[#002B40] text-sm truncate">{lead.athleteName}</p>
                                            <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wide">
                                                Jogou às {[...lead.freeSlots].sort((a, b) => a - b).map(h => `${String(h).padStart(2, '0')}h`).join(' · ')} neste dia
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        size="icon"
                                        className="h-10 w-10 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white shadow-lg shadow-[#25D366]/20 shrink-0"
                                        onClick={() => handleWhatsApp(lead.phone, lead.athleteName, lead.freeSlots)}
                                        title={`Contatar via WhatsApp: ${lead.phone}`}
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                            <div className="h-16 w-16 bg-[#002B40]/5 rounded-full flex items-center justify-center">
                                <CalendarIcon className="w-8 h-8 text-[#002B40]/20" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-[#002B40]">Nenhuma oportunidade</p>
                                <p className="text-sm text-[#002B40]/60">
                                    Nenhum atleta com histórico neste dia da semana nos horários disponíveis.
                                </p>
                            </div>
                        </div>
                    )}
                </ScrollArea>

                <div className="p-6 bg-white border-t border-[#002B40]/5">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="w-full h-12 border-[#002B40]/10 text-[#002B40] font-bold rounded-xl hover:bg-gray-50 active:scale-95 transition-all"
                    >
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
