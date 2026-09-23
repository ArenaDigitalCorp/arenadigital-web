"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
    MESSAGE_TEMPLATE_VARIABLES,
    type MessageTemplateVariableCategory,
} from "@/modules/templates-mensagens/constants/messageVariables"
import type {
    MessageTemplate,
    MessageTemplateFormInput,
} from "@/modules/templates-mensagens/types/templateMensagem.types"

const IDENTIFIER_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

const templateFormSchema = z.object({
    identifier: z
        .string()
        .min(2, "Identificador deve ter pelo menos 2 caracteres")
        .regex(IDENTIFIER_PATTERN, "Use apenas letras minúsculas, números e hífen (ex.: confirmacao-reserva)"),
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    message: z.string().min(5, "Mensagem deve ter pelo menos 5 caracteres"),
    status: z.enum(["Ativo", "Inativo"]),
})

type TemplateFormValues = z.infer<typeof templateFormSchema>

const EMPTY_TEMPLATE_FORM: TemplateFormValues = {
    identifier: "",
    name: "",
    message: "",
    status: "Ativo",
}

function templateToFormValues(t: MessageTemplate): TemplateFormValues {
    return {
        identifier: t.identifier,
        name: t.name,
        message: t.message,
        status: t.status,
    }
}

const dialogContentClass =
    "max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-xl sm:max-w-[640px] sm:p-7 [&_[data-slot=dialog-close]]:text-[#0D3B45] [&_[data-slot=dialog-close]]:opacity-100"

const dialogTitleClass = "text-xl font-bold text-[#0D3B45] sm:text-2xl"

const dialogDescriptionClass = "text-sm leading-relaxed text-slate-600"

const formLabelClass = "text-sm font-medium text-arena-navy-800"

const inputFieldClass =
    "h-10 bg-white border-slate-300 text-slate-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400"

const textareaFieldClass =
    "min-h-[140px] bg-white border-slate-300 text-slate-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400"

const selectTriggerClass =
    "h-10 w-full bg-white border-slate-300 text-sm text-arena-navy-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-400"

const selectContentClass = "rounded-xl border border-slate-200 bg-white text-slate-800 shadow-lg"

const selectItemClass =
    "cursor-pointer hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900"

const footerButtonOutlineClass =
    "h-11 flex-1 rounded-lg border-[#0D3B45] bg-white px-6 font-semibold text-[#0D3B45] shadow-none hover:bg-slate-50 sm:flex-initial sm:min-w-[120px]"

const footerButtonPrimaryClass =
    "h-11 flex-1 rounded-lg border-0 bg-arena-button px-6 font-semibold text-white shadow-none hover:bg-arena-button-hover sm:flex-initial sm:min-w-[120px]"

const VARIABLE_CATEGORY_ORDER: MessageTemplateVariableCategory[] = [
    "Atleta",
    "Contexto",
    "Mensalista",
    "Arena",
]

export interface TemplateMensagemFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    template?: MessageTemplate | null
    onSave: (data: MessageTemplateFormInput) => Promise<void> | void
}

function TemplateFormInner({
    template,
    onSave,
    onOpenChange,
}: {
    template: MessageTemplate | null | undefined
    onSave: (data: MessageTemplateFormInput) => Promise<void> | void
    onOpenChange: (open: boolean) => void
}) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isVariablesOpen, setIsVariablesOpen] = useState(false)
    const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null)

    const variablesByCategory = useMemo(() => {
        return VARIABLE_CATEGORY_ORDER.map((category) => ({
            category,
            variables: MESSAGE_TEMPLATE_VARIABLES.filter((v) => v.category === category),
        })).filter((group) => group.variables.length > 0)
    }, [])

    const form = useForm<TemplateFormValues>({
        resolver: zodResolver(templateFormSchema),
        defaultValues: template ? templateToFormValues(template) : EMPTY_TEMPLATE_FORM,
    })

    useEffect(() => {
        form.reset(template ? templateToFormValues(template) : EMPTY_TEMPLATE_FORM)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- alinhar ao template em edição
    }, [template, template?.id])

    function insertVariable(token: string) {
        const el = messageTextareaRef.current
        const current = form.getValues("message") ?? ""

        if (!el) {
            form.setValue("message", `${current}${token}`, { shouldDirty: true, shouldValidate: true })
            return
        }

        const start = el.selectionStart ?? current.length
        const end = el.selectionEnd ?? current.length
        const next = `${current.slice(0, start)}${token}${current.slice(end)}`

        form.setValue("message", next, { shouldDirty: true, shouldValidate: true })

        requestAnimationFrame(() => {
            el.focus()
            const cursor = start + token.length
            el.setSelectionRange(cursor, cursor)
        })
    }

    const onSubmit = form.handleSubmit(async (data) => {
        setIsSubmitting(true)
        try {
            await onSave(data)
            toast.success(template ? "Template atualizado com sucesso!" : "Template criado com sucesso!")
            onOpenChange(false)
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Erro desconhecido"
            toast.error(`Erro ao salvar template: ${msg}`)
        } finally {
            setIsSubmitting(false)
        }
    })

    return (
        <Form {...form}>
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
                <FormField
                    control={form.control}
                    name="identifier"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className={formLabelClass}>Identificador</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Ex.: confirmacao-reserva"
                                    className={inputFieldClass}
                                    {...field}
                                />
                            </FormControl>
                            <p className="text-xs leading-relaxed text-slate-500">
                                Código curto para localizar este template depois. Único por arena e canal.
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className={formLabelClass}>Nome</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Ex.: Confirmação de reserva"
                                    className={inputFieldClass}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="rounded-lg border border-slate-200 bg-slate-50">
                    <button
                        type="button"
                        onClick={() => setIsVariablesOpen((v) => !v)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                    >
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Variáveis disponíveis
                        </span>
                        <ChevronDown
                            className={cn(
                                "h-4 w-4 shrink-0 text-slate-500 transition-transform",
                                isVariablesOpen && "rotate-180"
                            )}
                        />
                    </button>
                    {isVariablesOpen && (
                        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto border-t border-slate-200 p-3 pr-1">
                            {variablesByCategory.map(({ category, variables }) => (
                                <div key={category} className="flex flex-col gap-1">
                                    <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        {category}
                                    </p>
                                    {variables.map((variable) => (
                                        <button
                                            key={variable.token}
                                            type="button"
                                            onClick={() => insertVariable(variable.token)}
                                            className="flex flex-col items-start gap-0.5 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-slate-200 hover:bg-white"
                                        >
                                            <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-arena-navy-800">
                                                {variable.token}
                                            </code>
                                            <span className="text-xs leading-relaxed text-slate-500">
                                                {variable.description}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className={formLabelClass}>Mensagem</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Ex.: Olá ##ATLETA_PRIMEIRO_NOME##, você tem um débito de ##VALOR_DEVIDO_MES_CORRENTE## este mês."
                                    className={textareaFieldClass}
                                    {...field}
                                    ref={(el) => {
                                        field.ref(el)
                                        messageTextareaRef.current = el
                                    }}
                                />
                            </FormControl>
                            <p className="text-xs leading-relaxed text-slate-500">
                                Use as variáveis acima para inserir dados dinâmicos no texto.
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className={formLabelClass}>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className={selectTriggerClass}>
                                        <SelectValue placeholder="Selecione o status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className={selectContentClass}>
                                    <SelectItem value="Ativo" className={selectItemClass}>
                                        Ativo
                                    </SelectItem>
                                    <SelectItem value="Inativo" className={selectItemClass}>
                                        Inativo
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        className={footerButtonOutlineClass}
                        disabled={isSubmitting}
                        onClick={() => onOpenChange(false)}
                    >
                        Fechar
                    </Button>
                    <Button type="submit" className={footerButtonPrimaryClass} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : template ? (
                            "Salvar"
                        ) : (
                            "Cadastrar"
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    )
}

export function TemplateMensagemFormModal({
    open,
    onOpenChange,
    template,
    onSave,
}: TemplateMensagemFormModalProps) {
    const title = template ? "Editar template" : "Novo template de mensagem"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={dialogContentClass}>
                <DialogHeader className="mb-4 space-y-2 text-left">
                    <DialogTitle className={dialogTitleClass}>{title}</DialogTitle>
                    <DialogDescription className={dialogDescriptionClass}>
                        Este template será usado nas mensagens automáticas de WhatsApp enviadas pelo sistema.
                    </DialogDescription>
                </DialogHeader>
                {open && (
                    <TemplateFormInner
                        key={template?.id ?? "new"}
                        template={template}
                        onSave={onSave}
                        onOpenChange={onOpenChange}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
