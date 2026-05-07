"use client"

import { useState } from "react"
import { Calendar as CalendarIcon, Clock, Trash2 } from "lucide-react"
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
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    onEdit?: () => void
    booking: any
    court: any
}

function statusPresentation(status: string | null | undefined) {
    if (status === "confirmed") {
        return { label: "Confirmado", className: "bg-emerald-100 text-emerald-800 border-transparent" }
    }
    if (status === "reservado") {
        return { label: "Pendente pagamento", className: "bg-amber-100 text-amber-900 border-transparent" }
    }
    if (status === "cancelled") {
        return { label: "Cancelado", className: "bg-red-100 text-red-800 border-transparent" }
    }
    return { label: status ?? "—", className: "bg-slate-100 text-slate-700 border-transparent" }
}

export function BookingDetailsModal({ isOpen, onClose, onSuccess, onEdit, booking, court }: BookingDetailsModalProps) {
    const [isCancelling, setIsCancelling] = useState(false)

    if (!booking || !court) return null

    const startTime = parseISO(booking.start_time)
    const endTime = parseISO(booking.end_time)
    const status = statusPresentation(booking.status)
    const isMensalista = booking.booking_type === "mensalista" || !!booking.plano_mensalista_id
    const canEdit = Boolean(onEdit) && !isMensalista && booking.status !== "cancelled"
    const mensalistaReservadoBlock = isMensalista && booking.status === "reservado"

    const handleCancel = async () => {
        if (!confirm("Tem certeza que deseja cancelar esta reserva?")) return

        setIsCancelling(true)
        try {
            await updateBookingStatusAction(booking.arena_id, booking.id, "cancelled")
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

    const sportName = booking.sports?.name || court.sports?.[0]?.name || "—"

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton
                className="max-w-[calc(100%-2rem)] sm:max-w-[440px] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-xl"
            >
                <DialogHeader className="border-b border-slate-100 px-6 pb-4 pt-6 text-left">
                    <DialogTitle className="text-lg font-bold tracking-tight text-arena-navy-800">
                        Detalhes da reserva
                    </DialogTitle>
                </DialogHeader>

                <div className="px-6 py-5">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Responsável
                            </p>
                            <p className="mt-1 text-sm font-semibold text-arena-navy-800">
                                {booking.athlete_name ?? "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Status
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className={cn("text-xs font-medium", status.className)}>
                                    {status.label}
                                </Badge>
                                {booking.booking_type === "mensalista" && (
                                    <Badge
                                        variant="outline"
                                        className="border-transparent bg-amber-50 text-xs font-medium text-amber-800"
                                    >
                                        Mensalista
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Esporte
                            </p>
                            <p className="mt-1 text-sm font-semibold text-arena-navy-800">{sportName}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Espaço
                            </p>
                            <p className="mt-1 text-sm font-semibold text-arena-navy-800">{court.name}</p>
                        </div>
                    </div>

                    <div className="my-5 border-t border-slate-100" />

                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Período</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-arena-navy-800">
                                <CalendarIcon className="h-3.5 w-3.5 text-slate-500" />
                                {format(startTime, "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFF5EF] px-3 py-1.5 text-sm font-semibold text-arena-button">
                                <Clock className="h-3.5 w-3.5 text-arena-button/70" />
                                <span>{format(startTime, "HH:mm")}</span>
                                <span className="text-arena-button/50">→</span>
                                <span>{format(endTime, "HH:mm")}</span>
                            </div>
                        </div>
                    </div>

                    <div className="my-5 border-t border-slate-100" />

                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Valor</p>
                        <p className="mt-1 text-2xl font-bold text-arena-button">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                                booking.price ?? 0
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex w-full flex-row items-stretch gap-3 border-t border-slate-100 px-6 py-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="min-w-0 flex-1 basis-0 border-arena-navy-800/20 font-semibold text-arena-navy-800 hover:bg-slate-50"
                    >
                        Voltar
                    </Button>
                    {canEdit && (
                        <Button
                            type="button"
                            onClick={onEdit}
                            className="min-w-0 flex-1 basis-0 bg-arena-button font-semibold text-white shadow-sm hover:bg-arena-button-hover"
                        >
                            Editar
                        </Button>
                    )}
                    {mensalistaReservadoBlock ? (
                        <div className="flex min-w-0 flex-1 basis-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800">
                            Gerencie via &quot;Mensalistas&quot; no calendário
                        </div>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleCancel}
                            disabled={isCancelling || booking.status === "cancelled"}
                            className="h-10 w-10 shrink-0 self-center border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                            title="Cancelar reserva"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
