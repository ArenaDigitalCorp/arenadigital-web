'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addMonths, format, parseISO, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  MapPin,
  Minus,
  Plus,
  Star,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { arenaDataTable } from '@/lib/arena-data-table'
import {
  formatCurrency,
  formatCompetencia,
  formatCompetenciaShort,
  formatDate,
  toCompetencia,
} from '@/lib/format'
import { toast } from 'sonner'
import { cancelPlanoMensalistaAction } from '@/modules/bookings/actions/mensalistaActions'
import { RateioModal } from './RateioModal'
import { RegistrarPagamentoModal } from './RegistrarPagamentoModal'
import { LancarCreditoModal } from './LancarCreditoModal'
import { RetirarCreditoModal } from './RetirarCreditoModal'
import { EncerramentoModal } from './EncerramentoModal'
import type {
  CobrancaRow,
  MensalidadeRow,
  MensalistaDetalhe,
} from '@/modules/mensalistas/types/mensalista.types'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CREDITO_TIPO_LABEL: Record<string, string> = {
  lancamento: 'Lançamento',
  uso: 'Uso em mensalidade',
  retirada: 'Retirada',
  estorno: 'Estorno',
  ajuste: 'Ajuste',
}

interface Props {
  arenaId: string
  athleteId: string
  competencia: string
  detalhe: MensalistaDetalhe
  modosPagamento: { id: string; nome: string }[]
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
          'h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0',
          color
        )}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-black uppercase text-arena-navy-800/40 tracking-wider">
          {label}
        </p>
        <p className="text-xl font-black text-arena-navy-800">{value}</p>
        {sub && (
          <p className="text-[10px] text-arena-navy-800/40 font-medium">{sub}</p>
        )}
      </div>
    </Card>
  )
}

/** Loyalty balance uses the arena virtual currency, rendered like the loyalty module ($ prefix). */
function formatLoyalty(value: number): string {
  return `$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function cobrancaStatus(c: CobrancaRow): { label: string; className: string } {
  const pago = Number(c.valor_pago) + Number(c.credito_aplicado)
  if (pago + 0.01 >= Number(c.valor_devido))
    return { label: 'Pago', className: 'bg-emerald-100 text-emerald-700' }
  if (pago > 0) return { label: 'Parcial', className: 'bg-amber-100 text-amber-700' }
  return { label: 'Pendente', className: 'bg-red-100 text-red-700' }
}

const PAGE_SIZE = 10

export function MensalistaDetailClient({
  arenaId,
  athleteId,
  competencia,
  detalhe,
  modosPagamento,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [page, setPage] = useState(1)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  const [rateioTarget, setRateioTarget] = useState<{
    mensalidade: MensalidadeRow
    cobrancas: CobrancaRow[]
  } | null>(null)
  const [pagamentoTarget, setPagamentoTarget] = useState<CobrancaRow | null>(null)
  const [encerramentoTarget, setEncerramentoTarget] = useState<{
    planoId: string
    label: string
    dataPrevista: string | null
    obs: string | null
  } | null>(null)
  const [creditoOpen, setCreditoOpen] = useState(false)
  const [retiradaOpen, setRetiradaOpen] = useState(false)

  const {
    resumo,
    recorrencias,
    atrasos,
    historicoPagamentos,
    creditos,
    creditoSaldo,
    fidelidade,
  } = detalhe
  const competenciaDate = parseISO(`${competencia}-01`)

  const goToMonth = (date: Date) => {
    startTransition(() => {
      router.push(
        `/dashboard/arenas/${arenaId}/mensalistas/${athleteId}?competencia=${toCompetencia(
          date
        )}`
      )
    })
  }

  const refresh = () => router.refresh()

  const handleCancelPlano = async (planoId: string, label: string) => {
    if (
      !window.confirm(
        `Cancelar definitivamente a recorrência "${label}"? As reservas futuras ainda não confirmadas serão canceladas. Esta ação não pode ser desfeita.`
      )
    ) {
      return
    }
    setCancelingId(planoId)
    try {
      const res = await cancelPlanoMensalistaAction(arenaId, planoId)
      if (res.success) {
        toast.success('Recorrência cancelada.')
        refresh()
      } else {
        toast.error(res.error ?? 'Erro ao cancelar a recorrência')
      }
    } finally {
      setCancelingId(null)
    }
  }

  const atletasParaCredito = useMemo(() => {
    const map = new Map<string, string>()
    map.set(athleteId, resumo.nome)
    for (const rec of recorrencias) {
      for (const c of rec.cobrancas) {
        if (c.atleta_id) map.set(c.atleta_id, c.nome)
      }
    }
    return Array.from(map, ([id, nome]) => ({ id, nome }))
  }, [athleteId, resumo.nome, recorrencias])

  const pagedHistorico = historicoPagamentos.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )
  const totalPages = Math.max(1, Math.ceil(historicoPagamentos.length / PAGE_SIZE))

  return (
    <div className="space-y-8">
      <div>
        <button
          onClick={() =>
            router.push(
              `/dashboard/arenas/${arenaId}/mensalistas?competencia=${competencia}`
            )
          }
          className="flex items-center gap-1.5 text-sm font-medium text-arena-navy-800/60 hover:text-arena-navy-800"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">
              {resumo.nome}
            </h1>
            {resumo.statusPlano === 'encerrando' && (
              <Badge className="bg-orange-100 text-orange-700 border-none font-bold">
                Encerrando
              </Badge>
            )}
            {resumo.atrasoValor > 0 && (
              <Badge className="bg-red-100 text-red-700 border-none font-bold">
                Em atraso: {formatCurrency(resumo.atrasoValor)} · {resumo.atrasoMeses}{' '}
                {resumo.atrasoMeses === 1 ? 'mês' : 'meses'}
              </Badge>
            )}
          </div>
          <p className="text-arena-navy-800/60 font-medium">
            Competência de{' '}
            {format(competenciaDate, "MMMM 'de' yyyy", { locale: ptBR })}
            {resumo.telefone ? ` · ${resumo.telefone}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-arena-navy-800/5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={isPending}
              onClick={() => goToMonth(subMonths(competenciaDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-arena-button" />
              <span className="text-xs font-black text-arena-navy-800 uppercase tracking-wider min-w-[120px] text-center">
                {format(competenciaDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={isPending}
              onClick={() => goToMonth(addMonths(competenciaDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {creditoSaldo > 0 && (
            <Button
              variant="outline"
              onClick={() => setRetiradaOpen(true)}
              className="font-bold gap-1.5 border-arena-navy-800/15"
            >
              <Minus className="h-4 w-4" /> Retirar crédito
            </Button>
          )}
          <Button
            onClick={() => setCreditoOpen(true)}
            className="bg-arena-button hover:bg-arena-button-hover text-white font-bold gap-1.5"
          >
            <Plus className="h-4 w-4" /> Lançar crédito
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          icon={TrendingUp}
          label="Total a receber"
          value={formatCurrency(resumo.valorMes)}
          color="bg-arena-navy-800"
        />
        <StatCard
          icon={Wallet}
          label="Recebido"
          value={formatCurrency(resumo.recebidoMes)}
          color="bg-emerald-500"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Restante"
          value={formatCurrency(resumo.restanteMes)}
          color={resumo.restanteMes > 0 ? 'bg-amber-500' : 'bg-slate-400'}
        />
        <StatCard
          icon={Wallet}
          label="Crédito"
          value={formatCurrency(creditoSaldo)}
          color={creditoSaldo > 0 ? 'bg-sky-500' : 'bg-slate-400'}
        />
        <StatCard
          icon={Star}
          label={fidelidade.moeda ?? 'Pontos de fidelidade'}
          value={formatLoyalty(fidelidade.saldo)}
          sub="(Saldo Programa Fidelidade)"
          color={fidelidade.saldo > 0 ? 'bg-yellow-500' : 'bg-slate-400'}
        />
      </div>

      {/* Recorrências + mensalidade do mês */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-arena-navy-800">
          Recorrências e mensalidade do mês
        </h2>

        {recorrencias.map((rec) => {
          const p = rec.plano
          const horario = `${p.horario_inicio.slice(0, 5)} às ${p.horario_fim.slice(0, 5)}`
          const m = rec.mensalidade
          return (
            <Card
              key={p.id}
              className="border-none shadow-sm bg-white p-5 space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1.5 font-bold text-arena-navy-800">
                    <MapPin className="h-4 w-4 text-arena-navy-800/30" />
                    {(p.court as { name?: string } | null)?.name ?? '—'}
                  </span>
                  <span className="flex items-center gap-1.5 text-arena-navy-800/70">
                    <Calendar className="h-4 w-4 text-arena-navy-800/30" />
                    {DIAS[p.dia_semana]}
                  </span>
                  <span className="flex items-center gap-1.5 text-arena-navy-800/70">
                    <Clock className="h-4 w-4 text-arena-navy-800/30" />
                    {horario}
                  </span>
                  <span className="font-bold text-arena-button">
                    {formatCurrency(p.valor_mensal)}/mês
                  </span>
                  {p.status !== 'ativo' && (
                    <Badge className="bg-gray-100 text-gray-500 border-none font-bold text-[10px] uppercase">
                      Cancelado
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {m && (
                    <label className="flex items-center gap-2 text-xs font-bold text-arena-navy-800/60">
                      Rateio
                      <Switch
                        checked={m.rateio}
                        onCheckedChange={() =>
                          setRateioTarget({ mensalidade: m, cobrancas: rec.cobrancas })
                        }
                      />
                    </label>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-arena-navy-800/60 hover:text-orange-600 hover:bg-orange-50 text-xs font-bold"
                    disabled={p.status !== 'ativo'}
                    onClick={() =>
                      setEncerramentoTarget({
                        planoId: p.id,
                        label: `${(p.court as { name?: string } | null)?.name ?? ''} · ${DIAS[p.dia_semana]} ${horario}`,
                        dataPrevista: p.data_encerramento_prevista ?? null,
                        obs: p.encerramento_observacao ?? null,
                      })
                    }
                  >
                    {p.data_encerramento_prevista ? 'Editar encerramento' : 'Prever encerramento'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-arena-navy-800/50 hover:text-red-600 hover:bg-red-50 text-xs font-bold"
                    disabled={p.status !== 'ativo' || cancelingId === p.id}
                    onClick={() =>
                      handleCancelPlano(
                        p.id,
                        `${(p.court as { name?: string } | null)?.name ?? ''} · ${DIAS[p.dia_semana]} ${horario}`
                      )
                    }
                  >
                    {cancelingId === p.id ? 'Cancelando…' : 'Cancelar plano'}
                  </Button>
                </div>
              </div>

              {p.data_encerramento_prevista && (
                <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-sm text-orange-700">
                  Encerra a partir de{' '}
                  <b>{formatCompetenciaShort(p.data_encerramento_prevista)}</b>
                  {p.encerramento_observacao ? ` — ${p.encerramento_observacao}` : ''}
                  . Horário liberado para revenda:{' '}
                  {DIAS[p.dia_semana]} {horario}.
                </div>
              )}

              {!m ? (
                <p className="text-sm text-arena-navy-800/40">
                  Sem mensalidade gerada para este mês (plano inativo ou anterior
                  ao início).
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className={arenaDataTable.table}>
                    <thead>
                      <tr className={arenaDataTable.theadRow}>
                        {['Participante', 'Devido', 'Pago', 'Crédito', 'Pago em', 'Status', 'Ações'].map(
                          (h, i, arr) => (
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
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {rec.cobrancas
                        .filter((c) => c.ativo)
                        .map((c) => {
                          const st = cobrancaStatus(c)
                          const quitada =
                            Number(c.valor_pago) + Number(c.credito_aplicado) + 0.01 >=
                            Number(c.valor_devido)
                          return (
                            <tr key={c.id} className={arenaDataTable.tbodyRow}>
                              <td className={arenaDataTable.tdBold}>
                                {c.nome}
                                {!c.atleta_id && (
                                  <span className="ml-1.5 text-[10px] text-arena-navy-800/40">
                                    avulso
                                  </span>
                                )}
                              </td>
                              <td className={arenaDataTable.td}>
                                {formatCurrency(c.valor_devido)}
                              </td>
                              <td className={cn(arenaDataTable.td, 'text-emerald-600 font-bold')}>
                                {formatCurrency(c.valor_pago)}
                              </td>
                              <td className={arenaDataTable.td}>
                                {Number(c.credito_aplicado) > 0
                                  ? formatCurrency(c.credito_aplicado)
                                  : '—'}
                              </td>
                              <td className={arenaDataTable.td}>
                                {c.pago_em ? formatDate(c.pago_em) : '—'}
                              </td>
                              <td className={arenaDataTable.td}>
                                <Badge
                                  className={cn(
                                    'border-none font-bold text-[10px]',
                                    st.className
                                  )}
                                >
                                  {st.label}
                                </Badge>
                              </td>
                              <td className={arenaDataTable.tdRight}>
                                <Button
                                  size="sm"
                                  disabled={quitada}
                                  onClick={() => setPagamentoTarget(c)}
                                  className="h-8 px-3 rounded-lg text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                                >
                                  Registrar pagamento
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Pendências de meses anteriores */}
      {atrasos.length > 0 && (
        <Card className="border border-red-200 shadow-sm bg-red-50/50 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-red-700">
              Pendências de meses anteriores
            </h2>
            <span className="text-sm font-bold text-red-700">
              {formatCurrency(resumo.atrasoValor)} em {atrasos.length}{' '}
              {atrasos.length === 1 ? 'mês' : 'meses'}
            </span>
          </div>
          <div className="space-y-4">
            {atrasos.map((a) => (
              <div
                key={a.mensalidadeId}
                className="rounded-xl bg-white border border-red-100 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-arena-navy-800 capitalize">
                      {formatCompetencia(a.competencia)}
                    </span>
                    {a.quadra && (
                      <span className="text-xs text-arena-navy-800/50 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {a.quadra}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-red-600">
                    Falta {formatCurrency(a.restante)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className={arenaDataTable.table}>
                    <thead>
                      <tr className={arenaDataTable.theadRow}>
                        {['Participante', 'Devido', 'Pago', 'Status', 'Ações'].map(
                          (h, i, arr) => (
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
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {a.cobrancas.map((c) => {
                        const st = cobrancaStatus(c)
                        const quitada =
                          Number(c.valor_pago) +
                            Number(c.credito_aplicado) +
                            0.01 >=
                          Number(c.valor_devido)
                        return (
                          <tr key={c.id} className={arenaDataTable.tbodyRow}>
                            <td className={arenaDataTable.tdBold}>{c.nome}</td>
                            <td className={arenaDataTable.td}>
                              {formatCurrency(c.valor_devido)}
                            </td>
                            <td className={cn(arenaDataTable.td, 'text-emerald-600 font-bold')}>
                              {formatCurrency(
                                Number(c.valor_pago) + Number(c.credito_aplicado)
                              )}
                            </td>
                            <td className={arenaDataTable.td}>
                              <Badge
                                className={cn(
                                  'border-none font-bold text-[10px]',
                                  st.className
                                )}
                              >
                                {st.label}
                              </Badge>
                            </td>
                            <td className={arenaDataTable.tdRight}>
                              <Button
                                size="sm"
                                disabled={quitada}
                                onClick={() => setPagamentoTarget(c)}
                                className="h-8 px-3 rounded-lg text-xs bg-red-500 hover:bg-red-600 text-white font-bold"
                              >
                                Registrar pagamento
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Histórico de pagamentos */}
      <Card className="border-none shadow-sm bg-white p-6 space-y-4">
        <h2 className="text-lg font-black text-arena-navy-800">
          Histórico de pagamentos
        </h2>
        <div className="overflow-x-auto">
          <table className={arenaDataTable.table}>
            <thead>
              <tr className={arenaDataTable.theadRow}>
                {['Data', 'Competência', 'Participante', 'Dinheiro', 'Crédito', 'Observação'].map(
                  (h) => (
                    <th key={h} className={arenaDataTable.th}>
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {pagedHistorico.length === 0 && (
                <tr>
                  <td colSpan={6} className={arenaDataTable.emptyCell}>
                    Nenhum pagamento registrado.
                  </td>
                </tr>
              )}
              {pagedHistorico.map((pg) => (
                <tr key={pg.id} className={arenaDataTable.tbodyRow}>
                  <td className={arenaDataTable.td}>
                    {formatDate(pg.data_pagamento)}
                  </td>
                  <td className={arenaDataTable.td}>
                    {pg.competencia
                      ? formatCompetenciaShort(pg.competencia)
                      : '—'}
                  </td>
                  <td className={arenaDataTable.tdBold}>{pg.cobrancaNome}</td>
                  <td className={cn(arenaDataTable.td, 'text-emerald-600 font-bold')}>
                    {formatCurrency(pg.valor)}
                  </td>
                  <td className={arenaDataTable.td}>
                    {Number(pg.credito_aplicado) > 0
                      ? formatCurrency(pg.credito_aplicado)
                      : '—'}
                  </td>
                  <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>
                    {pg.observacao ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-bold text-arena-navy-800/60">
              {page} / {totalPages}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>

      {/* Créditos */}
      <Card className="border-none shadow-sm bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-arena-navy-800">Créditos</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-arena-navy-800">
              Saldo atual:{' '}
              <span
                className={
                  creditoSaldo > 0 ? 'text-sky-600' : 'text-arena-navy-800/40'
                }
              >
                {formatCurrency(creditoSaldo)}
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreditoOpen(true)}
              className="h-8 gap-1 text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5" /> Lançar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={creditoSaldo <= 0}
              onClick={() => setRetiradaOpen(true)}
              className="h-8 gap-1 text-xs font-bold"
            >
              <Minus className="h-3.5 w-3.5" /> Retirar
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className={arenaDataTable.table}>
            <thead>
              <tr className={arenaDataTable.theadRow}>
                {['Data', 'Tipo', 'Valor', 'Descrição'].map((h) => (
                  <th key={h} className={arenaDataTable.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creditos.length === 0 && (
                <tr>
                  <td colSpan={4} className={arenaDataTable.emptyCell}>
                    Nenhum crédito lançado.
                  </td>
                </tr>
              )}
              {creditos.map((c) => (
                <tr key={c.id} className={arenaDataTable.tbodyRow}>
                  <td className={arenaDataTable.td}>{formatDate(c.created_at)}</td>
                  <td className={arenaDataTable.td}>{CREDITO_TIPO_LABEL[c.tipo] ?? c.tipo}</td>
                  <td
                    className={cn(
                      arenaDataTable.td,
                      'font-bold',
                      Number(c.valor) < 0 ? 'text-red-500' : 'text-emerald-600'
                    )}
                  >
                    {formatCurrency(c.valor)}
                  </td>
                  <td className={cn(arenaDataTable.td, 'text-arena-navy-800/60')}>
                    {c.descricao ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <RateioModal
        open={!!rateioTarget}
        onClose={() => setRateioTarget(null)}
        onSuccess={refresh}
        arenaId={arenaId}
        mensalidade={rateioTarget?.mensalidade ?? null}
        cobrancas={rateioTarget?.cobrancas ?? []}
      />
      <RegistrarPagamentoModal
        open={!!pagamentoTarget}
        onClose={() => setPagamentoTarget(null)}
        onSuccess={refresh}
        arenaId={arenaId}
        cobranca={pagamentoTarget}
        creditoSaldo={creditoSaldo}
        modosPagamento={modosPagamento}
      />
      <LancarCreditoModal
        open={creditoOpen}
        onClose={() => setCreditoOpen(false)}
        onSuccess={refresh}
        arenaId={arenaId}
        atletas={atletasParaCredito}
        defaultAtletaId={athleteId}
      />
      <RetirarCreditoModal
        open={retiradaOpen}
        onClose={() => setRetiradaOpen(false)}
        onSuccess={refresh}
        arenaId={arenaId}
        atletaId={athleteId}
        atletaNome={resumo.nome}
        saldo={creditoSaldo}
      />
      <EncerramentoModal
        open={!!encerramentoTarget}
        onClose={() => setEncerramentoTarget(null)}
        onSuccess={refresh}
        arenaId={arenaId}
        planoId={encerramentoTarget?.planoId ?? ''}
        planoLabel={encerramentoTarget?.label ?? ''}
        currentDataPrevista={encerramentoTarget?.dataPrevista ?? null}
        currentObs={encerramentoTarget?.obs ?? null}
      />
    </div>
  )
}
