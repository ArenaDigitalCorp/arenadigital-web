"use client"

import { useMemo, useState } from "react"
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    FilePenLine,
    Loader2,
    Plus,
    ShieldCheck,
    Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    createArenaCancellationPolicyDraftAction,
    publishArenaCancellationPolicyAction,
    saveArenaCancellationPolicyDraftAction,
} from "@/modules/arenas/actions/cancellationPolicyActions"
import type {
    ArenaCancellationPolicySettings,
    ArenaCancellationPolicyTier,
} from "@/modules/arenas/types/cancellation-policy.types"

type EditableTier = {
    key: string
    minimumHoursBeforeStart: string
    refundPercentage: string
}

type BusyOperation = "create" | "save" | "publish" | null

type Props = {
    arenaId: string
    initialSettings: ArenaCancellationPolicySettings
}

function editableTier(tier: ArenaCancellationPolicyTier | undefined, key: string): EditableTier {
    return {
        key,
        minimumHoursBeforeStart: tier ? String(tier.minimumHoursBeforeStart) : "",
        refundPercentage: tier ? String(tier.refundPercentage) : "",
    }
}

function rowsFromSettings(settings: ArenaCancellationPolicySettings): EditableTier[] {
    const tiers = settings.draftPolicy?.tiers ?? []
    if (tiers.length === 0) {
        return [{ ...editableTier(undefined, "required-zero-tier"), minimumHoursBeforeStart: "0" }]
    }
    return tiers
        .slice()
        .sort((left, right) => right.minimumHoursBeforeStart - left.minimumHoursBeforeStart)
        .map((tier, index) => editableTier(tier, `saved-${index}-${tier.minimumHoursBeforeStart}`))
}

function parsedTiers(rows: EditableTier[]): ArenaCancellationPolicyTier[] | null {
    const tiers = rows.map((row) => ({
        minimumHoursBeforeStart: Number(row.minimumHoursBeforeStart),
        refundPercentage: Number(row.refundPercentage),
    }))

    if (tiers.some((tier) => (
        !Number.isInteger(tier.minimumHoursBeforeStart)
        || tier.minimumHoursBeforeStart < 0
        || !Number.isInteger(tier.refundPercentage)
        || tier.refundPercentage < 0
        || tier.refundPercentage > 100
    ))) {
        return null
    }

    return tiers.sort((left, right) => left.minimumHoursBeforeStart - right.minimumHoursBeforeStart)
}

function policyFingerprint(tiers: ArenaCancellationPolicyTier[]): string {
    return JSON.stringify(tiers.slice().sort(
        (left, right) => left.minimumHoursBeforeStart - right.minimumHoursBeforeStart,
    ))
}

function formatPublishedAt(value: string | null): string {
    if (!value) return ""
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value))
}

function PolicyTiers({ tiers }: { tiers: ArenaCancellationPolicyTier[] }) {
    return (
        <div className="grid gap-2 md:grid-cols-3">
            {tiers
                .slice()
                .sort((left, right) => right.minimumHoursBeforeStart - left.minimumHoursBeforeStart)
                .map((tier) => (
                    <div
                        key={tier.minimumHoursBeforeStart}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                            {tier.minimumHoursBeforeStart === 0
                                ? "Próximo ao início"
                                : `${tier.minimumHoursBeforeStart}h ou mais`}
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                            {tier.refundPercentage}% de reembolso
                        </p>
                    </div>
                ))}
        </div>
    )
}

export function ArenaCancellationPolicyCard({ arenaId, initialSettings }: Props) {
    const [settings, setSettings] = useState(initialSettings)
    const [rows, setRows] = useState<EditableTier[]>(() => rowsFromSettings(initialSettings))
    const [busy, setBusy] = useState<BusyOperation>(null)
    const [publishDialogOpen, setPublishDialogOpen] = useState(false)

    const normalizedRows = useMemo(() => parsedTiers(rows), [rows])
    const isDirty = settings.draftPolicy
        ? policyFingerprint(normalizedRows ?? []) !== policyFingerprint(settings.draftPolicy.tiers)
        : false

    function applySettings(nextSettings: ArenaCancellationPolicySettings) {
        setSettings(nextSettings)
        setRows(rowsFromSettings(nextSettings))
    }

    async function handleCreateDraft() {
        setBusy("create")
        try {
            const response = await createArenaCancellationPolicyDraftAction(arenaId)
            if (!response.success) throw new Error(response.error)
            applySettings(response.data)
            toast.success("Rascunho criado. Nenhuma regra foi publicada ainda.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível criar o rascunho.")
        } finally {
            setBusy(null)
        }
    }

    async function handleSaveDraft() {
        if (!settings.draftPolicy || !normalizedRows) {
            toast.error("Preencha horas e percentuais inteiros válidos em todas as faixas.")
            return
        }

        setBusy("save")
        try {
            const response = await saveArenaCancellationPolicyDraftAction(
                arenaId,
                settings.draftPolicy.id,
                normalizedRows,
            )
            if (!response.success) throw new Error(response.error)
            applySettings(response.data)
            toast.success("Rascunho salvo. A versão publicada continua inalterada.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível salvar o rascunho.")
        } finally {
            setBusy(null)
        }
    }

    async function handlePublish() {
        if (!settings.draftPolicy || isDirty) return
        setBusy("publish")
        try {
            const response = await publishArenaCancellationPolicyAction(arenaId, settings.draftPolicy.id)
            if (!response.success) throw new Error(response.error)
            applySettings(response.data)
            setPublishDialogOpen(false)
            toast.success("Política publicada para novas reservas online.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível publicar a política.")
        } finally {
            setBusy(null)
        }
    }

    function updateRow(key: string, field: "minimumHoursBeforeStart" | "refundPercentage", value: string) {
        setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row))
    }

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10">
                            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold">Política de cancelamento</h3>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
                                Defina quanto o atleta recebe de volta conforme a antecedência do cancelamento.
                            </p>
                        </div>
                    </div>
                    <Badge className={settings.currentPolicy
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                        : "border-amber-400/30 bg-amber-400/10 text-amber-200"}
                    >
                        {settings.currentPolicy ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                        {settings.currentPolicy ? `Versão ${settings.currentPolicy.version} publicada` : "Publicação pendente"}
                    </Badge>
                </div>
            </div>

            <div className="space-y-6 px-5 py-6 sm:px-6">
                {settings.currentPolicy ? (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <p className="text-sm font-bold text-slate-950">Regra vigente</p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Publicada em {formatPublishedAt(settings.currentPolicy.publishedAt)}. Reservas já contratadas preservam a versão aceita.
                                </p>
                            </div>
                            {settings.publishedVersions.length > 1 && (
                                <span className="text-xs font-medium text-slate-400">
                                    {settings.publishedVersions.length - 1} versão(ões) anterior(es) preservada(s)
                                </span>
                            )}
                        </div>
                        <PolicyTiers tiers={settings.currentPolicy.tiers} />
                    </div>
                ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                            <div>
                                <p className="font-bold">Reservas com pagamento online continuam desativadas</p>
                                <p className="mt-1 leading-6 text-amber-800">
                                    Crie, revise e publique uma política. Nenhum valor sugerido será ativado automaticamente.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {!settings.draftPolicy ? (
                    <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 sm:flex-row sm:items-center">
                        <div>
                            <p className="font-bold text-slate-950">
                                {settings.currentPolicy ? "Criar uma nova versão" : "Configurar a primeira política"}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                O rascunho não afeta reservas até que seja publicado.
                            </p>
                        </div>
                        <Button onClick={() => void handleCreateDraft()} disabled={busy !== null}>
                            {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePenLine className="h-4 w-4" />}
                            Criar rascunho
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-5 rounded-xl border border-sky-200 bg-sky-50/40 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="font-bold text-slate-950">Rascunho da versão {settings.draftPolicy.version}</p>
                                <p className="mt-1 text-sm text-slate-500">
                                    A maior antecedência compatível será aplicada. A faixa de 0 hora é obrigatória.
                                </p>
                            </div>
                            <Badge variant="outline" className="border-sky-200 bg-white text-sky-800">
                                {isDirty ? "Alterações não salvas" : "Rascunho salvo"}
                            </Badge>
                        </div>

                        <div className="space-y-3">
                            {rows.map((row, index) => (
                                <div key={row.key} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                    <div className="space-y-2">
                                        <Label htmlFor={`hours-${row.key}`}>Antecedência mínima (horas)</Label>
                                        <Input
                                            id={`hours-${row.key}`}
                                            type="number"
                                            min={0}
                                            step={1}
                                            inputMode="numeric"
                                            value={row.minimumHoursBeforeStart}
                                            onChange={(event) => updateRow(row.key, "minimumHoursBeforeStart", event.target.value)}
                                            placeholder={index === rows.length - 1 ? "0" : "Ex.: 24"}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`refund-${row.key}`}>Reembolso (%)</Label>
                                        <Input
                                            id={`refund-${row.key}`}
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={1}
                                            inputMode="numeric"
                                            value={row.refundPercentage}
                                            onChange={(event) => updateRow(row.key, "refundPercentage", event.target.value)}
                                            placeholder="0 a 100"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="justify-self-end text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                                        aria-label="Remover faixa"
                                        disabled={rows.length === 1 || busy !== null}
                                        onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col justify-between gap-3 sm:flex-row">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy !== null || rows.length >= 100}
                                onClick={() => setRows((current) => [
                                    ...current,
                                    editableTier(undefined, `new-${Date.now()}-${current.length}`),
                                ])}
                            >
                                <Plus className="h-4 w-4" />
                                Adicionar faixa
                            </Button>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busy !== null || !isDirty || !normalizedRows}
                                    onClick={() => void handleSaveDraft()}
                                >
                                    {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Salvar rascunho
                                </Button>
                                <Button
                                    type="button"
                                    disabled={busy !== null || isDirty || settings.draftPolicy.tiers.length === 0}
                                    onClick={() => setPublishDialogOpen(true)}
                                >
                                    Publicar política
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Publicar a versão {settings.draftPolicy?.version}?</DialogTitle>
                        <DialogDescription className="leading-6">
                            Depois da publicação, esta versão e suas faixas não poderão ser editadas. Novas reservas online guardarão uma cópia dessas condições.
                        </DialogDescription>
                    </DialogHeader>
                    {settings.draftPolicy && <PolicyTiers tiers={settings.draftPolicy.tiers} />}
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={busy === "publish"}>Voltar e revisar</Button>
                        </DialogClose>
                        <Button type="button" disabled={busy === "publish"} onClick={() => void handlePublish()}>
                            {busy === "publish" && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirmar publicação
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    )
}
