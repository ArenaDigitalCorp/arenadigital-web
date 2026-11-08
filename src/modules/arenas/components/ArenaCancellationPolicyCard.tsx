"use client"

import { useMemo, useState } from "react"
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    FilePenLine,
    Loader2,
    Plus,
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
import { cancellationPolicyTiersSchema } from "@/modules/arenas/schemas/cancellation-policy.schema"
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
    onSettingsChange?: (settings: ArenaCancellationPolicySettings) => void
}

function editableTier(tier: ArenaCancellationPolicyTier | undefined, key: string): EditableTier {
    return {
        key,
        minimumHoursBeforeStart: tier ? String(tier.minimumHoursBeforeStart) : "",
        refundPercentage: tier ? String(tier.refundPercentage) : "",
    }
}

/** A persisted 0h / 0% fallback is represented by the summary, not a mandatory rule.
 * Explicit legacy refunds at 0h remain visible and editable. */
function configuredTiers(tiers: ArenaCancellationPolicyTier[]): ArenaCancellationPolicyTier[] {
    const hasPositiveThreshold = tiers.some((tier) => tier.minimumHoursBeforeStart > 0)
    return tiers.filter((tier) => !hasPositiveThreshold || tier.minimumHoursBeforeStart !== 0 || tier.refundPercentage !== 0)
}

function fallbackSummary(tiers: ArenaCancellationPolicyTier[]): string | null {
    const configured = configuredTiers(tiers)
    if (!configured.length) return null
    const minimum = Math.min(...configured.map((tier) => tier.minimumHoursBeforeStart))
    return minimum > 0 ? `Menos de ${minimum}h: sem reembolso.` : null
}

function rowsFromSettings(settings: ArenaCancellationPolicySettings): EditableTier[] {
    const tiers = configuredTiers(settings.draftPolicy?.tiers ?? [])
    if (tiers.length === 0) return [editableTier(undefined, "first-rule")]
    return tiers
        .slice()
        .sort((left, right) => right.minimumHoursBeforeStart - left.minimumHoursBeforeStart)
        .map((tier, index) => editableTier(tier, `saved-${index}-${tier.minimumHoursBeforeStart}`))
}

function parsedTiers(rows: EditableTier[]): ArenaCancellationPolicyTier[] | null {
    const tiers: ArenaCancellationPolicyTier[] = []
    for (const row of rows) {
        const hoursText = row.minimumHoursBeforeStart
        const refundText = row.refundPercentage
        if (typeof hoursText !== "string" || !/^\d+$/.test(hoursText.trim())
            || typeof refundText !== "string" || !/^\d+$/.test(refundText.trim())) {
            return null
        }

        const minimumHoursBeforeStart = Number(hoursText)
        const refundPercentage = Number(refundText)
        if (!Number.isSafeInteger(minimumHoursBeforeStart)
            || minimumHoursBeforeStart > 2_147_483_647
            || !Number.isSafeInteger(refundPercentage)
            || refundPercentage > 100) {
            return null
        }
        tiers.push({ minimumHoursBeforeStart, refundPercentage })
    }

    const result = cancellationPolicyTiersSchema.safeParse(tiers)
    return result.success
        ? result.data.sort((left, right) => left.minimumHoursBeforeStart - right.minimumHoursBeforeStart)
        : null
}

function policyFingerprint(tiers: ArenaCancellationPolicyTier[]): string {
    return JSON.stringify(configuredTiers(tiers).sort(
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
    const fallback = fallbackSummary(tiers)
    const sortedTiers = configuredTiers(tiers)
        .slice()
        .sort((left, right) => right.minimumHoursBeforeStart - left.minimumHoursBeforeStart)
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {sortedTiers.map((tier, index) => {
                    const upperThreshold = sortedTiers[index - 1]?.minimumHoursBeforeStart
                    const rangeLabel = upperThreshold === undefined
                        ? tier.minimumHoursBeforeStart === 0 ? "Até o início da reserva" : `${tier.minimumHoursBeforeStart}h ou mais antes do início`
                        : tier.minimumHoursBeforeStart === 0
                            ? `Menos de ${upperThreshold}h antes do início`
                            : `De ${tier.minimumHoursBeforeStart}h até menos de ${upperThreshold}h antes do início`
                    return (
                        <div key={tier.minimumHoursBeforeStart} className="min-w-40 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <p className="text-xs text-slate-500">{rangeLabel}</p>
                            <p className="mt-1 text-sm font-semibold text-arena-navy-800">{tier.refundPercentage}% de reembolso</p>
                        </div>
                    )
                })}
            </div>
            {fallback && <p className="text-xs leading-5 text-slate-500">{fallback}</p>}
        </div>
    )
}

export function ArenaCancellationPolicyCard({ arenaId, initialSettings, onSettingsChange }: Props) {
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
        onSettingsChange?.(nextSettings)
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
        <section className="px-5 py-6 sm:px-7" aria-labelledby="cancellation-policy-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-arena-button text-xs font-bold text-white" aria-hidden="true">2</span>
                        <h3 id="cancellation-policy-title" className="text-base font-bold text-arena-navy-800">Política de cancelamento</h3>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Defina quanto o atleta recebe de volta conforme a antecedência do cancelamento.
                    </p>
                </div>
                <Badge className={settings.currentPolicy
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"}
                >
                    {settings.currentPolicy ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                    {settings.currentPolicy ? `Versão ${settings.currentPolicy.version} publicada` : "Publicação pendente"}
                </Badge>
            </div>

            <div className="mt-5 space-y-5">
                {settings.currentPolicy ? (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-arena-navy-800">Regra vigente</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    Publicada em {formatPublishedAt(settings.currentPolicy.publishedAt)}. Reservas já contratadas preservam a versão aceita.
                                </p>
                            </div>
                            {settings.publishedVersions.length > 1 && (
                                <span className="text-xs text-slate-500">
                                    {settings.publishedVersions.length - 1} versão(ões) anterior(es) preservada(s)
                                </span>
                            )}
                        </div>
                        <PolicyTiers tiers={settings.currentPolicy.tiers} />
                    </div>
                ) : (
                    <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-3 text-xs leading-5 text-amber-900">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p>Publique a primeira política para liberar o pagamento online. Pré-reservas não exigem esta etapa. Nenhum valor sugerido será ativado automaticamente.</p>
                    </div>
                )}

                {!settings.draftPolicy ? (
                    <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center">
                        <div>
                            <p className="text-sm font-semibold text-arena-navy-800">
                                {settings.currentPolicy ? "Criar uma nova versão" : "Configurar a primeira política"}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Prepare as regras e publique quando estiverem prontas.</p>
                        </div>
                        <Button size="sm" className="bg-arena-button text-white hover:bg-arena-button-hover" onClick={() => void handleCreateDraft()} disabled={busy !== null}>
                            {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePenLine className="h-4 w-4" />}
                            Criar rascunho
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-arena-navy-800">Rascunho da versão {settings.draftPolicy.version}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    A maior antecedência compatível será aplicada. Abaixo da menor regra, o reembolso é zero.
                                </p>
                            </div>
                            <span role="status" className="text-xs text-slate-500">{isDirty ? "Alterações não salvas" : "Rascunho salvo"}</span>
                        </div>

                        <fieldset disabled={busy !== null} className="space-y-3">
                            <legend className="sr-only">Regras de cancelamento</legend>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {rows.map((row, index) => (
                                    <div key={row.key} className="relative rounded-lg border border-slate-200 bg-slate-50/70 p-3 pr-10">
                                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Regra {index + 1}</p>
                                        <div className="space-y-2.5">
                                            <div className="flex items-center gap-2">
                                                <Label htmlFor={`hours-${row.key}`} className="sr-only">Antecedência da regra {index + 1} (horas)</Label>
                                                <Input
                                                    id={`hours-${row.key}`}
                                                    aria-describedby={`hours-${row.key}-hint`}
                                                    type="number" min={0} step={1} inputMode="numeric"
                                                    value={row.minimumHoursBeforeStart}
                                                    onChange={(event) => updateRow(row.key, "minimumHoursBeforeStart", event.target.value)}
                                                    placeholder="Ex.: 4"
                                                    className="h-9 w-20 bg-white px-2 text-sm font-semibold text-arena-navy-800"
                                                />
                                                <span id={`hours-${row.key}-hint`} className="text-xs text-slate-600">horas ou mais</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Label htmlFor={`refund-${row.key}`} className="sr-only">Percentual de reembolso da regra {index + 1}</Label>
                                                <Input
                                                    id={`refund-${row.key}`}
                                                    aria-describedby={`refund-${row.key}-hint`}
                                                    type="number" min={0} max={100} step={1} inputMode="numeric"
                                                    value={row.refundPercentage}
                                                    onChange={(event) => updateRow(row.key, "refundPercentage", event.target.value)}
                                                    placeholder="0–100"
                                                    className="h-9 w-20 bg-white px-2 text-sm font-semibold text-arena-navy-800"
                                                />
                                                <span id={`refund-${row.key}-hint`} className="text-xs text-slate-600">% de reembolso</span>
                                            </div>
                                        </div>
                                        <Button
                                            type="button" variant="ghost" size="icon-sm"
                                            className="absolute right-1 top-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                                            aria-label={`Remover regra ${index + 1}`}
                                            disabled={rows.length === 1 || busy !== null}
                                            onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Button
                                type="button" variant="outline" size="sm"
                                className="border-dashed border-orange-300 bg-orange-50/40 text-orange-700 hover:bg-orange-50"
                                disabled={busy !== null || rows.length >= 100}
                                onClick={() => setRows((current) => [
                                    ...current,
                                    editableTier(undefined, `new-${Date.now()}-${current.length}`),
                                ])}
                            >
                                <Plus className="h-4 w-4" />
                                Adicionar nova regra
                            </Button>
                        </fieldset>

                        {normalizedRows && fallbackSummary(normalizedRows) && (
                            <p role="status" className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{fallbackSummary(normalizedRows)}</p>
                        )}
                        <p className="text-xs leading-5 text-slate-500">Salvar o rascunho não altera a política vigente. Publique a nova versão para aplicá-la às próximas reservas.</p>
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button type="button" variant="outline" disabled={busy !== null || !isDirty || !normalizedRows} onClick={() => void handleSaveDraft()}>
                                {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
                                Salvar rascunho
                            </Button>
                            <Button
                                type="button" className="bg-arena-button text-white hover:bg-arena-button-hover"
                                disabled={busy !== null || isDirty || settings.draftPolicy.tiers.length === 0}
                                onClick={() => setPublishDialogOpen(true)}
                            >
                                Publicar política
                            </Button>
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
