"use client"

import { useState, useTransition } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Search,
  Filter,
  Plus,
  UserPlus,
  Pencil,
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { arenaDataTable } from "@/lib/arena-data-table"
import { listRotativosAction, setRotativoStatusAction, getParticipantsAction } from "@/modules/rotativos/actions/rotativoActions"
import type { CourtOption, Rotativo, RotativoInscricao, RotativoStatus } from "@/modules/rotativos/types/rotativo.types"
import { canReactivateRotativo, formatRotativoTime } from "@/modules/rotativos/utils/rotativo.utils"
import type { Sport } from "@/modules/arenas/types/arena.types"
import {
  RotativoFormModal,
  RotativoDetailsModal,
  DeactivateRotativoModal,
  ReactivateRotativoModal,
} from "./RotativoSessionModals"
import { EnrollAthleteModal } from "./EnrollAthleteModal"
import { toast } from "sonner"

const PAGE_SIZE = 10

interface Props {
  arenaId: string
  sports: Sport[]
  courts: CourtOption[]
  initialRows: Rotativo[]
  initialTotal: number
}

function formatTime(time: string) {
  return formatRotativoTime(time)
}

function formatDate(date: string) {
  try {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR })
  } catch {
    return date
  }
}

export function CadastradosTab({
  arenaId,
  sports,
  courts,
  initialRows,
  initialTotal,
}: Props) {
  const [rows, setRows] = useState(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<RotativoStatus | "todos">("todos")
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  const [formOpen, setFormOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [reactivateOpen, setReactivateOpen] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [selected, setSelected] = useState<Rotativo | null>(null)
  const [participants, setParticipants] = useState<RotativoInscricao[]>([])
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)

  function reload(nextPage = page, nextSearch = search, nextStatus = status) {
    startTransition(async () => {
      const result = await listRotativosAction(arenaId, {
        search: nextSearch || undefined,
        status: nextStatus,
        page: nextPage,
        pageSize: PAGE_SIZE,
      })
      if (result.success) {
        setRows(result.data ?? [])
        setTotal(result.total ?? 0)
      }
    })
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    reload(1, search, status)
  }

  function handleStatusChange(value: string) {
    const next = value as RotativoStatus | "todos"
    setStatus(next)
    setPage(1)
    reload(1, search, next)
  }

  function openCreate() {
    setSelected(null)
    setFormOpen(true)
  }

  function openDetails(rotativo: Rotativo) {
    setSelected(rotativo)
    setDetailsOpen(true)
    setIsLoadingParticipants(true)
    setParticipants([])
    getParticipantsAction(arenaId, rotativo.id).then((result) => {
      if (result.success) setParticipants(result.data ?? [])
      setIsLoadingParticipants(false)
    })
  }

  function openEdit() {
    setDetailsOpen(false)
    setFormOpen(true)
  }

  function openEnroll(rotativo: Rotativo) {
    setSelected(rotativo)
    setEnrollOpen(true)
  }

  function openDeactivate(rotativo: Rotativo) {
    setSelected(rotativo)
    setDeactivateOpen(true)
  }

  async function confirmDeactivate() {
    if (!selected) return
    setIsDeactivating(true)
    try {
      const result = await setRotativoStatusAction(arenaId, selected.id, "desativado")
      if (result.success) {
        toast.success("Rotativo desativado")
        setDeactivateOpen(false)
        setDetailsOpen(false)
        reload()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsDeactivating(false)
    }
  }

  async function confirmReactivate() {
    if (!selected) return
    setIsReactivating(true)
    try {
      const result = await setRotativoStatusAction(arenaId, selected.id, "ativo")
      if (result.success) {
        toast.success("Rotativo reativado")
        setReactivateOpen(false)
        setDetailsOpen(false)
        reload()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsReactivating(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <Card className="rounded-lg border border-slate-100 bg-white px-6 py-6 shadow-sm">
        <CardContent className="p-0">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center">
            <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-sm">
              <Input
                placeholder="Buscar rotativo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 rounded-md border-slate-300 pl-3 pr-10 text-sm shadow-none"
              />
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </form>

            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-10 w-full rounded-md border-slate-300 shadow-none md:w-[180px]">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="desativado">Desativado</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={openCreate} className="ml-auto h-10 rounded-md bg-arena-button px-4 text-sm font-bold text-white shadow-none hover:bg-arena-button-hover">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar rotativo
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className={arenaDataTable.table}>
              <thead>
                <tr className={arenaDataTable.theadRow}>
                  <th className={arenaDataTable.th}>Status</th>
                  <th className={arenaDataTable.th}>Data</th>
                  <th className={arenaDataTable.th}>Modalidade</th>
                  <th className={arenaDataTable.th}>Horário</th>
                  <th className={arenaDataTable.th}>Valor</th>
                  <th className={arenaDataTable.th}>Quant. inscritos</th>
                  <th className={arenaDataTable.thRight}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {isPending ? (
                  <tr>
                    <td colSpan={7} className={arenaDataTable.emptyCell}>
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-arena-button" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={arenaDataTable.emptyCell}>
                      Nenhum rotativo encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const isActive = (row.status ?? "ativo") === "ativo"
                    const canReactivate = !isActive && canReactivateRotativo(row.data)
                    return (
                      <tr key={row.id} className={arenaDataTable.tbodyRow}>
                        <td className={arenaDataTable.td}>
                          <Badge
                            variant="outline"
                            className={cn(
                              isActive
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-red-100 text-red-700 border-red-200"
                            )}
                          >
                            {isActive ? "Ativo" : "Desativado"}
                          </Badge>
                        </td>
                        <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                          {formatDate(row.data)}
                        </td>
                        <td className={arenaDataTable.tdBold}>{row.esporte?.name ?? "—"}</td>
                        <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                          {formatTime(row.hora_inicio)} - {formatTime(row.hora_fim)}
                        </td>
                        <td className={arenaDataTable.tdBold}>
                          {row.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className={arenaDataTable.tdBold}>{row.inscricoes_count ?? 0}</td>
                        <td className={arenaDataTable.tdRight}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-8 w-8",
                                canReactivate
                                  ? "bg-teal-50 text-teal-600/60 hover:bg-teal-100 hover:text-teal-600"
                                  : "bg-arena-button/10 text-arena-button/60 hover:bg-arena-button/20 hover:text-arena-button"
                              )}
                              disabled={!isActive && !canReactivate}
                              onClick={() => {
                                if (canReactivate) {
                                  setSelected(row)
                                  setReactivateOpen(true)
                                } else {
                                  openEnroll(row)
                                }
                              }}
                              title={canReactivate ? "Reativar" : "Inscrever atleta"}
                            >
                              {canReactivate ? (
                                <RotateCcw className="h-4 w-4" />
                              ) : (
                                <UserPlus className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-slate-100 text-arena-navy-800/60 hover:bg-slate-200 hover:text-arena-navy-800"
                              disabled={!isActive}
                              onClick={() => {
                                setSelected(row)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-red-50 text-red-500/70 hover:bg-red-100 hover:text-red-600"
                              disabled={!isActive}
                              onClick={() => openDeactivate(row)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-teal-50 text-teal-600/60 hover:bg-teal-100 hover:text-teal-600"
                              onClick={() => openDetails(row)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-0 pt-4">
            <p className="text-xs text-arena-navy-800/40">
              Exibindo {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-white"
                disabled={page === 1}
                onClick={() => {
                  const next = page - 1
                  setPage(next)
                  reload(next)
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis")
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === "ellipsis" ? (
                    <span key={`e-${i}`} className="px-1 text-gray-400 text-sm">...</span>
                  ) : (
                    <Button
                      key={p}
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-8 w-8 text-xs",
                        p === page && "border-transparent bg-arena-navy-800 text-white hover:bg-arena-navy-800/90 hover:text-white"
                      )}
                      onClick={() => {
                        setPage(p as number)
                        reload(p as number)
                      }}
                    >
                      {String(p).padStart(2, "0")}
                    </Button>
                  )
                )}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-white"
                disabled={page >= totalPages}
                onClick={() => {
                  const next = page + 1
                  setPage(next)
                  reload(next)
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <RotativoFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        arenaId={arenaId}
        sports={sports}
        courts={courts}
        rotativo={selected}
        onSuccess={() => reload()}
      />

      <RotativoDetailsModal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        rotativo={selected}
        participants={participants}
        isLoadingParticipants={isLoadingParticipants}
        onEdit={openEdit}
        onDeactivate={() => setDeactivateOpen(true)}
        onReactivate={() => setReactivateOpen(true)}
      />

      <DeactivateRotativoModal
        isOpen={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={confirmDeactivate}
        isLoading={isDeactivating}
      />

      <ReactivateRotativoModal
        isOpen={reactivateOpen}
        onClose={() => setReactivateOpen(false)}
        onConfirm={confirmReactivate}
        isLoading={isReactivating}
      />

      <EnrollAthleteModal
        isOpen={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        arenaId={arenaId}
        rotativo={selected}
        onSuccess={() => reload()}
      />
    </div>
  )
}
