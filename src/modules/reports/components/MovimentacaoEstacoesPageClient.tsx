"use client"

import { useEffect, useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { getStationMovementReportAction } from '@/modules/reports/actions/stationMovementActions'
import type {
  StationMovementRow,
  StationFilterOption,
  StationMovementPaymentStatus,
} from '@/modules/reports/types/station-movement.types'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 400

const PAYMENT_METHODS = ['Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Pix']

const paymentStatusConfig: Record<StationMovementPaymentStatus, { label: string; className: string }> = {
  pago: { label: 'Pago', className: 'bg-green-100 text-green-700 border-green-200' },
  parcial: { label: 'Parcial', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  pendente: { label: 'Pendente', className: 'bg-red-100 text-red-700 border-red-200' },
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

interface Props {
  arenaId: string
  initialRows: StationMovementRow[]
  initialStations: StationFilterOption[]
}

export function MovimentacaoEstacoesPageClient({
  arenaId,
  initialRows,
  initialStations,
}: Props) {
  const [rows, setRows] = useState<StationMovementRow[]>(initialRows)
  const [stations] = useState<StationFilterOption[]>(initialStations)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [stationId, setStationId] = useState<string>('todos')
  const [customer, setCustomer] = useState('')
  const [debouncedCustomer, setDebouncedCustomer] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>('todos')
  const [status, setStatus] = useState<string>('todos')
  const [paymentStatus, setPaymentStatus] = useState<string>('todos')
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedCustomer(customer.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [customer])

  const isFirstRender = useState(() => ({ current: true }))[0]
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    startTransition(async () => {
      const result = await getStationMovementReportAction(arenaId, {
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        stationId: stationId === 'todos' ? undefined : stationId,
        customer: debouncedCustomer || undefined,
        paymentMethod: paymentMethod === 'todos' ? undefined : paymentMethod,
        status: status === 'todos' ? undefined : (status as StationMovementRow['status']),
        paymentStatus: paymentStatus === 'todos' ? undefined : (paymentStatus as StationMovementPaymentStatus),
      })
      if (result.success) {
        setRows(result.rows ?? [])
        setPage(1)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, stationId, debouncedCustomer, paymentMethod, status, paymentStatus])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openOrderDetails(row: StationMovementRow) {
    window.open(`/dashboard/arenas/${arenaId}/stations/${row.station_id}/orders/${row.id}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Movimentação Estações</h1>
        <p className="text-sm text-gray-500 mt-1">
          Acompanhe as comandas das estações da sua arena
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-xs font-medium text-gray-500">Cliente</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/20" />
                <Input
                  placeholder="Buscar por cliente"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <div className="flex items-center bg-white border border-arena-navy-800/10 rounded-md px-3 h-9 gap-2">
              <Calendar className="h-4 w-4 text-arena-navy-800/20" />
              <span className="text-xs font-bold text-arena-navy-800/40 uppercase">De</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-sm font-medium text-arena-navy-800/60 focus:outline-none"
              />
              <span className="text-xs font-bold text-arena-navy-800/40 uppercase">Até</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-sm font-medium text-arena-navy-800/60 focus:outline-none"
              />
            </div>

            {stations.length > 0 && (
              <div className="flex flex-col gap-1 min-w-[160px]">
                <label className="text-xs font-medium text-gray-500">Estação</label>
                <Select value={stationId} onValueChange={setStationId}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as estações</SelectItem>
                    {stations.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs font-medium text-gray-500">Forma de pagamento</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs font-medium text-gray-500">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="open">Aberta</SelectItem>
                  <SelectItem value="closed">Fechada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs font-medium text-gray-500">Situação pagamento</label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-lg border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-arena-navy-800">Comandas</h2>
            <p className="text-xs text-arena-navy-800/40">
              {dateFrom || dateTo
                ? `${dateFrom ? format(parseISO(dateFrom), 'dd/MM/yyyy') : 'Início'} – ${dateTo ? format(parseISO(dateTo), 'dd/MM/yyyy') : 'Hoje'}`
                : 'Todos os períodos'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto px-6">
          <table className={arenaDataTable.table}>
            <thead>
              <tr className={arenaDataTable.theadRow}>
                <th className={arenaDataTable.th}>Data abertura</th>
                <th className={arenaDataTable.th}>Cliente</th>
                <th className={arenaDataTable.th}>Estação</th>
                <th className={arenaDataTable.th}>Comanda</th>
                <th className={arenaDataTable.th}>Situação</th>
                <th className={arenaDataTable.th}>Forma de pagamento</th>
                <th className={cn(arenaDataTable.th, "text-arena-button")}>Valor total</th>
                <th className={cn(arenaDataTable.thRight, "w-16")} />
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={8} className={arenaDataTable.emptyCell}>
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-arena-button" />
                      Carregando comandas...
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className={arenaDataTable.emptyCell}>
                    Nenhuma comanda encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  return (
                    <tr key={row.id} className={arenaDataTable.tbodyRow}>
                      <td className={cn(arenaDataTable.td, "whitespace-nowrap text-arena-navy-800/60")}>
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className={arenaDataTable.tdBold}>
                        {row.customer_name ?? <span className="text-arena-navy-800/30">—</span>}
                      </td>
                      <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                        {row.station_name ?? <span className="text-arena-navy-800/30">—</span>}
                      </td>
                      <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                        #{row.order_number}
                      </td>
                      <td className={arenaDataTable.td}>
                        <Badge variant="outline" className={paymentStatusConfig[row.payment_status].className}>
                          {paymentStatusConfig[row.payment_status].label}
                        </Badge>
                      </td>
                      <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                        {row.payment_method ?? <span className="text-arena-navy-800/30">—</span>}
                      </td>
                      <td className={cn(arenaDataTable.td, "whitespace-nowrap text-arena-button font-black")}>
                        {formatCurrency(row.total_value)}
                      </td>
                      <td className={arenaDataTable.tdRight}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Ver detalhes da comanda"
                          onClick={() => openOrderDetails(row)}
                        >
                          <ExternalLink className="h-4 w-4 text-arena-navy-800/50" />
                        </Button>
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
