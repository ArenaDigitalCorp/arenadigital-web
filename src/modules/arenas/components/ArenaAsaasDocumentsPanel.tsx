"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import type { FormEvent } from "react"
import { AlertCircle, CheckCircle2, ExternalLink, FileText, Loader2, RefreshCw, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
    MAX_ASAAS_DOCUMENT_FILE_BYTES,
    type ArenaAsaasDocumentGroup,
} from "@/modules/arenas/types/asaas-documents.types"

interface Props {
    arenaId: string
    refreshKey: string | null
    onUploaded?: () => void
    disabled?: boolean
}

const DOCUMENT_STATUS_LABELS: Record<ArenaAsaasDocumentGroup["status"], string> = {
    NOT_SENT: "Não enviado",
    PENDING: "Em análise",
    AWAITING_APPROVAL: "Em análise",
    APPROVED: "Aprovado",
    REJECTED: "Reenvio solicitado",
    IGNORED: "Dispensado",
    UNKNOWN: "Consultar situação",
}

function responseError(value: unknown, fallback: string): string {
    if (value && typeof value === "object" && "error" in value && typeof value.error === "string") {
        return value.error
    }
    return fallback
}

function DocumentUploadForm({
    arenaId,
    group,
    disabled,
    onUploaded,
}: {
    arenaId: string
    group: ArenaAsaasDocumentGroup
    disabled: boolean
    onUploaded: () => Promise<void>
}) {
    const inputId = useId()
    const inputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [requestId, setRequestId] = useState<string | null>(null)
    const [explicitRetry, setExplicitRetry] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const requiresRetryConfirmation = group.attemptStatus === "failed" || group.attemptStatus === "submitted"
    const imagesOnly = group.type === "IDENTIFICATION_SELFIE"
    const formatHint = imagesOnly ? "JPG ou PNG" : "JPG, PNG ou PDF"

    function selectFile(selected: File | null) {
        setError(null)
        setExplicitRetry(false)
        setFile(null)
        setRequestId(null)
        if (!selected) return
        if (!selected.size || selected.size > MAX_ASAAS_DOCUMENT_FILE_BYTES) {
            setError("Selecione um arquivo de até 3 MB que não esteja vazio.")
            if (inputRef.current) inputRef.current.value = ""
            return
        }
        const allowedTypes = imagesOnly
            ? ["image/jpeg", "image/png"]
            : ["image/jpeg", "image/png", "application/pdf"]
        if (!allowedTypes.includes(selected.type)) {
            setError(`Formato não aceito. Use ${formatHint}.`)
            if (inputRef.current) inputRef.current.value = ""
            return
        }
        setFile(selected)
        setRequestId(crypto.randomUUID())
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!file || !requestId || sending || (requiresRetryConfirmation && !explicitRetry)) return
        setSending(true)
        setError(null)
        try {
            const body = new FormData()
            body.set("documentGroupId", group.id)
            body.set("requestId", requestId)
            body.set("explicitRetry", String(explicitRetry))
            body.set("documentFile", file)
            const response = await fetch(`/api/arenas/${encodeURIComponent(arenaId)}/asaas/documents`, {
                method: "POST",
                credentials: "same-origin",
                body,
            })
            const result = await response.json()
            if (!response.ok || !result.success) {
                throw new Error(responseError(result, "Não foi possível enviar este documento."))
            }
            if (result.data.status !== "submitted") {
                throw new Error("O resultado do envio precisa de conferência. Atualize os documentos antes de continuar.")
            }
            setFile(null)
            setRequestId(null)
            setExplicitRetry(false)
            if (inputRef.current) inputRef.current.value = ""
            toast.success("Documento enviado ao Asaas. Aguarde a análise.")
            await onUploaded()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível confirmar o envio. Atualize os documentos antes de continuar.")
            setExplicitRetry(false)
            await onUploaded()
        } finally {
            setSending(false)
        }
    }

    return (
        <form onSubmit={submit} className="mt-4">
            <fieldset disabled={disabled || sending} className="space-y-3">
                <div className="space-y-2">
                    <Label htmlFor={inputId} className="text-xs font-semibold text-slate-700">Arquivo do documento</Label>
                    <Input
                        ref={inputRef}
                        id={inputId}
                        type="file"
                        accept={imagesOnly ? "image/jpeg,image/png" : "image/jpeg,image/png,application/pdf"}
                        onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                        aria-describedby={`${inputId}-hint`}
                        className="h-auto min-h-11 bg-white text-xs file:mr-3 file:font-semibold"
                    />
                    <p id={`${inputId}-hint`} className="text-xs leading-5 text-slate-500">
                        {formatHint}, até 3 MB. O arquivo será encaminhado ao Asaas para análise.
                    </p>
                </div>
                {requiresRetryConfirmation && (
                    <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                        <input
                            type="checkbox"
                            checked={explicitRetry}
                            onChange={(event) => {
                                setExplicitRetry(event.target.checked)
                                if (event.target.checked && file) setRequestId(crypto.randomUUID())
                            }}
                            className="mt-1 h-4 w-4 shrink-0 accent-orange-600"
                        />
                        Confirmo o reenvio deste documento. Um novo envio pode substituir o arquivo anterior.
                    </label>
                )}
                <Button
                    type="submit"
                    size="sm"
                    disabled={!file || !requestId || (requiresRetryConfirmation && !explicitRetry)}
                    className="min-h-11 w-full bg-arena-button text-white hover:bg-arena-button/90 sm:w-auto"
                >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                    {sending ? "Enviando documento…" : requiresRetryConfirmation ? "Reenviar documento" : "Enviar documento"}
                </Button>
            </fieldset>
            {error && <p role="alert" className="mt-3 text-xs font-semibold leading-5 text-rose-700">{error}</p>}
        </form>
    )
}

export function ArenaAsaasDocumentList({ arenaId, groups, disabled = false, onUploaded }: {
    arenaId: string
    groups: ArenaAsaasDocumentGroup[]
    disabled?: boolean
    onUploaded: () => Promise<void>
}) {
    return (
        <div className="mt-4 space-y-3">
            {groups.map((group) => (
                <article key={group.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                            <h6 className="break-words text-sm font-semibold text-slate-900">{group.title}</h6>
                        </div>
                        <span className={cn("shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold", group.status === "APPROVED" ? "bg-emerald-50 text-emerald-800" : group.status === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-white text-slate-600")}>
                            {DOCUMENT_STATUS_LABELS[group.status]}
                        </span>
                    </div>
                    {group.description && <p className="mt-2 whitespace-pre-line break-words text-xs leading-5 text-slate-600">{group.description}</p>}
                    {group.attemptStatus === "processing" || group.attemptStatus === "unknown" ? (
                        <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                            {group.attemptStatus === "processing" ? "Há um envio em andamento para este documento." : "Não foi possível confirmar o resultado do último envio."} Atualize os documentos para conferir a situação. Se a pendência continuar, entre em contato com o suporte financeiro.
                        </p>
                    ) : group.onboardingUrl && (group.status === "NOT_SENT" || group.status === "REJECTED") ? (
                        <Button asChild variant="outline" size="sm" className="mt-3 min-h-11 w-full sm:w-auto">
                            <a href={group.onboardingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />Enviar pelo Asaas</a>
                        </Button>
                    ) : group.canUpload ? (
                        <DocumentUploadForm arenaId={arenaId} group={group} disabled={disabled} onUploaded={onUploaded} />
                    ) : group.status === "APPROVED" || group.status === "IGNORED" ? (
                        <p className="mt-3 flex items-center gap-2 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Nenhuma ação necessária para este documento.</p>
                    ) : group.status === "PENDING" || group.status === "AWAITING_APPROVAL" || group.attemptStatus === "submitted" ? (
                        <p role="status" className="mt-3 text-xs leading-5 text-slate-600">Documento enviado. Aguarde a análise do Asaas.</p>
                    ) : (
                        <p className="mt-3 text-xs leading-5 text-slate-600">O método de envio deste documento precisa ser confirmado com o suporte financeiro Asaas.</p>
                    )}
                </article>
            ))}
        </div>
    )
}

export function ArenaAsaasDocumentsPanel({ arenaId, refreshKey, onUploaded, disabled = false }: Props) {
    const headingId = useId()
    const [groups, setGroups] = useState<ArenaAsaasDocumentGroup[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [uploadAvailable, setUploadAvailable] = useState(true)
    const controllerRef = useRef<AbortController | null>(null)

    const refresh = useCallback(async () => {
        controllerRef.current?.abort()
        const controller = new AbortController()
        controllerRef.current = controller
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/arenas/${encodeURIComponent(arenaId)}/asaas/documents`, {
                credentials: "same-origin",
                cache: "no-store",
                signal: controller.signal,
            })
            const result = await response.json()
            if (!response.ok || !result.success || !Array.isArray(result.data?.groups)) {
                throw new Error(responseError(result, "Não foi possível consultar os documentos solicitados."))
            }
            if (!controller.signal.aborted) {
                setGroups(result.data.groups)
                setUploadAvailable(result.data.uploadAvailable !== false)
            }
        } catch (cause) {
            if (!controller.signal.aborted) {
                setGroups(null)
                setError(cause instanceof Error ? cause.message : "Não foi possível consultar os documentos solicitados.")
            }
        } finally {
            if (!controller.signal.aborted) setLoading(false)
        }
    }, [arenaId])

    useEffect(() => {
        void refresh()
        return () => controllerRef.current?.abort()
    }, [refresh, refreshKey])

    async function afterUpload() {
        await refresh()
        onUploaded?.()
    }

    return (
        <section aria-labelledby={headingId} className="mt-5 border-t border-slate-200 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h5 id={headingId} className="text-sm font-bold text-slate-950">Documentos solicitados</h5>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Confira as exigências do Asaas para concluir o cadastro.</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading || disabled} className="min-h-11">
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
                    Atualizar documentos
                </Button>
            </div>
            {loading && <p role="status" className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Consultando documentos…</p>}
            {error && (
                <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>{error} Use “Atualizar documentos” para consultar novamente.</p>
                </div>
            )}
            {!loading && groups && !uploadAvailable && (
                <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">O envio de arquivos pelo painel ainda não está disponível. Entre em contato com a equipe Arena Digital para concluir a configuração.</p>
            )}
            {!loading && groups?.length === 0 && <p role="status" className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">O Asaas não retornou documentos solicitados nesta consulta. Acompanhe a situação cadastral acima.</p>}
            {groups && groups.length > 0 && (
                <ArenaAsaasDocumentList arenaId={arenaId} groups={groups} disabled={disabled || loading} onUploaded={afterUpload} />
            )}
        </section>
    )
}
