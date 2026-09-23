"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Search, MoreHorizontal, Edit, Trash } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { DashboardTabs } from "@/components/dashboard/DashboardTabs"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { arenaDataTable } from "@/lib/arena-data-table"
import { ConfirmActionDialog } from "@/components/dashboard/ConfirmActionDialog"
import { TemplateMensagemFormModal } from "@/modules/templates-mensagens/components/TemplateMensagemFormModal"
import {
    createMessageTemplateAction,
    deleteMessageTemplateAction,
    getMessageTemplatesByArenaAction,
    updateMessageTemplateAction,
} from "@/modules/templates-mensagens/actions/templateMensagemActions"
import type {
    MessageTemplate,
    MessageTemplateFormInput,
    MessageTemplateStatus,
} from "@/modules/templates-mensagens/types/templateMensagem.types"

const searchInputClass =
    "h-10 w-full rounded-md border-slate-300 pl-3 pr-10 text-sm text-arena-navy-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#20B2AA] sm:max-w-[280px] sm:w-[280px]"

const statusSelectTriggerClass =
    "h-10 w-fit min-w-[180px] border-slate-300 text-sm text-arena-navy-800 shadow-none focus-visible:ring-1 focus-visible:ring-[#20B2AA] data-[placeholder]:text-arena-navy-800/60"

const primaryCtaClass =
    "h-10 shrink-0 rounded-md bg-arena-button px-4 text-sm font-bold text-white shadow-none hover:bg-arena-button-hover"

const actionsTriggerClass =
    "h-8 w-8 text-arena-navy-800/60 bg-[#F1F5F9] hover:bg-[#E2E8F0] hover:text-arena-navy-800"

type StatusFilter = "all" | MessageTemplateStatus

interface Props {
    arenaId: string
    arenaName: string
    initialTemplates: MessageTemplate[]
}

export function TemplatesMensagensPageClient({ arenaId, arenaName, initialTemplates }: Props) {
    const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates)
    const [activeTab, setActiveTab] = useState<"whatsapp">("whatsapp")
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)

    const [templatePendingDelete, setTemplatePendingDelete] = useState<MessageTemplate | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const filteredTemplates = useMemo(() => {
        return templates.filter((t) => {
            const matchesSearch =
                t.name.toLowerCase().includes(search.toLowerCase()) ||
                t.identifier.toLowerCase().includes(search.toLowerCase()) ||
                t.message.toLowerCase().includes(search.toLowerCase())
            if (!matchesSearch) return false
            if (statusFilter === "all") return true
            return t.status === statusFilter
        })
    }, [templates, search, statusFilter])

    const openCreate = () => {
        setEditingTemplate(null)
        setIsModalOpen(true)
    }

    const openEdit = (t: MessageTemplate) => {
        setEditingTemplate(t)
        setIsModalOpen(true)
    }

    const handleModalOpenChange = (open: boolean) => {
        setIsModalOpen(open)
        if (!open) setEditingTemplate(null)
    }

    const refreshTemplates = () => {
        getMessageTemplatesByArenaAction(arenaId).then((res) => setTemplates(res.data ?? []))
    }

    const handleSave = async (data: MessageTemplateFormInput) => {
        const result = editingTemplate
            ? await updateMessageTemplateAction(arenaId, editingTemplate.id, data)
            : await createMessageTemplateAction(arenaId, data)
        if (!result.success) throw new Error(result.error)
        refreshTemplates()
    }

    const confirmDelete = async () => {
        if (!templatePendingDelete) return
        const t = templatePendingDelete
        setIsDeleting(true)
        try {
            const result = await deleteMessageTemplateAction(arenaId, t.id)
            if (!result.success) throw new Error(result.error)
            setTemplates((prev) => prev.filter((x) => x.id !== t.id))
            toast.success("Template excluído com sucesso")
            setTemplatePendingDelete(null)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao excluir")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black tracking-tight text-arena-navy-800">Templates Mensagens</h1>
                <p className="text-sm font-medium text-arena-navy-800/60">
                    {arenaName ? (
                        <>
                            Arena <span className="font-semibold text-arena-navy-800">{arenaName}</span>
                            {" — "}
                        </>
                    ) : null}
                    Mensagens padronizadas usadas pelo sistema, com variáveis preenchidas automaticamente.
                </p>
            </div>

            <DashboardTabs
                value={activeTab}
                onChange={setActiveTab}
                tabs={[{ label: "Whatsapp", value: "whatsapp" }]}
            />

            <Card className="rounded-lg border border-slate-100 bg-white px-6 py-6 shadow-sm">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-[280px]">
                        <Input
                            placeholder="Buscar templates..."
                            className={searchInputClass}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
                        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                            <SelectTrigger className={statusSelectTriggerClass}>
                                <SelectValue placeholder="Todos os status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os status</SelectItem>
                                <SelectItem value="Ativo">Ativo</SelectItem>
                                <SelectItem value="Inativo">Inativo</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button type="button" onClick={openCreate} className={primaryCtaClass}>
                            <Plus className="mr-2 h-4 w-4" />
                            Novo template
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className={arenaDataTable.table}>
                        <thead>
                            <tr className={arenaDataTable.theadRow}>
                                <th className={arenaDataTable.th}>Nome</th>
                                <th className={arenaDataTable.th}>Mensagem</th>
                                <th className={arenaDataTable.th}>Status</th>
                                <th className={arenaDataTable.th}>Criado em</th>
                                <th className={arenaDataTable.thRight}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTemplates.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className={arenaDataTable.emptyCell}>
                                        Nenhum template de mensagem encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredTemplates.map((template) => (
                                    <tr key={template.id} className={arenaDataTable.tbodyRow}>
                                        <td className={arenaDataTable.tdBold}>
                                            <div className="flex flex-col gap-0.5">
                                                <span>{template.name}</span>
                                                <code className="w-fit rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                                                    {template.identifier}
                                                </code>
                                            </div>
                                        </td>
                                        <td className={cn(arenaDataTable.td, "max-w-sm")}>
                                            <span className="line-clamp-2 text-arena-navy-800/80">
                                                {template.message}
                                            </span>
                                        </td>
                                        <td className={arenaDataTable.td}>
                                            <Badge
                                                variant={template.status === "Ativo" ? "default" : "destructive"}
                                                className={
                                                    template.status === "Ativo"
                                                        ? "bg-emerald-500 hover:bg-emerald-600"
                                                        : ""
                                                }
                                            >
                                                {template.status}
                                            </Badge>
                                        </td>
                                        <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                            {format(new Date(template.created_at), "dd/MM/yyyy HH:mm", {
                                                locale: ptBR,
                                            })}
                                        </td>
                                        <td className={arenaDataTable.tdRight}>
                                            <div className="flex items-center justify-end gap-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className={actionsTriggerClass}
                                                        >
                                                            <span className="sr-only">Abrir menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => openEdit(template)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => setTemplatePendingDelete(template)}
                                                            className="text-red-600 focus:text-red-600"
                                                        >
                                                            <Trash className="mr-2 h-4 w-4" />
                                                            Excluir
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <ConfirmActionDialog
                open={!!templatePendingDelete}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) setTemplatePendingDelete(null)
                }}
                title="Excluir template"
                description="Tem certeza que deseja excluir este template de mensagem? A exclusão é permanente e não pode ser desfeita."
                confirmLabel="Excluir"
                loadingLabel="Excluindo..."
                loading={isDeleting}
                onConfirm={confirmDelete}
            />

            <TemplateMensagemFormModal
                open={isModalOpen}
                onOpenChange={handleModalOpenChange}
                template={editingTemplate}
                onSave={handleSave}
            />
        </div>
    )
}
