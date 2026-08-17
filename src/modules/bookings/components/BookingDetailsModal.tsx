"use client"

import { useState } from "react"
import { Calendar as CalendarIcon, Clock, Trash2, Loader2, CheckCircle2 } from "lucide-react"
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
import {
    confirmarPagamentoAvulsoAction,
    confirmarPagamentoParticipanteAvulsoAction,
    updateBookingStatusAction,
} from "@/modules/bookings/actions/bookingActions"
import { ConfirmarPagamentoDialog } from "@/modules/bookings/components/ConfirmarPagamentoDialog"
import { toast } from "sonner"
import { trackAction } from "@/lib/telemetry/client"

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
    if (status === "pending_payment") {
        return { label: "Pix pendente no app", className: "bg-orange-100 text-orange-900 border-transparent" }
    }
    if (status === "cancelled") {
        return { label: "Cancelado", className: "bg-red-100 text-red-800 border-transparent" }
    }
    return { label: status ?? "—", className: "bg-slate-100 text-slate-700 border-transparent" }
}

export function BookingDetailsModal({ isOpen, onClose, onSuccess, onEdit, booking, court }: BookingDetailsModalProps) {
    const [isCancelling, setIsCancelling] = useState(false)
    const [showConfirmPayment, setShowConfirmPayment] = useState(false)
    const [confirmingParticipantId, setConfirmingParticipantId] = useState<string | null>(null)
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false)

    const arenaId = booking?.arena_id as string | undefined

    const fmtBrl = (n: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

    if (!booking || !court) return null

    const startTime = parseISO(booking.start_time)
    const endTime = parseISO(booking.end_time)
    const status = statusPresentation(booking.status)
    const isMensalista = booking.booking_type === "mensalista" || !!booking.plano_mensalista_id
    const mobilePixPending = booking.status === "pending_payment"
    const canEdit = Boolean(onEdit) && !isMensalista && booking.status !== "cancelled" && !mobilePixPending
    const mensalistaReservadoBlock = isMensalista && booking.status === "reservado"
    const avulsoReservado = !isMensalista && booking.status === "reservado"
    const canCancel = avulsoReservado

    const handleCancel = async () => {
        if (!confirm("Tem certeza que deseja cancelar esta reserva?")) return

        setIsCancelling(true)
        try {
            const result = await updateBookingStatusAction(booking.arena_id, booking.id, "cancelled")
            if (!result.success) throw new Error(result.error)
            trackAction("booking_cancel", "success", {
                arena_id: booking.arena_id,
                entity_id: booking.id,
                entity_type: "booking",
            })
            toast.success("Reserva cancelada com sucesso!")
            onSuccess()
            onClose()
        } catch (error) {
            console.error("Error cancelling booking:", error)
            trackAction("booking_cancel", "failure", {
                arena_id: booking.arena_id,
                entity_id: booking.id,
                entity_type: "booking",
                source: "exception",
            })
            toast.error(error instanceof Error ? error.message : "Erro ao cancelar reserva.")
        } finally {
            setIsCancelling(false)
        }
    }

    const handleConfirmarPagamento = async (valor: number) => {
        if (!arenaId) return
        setIsConfirmingPayment(true)
        try {
            const res = await confirmarPagamentoAvulsoAction(arenaId, booking.id, valor)
            if (!res.success) throw new Error(res.error)
            trackAction("booking_payment", "success", {
                arena_id: arenaId,
                entity_id: booking.id,
                entity_type: "booking",
            })
            toast.success("Pagamento confirmado!")
            setShowConfirmPayment(false)
            onSuccess()
            onClose()
        } catch (error) {
            trackAction("booking_payment", "failure", {
                arena_id: arenaId,
                entity_id: booking.id,
                entity_type: "booking",
                source: "exception",
            })
            toast.error(error instanceof Error ? error.message : "Erro ao confirmar pagamento")
        } finally {
            setIsConfirmingPayment(false)
        }
    }

    const handleConfirmarPagamentoParticipante = async (participantId: string, valor: number) => {
        if (!arenaId) return
        setConfirmingParticipantId(participantId)
        try {
            const res = await confirmarPagamentoParticipanteAvulsoAction(
                arenaId,
                booking.id,
                participantId,
                valor
            )
            if (!res.success) throw new Error(res.error)
            trackAction("booking_payment", "success", {
                arena_id: arenaId,
                entity_id: booking.id,
                entity_type: "booking",
            })
            toast.success("Pagamento do participante confirmado!")
            onSuccess()
        } catch (error) {
            trackAction("booking_payment", "failure", {
                arena_id: arenaId,
                entity_id: booking.id,
                entity_type: "booking",
                source: "exception",
            })
            toast.error(error instanceof Error ? error.message : "Erro ao confirmar pagamento")
        } finally {
            setConfirmingParticipantId(null)
        }
    }

    const sportName = booking.sports?.name || court.sports?.[0]?.name || "—"
    const wideLayout = canEdit
    const servicesSum = (booking.booking_services as any[] | undefined ?? []).reduce(
        (acc, s) => acc + s.quantity * Number(s.unit_price),
        0
    )
    const splitBilling = Boolean(booking.cobranca_por_participante)
    const courtPortionDisplay = splitBilling
        ? Number(booking.price ?? 0)
        : Math.max(0, (booking.price ?? 0) - servicesSum)
    const billingParticipants = (booking.booking_participants ?? []).filter(
        (p: { funcao?: string }) => p.funcao === "responsavel" || p.funcao === "convidado"
    )
    const unpaidParticipants = billingParticipants.filter(
        (p: { pago_em?: string | null }) => !p.pago_em
    )
    const additionalNames: string[] = (booking.booking_participants ?? [])
        .filter(
            (p: { funcao?: string; atleta_id?: string }) =>
                p.funcao === "convidado" && p.atleta_id !== booking.athlete_id
        )
        .map((p: { atleta?: { nome_perfil?: string } | null }) => p.atleta?.nome_perfil ?? "")
        .filter((name: string) => name.length > 0)

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton
                className={cn(
                    "!flex max-h-[90vh] min-h-0 w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-3xl border-none bg-white p-0 shadow-2xl",
                    wideLayout
                        ? "sm:w-full sm:max-w-[min(995px,calc(100vw-2rem))]"
                        : "sm:w-full sm:max-w-[min(28rem,calc(100vw-2rem))]"
                )}
            >
                <DialogHeader
                    className={cn(
                        "shrink-0 space-y-0 px-6 pb-4 pt-6 text-left",
                        wideLayout && "sm:px-10 sm:pb-5 sm:pt-8"
                    )}
                >
                    <DialogTitle
                        className={cn(
                            "font-black tracking-tight text-arena-navy-800",
                            wideLayout ? "text-2xl" : "text-xl"
                        )}
                    >
                        Detalhes da reserva
                    </DialogTitle>
                </DialogHeader>

                <div
                    className={cn(
                        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6",
                        wideLayout && "sm:px-10"
                    )}
                >
                    <div className={cn("space-y-6 pb-6", wideLayout && "sm:space-y-8 sm:pb-8")}>
                        <div
                            className={cn(
                                "grid grid-cols-2 gap-4 gap-y-5 sm:gap-x-8",
                                wideLayout ? "lg:grid-cols-4 lg:gap-5" : "sm:gap-x-6"
                            )}
                        >
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">
                                    Responsável
                                </p>
                                <p className="mt-1 text-sm font-semibold text-arena-navy-800">
                                    {booking.athlete_name ?? booking.atleta?.nome_perfil ?? "—"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">Status</p>
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
                                <p className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">Esporte</p>
                                <p className="mt-1 text-sm font-semibold text-arena-navy-800">{sportName}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">Espaço</p>
                                <p className="mt-1 text-sm font-semibold text-arena-navy-800">{court.name}</p>
                            </div>
                        </div>

                        {mobilePixPending && (
                            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
                                Esta reserva foi criada pelo app e está aguardando pagamento Pix. O horário fica
                                bloqueado temporariamente e será confirmado automaticamente pelo webhook do Asaas após o
                                pagamento.
                            </div>
                        )}

                        {splitBilling && billingParticipants.length > 0 ? (
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">
                                    Participantes e pagamentos
                                </p>
                                <ul className="mt-2 space-y-2">
                                    {billingParticipants.map(
                                        (p: {
                                            id: string
                                            pago_em?: string | null
                                            valor?: number | null
                                            atleta?: { nome_perfil?: string } | null
                                        }) => {
                                            const nome = p.atleta?.nome_perfil ?? "Atleta"
                                            const paid = Boolean(p.pago_em)
                                            const valor = Number(p.valor ?? booking.price ?? 0)
                                            const isConfirming = confirmingParticipantId === p.id

                                            return (
                                                <li
                                                    key={p.id}
                                                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-arena-navy-800/8 bg-slate-50 px-3 py-2.5"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-arena-navy-800">
                                                            {nome}
                                                        </p>
                                                        <p className="text-xs font-medium text-arena-navy-800/50">
                                                            {fmtBrl(valor)}
                                                            {paid ? " · Pago" : " · Pendente"}
                                                        </p>
                                                    </div>
                                                    {avulsoReservado && !paid && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            disabled={isConfirming}
                                                            onClick={() =>
                                                                handleConfirmarPagamentoParticipante(
                                                                    p.id,
                                                                    valor
                                                                )
                                                            }
                                                            className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-white hover:bg-emerald-600"
                                                        >
                                                            {isConfirming ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                "Confirmar"
                                                            )}
                                                        </Button>
                                                    )}
                                                </li>
                                            )
                                        }
                                    )}
                                </ul>
                            </div>
                        ) : additionalNames.length > 0 ? (
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">
                                    Participantes
                                </p>
                                <ul className="mt-2 space-y-1.5">
                                    {additionalNames.map((name, index) => (
                                        <li
                                            key={`${name}-${index}`}
                                            className="text-sm font-semibold text-arena-navy-800"
                                        >
                                            {name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        <div className="border-t border-slate-200 pt-6" />

                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">Período</p>
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

                        <div className="border-t border-slate-200 pt-6" />

                        {wideLayout ? (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">
                                        {splitBilling
                                            ? "Valor por participante"
                                            : avulsoReservado
                                              ? "Valor da reserva"
                                              : "Valor pago"}
                                    </p>
                                    <div className="flex h-14 items-center rounded-xl border border-arena-navy-800/10 bg-slate-50/80 px-4">
                                        <span className="text-2xl font-black text-arena-button">
                                            {fmtBrl(booking.price ?? 0)}
                                        </span>
                                    </div>
                                </div>

                                {booking.booking_services?.length > 0 && (
                                    <div className="border-t border-slate-200 pt-6">
                                        <p className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40 mb-3">
                                            Serviços
                                        </p>
                                        <ul className="space-y-2 text-sm text-arena-navy-800/80">
                                            {(booking.booking_services as any[]).map((s: any) => (
                                                <li
                                                    key={s.id}
                                                    className="flex justify-between gap-2 rounded-xl border border-arena-navy-800/8 bg-[#FFF8F1] px-4 py-3"
                                                >
                                                    <span>
                                                        {s.quantity}× {s.products?.name ?? "Serviço"}
                                                    </span>
                                                    <span className="font-semibold">
                                                        {fmtBrl(s.quantity * Number(s.unit_price))}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="border-t border-slate-200 pt-6">
                                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                                        <span className="text-sm font-medium text-arena-navy-800/70">
                                            {splitBilling ? "Total estimado" : "Total da reserva"}
                                        </span>
                                        <span className="text-2xl font-black tracking-tight text-arena-button">
                                            {splitBilling
                                                ? fmtBrl(
                                                      courtPortionDisplay *
                                                          billingParticipants.length
                                                  )
                                                : fmtBrl(booking.price ?? 0)}
                                        </span>
                                    </div>
                                    {splitBilling ? (
                                        <p className="mt-2 text-[11px] font-medium text-arena-navy-800/45">
                                            {billingParticipants.length} participante
                                            {billingParticipants.length !== 1 ? "s" : ""} ×{" "}
                                            {fmtBrl(courtPortionDisplay)}
                                            {unpaidParticipants.length > 0 &&
                                                ` · ${unpaidParticipants.length} pendente${unpaidParticipants.length !== 1 ? "s" : ""}`}
                                        </p>
                                    ) : booking.booking_services?.length > 0 ? (
                                        <p className="mt-2 text-[11px] font-medium text-arena-navy-800/45">
                                            Locação {fmtBrl(courtPortionDisplay)} + serviços {fmtBrl(servicesSum)}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">Valor</p>
                                <p className="mt-1 text-2xl font-black text-arena-button">{fmtBrl(booking.price ?? 0)}</p>
                                {booking.booking_services?.length > 0 && (
                                    <ul className="mt-3 space-y-1.5 text-sm text-arena-navy-800/80">
                                        {(booking.booking_services as any[]).map((s: any) => (
                                            <li key={s.id} className="flex justify-between gap-2">
                                                <span>
                                                    {s.quantity}× {s.products?.name ?? "Serviço"}
                                                </span>
                                                <span className="font-semibold">
                                                    {fmtBrl(s.quantity * Number(s.unit_price))}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div
                    className={cn(
                        "flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-slate-100 px-6 py-4 sm:gap-4",
                        wideLayout && "sm:px-10 sm:py-5"
                    )}
                >
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="h-11 w-full rounded-xl border-arena-navy-800/25 font-semibold text-arena-navy-800 hover:bg-slate-50 sm:w-auto sm:min-w-[200px]"
                    >
                        Voltar
                    </Button>
                    {canEdit && (
                        <Button
                            type="button"
                            onClick={onEdit}
                            className="h-11 w-full rounded-xl bg-arena-button font-semibold text-white shadow-sm hover:bg-arena-button-hover sm:w-auto sm:min-w-[200px]"
                        >
                            Editar
                        </Button>
                    )}
                    {avulsoReservado && !splitBilling && (
                        <Button
                            type="button"
                            onClick={() => setShowConfirmPayment(true)}
                            disabled={isConfirmingPayment}
                            className="h-11 w-full rounded-xl bg-emerald-500 font-semibold text-white shadow-sm hover:bg-emerald-600 sm:w-auto sm:min-w-[200px] gap-2"
                        >
                            {isConfirmingPayment ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                            Confirmar pagamento
                        </Button>
                    )}
                    {mensalistaReservadoBlock ? (
                        <div className="flex w-full min-w-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center text-xs font-medium text-amber-800 sm:w-auto sm:max-w-md">
                            Gerencie via &quot;Mensalistas&quot; no calendário
                        </div>
                    ) : canCancel ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleCancel}
                            disabled={isCancelling}
                            className="h-11 w-11 shrink-0 rounded-xl border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                            title="Cancelar reserva"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    ) : null}
                </div>
            </DialogContent>

            <ConfirmarPagamentoDialog
                isOpen={showConfirmPayment}
                onClose={() => setShowConfirmPayment(false)}
                onConfirm={handleConfirmarPagamento}
                atletaNome={booking.athlete_name ?? "Atleta"}
                mesDevido={format(startTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                valorPadrao={booking.price ?? 0}
                isLoading={isConfirmingPayment}
                tipo="avulso"
            />
        </Dialog>
    )
}
