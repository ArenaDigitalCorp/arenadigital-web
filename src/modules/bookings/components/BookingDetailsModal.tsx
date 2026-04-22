"use client"

import { useState } from "react"
import { X, Calendar as CalendarIcon, Clock, User, Trophy, Shield, Info, Trash2, ArrowRight } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { updateBookingStatusAction } from "@/modules/bookings/actions/bookingActions"
import { toast } from "sonner"

interface BookingDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    booking: any;
    court: any;
}

export function BookingDetailsModal({ isOpen, onClose, onSuccess, booking, court }: BookingDetailsModalProps) {
    const [isCancelling, setIsCancelling] = useState(false)

    if (!booking || !court) return null

    const startTime = parseISO(booking.start_time)
    const endTime = parseISO(booking.end_time)

    const handleCancel = async () => {
        if (!confirm("Tem certeza que deseja cancelar esta reserva?")) return

        setIsCancelling(true)
        try {
            await updateBookingStatusAction(booking.arena_id, booking.id, 'cancelled')
            toast.success("Reserva cancelada com sucesso!")
            onSuccess()
            onClose()
        } catch (error) {
            console.error("Error cancelling booking:", error)
            toast.error("Erro ao cancelar reserva.")
        } finally {
            setIsCancelling(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-[#F8FAFC]">
                <DialogHeader className="p-8 pb-4 bg-white flex flex-row items-center justify-between border-b border-[#002B40]/5">
                    <DialogTitle className="text-2xl font-black text-[#002B40] tracking-tight">
                        Detalhes do Agendamento
                    </DialogTitle>
                </DialogHeader>

                <div className="p-8 space-y-8">
                    {/* Main Info Card */}
                    <div className="bg-white rounded-2xl border border-[#002B40]/5 p-6 shadow-sm space-y-6">
                        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                            {/* Atleta */}
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-[#002B40]/40 tracking-widest flex items-center gap-1.5">
                                    <User className="w-3 h-3" /> Responsável
                                </p>
                                <p className="text-sm font-bold text-[#002B40]">{booking.athlete_name}</p>
                            </div>

                            {/* Status */}
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-[#002B40]/40 tracking-widest flex items-center gap-1.5">
                                    <Shield className="w-3 h-3" /> Status
                                </p>
                                <Badge className={cn(
                                    "text-[10px] font-black uppercase px-2 py-0.5 rounded-md border-none",
                                    booking.status === 'confirmed' ? "bg-emerald-100 text-emerald-700" :
                                    booking.status === 'reservado' ? "bg-amber-100 text-amber-700" :
                                    "bg-red-100 text-red-700"
                                )}>
                                    {booking.status === 'confirmed' ? 'Confirmado' :
                                     booking.status === 'reservado' ? 'Ag. Confirmação' :
                                     'Cancelado'}
                                </Badge>
                                {booking.booking_type === 'mensalista' && (
                                    <Badge className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border-none bg-amber-100 text-amber-700 ml-1">
                                        Mensalista
                                    </Badge>
                                )}
                            </div>

                            {/* Esporte */}
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-[#002B40]/40 tracking-widest flex items-center gap-1.5">
                                    <Trophy className="w-3 h-3" /> Esporte
                                </p>
                                <p className="text-sm font-bold text-[#002B40]">{booking.sports?.name || court.sports?.[0]?.name || 'Não informado'}</p>
                            </div>

                            {/* Espaço */}
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-[#002B40]/40 tracking-widest flex items-center gap-1.5">
                                    <Info className="w-3 h-3" /> Espaço
                                </p>
                                <p className="text-sm font-bold text-[#002B40]">{court.name}</p>
                            </div>

                            {/* Horário */}
                            <div className="col-span-2 space-y-1 pt-2 border-t border-[#002B40]/5">
                                <p className="text-[10px] font-black uppercase text-[#002B40]/40 tracking-widest flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" /> Período do Agendamento
                                </p>
                                <div className="flex items-center gap-3">
                                    <div className="bg-[#F1F5F9] px-3 py-1.5 rounded-lg flex items-center gap-2">
                                        <CalendarIcon className="w-3.5 h-3.5 text-[#002B40]/40" />
                                        <span className="text-sm font-bold text-[#002B40]">
                                            {format(startTime, "dd/MM/yyyy", { locale: ptBR })}
                                        </span>
                                    </div>
                                    <div className="bg-[#FFF5EF] px-3 py-1.5 rounded-lg flex items-center gap-2">
                                        <span className="text-sm font-black text-[#FF6B00]">
                                            {format(startTime, "HH:mm")}
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-[#FF6B00]/40" />
                                        <span className="text-sm font-black text-[#FF6B00]">
                                            {format(endTime, "HH:mm")}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Valor */}
                            <div className="col-span-2 space-y-1 pt-2 border-t border-[#002B40]/5">
                                <p className="text-[10px] font-black uppercase text-[#002B40]/40 tracking-widest">Valor Total</p>
                                <p className="text-2xl font-black text-[#FF6B00]">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(booking.price || 0)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 h-14 border-[#002B40]/10 text-[#002B40] font-bold rounded-2xl hover:bg-white active:scale-95 transition-all"
                        >
                            Fechar
                        </Button>
                        {booking.booking_type === 'mensalista' && booking.status === 'reservado' ? (
                            <div className="flex-1 h-14 flex items-center justify-center text-xs text-amber-600 font-bold bg-amber-50 border border-amber-200 rounded-2xl px-4 text-center">
                                Gerencie via "Mensalistas" no calendário
                            </div>
                        ) : (
                            <Button
                                onClick={handleCancel}
                                disabled={isCancelling || booking.status === 'cancelled'}
                                className="flex-1 h-14 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold rounded-2xl active:scale-95 transition-all gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {isCancelling ? "Cancelando..." : "Cancelar Reserva"}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
