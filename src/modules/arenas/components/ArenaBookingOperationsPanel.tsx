"use client"

import { useState } from "react"
import { CalendarRange, CheckCircle2, CircleDashed } from "lucide-react"
import { ArenaAppBookingSettingsCard } from "@/modules/arenas/components/ArenaAppBookingSettingsCard"
import { ArenaCancellationPolicyCard } from "@/modules/arenas/components/ArenaCancellationPolicyCard"
import { ArenaPixSplitSettingsCard } from "@/modules/arenas/components/ArenaPixSplitSettingsCard"
import { normalizeAppBookingMode, type AppBookingMode } from "@/modules/arenas/domain/app-booking-mode"
import type { ArenaCancellationPolicySettings } from "@/modules/arenas/types/cancellation-policy.types"
import type { ArenaPixSplitSettings } from "@/modules/arenas/types/pix-split.types"

type Props = {
    arenaId: string
    arenaName: string
    initialMode: unknown
    legacyAcceptsRequests?: boolean
    paymentSettings: ArenaPixSplitSettings
    cancellationPolicySettings: ArenaCancellationPolicySettings
    registration: {
        email: string
        phone: string
        document: string
        address: string
        addressNumber: string
        complement: string
        province: string
        postalCode: string
    }
}

export function ArenaBookingOperationsPanel({
    arenaId,
    arenaName,
    initialMode,
    legacyAcceptsRequests = false,
    paymentSettings,
    cancellationPolicySettings,
    registration,
}: Props) {
    const savedMode = normalizeAppBookingMode(initialMode, legacyAcceptsRequests)
    const hasOnlineConfiguration = Boolean(
        paymentSettings.onboardingStarted
        || cancellationPolicySettings.currentPolicy
        || cancellationPolicySettings.draftPolicy,
    )
    const [selectedMode, setSelectedMode] = useState<AppBookingMode>(savedMode)
    const [hasPublishedPolicy, setHasPublishedPolicy] = useState(
        Boolean(cancellationPolicySettings.currentPolicy),
    )
    const [receivingReady, setReceivingReady] = useState(
        paymentSettings.enabled && !paymentSettings.credentialRecoveryRequired,
    )
    const [showOnlineConfiguration, setShowOnlineConfiguration] = useState(
        savedMode === "online_payment" || hasOnlineConfiguration,
    )
    const effectiveOnlineBookingReady = hasPublishedPolicy && receivingReady
    const effectiveOnlineBookingMissing = [
        ...(!receivingReady ? ['a conta de recebimento aprovada e ativa'] : []),
        ...(!hasPublishedPolicy ? ['uma política de cancelamento publicada'] : []),
    ]

    function handleSelectionChange(mode: AppBookingMode) {
        setSelectedMode(mode)
        if (mode === "online_payment") {
            setShowOnlineConfiguration(true)
        } else if (!hasOnlineConfiguration) {
            setShowOnlineConfiguration(false)
        }
    }

    return (
        <section
            id="booking-operations"
            className="overflow-hidden rounded-3xl border border-arena-navy-800/10 bg-white shadow-[0_18px_55px_-42px_rgba(8,48,65,0.5)]"
        >
            <div className="border-b border-arena-navy-800/8 bg-[linear-gradient(135deg,#f5fafb_0%,#fffaf4_100%)] px-5 py-6 sm:px-8 sm:py-7">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                    <div className="flex items-start gap-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-arena-navy-800 text-white shadow-sm">
                            <CalendarRange className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-arena-button">
                                Configuração comercial
                            </p>
                            <h2 className="mt-1 text-xl font-black tracking-tight text-arena-navy-800">
                                Operação de reservas
                            </h2>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                                Defina a experiência no aplicativo. Política e conta de recebimento só são exigidas para pagamento online.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold sm:flex sm:text-left">
                        <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Modalidade
                        </span>
                        <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-slate-600">
                            {hasPublishedPolicy
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                : <CircleDashed className="h-3.5 w-3.5" />}
                            Política
                        </span>
                        <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-slate-600">
                            {receivingReady
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                : <CircleDashed className="h-3.5 w-3.5" />}
                            Recebimento
                        </span>
                    </div>
                </div>
            </div>

            <div className="divide-y divide-slate-200">
                <ArenaAppBookingSettingsCard
                    arenaId={arenaId}
                    initialMode={initialMode}
                    legacyAcceptsRequests={legacyAcceptsRequests}
                    onlineBookingReady={effectiveOnlineBookingReady}
                    onlineBookingMissing={effectiveOnlineBookingMissing}
                    onSelectionChange={handleSelectionChange}
                    onRequestOnlineConfiguration={() => setShowOnlineConfiguration(true)}
                />

                {showOnlineConfiguration && (
                    <>
                        <ArenaCancellationPolicyCard
                            arenaId={arenaId}
                            initialSettings={cancellationPolicySettings}
                            onSettingsChange={(settings) => setHasPublishedPolicy(Boolean(settings.currentPolicy))}
                        />
                        <ArenaPixSplitSettingsCard
                            accessMode="arena"
                            arenaId={arenaId}
                            arenaName={arenaName}
                            initialSettings={paymentSettings}
                            registration={registration}
                            onSettingsChange={(settings) => setReceivingReady(
                                settings.enabled && !settings.credentialRecoveryRequired,
                            )}
                        />
                    </>
                )}

                {!showOnlineConfiguration && selectedMode !== "online_payment" && (
                    <div className="px-5 py-4 text-xs leading-5 text-slate-500 sm:px-8">
                        Política de cancelamento e conta de recebimento ficam disponíveis quando você escolher pagamento online.
                    </div>
                )}
            </div>
        </section>
    )
}
