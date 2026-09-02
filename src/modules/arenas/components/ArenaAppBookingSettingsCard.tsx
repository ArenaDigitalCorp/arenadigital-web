"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
    Ban,
    CalendarClock,
    Check,
    CreditCard,
    Info,
    Loader2,
    LockKeyhole,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { updateArenaAppBookingModeAction } from "@/modules/arenas/actions/arenaActions"
import {
    normalizeAppBookingMode,
    type AppBookingMode,
} from "@/modules/arenas/domain/app-booking-mode"

type Props = {
    arenaId: string
    initialMode: unknown
    legacyAcceptsRequests?: boolean
    onlineBookingReady: boolean
    onlineBookingMissing: string[]
    onSelectionChange?: (mode: AppBookingMode) => void
    onRequestOnlineConfiguration?: () => void
}

const OPTIONS: Array<{
    value: AppBookingMode
    title: string
    description: string
    icon: typeof CalendarClock
}> = [
    {
        value: "disabled",
        title: "Desativado",
        description: "A Arena permanece visível, mas combina as reservas fora do aplicativo.",
        icon: Ban,
    },
    {
        value: "pre_booking",
        title: "Pré-reserva",
        description: "O atleta solicita, a Arena aprova e o pagamento acontece presencialmente.",
        icon: CalendarClock,
    },
    {
        value: "online_payment",
        title: "Pagamento online",
        description: "A reserva é confirmada por Pix, com split e política de cancelamento.",
        icon: CreditCard,
    },
]

export function ArenaAppBookingSettingsCard({
    arenaId,
    initialMode,
    legacyAcceptsRequests = false,
    onlineBookingReady,
    onlineBookingMissing,
    onSelectionChange,
    onRequestOnlineConfiguration,
}: Props) {
    const router = useRouter()
    const normalizedInitialMode = normalizeAppBookingMode(initialMode, legacyAcceptsRequests)
    const [savedMode, setSavedMode] = useState<AppBookingMode>(normalizedInitialMode)
    const [selectedMode, setSelectedMode] = useState<AppBookingMode>(normalizedInitialMode)
    const [saving, setSaving] = useState(false)
    const isDirty = selectedMode !== savedMode

    async function handleSave() {
        if (selectedMode === "online_payment" && !onlineBookingReady) {
            onRequestOnlineConfiguration?.()
            toast.info("Conclua a política e a conta de recebimento para ativar o pagamento online.")
            return
        }
        setSaving(true)
        try {
            const result = await updateArenaAppBookingModeAction(arenaId, selectedMode)
            if (!result.success) throw new Error(result.error)
            const nextMode = normalizeAppBookingMode(
                result.data?.app_booking_mode,
                result.data?.accepts_app_booking_requests ?? false,
            )
            setSelectedMode(nextMode)
            setSavedMode(nextMode)
            toast.success("Modalidade de reserva atualizada.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível atualizar as reservas pelo aplicativo.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="px-5 py-7 sm:px-8" aria-labelledby="app-booking-settings-title">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-arena-navy-800 text-white shadow-sm">
                        <CalendarClock className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-arena-button">
                            Modalidade no aplicativo
                        </p>
                        <h3 id="app-booking-settings-title" className="mt-1 text-base font-bold text-arena-navy-800">
                            Como os atletas poderão reservar
                        </h3>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                            Escolha uma modalidade. Nenhuma opção é ativada automaticamente para a Arena.
                        </p>
                    </div>
                </div>
                <span className={cn(
                    "inline-flex h-7 w-fit items-center gap-1.5 rounded-full border px-3 text-xs font-bold",
                    savedMode === "disabled"
                        ? "border-slate-200 bg-slate-50 text-slate-600"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800",
                )}>
                    {savedMode === "disabled" ? <Ban className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    {savedMode === "disabled"
                        ? "Reservas desativadas"
                        : savedMode === "pre_booking"
                            ? "Pré-reserva ativa"
                            : "Pagamento online ativo"}
                </span>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-3" role="radiogroup" aria-label="Modo de reservas pelo aplicativo">
                {OPTIONS.map((option) => {
                    const Icon = option.icon
                    const selected = selectedMode === option.value
                    const requiresOnlineConfiguration = option.value === "online_payment" && !onlineBookingReady
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => {
                                setSelectedMode(option.value)
                                onSelectionChange?.(option.value)
                            }}
                            className={cn(
                                "group relative min-h-40 rounded-2xl border p-5 text-left transition-[border-color,box-shadow,transform,background-color] duration-200",
                                selected
                                    ? "border-arena-button bg-[#fffdfa] shadow-[0_14px_34px_-24px_rgba(240,125,42,0.9)] ring-2 ring-arena-button/15"
                                    : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm",
                            )}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className={cn(
                                    "grid h-10 w-10 place-items-center rounded-xl",
                                    selected ? "bg-arena-button text-white" : "bg-slate-100 text-slate-500",
                                )}>
                                    <Icon className="h-5 w-5" aria-hidden="true" />
                                </div>
                                {requiresOnlineConfiguration ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-700">
                                        <LockKeyhole className="h-3 w-3" />
                                        Configurar
                                    </span>
                                ) : selected ? (
                                    <span className="grid h-6 w-6 place-items-center rounded-full bg-arena-button text-white">
                                        <Check className="h-3.5 w-3.5" />
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-5 text-sm font-black text-arena-navy-800">{option.title}</p>
                            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{option.description}</p>
                        </button>
                    )
                })}
            </div>

            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5 text-xs leading-5 text-slate-600">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <div>
                        <p className="font-semibold text-slate-700">
                            Na pré-reserva, solicitações pendentes não ocupam a agenda.
                        </p>
                        <p>O horário só é bloqueado depois que a Arena aprova a solicitação.</p>
                        {!onlineBookingReady && (
                            <p className="mt-1 font-semibold text-amber-800">
                                Para pagamento online, falta: {onlineBookingMissing.join(" e ")}.
                            </p>
                        )}
                    </div>
                </div>
                <Button
                    type="button"
                    className="shrink-0 bg-arena-button text-white hover:bg-arena-button-hover"
                    disabled={(!isDirty && !(selectedMode === "online_payment" && !onlineBookingReady)) || saving}
                    onClick={() => void handleSave()}
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {selectedMode === "online_payment" && !onlineBookingReady
                        ? "Concluir configuração abaixo"
                        : "Salvar modalidade"}
                </Button>
            </div>
        </section>
    )
}
