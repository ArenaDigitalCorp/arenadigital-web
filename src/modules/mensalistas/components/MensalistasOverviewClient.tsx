'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addMonths, format, parseISO, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  TrendingUp,
  Wallet,
  AlertTriangleIcon,
  CircleDollarSign,
  Eye,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { arenaDataTable } from '@/lib/arena-data-table'
import { formatCurrency, formatCompetenciaShort, formatDate, toCompetencia } from '@/lib/format'
import type {
  MensalistasOverview,
  MensalistaResumo,
  SituacaoPagamento,
  StatusPlano,
} from '@/modules/mensalistas/types/mensalista.types'

interface Props {
  arenaId: string
  competencia: string
  overview: MensalistasOverview
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <Card className="border-none shadow-sm bg-white p-5 flex flex-col items-center text-center gap-3">
      <div
        className={cn(
          'h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0',
          color
        )}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-black uppercase text-arena-navy-800/40 tracking-wider">
          {label}
        </p>
        <p className="text-2xl font-black text-arena-navy-800">{value}</p>
        {sub && (
          <p className="text-[11px] text-arena-navy-800/40 font-medium">{sub}</p>
        )}
      </div>
    </Card>
  )
}

const SITUACAO_STYLE: Record<SituacaoPagamento, { label: string; className: string; dot: string }> = {
  quitado: { label: 'Quitado', className: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  parcial: { label: 'Parcial', className: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  pendente: { label: 'Pendente', className: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
}

const STATUS_PLANO_STYLE: Record<StatusPlano, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-emerald-100 text-emerald-700' },
  encerrando: { label: 'Encerrando', className: 'bg-orange-100 text-orange-700' },
  cancelado: { label: 'Cancelado', className: 'bg-gray-100 text-gray-500' },
}

type StatusFilter = 'todos' | StatusPlano
type SituacaoFilter = 'todas' | SituacaoPagamento

export function MensalistasOverviewClient({ arenaId, competencia, overview }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [situacaoFilter, setSituacaoFilter] = useState<SituacaoFilter>('todas')
  const [soAtraso, setSoAtraso] = useState(false)

  const competenciaDate = parseISO(`${competencia}-01`)

  const goToMonth = (date: Date) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('competencia', toCompetencia(date))
    startTransition(() => {
      router.push(`/dashboard/arenas/${arenaId}/mensalistas?${params.toString()}`)
    })
  }

  const openDetail = (resumo: MensalistaResumo) => {
    router.push(
      `/dashboard/arenas/${arenaId}/mensalistas/${resumo.athleteId}?competencia=${competencia}`
    )
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return overview.resumos.filter((r) => {
      const matchSearch =
        !term ||
        r.nome.toLowerCase().includes(term) ||
        (r.telefone ?? '').toLowerCase().includes(term)
      const matchStatus = statusFilter === 'todos' || r.statusPlano === statusFilter
      const matchSituacao =
        situacaoFilter === 'todas' || r.situacao === situacaoFilter
      const matchAtraso = !soAtraso || r.atrasoValor > 0
      return matchSearch && matchStatus && matchSituacao && matchAtraso
    })
  }, [overview.resumos, search, statusFilter, situacaoFilter, soAtraso])

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">
            Mensalistas
          </h1>
          <p className="text-arena-navy-800/60 font-medium">
            Controle de recebimentos, rateios e créditos de todos os mensalistas
            da arena.
          </p>
        </div>

        <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-arena-navy-800/5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToMonth(subMonths(competenciaDate, 1))}
            disabled={isPending}
            className="h-9 w-9 hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="px-5 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-arena-button" />
            <span className="text-sm font-black text-arena-navy-800 uppercase tracking-wider min-w-[140px] text-center">
              {format(competenciaDate, 'MMMM yyyy', { locale: ptBR })}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToMonth(addMonths(competenciaDate, 1))}
            disabled={isPending}
            className="h-9 w-9 hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Total a receber"
          value={formatCurrency(overview.totais.aReceber)}
          sub="mensalidades do mês"
          color="bg-arena-navy-800"
        />
        <StatCard
          icon={Wallet}
          label="Total recebido"
          value={formatCurrency(overview.totais.recebido)}
          color="bg-emerald-500"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Restante"
          value={formatCurrency(overview.totais.restante)}
          sub="ainda em aberto"
          color={overview.totais.restante > 0 ? 'bg-amber-500' : 'bg-slate-400'}
        />
        <StatCard
          icon={AlertTriangleIcon}
          label="Encerrando em breve"
          value={String(overview.totais.encerrandoEmBreve)}
          sub="próximos 60 dias"
          color={
            overview.totais.encerrandoEmBreve > 0
              ? 'bg-orange-500'
              : 'bg-slate-400'
          }
        />
      </div>

      {overview.totais.atrasoTotal > 0 && (
        <button
          onClick={() => setSoAtraso((v) => !v)}
          className={cn(
            'w-full flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors',
            soAtraso
              ? 'border-red-300 bg-red-100'
              : 'border-red-200 bg-red-50 hover:bg-red-100'
          )}
        >
          <div className="h-10 w-10 rounded-2xl bg-red-500 flex items-center justify-center flex-shrink-0">
            <AlertTriangleIcon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-red-700">
              {overview.totais.atrasoMensalistas} mensalista
              {overview.totais.atrasoMensalistas !== 1 ? 's' : ''} com mensalidade
              de mês anterior em aberto — {formatCurrency(overview.totais.atrasoTotal)}
            </p>
            <p className="text-[11px] text-red-600/80 font-medium">
              Independe do mês selecionado.{' '}
              {soAtraso ? 'Mostrando só os em atraso.' : 'Clique para filtrar.'}
            </p>
          </div>
        </button>
      )}

      <Card className="border-none shadow-sm bg-white p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['todos', 'ativo', 'encerrando', 'cancelado'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                  statusFilter === f
                    ? 'bg-arena-navy-800 text-white'
                    : 'bg-[#F1F5F9] text-arena-navy-800/60 hover:bg-arena-navy-800/10'
                )}
              >
                {f === 'todos'
                  ? 'Todos'
                  : STATUS_PLANO_STYLE[f].label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-arena-navy-800/10" />
            {(['todas', 'pendente', 'parcial', 'quitado'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSituacaoFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                  situacaoFilter === f
                    ? 'bg-arena-button text-white'
                    : 'bg-[#F1F5F9] text-arena-navy-800/60 hover:bg-arena-navy-800/10'
                )}
              >
                {f === 'todas' ? 'Situação' : SITUACAO_STYLE[f].label}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/30" />
            <Input
              placeholder="Buscar responsável..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-arena-navy-800/10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={arenaDataTable.table}>
            <thead>
              <tr className={arenaDataTable.theadRow}>
                {[
                  'Responsável',
                  'Status',
                  'Recorrências',
                  'Início',
                  'Encerramento',
                  'Valor do mês',
                  'Recebido',
                  'Restante',
                  'Atraso',
                  'Situação',
                  'Crédito',
                  'Ações',
                ].map((h, i, arr) => (
                  <th
                    key={h}
                    className={
                      i === arr.length - 1
                        ? arenaDataTable.thRight
                        : arenaDataTable.th
                    }
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className={arenaDataTable.emptyCell}>
                    Nenhum mensalista encontrado para este mês.
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const sit = SITUACAO_STYLE[r.situacao]
                const st = STATUS_PLANO_STYLE[r.statusPlano]
                return (
                  <tr
                    key={r.athleteId}
                    className={cn(arenaDataTable.tbodyRow, 'cursor-pointer')}
                    onClick={() => openDetail(r)}
                  >
                    <td className={arenaDataTable.tdBold}>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Users className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-bold text-arena-navy-800 text-sm">
                            {r.nome}
                          </p>
                          {r.telefone && (
                            <p className="text-[11px] text-arena-navy-800/40">
                              {r.telefone}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={arenaDataTable.td}>
                      <Badge
                        className={cn(
                          'font-bold text-[10px] uppercase border-none',
                          st.className
                        )}
                      >
                        {st.label}
                      </Badge>
                    </td>
                    <td className={arenaDataTable.td}>{r.recorrenciasCount}</td>
                    <td className={cn(arenaDataTable.td, 'whitespace-nowrap')}>
                      {formatDate(r.inicio)}
                    </td>
                    <td className={cn(arenaDataTable.td, 'whitespace-nowrap')}>
                      {r.encerramentoPrevisto ? (
                        <span className="text-orange-600 font-bold">
                          {formatCompetenciaShort(r.encerramentoPrevisto)}
                        </span>
                      ) : (
                        <span className="text-arena-navy-800/30">—</span>
                      )}
                    </td>
                    <td className={cn(arenaDataTable.td, 'whitespace-nowrap font-bold')}>
                      {formatCurrency(r.valorMes)}
                    </td>
                    <td className={cn(arenaDataTable.td, 'whitespace-nowrap text-emerald-600 font-bold')}>
                      {formatCurrency(r.recebidoMes)}
                    </td>
                    <td className={cn(arenaDataTable.td, 'whitespace-nowrap font-bold', r.restanteMes > 0 ? 'text-amber-600' : 'text-arena-navy-800/40')}>
                      {formatCurrency(r.restanteMes)}
                    </td>
                    <td className={cn(arenaDataTable.td, 'whitespace-nowrap')}>
                      {r.atrasoValor > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
                          {formatCurrency(r.atrasoValor)}
                          <span className="text-red-500/70">
                            · {r.atrasoMeses}m
                          </span>
                        </span>
                      ) : (
                        <span className="text-arena-navy-800/30">—</span>
                      )}
                    </td>
                    <td className={arenaDataTable.td}>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold',
                          sit.className
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', sit.dot)} />
                        {sit.label}
                      </span>
                    </td>
                    <td className={arenaDataTable.td}>
                      {r.creditoSaldo > 0 ? (
                        <Badge className="bg-sky-100 text-sky-700 border-none font-bold text-[10px]">
                          {formatCurrency(r.creditoSaldo)}
                        </Badge>
                      ) : (
                        <span className="text-arena-navy-800/30">—</span>
                      )}
                    </td>
                    <td className={arenaDataTable.tdRight}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDetail(r)
                        }}
                      >
                        <Eye className="h-4 w-4 text-arena-navy-800/60" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
