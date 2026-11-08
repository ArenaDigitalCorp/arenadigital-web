"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArenaCommissionFields } from "./ArenaCommissionFields"

import type { FormEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
    AlertTriangle,
    Building2,
    Check,
    CheckCircle2,
    CircleDashed,
    Clock3,
    ExternalLink,
    FileCheck2,
    Landmark,
    Loader2,
    RefreshCw,
    ShieldCheck,
    ChevronDown,
    Save,
    XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MaskedInput } from "@/components/ui/masked-input"
import { DecimalInput } from "@/components/ui/decimal-input"
import { parseBrazilianDecimal } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    createArenaAsaasSubaccountAction,
    getArenaPixSplitSettingsAction,
    reconcileArenaAsaasSubaccountAction,
    recoverArenaAsaasSubaccountCredentialAction,
    syncArenaAsaasSubaccountStatusAction,
    updateArenaPixSplitSettingsAction,
} from "@/modules/arenas/actions/arenaActions"
import type { ReceivingDraftSnapshot } from "@/modules/arenas/types/receiving-setup.types"
import { saveArenaReceivingDraftAction } from "@/modules/arenas/actions/receivingSetupActions"
import type {
    ArenaAsaasOnboardingStatus,
    ArenaPixSplitSettings,
    AsaasCompanyType,
} from "@/modules/arenas/types/pix-split.types"
import { cn } from "@/lib/utils"
import { AsaasProviderNotice } from "@/components/payments/asaas-provider-notice"
import { ArenaAsaasDocumentsPanel } from "@/modules/arenas/components/ArenaAsaasDocumentsPanel"

export type ReceivingDraftFields = {
    name: string
    email: string
    cpfCnpj: string
    companyType: AsaasCompanyType | ""
    mobilePhone: string
    incomeValue: string
    address: string
    addressNumber: string
    complement: string
    province: string
    postalCode: string
}

interface Props {
    arenaId: string
    arenaName: string
    initialSettings: ArenaPixSplitSettings
    registration: {
        legalName?: string | null
        email: string
        phone: string
        document: string
        address: string
        addressNumber: string
        complement: string
        province: string
        postalCode: string
    }
    initialReceivingDraft?: ReceivingDraftSnapshot | null
    accessMode?: "platform" | "arena"
    onSettingsChange?: (settings: ArenaPixSplitSettings) => void
    onDocumentsReadyChange?: (ready: boolean) => void
}

type BusyOperation = "create" | "reconcile" | "recover" | "sync" | "save" | "draft" | null

const AUTOMATIC_INITIAL_SYNC_DELAY_MS = 15_000
const AUTOMATIC_LOCAL_REFRESH_MS = 10_000
const AUTOMATIC_PROVIDER_RECONCILIATION_MS = 5 * 60_000

const STATUS_META: Record<ArenaAsaasOnboardingStatus, {
    label: string
    className: string
    icon: typeof CheckCircle2
}> = {
    NOT_STARTED: { label: "Não iniciado", className: "text-slate-500", icon: CircleDashed },
    PENDING: { label: "Pendente", className: "text-amber-700", icon: CircleDashed },
    AWAITING_APPROVAL: { label: "Em análise", className: "text-sky-700", icon: Clock3 },
    APPROVED: { label: "Aprovado", className: "text-emerald-700", icon: CheckCircle2 },
    REJECTED: { label: "Rejeitado", className: "text-rose-700", icon: XCircle },
}

const COMPANY_TYPES: Array<{ value: AsaasCompanyType; label: string }> = [
    { value: "MEI", label: "MEI" },
    { value: "LIMITED", label: "Sociedade limitada" },
    { value: "INDIVIDUAL", label: "Empresário individual" },
    { value: "ASSOCIATION", label: "Associação" },
]

function formatDate(value: string | null): string {
    if (!value) return "Ainda não sincronizado"
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value))
}

function automaticProviderDelay(
    lastStatusCheckedAt: string | null,
    updatedAt: string | null,
): number {
    const reference = lastStatusCheckedAt ?? updatedAt
    const interval = lastStatusCheckedAt
        ? AUTOMATIC_PROVIDER_RECONCILIATION_MS
        : AUTOMATIC_INITIAL_SYNC_DELAY_MS
    if (!reference) return interval
    const elapsed = Date.now() - Date.parse(reference)
    if (!Number.isFinite(elapsed)) return interval
    return Math.max(1_000, interval - Math.max(0, elapsed))
}

function StatusLine({
    label,
    status,
    icon: Icon,
}: {
    label: string
    status: ArenaAsaasOnboardingStatus
    icon: typeof Building2
}) {
    const meta = STATUS_META[status]
    const StatusIcon = meta.icon
    return (
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
            <span className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                {label}
            </span>
            <span className={cn("flex items-center gap-2 text-xs font-bold", meta.className)}>
                <StatusIcon className="h-4 w-4" aria-hidden="true" />
                {meta.label}
            </span>
        </div>
    )
}

export function ArenaPixSplitSettingsCard({
    arenaId,
    initialSettings,
    registration,
    accessMode = "platform",
    initialReceivingDraft,
    onSettingsChange,
    onDocumentsReadyChange,
}: Props) {
    const [settings, setSettings] = useState(initialSettings)
    const [documentGroupsReady, setDocumentGroupsReady] = useState(false)
    const onDocumentGroupsReadyChange = useCallback((ready: boolean) => setDocumentGroupsReady(ready), [])
    const [operationalForm, setOperationalForm] = useState(initialSettings)
    const [busy, setBusy] = useState<BusyOperation>(null)
    const [automaticUpdateError, setAutomaticUpdateError] = useState<string | null>(null)
    const automaticRefreshInFlightRef = useRef(false)
    const [showOnboarding, setShowOnboarding] = useState(!initialSettings.onboardingStarted)
    const [reconcileAccountId, setReconcileAccountId] = useState("")
    const [reconcileWalletId, setReconcileWalletId] = useState("")
    const [draftSaved, setDraftSaved] = useState(false)
    const [draftRevision, setDraftRevision] = useState(initialReceivingDraft?.revision ?? null)
    const [onboardingForm, setOnboardingForm] = useState<ReceivingDraftFields>({
        name: registration.legalName || initialSettings.holderName || "",
        email: registration.email,
        cpfCnpj: initialSettings.holderDocument || registration.document,
        mobilePhone: registration.phone,
        incomeValue: "",
        address: registration.address,
        addressNumber: registration.addressNumber,
        complement: registration.complement,
        province: registration.province,
        postalCode: registration.postalCode,
        ...initialReceivingDraft?.data,
        companyType: COMPANY_TYPES.some(type => type.value === initialReceivingDraft?.data.companyType)
            ? initialReceivingDraft!.data.companyType as AsaasCompanyType : "",
    })

    const [reviewRegistration, setReviewRegistration] = useState(false)
    // Keep the initial field set stable so inputs do not disappear while typing.
    const [reusedFields] = useState(() => (Object.keys(onboardingForm) as Array<keyof ReceivingDraftFields>)
        .filter(key => key !== 'companyType' && key !== 'incomeValue' && Boolean(onboardingForm[key].trim())))
    const registrationLabels: Partial<Record<keyof ReceivingDraftFields, string>> = {
        name: 'Nome ou razão social', cpfCnpj: 'CNPJ', email: 'E-mail', mobilePhone: 'Celular',
        address: 'Endereço', addressNumber: 'Número', complement: 'Complemento', province: 'Bairro', postalCode: 'CEP',
    }
    const needsInput = (key: keyof ReceivingDraftFields) => reviewRegistration || !reusedFields.includes(key) || !onboardingForm[key].trim()

    const isApproved =
        settings.onboardingStatus === "APPROVED" &&
        settings.webhookConfigured &&
        settings.paymentFlow === "arena_subaccount_split"
    const isRejected = settings.onboardingStatus === "REJECTED"
    const isPlatform = accessMode === "platform"

    const documentsReady = settings.enabled || settings.documentationStatus === "APPROVED" || documentGroupsReady
    useEffect(() => { onDocumentsReadyChange?.(documentsReady) }, [documentsReady, onDocumentsReadyChange])

    const updateSettings = useCallback((next: ArenaPixSplitSettings) => {
        setSettings(next)
        setOperationalForm(next)
        onSettingsChange?.(next)
    }, [onSettingsChange])

    useEffect(() => {
        if (
            !settings.onboardingStarted ||
            settings.enabled ||
            settings.credentialRecoveryRequired
        ) {
            return
        }

        let active = true

        async function refresh(source: "local" | "provider") {
            if (automaticRefreshInFlightRef.current) return
            automaticRefreshInFlightRef.current = true
            try {
                const result = source === "provider"
                    ? await syncArenaAsaasSubaccountStatusAction(arenaId)
                    : await getArenaPixSplitSettingsAction(arenaId)
                if (!active) return
                if (!result.success) {
                    setAutomaticUpdateError(result.error ?? "Não foi possível atualizar o cadastro automaticamente.")
                    return
                }
                updateSettings(result.data)
                setAutomaticUpdateError(null)
            } catch {
                if (active) setAutomaticUpdateError("A atualização automática está temporariamente indisponível.")
            } finally {
                automaticRefreshInFlightRef.current = false
            }
        }

        const providerTimer = window.setTimeout(
            () => void refresh("provider"),
            automaticProviderDelay(settings.lastStatusCheckedAt, settings.updatedAt),
        )
        const localRefreshTimer = window.setInterval(
            () => void refresh("local"),
            AUTOMATIC_LOCAL_REFRESH_MS,
        )
        const providerReconciliationTimer = window.setInterval(
            () => void refresh("provider"),
            AUTOMATIC_PROVIDER_RECONCILIATION_MS,
        )

        return () => {
            active = false
            window.clearTimeout(providerTimer)
            window.clearInterval(localRefreshTimer)
            window.clearInterval(providerReconciliationTimer)
        }
    }, [
        arenaId,
        settings.credentialRecoveryRequired,
        settings.enabled,
        settings.lastStatusCheckedAt,
        settings.onboardingStarted,
        settings.updatedAt,
        updateSettings,
    ])

    async function handleSaveDraft() {
        if (busy || settings.onboardingStarted) return
        setBusy("draft")
        setDraftSaved(false)
        try {
            const result = await saveArenaReceivingDraftAction(arenaId, onboardingForm, draftRevision)
            if (!result.success) throw new Error(result.error)
            setDraftRevision(result.data.revision)
            setDraftSaved(true)
            toast.success("Dados de recebimento salvos. Nenhum cadastro foi enviado ao Asaas.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível salvar os dados de recebimento.")
        } finally {
            setBusy(null)
        }
    }

    async function handleCreateSubaccount(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy || settings.onboardingStarted) return
        const companyType = onboardingForm.companyType
        if (!companyType) {
            toast.error("Selecione a natureza jurídica da empresa.")
            return
        }
        setBusy("create")
        try {
            const result = await createArenaAsaasSubaccountAction(arenaId, {
                ...onboardingForm,
                companyType,
                incomeValue: parseBrazilianDecimal(onboardingForm.incomeValue) ?? Number.NaN,
            })
            if (!result.success) {
                updateSettings(result.data)
                throw new Error(result.error)
            }
            updateSettings(result.data)
            setShowOnboarding(false)
            setAutomaticUpdateError(null)
            toast.success("Cadastro financeiro iniciado. A aprovação será acompanhada automaticamente.")
            if (result.warning) toast.info(result.warning)
        } catch (error) {
            setReviewRegistration(true)
            toast.error(error instanceof Error ? error.message : "Não foi possível criar a subconta Asaas.")
        } finally {
            setBusy(null)
        }
    }

    async function handleCredentialRecovery() {
        setBusy("recover")
        try {
            const result = await recoverArenaAsaasSubaccountCredentialAction(arenaId)
            updateSettings(result.data)
            if (!result.success) throw new Error(result.error)
            toast.success("Credencial protegida no cofre. A sincronização foi liberada.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível recuperar a credencial.")
        } finally {
            setBusy(null)
        }
    }

    async function handleAccountReconciliation(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy("reconcile")
        try {
            const result = await reconcileArenaAsaasSubaccountAction(
                arenaId, reconcileAccountId, reconcileWalletId,
            )
            updateSettings(result.data)
            if (!result.success) throw new Error(result.error)
            setReconcileAccountId("")
            setReconcileWalletId("")
            toast.success("Subconta vinculada. Agora proteja a chave no cofre.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível vincular a subconta.")
        } finally {
            setBusy(null)
        }
    }

    async function handleSync() {
        setBusy("sync")
        try {
            const result = await syncArenaAsaasSubaccountStatusAction(arenaId)
            if (!result.success) throw new Error(result.error)
            updateSettings(result.data)
            setAutomaticUpdateError(null)
            toast.success(result.data.enabled ? "Recebimento online atualizado e ativo." : "Cadastro atualizado.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível sincronizar o status.")
        } finally {
            setBusy(null)
        }
    }

    async function handleOperationalSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy("save")
        try {
            const result = await updateArenaPixSplitSettingsAction(arenaId, {
                enabled: operationalForm.enabled,
                asaasWalletId: operationalForm.asaasWalletId,
                asaasAccountId: operationalForm.asaasAccountId,
                holderName: operationalForm.holderName,
                holderDocument: operationalForm.holderDocument,
                pixKey: operationalForm.pixKey,
                platformFeeBasisPoints: operationalForm.platformFeeBasisPoints,
                commissionMode: operationalForm.commissionMode,
                commissionFixedCents: operationalForm.commissionFixedCents,
            })
            if (!result.success) throw new Error(result.error)
            updateSettings(result.data)
            toast.success(result.data.enabled ? "Split ativado para novas reservas." : "Configuração de split atualizada.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível salvar a configuração.")
        } finally {
            setBusy(null)
        }
    }

    return (
        <section className="px-5 py-7 sm:px-8" aria-labelledby="receiving-account-title">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 id="receiving-account-title" className="flex items-center gap-2 text-base font-bold text-arena-navy-800">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-arena-button text-xs font-bold text-white">3</span>
                        Conta de recebimento
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        {settings.onboardingStarted
                            ? "Acompanhe o cadastro e os documentos solicitados pelo Asaas."
                            : "Prepare os dados da empresa. Você pode salvar e continuar depois, independentemente da política de cancelamento."}
                    </p>
                </div>
                <Badge variant="outline" className={cn("h-7", settings.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-800" : isRejected ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
                    {settings.enabled ? <Check className="size-3.5"/> : isRejected ? <XCircle className="size-3.5"/> : <CircleDashed className="size-3.5"/>}
                    {settings.enabled ? "Conta aprovada" : isRejected ? "Cadastro recusado" : settings.onboardingStarted ? "Cadastro iniciado" : "Pendente"}
                </Badge>
            </div>

            {settings.onboardingStarted && (
                <div className="space-y-3">
                    <details open className="group overflow-hidden rounded-xl border border-slate-200">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50 px-4 py-4 text-sm font-semibold text-arena-navy-800 [&::-webkit-details-marker]:hidden">
                            <span>1　Registro operacional</span><ChevronDown className="size-4 transition-transform group-open:rotate-180"/>
                        </summary>
                        <div className="border-t border-slate-200 px-4 py-2 sm:px-5">
                            <dl className="divide-y divide-slate-100 text-sm">
                                <div className="flex flex-wrap justify-between gap-3 py-3"><dt className="text-slate-500">Titular</dt><dd className="font-medium text-arena-navy-800">{settings.holderName || "Em validação"}</dd></div>
                                <div className="flex flex-wrap justify-between gap-3 py-3"><dt className="text-slate-500">CNPJ</dt><dd className="font-medium text-arena-navy-800">{settings.holderDocument || "Em validação"}</dd></div>
                                {isPlatform && <>
                                    <div className="flex flex-wrap justify-between gap-3 py-3"><dt className="text-slate-500">Conta Asaas</dt><dd className="break-all font-mono text-xs">{settings.asaasAccountId || "Pendente"}</dd></div>
                                    <div className="flex flex-wrap justify-between gap-3 py-3"><dt className="text-slate-500">Wallet</dt><dd className="break-all font-mono text-xs">{settings.asaasWalletId || "Pendente"}</dd></div>
                                    <div className="flex flex-wrap justify-between gap-3 py-3"><dt className="text-slate-500">Webhook exclusivo</dt><dd className="text-xs">{settings.webhookConfigured ? "Token registrado" : "Ausente"}</dd></div>
                                </>}
                            </dl>
                        </div>
                    </details>
                    <details open className="group overflow-hidden rounded-xl border border-slate-200">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50 px-4 py-4 text-sm font-semibold text-arena-navy-800 [&::-webkit-details-marker]:hidden">
                            <span>2　Documentos solicitados</span><ChevronDown className="size-4 transition-transform group-open:rotate-180"/>
                        </summary>
                        <div className="border-t border-slate-200 p-4 sm:p-5">
                            {settings.onboardingUrl && (settings.documentationStatus === "PENDING" || settings.documentationStatus === "REJECTED") && (
                                <Button asChild variant="outline" className="mb-4 w-full sm:w-auto"><a href={settings.onboardingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4"/>Enviar documentos solicitados</a></Button>
                            )}
                            {!settings.onboardingUrl && settings.documentationStatus === "PENDING" && settings.hasPaymentAccount && (
                                <p className="mb-4 text-xs leading-5 text-slate-500" role="status">Não há um link de envio nesta consulta. Confira os documentos abaixo: cada solicitação indica como concluir o envio ao Asaas.</p>
                            )}
                            {settings.hasPaymentAccount && !settings.credentialRecoveryRequired && <ArenaAsaasDocumentsPanel arenaId={arenaId} refreshKey={settings.lastStatusCheckedAt ?? settings.updatedAt} onUploaded={() => { void handleSync() }} disabled={busy !== null} onDocumentsReadyChange={onDocumentGroupsReadyChange} embedded />}
                            {settings.credentialRecoveryRequired && <p className="text-sm text-slate-500">Os documentos estarão disponíveis após a conferência do cadastro financeiro.</p>}
                        </div>
                    </details>
                    <section aria-labelledby="asaas-validation-title" className="rounded-xl border border-slate-200 p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div><h4 id="asaas-validation-title" className="text-sm font-semibold text-arena-navy-800">Situação da conta</h4><p className="mt-1 text-xs text-slate-500">Atualização do Asaas: {formatDate(settings.lastStatusCheckedAt)}</p></div>
                            <Button type="button" variant="ghost" size="sm" onClick={handleSync} disabled={busy !== null}>{busy === "sync" ? <Loader2 className="animate-spin"/> : <RefreshCw/>}Atualizar agora</Button>
                        </div>
                        <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
                            <StatusLine label="Aprovação final" status={settings.onboardingStatus} icon={ShieldCheck}/>
                            <StatusLine label="Cadastro empresarial" status={settings.commercialInfoStatus} icon={Building2}/>
                            <StatusLine label="Conta bancária" status={settings.bankAccountInfoStatus} icon={Landmark}/>
                            <StatusLine label="Documentos do responsável" status={settings.documentationStatus} icon={FileCheck2}/>
                        </div>
                        {automaticUpdateError && <p className="mt-3 text-xs font-semibold text-amber-800" role="status">{automaticUpdateError} Você pode usar “Atualizar agora” sem reiniciar o cadastro.</p>}
                    </section>
                </div>
            )}

            {settings.credentialRecoveryRequired && (
                <div className="mt-6 flex flex-col gap-4 border-y border-rose-200 bg-rose-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
                        <div>
                            <p className="text-sm font-bold text-rose-950">Cadastro financeiro precisa de conferência</p>
                            <p className="mt-1 text-xs leading-5 text-rose-800">
                                {settings.asaasAccountId
                                    ? "A subconta foi identificada, mas a chave ainda precisa ser confirmada no cofre. Não inicie outro cadastro."
                                    : "A tentativa de criação precisa ser conferida no Asaas antes de qualquer novo cadastro."}
                            </p>
                        </div>
                    </div>
                    {isPlatform && !settings.asaasAccountId ? (
                        <div className="grid w-full gap-3 sm:max-w-sm">
                            <form onSubmit={handleAccountReconciliation} className="grid gap-2">
                                <p className="text-xs text-rose-800">Confira o ID, a wallet e o CNPJ no painel do Asaas antes de vincular.</p>
                                <Label htmlFor="asaas-reconcile-account">ID da subconta</Label>
                                <Input id="asaas-reconcile-account" value={reconcileAccountId} onChange={(event) => setReconcileAccountId(event.target.value)} required autoComplete="off" />
                                <Label htmlFor="asaas-reconcile-wallet">Wallet da subconta</Label>
                                <Input id="asaas-reconcile-wallet" value={reconcileWalletId} onChange={(event) => setReconcileWalletId(event.target.value)} required autoComplete="off" />
                                <Button type="submit" variant="outline" disabled={busy !== null}>
                                    {busy === "reconcile" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                                    Vincular conta conferida
                                </Button>
                            </form>
                        </div>
                    ) : isPlatform ? (
                        <Button type="button" variant="outline" onClick={handleCredentialRecovery} disabled={busy !== null}>
                            {busy === "recover" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                            Proteger credencial
                        </Button>
                    ) : (
                        <p className="text-xs font-semibold text-rose-800">Entre em contato com a equipe Arena Digital para concluir a conferência.</p>
                    )}
                </div>
            )}

            {(showOnboarding && !settings.onboardingStarted) && (
                <details open className="group overflow-hidden rounded-xl border border-slate-200">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50 px-4 py-4 text-sm font-semibold text-arena-navy-800 [&::-webkit-details-marker]:hidden">
                        <span id="asaas-onboarding-title">1　Registro operacional</span><ChevronDown className="size-4 transition-transform group-open:rotate-180"/>
                    </summary>
                    <form onSubmit={handleCreateSubaccount} onChange={() => setDraftSaved(false)} className="border-t border-slate-200 p-4 sm:p-5" aria-labelledby="asaas-onboarding-title">
                    <fieldset disabled={busy !== null}>
                    <p className="text-xs leading-5 text-slate-500">Aproveitamos os dados já informados no cadastro da arena ou no rascunho. Confira as informações e complete apenas o que falta.</p>
                    {(reusedFields.length > 0 || reviewRegistration) && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-arena-navy-800">Dados já informados</p>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setReviewRegistration(value => !value)}>
                                {reviewRegistration ? 'Concluir revisão' : 'Revisar dados'}
                            </Button>
                        </div>
                        {!reviewRegistration && <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {reusedFields.filter(key => onboardingForm[key].trim()).map(key => <div key={key} className="min-w-0">
                                <dt className="text-xs text-slate-500">{registrationLabels[key]}</dt>
                                <dd className="mt-1 break-words text-sm text-arena-navy-800">{onboardingForm[key]}</dd>
                            </div>)}
                        </dl>}
                        {reviewRegistration && <p className="mt-2 text-xs text-slate-500">As correções abaixo valem para o cadastro de recebimento.</p>}
                    </div>}
                    <div className="mt-5 grid gap-x-4 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                        {needsInput('name') && <div className="space-y-2 xl:col-span-2">
                            <Label htmlFor="baas-name">Nome ou razão social</Label>
                            <Input id="baas-name" value={onboardingForm.name} onChange={(event) => setOnboardingForm((form) => ({ ...form, name: event.target.value }))} autoComplete="organization" required />
                        </div>}
                        {needsInput('cpfCnpj') && <div className="space-y-2">
                            <Label htmlFor="baas-document">CNPJ</Label>
                            <MaskedInput mask="cnpj" id="baas-document" value={onboardingForm.cpfCnpj} onChange={(event) => setOnboardingForm((form) => ({ ...form, cpfCnpj: event.target.value }))} inputMode="text" autoComplete="off" required />
                        </div>}
                        <div className="space-y-2">
                            <Label htmlFor="baas-company-type">Natureza jurídica</Label>
                            <Select value={onboardingForm.companyType} onValueChange={(value) => { setDraftSaved(false); setOnboardingForm(form => ({...form, companyType: value as AsaasCompanyType})) }} disabled={busy !== null}>
                                <SelectTrigger id="baas-company-type"><SelectValue placeholder="Selecione"/></SelectTrigger>
                                <SelectContent>{COMPANY_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        {needsInput('email') && <div className="space-y-2">
                            <Label htmlFor="baas-email">E-mail</Label>
                            <Input id="baas-email" type="email" value={onboardingForm.email} onChange={(event) => setOnboardingForm((form) => ({ ...form, email: event.target.value }))} autoComplete="email" required />
                        </div>}
                        {needsInput('mobilePhone') && <div className="space-y-2">
                            <Label htmlFor="baas-phone">Celular</Label>
                            <MaskedInput mask="phone" id="baas-phone" value={onboardingForm.mobilePhone} onChange={(event) => setOnboardingForm((form) => ({ ...form, mobilePhone: event.target.value }))} inputMode="tel" autoComplete="tel" required />
                        </div>}
                        <div className="space-y-2">
                            <Label htmlFor="baas-income">Faturamento mensal (R$)</Label>
                            <DecimalInput id="baas-income" value={onboardingForm.incomeValue} onChange={(event) => setOnboardingForm((form) => ({ ...form, incomeValue: event.target.value }))} inputMode="decimal" required />
                        </div>
                        {needsInput('address') && <div className="space-y-2 xl:col-span-2">
                            <Label htmlFor="baas-address">Endereço</Label>
                            <Input id="baas-address" value={onboardingForm.address} onChange={(event) => setOnboardingForm((form) => ({ ...form, address: event.target.value }))} autoComplete="street-address" required />
                        </div>}
                        {needsInput('addressNumber') && <div className="space-y-2">
                            <Label htmlFor="baas-address-number">Número</Label>
                            <Input id="baas-address-number" value={onboardingForm.addressNumber} onChange={(event) => setOnboardingForm((form) => ({ ...form, addressNumber: event.target.value }))} required />
                        </div>}
                        {reviewRegistration && <div className="space-y-2">
                            <Label htmlFor="baas-complement">Complemento</Label>
                            <Input id="baas-complement" value={onboardingForm.complement} onChange={(event) => setOnboardingForm((form) => ({ ...form, complement: event.target.value }))} />
                        </div>}
                        {needsInput('province') && <div className="space-y-2">
                            <Label htmlFor="baas-province">Bairro</Label>
                            <Input id="baas-province" value={onboardingForm.province} onChange={(event) => setOnboardingForm((form) => ({ ...form, province: event.target.value }))} required />
                        </div>}
                        {needsInput('postalCode') && <div className="space-y-2">
                            <Label htmlFor="baas-postal-code">CEP</Label>
                            <MaskedInput mask="cep" id="baas-postal-code" value={onboardingForm.postalCode} onChange={(event) => setOnboardingForm((form) => ({ ...form, postalCode: event.target.value }))} inputMode="numeric" autoComplete="postal-code" required />
                        </div>}
                    </div>
                    {!reusedFields.length && !reviewRegistration && <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setReviewRegistration(true)}>Adicionar complemento / revisar dados</Button>}
                    <p className="mt-4 text-xs leading-5 text-slate-500">Salvar rascunho permite continuar depois. O cadastro só é enviado ao Asaas ao confirmar.</p>
                    <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
                        {draftSaved && <span role="status" className="mr-auto text-xs font-medium text-emerald-700">Rascunho salvo</span>}
                        {!isPlatform && <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void handleSaveDraft()}>{busy === "draft" ? <Loader2 className="animate-spin"/> : <Save/>}Salvar rascunho</Button>}
                        <Button type="submit" disabled={busy !== null} className="bg-arena-button text-white hover:bg-arena-button-hover">
                            {busy === "create" ? <Loader2 className="animate-spin" /> : <Building2 />}
                            Confirmar e iniciar cadastro
                        </Button>
                    </div>
                    </fieldset>
                    </form>
                </details>
            )}

            {!settings.onboardingStarted && <details open className="group mt-3 overflow-hidden rounded-xl border border-slate-200">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50 px-4 py-4 text-sm font-semibold text-arena-navy-800 [&::-webkit-details-marker]:hidden"><span>2　Documentos solicitados</span><ChevronDown className="size-4 transition-transform group-open:rotate-180"/></summary>
                <p className="border-t border-slate-200 p-4 text-sm leading-6 text-slate-500">Confirme o cadastro acima para consultar quais documentos o Asaas solicita para sua empresa. Os documentos enviados serão analisados antes da aprovação.</p>
            </details>}

            {isApproved && isPlatform && (
                <form onSubmit={handleOperationalSave} className="mt-7 border-t border-slate-200 pt-6" aria-labelledby="split-operation-title">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                        <div>
                            <h4 id="split-operation-title" className="text-sm font-bold text-slate-950">Operação do split</h4>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Defina a comissão da Arena Digital após as tarifas do Asaas. A arena recebe o restante do valor líquido.</p>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="text-right">
                                <Label htmlFor="app-pix-enabled">Reservas com Pix</Label>
                                <p className="mt-1 text-xs text-slate-500">{operationalForm.enabled ? "Ativo" : "Inativo"}</p>
                            </div>
                            <Switch id="app-pix-enabled" checked={operationalForm.enabled} onCheckedChange={(enabled) => setOperationalForm((form) => ({ ...form, enabled }))} disabled={!isApproved} />
                        </div>
                    </div>

                    <ArenaCommissionFields value={operationalForm} onChange={(next) => setOperationalForm((form) => ({ ...form, ...next }))} />
                    <div className="mt-5 flex justify-end">
                        <Button type="submit" disabled={busy !== null} className="bg-slate-950 text-white hover:bg-slate-800">
                            {busy === "save" ? <Loader2 className="animate-spin" /> : <Check />}
                            Salvar operação
                        </Button>
                    </div>
                </form>
            )}

            {settings.enabled && !isPlatform && (
                <div className="mt-7 grid gap-3 border-y border-emerald-200 bg-emerald-50/70 px-4 py-4 sm:grid-cols-[auto_1fr] sm:items-start">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
                    <div>
                        <p className="text-sm font-bold text-emerald-950">Conta de recebimento aprovada</p>
                        <p className="mt-1 text-xs leading-5 text-emerald-800">
                            A conta está pronta para receber. O pagamento online depende também da política de cancelamento publicada e da solicitação de ativação da Arena.
                        </p>
                    </div>
                </div>
            )}

            {settings.onboardingStarted && !settings.enabled && (
                <div className="mt-7 border-t border-slate-200 pt-5 text-sm text-slate-500">
                    {isApproved
                        ? "A conta foi aprovada, mas o recebimento está desativado. Fale com o suporte da Arena Digital para revisar a operação."
                        : isRejected
                            ? "O cadastro foi recusado pelo Asaas e o recebimento permanece bloqueado. Revise os status acima e siga a ação solicitada antes de tentar novamente."
                            : "O recebimento permanece bloqueado até a aprovação do Asaas. Confira os status e conclua as pendências indicadas acima."}
                </div>
            )}
            {isPlatform && <AsaasProviderNotice className="mt-6" />}
        </section>
    )
}
