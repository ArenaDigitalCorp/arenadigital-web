"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ChevronLeft, Loader2, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { openWhatsAppWeb } from "@/lib/whatsapp-web"
import { getMessageTemplatesByArenaAction } from "@/modules/templates-mensagens/actions/templateMensagemActions"
import { resolveMessageTemplateAction } from "@/modules/templates-mensagens/actions/templateVariableResolverActions"
import type { MessageTemplate } from "@/modules/templates-mensagens/types/templateMensagem.types"

export interface SendTemplateMessageAthlete {
    id: string
    nome: string
    telefone: string | null
}

export interface SendTemplateMessageModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    arenaId: string
    /** Mês filtrado na tela de origem (`YYYY-MM`) — contexto das variáveis de mensalista. */
    competencia: string
    athlete: SendTemplateMessageAthlete | null
}

const dialogContentClass =
    "max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-xl sm:max-w-[560px] sm:p-7 [&_[data-slot=dialog-close]]:text-[#0D3B45] [&_[data-slot=dialog-close]]:opacity-100"

const dialogTitleClass = "text-xl font-bold text-[#0D3B45] sm:text-2xl"

const dialogDescriptionClass = "text-sm leading-relaxed text-slate-600"

const footerButtonOutlineClass =
    "h-11 flex-1 rounded-lg border-[#0D3B45] bg-white px-6 font-semibold text-[#0D3B45] shadow-none hover:bg-slate-50 sm:flex-initial sm:min-w-[120px]"

const footerButtonPrimaryClass =
    "h-11 flex-1 rounded-lg border-0 bg-[#25D366] px-6 font-semibold text-white shadow-none hover:bg-[#20BD5C] sm:flex-initial sm:min-w-[140px]"

type Step = "select" | "preview"

export function SendTemplateMessageModal({
    open,
    onOpenChange,
    arenaId,
    competencia,
    athlete,
}: SendTemplateMessageModalProps) {
    const [step, setStep] = useState<Step>("select")
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
    const [templates, setTemplates] = useState<MessageTemplate[]>([])

    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)
    const [isResolving, setIsResolving] = useState(false)
    const [resolvedMessage, setResolvedMessage] = useState("")
    const [warnings, setWarnings] = useState<string[]>([])

    useEffect(() => {
        if (!open) return
        setStep("select")
        setSelectedTemplate(null)
        setResolvedMessage("")
        setWarnings([])
        setIsLoadingTemplates(true)
        getMessageTemplatesByArenaAction(arenaId)
            .then((res) => setTemplates((res.data ?? []).filter((t) => t.status === "Ativo")))
            .finally(() => setIsLoadingTemplates(false))
    }, [open, arenaId])

    async function handlePickTemplate(template: MessageTemplate) {
        if (!athlete) return
        setSelectedTemplate(template)
        setStep("preview")
        setIsResolving(true)
        try {
            const res = await resolveMessageTemplateAction(arenaId, athlete.id, competencia, template.message)
            if (!res.success || !res.data) throw new Error(res.error)
            setResolvedMessage(res.data.resolvedMessage)
            setWarnings(res.data.warnings)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao montar a prévia da mensagem")
            setStep("select")
        } finally {
            setIsResolving(false)
        }
    }

    function handleSend() {
        if (!athlete?.telefone) {
            toast.error("Este atleta não tem telefone cadastrado")
            return
        }
        openWhatsAppWeb(athlete.telefone, resolvedMessage)
        onOpenChange(false)
    }

    const title = step === "select" ? "Enviar mensagem" : selectedTemplate?.name ?? "Prévia da mensagem"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={dialogContentClass}>
                <DialogHeader className="mb-4 space-y-2 text-left">
                    <DialogTitle className={dialogTitleClass}>{title}</DialogTitle>
                    <DialogDescription className={dialogDescriptionClass}>
                        {athlete ? (
                            <>
                                Para <span className="font-semibold text-arena-navy-800">{athlete.nome}</span>
                                {!athlete.telefone && " — atleta sem telefone cadastrado"}
                            </>
                        ) : null}
                    </DialogDescription>
                </DialogHeader>

                {step === "select" && (
                    <div className="flex flex-col gap-2">
                        {isLoadingTemplates ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-6 w-6 animate-spin text-arena-button" />
                            </div>
                        ) : templates.length === 0 ? (
                            <p className="rounded-lg bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
                                Nenhum template de WhatsApp ativo cadastrado. Cadastre um em Configurações → Templates
                                Mensagens antes de enviar.
                            </p>
                        ) : (
                            templates.map((template) => (
                                <button
                                    key={template.id}
                                    type="button"
                                    onClick={() => handlePickTemplate(template)}
                                    className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 px-4 py-3 text-left transition-colors hover:border-arena-button hover:bg-slate-50"
                                >
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="font-semibold text-arena-navy-800">{template.name}</span>
                                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                                            {template.identifier}
                                        </code>
                                    </div>
                                    <span className="line-clamp-2 text-xs text-slate-500">{template.message}</span>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {step === "preview" && (
                    <div className="flex flex-col gap-4">
                        {isResolving ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-6 w-6 animate-spin text-arena-button" />
                            </div>
                        ) : (
                            <>
                                {warnings.length > 0 && (
                                    <div className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                        {warnings.map((w) => (
                                            <div key={w} className="flex items-start gap-2 text-xs leading-relaxed text-amber-800">
                                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                {w}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Textarea
                                    value={resolvedMessage}
                                    onChange={(e) => setResolvedMessage(e.target.value)}
                                    className="min-h-[200px] bg-white border-slate-300 text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-400"
                                />
                                <p className="text-xs text-slate-500">
                                    Revise o texto (inclusive os trechos entre colchetes) antes de enviar.
                                </p>
                            </>
                        )}

                        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                className={footerButtonOutlineClass}
                                onClick={() => setStep("select")}
                            >
                                <ChevronLeft className="mr-1 h-4 w-4" />
                                Trocar template
                            </Button>
                            <Button
                                type="button"
                                className={footerButtonPrimaryClass}
                                disabled={isResolving || !athlete?.telefone}
                                onClick={handleSend}
                            >
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Enviar via WhatsApp
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
