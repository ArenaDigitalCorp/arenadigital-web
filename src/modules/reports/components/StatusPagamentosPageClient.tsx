"use client"

import { useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CheckCircle,
  Clock,
  XCircle,
  FileSpreadsheet,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { arenaDataTable } from '@/lib/arena-data-table'
import { getPaymentStatusReportAction } from '@/modules/reports/actions/reportActions'
import { buildPaymentStatusSheetData } from '@/modules/reports/payment-status-export'
import type {
  PaymentStatusRow,
  PaymentStatusSummary,
  CourtFilter,
  SportFilter,
} from '@/modules/reports/types/report.types'

const PAGE_SIZE = 10

const statusConfig: Record<
  PaymentStatusRow['status'],
  { label: string; className: string }
> = {
  Pago: { label: 'Pago', className: 'bg-green-100 text-green-700 border-green-200' },
  Pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  Cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700 border-red-200' },
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateTime(iso: string) {
  try {
    return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: ptBR })
  } catch {
    return iso
  }
}

function generateMonthOptions() {
  const options: { label: string; value: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      label: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
      value: format(d, 'yyyy-MM'),
    })
  }
  return options
}

function getMonthRange(yearMonth: string): { startDate: string; endDate: string } {
  const [year, month] = yearMonth.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  }
}

interface Props {
  arenaId: string
  initialRows: PaymentStatusRow[]
  initialSummary: PaymentStatusSummary
  initialCourts: CourtFilter[]
  initialSports: SportFilter[]
  initialStartDate: string
  initialEndDate: string
}

export function StatusPagamentosPageClient({
  arenaId,
  initialRows,
  initialSummary,
  initialCourts,
  initialSports,
  initialStartDate,
}: Props) {
  const now = new Date()
  const currentMonth = format(now, 'yyyy-MM')

  const [rows, setRows] = useState<PaymentStatusRow[]>(initialRows)
  const [summary, setSummary] = useState<PaymentStatusSummary>(initialSummary)
  const [courts] = useState<CourtFilter[]>(initialCourts)
  const [sports] = useState<SportFilter[]>(initialSports)

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [tipo, setTipo] = useState<'todos' | 'avulso' | 'mensal'>('todos')
  const [courtId, setCourtId] = useState<string>('todos')
  const [sportId, setSportId] = useState<string>('todos')
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  const monthOptions = generateMonthOptions()

  function applyFilters(
    month: string,
    t: typeof tipo,
    cId: string,
    sId: string,
  ) {
    const { startDate, endDate } = getMonthRange(month)
    startTransition(async () => {
      const result = await getPaymentStatusReportAction(arenaId, {
        startDate,
        endDate,
        tipo: t === 'todos' ? undefined : t,
        courtId: cId === 'todos' ? undefined : cId,
        sportId: sId === 'todos' ? undefined : sId,
      })
      if (result.success) {
        setRows(result.rows ?? [])
        setSummary(result.summary ?? {
          totalPago: 0, totalPendente: 0, totalCancelado: 0,
          countPago: 0, countPendente: 0, countCancelado: 0,
        })
        setPage(1)
      }
    })
  }

  function handleMonthChange(v: string) {
    setSelectedMonth(v)
    applyFilters(v, tipo, courtId, sportId)
  }

  function handleTipoChange(v: string) {
    const t = v as typeof tipo
    setTipo(t)
    applyFilters(selectedMonth, t, courtId, sportId)
  }

  function handleCourtChange(v: string) {
    setCourtId(v)
    applyFilters(selectedMonth, tipo, v, sportId)
  }

  function handleSportChange(v: string) {
    setSportId(v)
    applyFilters(selectedMonth, tipo, courtId, v)
  }

  async function handleExportExcel() {
    const { default: writeExcelFile } = await import('write-excel-file/browser')
    const sheetData = buildPaymentStatusSheetData(rows, formatDateTime)
    const { startDate, endDate } = getMonthRange(selectedMonth)
    await writeExcelFile(sheetData, { sheet: 'Status Pagamentos' })
      .toFile(`status-pagamentos-${startDate}-${endDate}.xlsx`)
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const monthLabel = monthOptions.find((m) => m.value === selectedMonth)?.label ?? selectedMonth

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Acompanhe pagamentos de reservas, comandas e rotativos da sua arena
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pagamentos Confirmados</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(summary.totalPago)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{summary.countPago} lançamento{summary.countPago !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pagamentos Pendentes</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(summary.totalPendente)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{summary.countPendente} lançamento{summary.countPendente !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-2 bg-red-50 rounded-lg">
              <XCircle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cancelados</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(summary.totalCancelado)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{summary.countCancelado} lançamento{summary.countCancelado !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs font-medium text-gray-500">Período</label>
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs font-medium text-gray-500">Tipo de Jogo</label>
              <Select value={tipo} onValueChange={handleTipoChange}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="avulso">Avulso</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {courts.length > 0 && (
              <div className="flex flex-col gap-1 min-w-[160px]">
                <label className="text-xs font-medium text-gray-500">Espaço</label>
                <Select value={courtId} onValueChange={handleCourtChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os espaços</SelectItem>
                    {courts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sports.length > 0 && (
              <div className="flex flex-col gap-1 min-w-[160px]">
                <label className="text-xs font-medium text-gray-500">Esporte</label>
                <Select value={sportId} onValueChange={handleSportChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os esportes</SelectItem>
                    {sports.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 ml-auto"
              disabled={isPending}
            >
              <Filter className="h-4 w-4" />
              {isPending ? 'Filtrando...' : 'Filtrar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-lg border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-arena-navy-800">Lançamentos</h2>
            <p className="text-xs text-arena-navy-800/40">{monthLabel}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportExcel}
            disabled={rows.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Exportar Excel
          </Button>
        </div>

        <div className="overflow-x-auto px-6">
          <table className={arenaDataTable.table}>
            <thead>
              <tr className={arenaDataTable.theadRow}>
                <th className={arenaDataTable.th}>Data</th>
                <th className={arenaDataTable.th}>Atleta</th>
                <th className={arenaDataTable.th}>Serviço</th>
                <th className={arenaDataTable.th}>Espaço</th>
                <th className={arenaDataTable.th}>Esporte</th>
                <th className={cn(arenaDataTable.th, "text-arena-button")}>Valor</th>
                <th className={cn(arenaDataTable.thRight, "w-28")}>Status</th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={7} className={arenaDataTable.emptyCell}>
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-arena-button" />
                      Carregando lançamentos...
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={arenaDataTable.emptyCell}>
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const sc = statusConfig[row.status]
                  return (
                    <tr key={row.id} className={arenaDataTable.tbodyRow}>
                      <td className={cn(arenaDataTable.td, "whitespace-nowrap text-arena-navy-800/60")}>
                        {formatDateTime(row.data)}
                      </td>
                      <td className={arenaDataTable.tdBold}>
                        {row.atleta ?? <span className="text-arena-navy-800/30">—</span>}
                      </td>
                      <td className={arenaDataTable.td}>
                        <span className="inline-flex items-center rounded-full bg-arena-navy-800/5 px-2.5 py-0.5 text-xs font-medium text-arena-navy-800">
                          {row.servico}
                        </span>
                      </td>
                      <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                        {row.espaco ?? <span className="text-arena-navy-800/30">—</span>}
                      </td>
                      <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                        {row.esporte ?? <span className="text-arena-navy-800/30">—</span>}
                      </td>
                      <td className={cn(arenaDataTable.td, "whitespace-nowrap text-arena-button font-black")}>
                        {row.valor != null ? formatCurrency(row.valor) : <span className="text-arena-navy-800/30 font-medium">—</span>}
                      </td>
                      <td className={arenaDataTable.tdRight}>
                        <Badge variant="outline" className={sc.className}>
                          {sc.label}
                        </Badge>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-xs text-arena-navy-800/40">
            {rows.length === 0
              ? '0 resultados'
              : `Exibindo ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, rows.length)} de ${rows.length}`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e-${i}`} className="px-1 text-xs text-arena-navy-800/30">…</span>
                ) : (
                  <Button
                    key={p}
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-8 w-8 text-xs font-bold",
                      page === p
                        ? "border-transparent bg-arena-navy-800 text-white hover:bg-arena-navy-800/90 hover:text-white"
                        : "bg-white text-arena-navy-800/60"
                    )}
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
