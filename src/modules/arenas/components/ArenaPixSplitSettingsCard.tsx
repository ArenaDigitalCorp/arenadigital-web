"use client"

import type { FormEvent } from "react"
import { useState } from "react"
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
    WalletCards,
    XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    createArenaAsaasSubaccountAction,
    recoverArenaAsaasSubaccountCredentialAction,
    syncArenaAsaasSubaccountStatusAction,
    updateArenaPixSplitSettingsAction,
} from "@/modules/arenas/actions/arenaActions"
import type {
    ArenaAsaasOnboardingStatus,
    ArenaPixSplitSettings,
    AsaasCompanyType,
} from "@/modules/arenas/types/pix-split.types"
import { cn } from "@/lib/utils"

interface Props {
    arenaId: string
    arenaName: string
    initialSettings: ArenaPixSplitSettings
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
    accessMode?: "platform" | "arena"
}

type BusyOperation = "create" | "recover" | "sync" | "save" | null

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
    arenaName,
    initialSettings,
    registration,
    accessMode = "platform",
}: Props) {
    const [settings, setSettings] = useState(initialSettings)
    const [operationalForm, setOperationalForm] = useState(initialSettings)
    const [busy, setBusy] = useState<BusyOperation>(null)
    const [showOnboarding, setShowOnboarding] = useState(!initialSettings.onboardingStarted)
    const [onboardingForm, setOnboardingForm] = useState({
        name: initialSettings.holderName || arenaName,
        email: registration.email,
        cpfCnpj: initialSettings.holderDocument || registration.document,
        companyType: "LIMITED" as AsaasCompanyType,
        mobilePhone: registration.phone,
        incomeValue: "",
        address: registration.address,
        addressNumber: registration.addressNumber,
        complement: registration.complement,
        province: registration.province,
        postalCode: registration.postalCode,
    })

    const isApproved =
        settings.onboardingStatus === "APPROVED" &&
        settings.webhookConfigured &&
        settings.paymentFlow === "arena_subaccount_split"
    const isPlatform = accessMode === "platform"

    function updateSettings(next: ArenaPixSplitSettings) {
        setSettings(next)
        setOperationalForm(next)
    }

    async function handleCreateSubaccount(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy("create")
        try {
            const result = await createArenaAsaasSubaccountAction(arenaId, {
                ...onboardingForm,
                incomeValue: Number(onboardingForm.incomeValue),
            })
            if (!result.success) {
                updateSettings(result.data)
                throw new Error(result.error)
            }
            updateSettings(result.data)
            setShowOnboarding(false)
            if (result.warning) toast.warning(result.warning)
            else toast.success("Subconta criada. Sincronize o status após alguns segundos.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível criar a subconta Asaas.")
        } finally {
            setBusy(null)
        }
    }

    async function handleCredentialRecovery() {
        setBusy("recover")
        try {
            const result = await recoverArenaAsaasSubaccountCredentialAction(arenaId)
            if (!result.success) throw new Error(result.error)
            updateSettings(result.data)
            toast.success("Credencial protegida no cofre. A sincronização foi liberada.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível recuperar a credencial.")
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
            toast.success(result.data.enabled ? "Status atualizado; o split continua ativo." : "Status cadastral atualizado.")
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
        <div className="border-t border-slate-200 pt-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-950 text-white">
                        <WalletCards className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-950">Conta de recebimento</h3>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                            {settings.onboardingStarted
                                ? "Acompanhe a validação da conta que receberá as reservas pagas pelo aplicativo."
                                : isPlatform
                                    ? "Onboarding financeiro da arena e configuração da taxa da plataforma."
                                    : "Cadastre a empresa que receberá automaticamente os pagamentos das reservas online."}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                    <Badge variant="outline" className={cn(
                        "h-7",
                        settings.enabled
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-slate-50 text-slate-600",
                    )}>
                        {settings.enabled ? <Check className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
                        {isPlatform
                            ? settings.enabled ? "Split ativo" : "Split inativo"
                            : settings.enabled ? "Recebimento ativo" : isApproved ? "Conta pronta" : "Em configuração"}
                    </Badge>
                    <Badge variant="outline" className={cn(
                        "h-7",
                        "border-sky-200 bg-sky-50 text-sky-800",
                    )}>
                        {settings.onboardingStarted ? "Subconta BaaS" : "Não configurado"}
                    </Badge>
                </div>
            </div>

            {settings.onboardingStarted && (
                <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.72fr)]">
                    <section aria-labelledby="asaas-validation-title">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h4 id="asaas-validation-title" className="text-sm font-bold text-slate-950">Validação cadastral</h4>
                                <p className="mt-1 text-xs text-slate-500">Última consulta: {formatDate(settings.lastStatusCheckedAt)}</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={handleSync} disabled={busy !== null}>
                                {busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                                Sincronizar
                            </Button>
                        </div>
                        <div className="mt-4 border-y border-slate-200">
                            <StatusLine label="Aprovação geral" status={settings.onboardingStatus} icon={ShieldCheck} />
                            <StatusLine label="Dados comerciais" status={settings.commercialInfoStatus} icon={Building2} />
                            <StatusLine label="Conta bancária" status={settings.bankAccountInfoStatus} icon={Landmark} />
                            <StatusLine label="Documentação" status={settings.documentationStatus} icon={FileCheck2} />
                        </div>
                        {settings.onboardingUrl && (
                            <Button asChild variant="outline" className="mt-4 w-full sm:w-auto">
                                <a href={settings.onboardingUrl} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                    Abrir envio de documentos
                                </a>
                            </Button>
                        )}
                    </section>

                    <section aria-labelledby="asaas-account-title" className="lg:border-l lg:border-slate-200 lg:pl-7">
                        <h4 id="asaas-account-title" className="text-sm font-bold text-slate-950">Registro operacional</h4>
                        <dl className="mt-4 space-y-4 text-sm">
                            {isPlatform ? (
                                <>
                                    <div>
                                        <dt className="text-xs text-slate-500">Conta Asaas</dt>
                                        <dd className="mt-1 break-all font-mono text-xs font-semibold text-slate-800">{settings.asaasAccountId || "Pendente"}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-slate-500">Wallet</dt>
                                        <dd className="mt-1 break-all font-mono text-xs font-semibold text-slate-800">{settings.asaasWalletId || "Pendente"}</dd>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <dt className="text-xs text-slate-500">Titular</dt>
                                        <dd className="mt-1 text-xs font-semibold text-slate-800">{settings.holderName || "Em validação"}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-slate-500">CNPJ</dt>
                                        <dd className="mt-1 text-xs font-semibold text-slate-800">{settings.holderDocument || "Em validação"}</dd>
                                    </div>
                                </>
                            )}
                            <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                                <dt className="text-xs text-slate-500">Webhook exclusivo</dt>
                                <dd className={cn("flex items-center gap-1.5 text-xs font-bold", settings.webhookConfigured ? "text-emerald-700" : "text-rose-700")}>
                                    {settings.webhookConfigured ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                    {settings.webhookConfigured ? "Protegido" : "Ausente"}
                                </dd>
                            </div>
                        </dl>
                    </section>
                </div>
            )}

            {settings.credentialRecoveryRequired && (
                <div className="mt-6 flex flex-col gap-4 border-y border-rose-200 bg-rose-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
                        <div>
                            <p className="text-sm font-bold text-rose-950">Proteção da credencial pendente</p>
                            <p className="mt-1 text-xs leading-5 text-rose-800">A subconta já existe e nenhuma nova conta será criada.</p>
                        </div>
                    </div>
                    {isPlatform ? (
                        <Button type="button" variant="outline" onClick={handleCredentialRecovery} disabled={busy !== null}>
                            {busy === "recover" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                            Proteger credencial
                        </Button>
                    ) : (
                        <p className="text-xs font-semibold text-rose-800">A equipe Arena Digital já foi avisada para concluir a proteção.</p>
                    )}
                </div>
            )}

            {(showOnboarding && !settings.onboardingStarted) && (
                <form onSubmit={handleCreateSubaccount} className="mt-7" aria-labelledby="asaas-onboarding-title">
                    <div className="border-b border-slate-200 pb-4">
                        <h4 id="asaas-onboarding-title" className="text-sm font-bold text-slate-950">
                            Criar subconta Asaas
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                            Os dados serão submetidos à validação cadastral do Asaas. A credencial gerada será armazenada no cofre do backend.
                        </p>
                    </div>
                    <div className="mt-5 grid gap-x-4 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2 xl:col-span-2">
                            <Label htmlFor="baas-name">Nome ou razão social</Label>
                            <Input id="baas-name" value={onboardingForm.name} onChange={(event) => setOnboardingForm((form) => ({ ...form, name: event.target.value }))} autoComplete="organization" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="baas-document">CNPJ</Label>
                            <Input id="baas-document" value={onboardingForm.cpfCnpj} onChange={(event) => setOnboardingForm((form) => ({ ...form, cpfCnpj: event.target.value }))} inputMode="numeric" autoComplete="off" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="baas-company-type">Natureza jurídica</Label>
                            <select id="baas-company-type" value={onboardingForm.companyType} onChange={(event) => setOnboardingForm((form) => ({ ...form, companyType: event.target.value as AsaasCompanyType }))} className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                                {COMPANY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="baas-email">E-mail</Label>
                            <Input id="baas-email" type="email" value={onboardingForm.email} onChange={(event) => setOnboardingForm((form) => ({ ...form, email: event.target.value }))} autoComplete="email" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="baas-phone">Celular</Label>
                            <Input id="baas-phone" value={onboardingForm.mobilePhone} onChange={(event) => setOnboardingForm((form) => ({ ...form, mobilePhone: event.target.value }))} inputMode="tel" autoComplete="tel" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="baas-income">Faturamento mensal (R$)</Label>
                            <Input id="baas-income" type="number" min="0.01" step="0.01" value={onboardingForm.incomeValue} onChange={(event) => setOnboardingForm((form) => ({ ...form, incomeValue: event.target.value }))} inputMode="decimal" required />
                        </div>
                        <div className="space-y-2 xl:col-span-2">
                            <Label htmlFor="baas-address">Endereço</Label>
                            <Input id="baas-address" value={onboardingForm.address} onChange={(event) => setOnboardingForm((form) => ({ ...form, address: event.target.value }))} autoComplete="street-address" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="baas-address-number">Número</Label>
                            <Input id="baas-address-number" value={onboardingForm.addressNumber} onChange={(event) => setOnboardingForm((form) => ({ ...form, addressNumber: event.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="baas-complement">Complemento</Label>
                            <Input id="baas-complement" value={onboardingForm.complement} onChange={(event) => setOnboardingForm((form) => ({ ...form, complement: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="baas-province">Bairro</Label>
                            <Input id="baas-province" value={onboardingForm.province} onChange={(event) => setOnboardingForm((form) => ({ ...form, province: event.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="baas-postal-code">CEP</Label>
                            <Input id="baas-postal-code" value={onboardingForm.postalCode} onChange={(event) => setOnboardingForm((form) => ({ ...form, postalCode: event.target.value }))} inputMode="numeric" autoComplete="postal-code" required />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end border-t border-slate-200 pt-5">
                        <Button type="submit" disabled={busy !== null} className="bg-slate-950 text-white hover:bg-slate-800">
                            {busy === "create" ? <Loader2 className="animate-spin" /> : <Building2 />}
                            Criar subconta
                        </Button>
                    </div>
                </form>
            )}

            {isApproved && isPlatform && (
                <form onSubmit={handleOperationalSave} className="mt-7 border-t border-slate-200 pt-6" aria-labelledby="split-operation-title">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                        <div>
                            <h4 id="split-operation-title" className="text-sm font-bold text-slate-950">Operação do split</h4>
                            <p className="mt-1 text-xs leading-5 text-slate-500">A comissão é calculada sobre o valor bruto e enviada como valor fixo em cada nova cobrança. A arena recebe o saldo líquido após a tarifa do Asaas.</p>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="text-right">
                                <Label htmlFor="app-pix-enabled">Reservas com Pix</Label>
                                <p className="mt-1 text-xs text-slate-500">{operationalForm.enabled ? "Ativo" : "Inativo"}</p>
                            </div>
                            <Switch id="app-pix-enabled" checked={operationalForm.enabled} onCheckedChange={(enabled) => setOperationalForm((form) => ({ ...form, enabled }))} disabled={!isApproved} />
                        </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="platform-split-fee">Taxa Arena Digital (%)</Label>
                            <Input id="platform-split-fee" type="number" min="0" max="100" step="0.01" value={(operationalForm.platformFeeBasisPoints / 100).toFixed(2)} onChange={(event) => setOperationalForm((form) => ({ ...form, platformFeeBasisPoints: Math.round(Number(event.target.value) * 100) }))} inputMode="decimal" />
                        </div>
                        <div className="flex items-end">
                            <div className="w-full border-y border-slate-200 py-3 text-sm text-slate-600">
                                Arena: <strong className="text-slate-950">{((10_000 - operationalForm.platformFeeBasisPoints) / 100).toFixed(2)}%</strong>
                                <span className="mx-2 text-slate-300">|</span>
                                Plataforma: <strong className="text-slate-950">{(operationalForm.platformFeeBasisPoints / 100).toFixed(2)}%</strong>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 flex justify-end">
                        <Button type="submit" disabled={busy !== null} className="bg-slate-950 text-white hover:bg-slate-800">
                            {busy === "save" ? <Loader2 className="animate-spin" /> : <Check />}
                            Salvar operação
                        </Button>
                    </div>
                </form>
            )}

            {isApproved && !isPlatform && (
                <div className="mt-7 grid gap-3 border-y border-emerald-200 bg-emerald-50/70 px-4 py-4 sm:grid-cols-[auto_1fr] sm:items-start">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
                    <div>
                        <p className="text-sm font-bold text-emerald-950">Conta de recebimento aprovada</p>
                        <p className="mt-1 text-xs leading-5 text-emerald-800">
                            A ativação das reservas online será liberada quando a política de cancelamento também estiver publicada e os testes financeiros da Arena estiverem concluídos.
                        </p>
                    </div>
                </div>
            )}

            {settings.onboardingStarted && !isApproved && (
                <div className="mt-7 border-t border-slate-200 pt-5 text-sm text-slate-500">
                    O split permanece bloqueado até a aprovação geral e a confirmação do webhook exclusivo da subconta.
                </div>
            )}
        </div>
    )
}
