'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownToLine,
  Building2,
  CheckCircle2,
  Clock3,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  configureArenaWithdrawalDestinationAction,
  getArenaFinancialOverviewAction,
  requestArenaWithdrawalAction,
} from '@/modules/finance/actions/arenaFinancialAccountActions'
import type {
  ArenaFinancialOverview,
  ArenaPixKeyType,
  ArenaWithdrawalStatus,
} from '@/modules/finance/types/arena-financial-account.types'
import { cn } from '@/lib/utils'

const PIX_KEY_TYPES: Array<{ value: ArenaPixKeyType; label: string }> = [
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'CPF', label: 'CPF' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'EVP', label: 'Chave aleatória' },
]

const WITHDRAWAL_STATUS: Record<ArenaWithdrawalStatus, { label: string; className: string }> = {
  requested: { label: 'Solicitado', className: 'bg-slate-100 text-slate-700' },
  processing: { label: 'Processando', className: 'bg-amber-50 text-amber-700' },
  unknown: { label: 'Em conciliação', className: 'bg-orange-50 text-orange-700' },
  pending: { label: 'Pendente', className: 'bg-amber-50 text-amber-700' },
  done: { label: 'Concluído', className: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Falhou', className: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600' },
}

function closedPeriod() {
  const finish = new Date()
  finish.setDate(finish.getDate() - 1)
  const start = new Date(finish)
  start.setDate(start.getDate() - 29)
  return {
    startDate: start.toISOString().slice(0, 10),
    finishDate: finish.toISOString().slice(0, 10),
  }
}

function formatCents(value: number | null) {
  if (value === null) return 'Indisponível'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function amountFromInput(value: string): number | null {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim()
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100)
}

export function ArenaFinancialAccountCard({ arenaId }: { arenaId: string }) {
  const period = useMemo(() => closedPeriod(), [])
  const [overview, setOverview] = useState<ArenaFinancialOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [destinationOpen, setDestinationOpen] = useState(false)
  const [pixKeyType, setPixKeyType] = useState<ArenaPixKeyType>('CNPJ')
  const [pixKey, setPixKey] = useState('')
  const [savingDestination, setSavingDestination] = useState(false)
  const [withdrawalOpen, setWithdrawalOpen] = useState(false)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalOperationId, setWithdrawalOperationId] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    const result = await getArenaFinancialOverviewAction(
      arenaId,
      period.startDate,
      period.finishDate,
    )
    if (result.success) {
      setOverview(result.data)
      setLoadError(null)
    } else {
      setLoadError(result.error)
    }
    setLoading(false)
    setRefreshing(false)
  }, [arenaId, period.finishDate, period.startDate])

  useEffect(() => {
    let cancelled = false
    void getArenaFinancialOverviewAction(
      arenaId,
      period.startDate,
      period.finishDate,
    ).then((result) => {
      if (cancelled) return
      if (result.success) {
        setOverview(result.data)
        setLoadError(null)
      } else {
        setLoadError(result.error)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [arenaId, period.finishDate, period.startDate])

  async function saveDestination() {
    setSavingDestination(true)
    const result = await configureArenaWithdrawalDestinationAction(arenaId, {
      pixKeyType,
      pixKey,
    })
    setSavingDestination(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Destino Pix salvo no cofre da conta.')
    setPixKey('')
    setDestinationOpen(false)
    await load(true)
  }

  function openWithdrawal() {
    setWithdrawalOperationId(crypto.randomUUID())
    setWithdrawalAmount('')
    setWithdrawalOpen(true)
  }

  async function requestWithdrawal() {
    const amountCents = amountFromInput(withdrawalAmount)
    if (!amountCents) {
      toast.error('Informe um valor de saque válido.')
      return
    }
    setWithdrawing(true)
    const result = await requestArenaWithdrawalAction(arenaId, {
      operationId: withdrawalOperationId,
      amountCents,
    })
    setWithdrawing(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(
      result.data?.status === 'done'
        ? 'Saque concluído.'
        : 'Saque registrado e em processamento.',
    )
    setWithdrawalOpen(false)
    await load(true)
  }

  if (loading) {
    return (
      <Card className="flex min-h-48 items-center justify-center rounded-2xl border-none bg-white shadow-lg">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-arena-button" />
          Carregando conta de recebimento
        </div>
      </Card>
    )
  }

  if (!overview || loadError) {
    return (
      <Card className="rounded-2xl border border-red-100 bg-white p-6 shadow-lg">
        <p className="font-bold text-arena-navy-800">Conta de recebimento indisponível</p>
        <p className="mt-1 text-sm text-slate-500">{loadError ?? 'Tente novamente em instantes.'}</p>
        <Button className="mt-4" variant="outline" onClick={() => void load()}>
          Tentar novamente
        </Button>
      </Card>
    )
  }

  return (
    <>
      {!overview.accountReady && (
        <Card className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-amber-950">Ative a conta de recebimento da Arena</p>
            <p className="mt-1 text-sm text-amber-900/70">
              Conclua o cadastro no Asaas para liberar reservas online, saldo e saques.
            </p>
          </div>
          <Button asChild className="shrink-0 bg-amber-950 text-white hover:bg-amber-900">
            <Link href={`/dashboard/arenas/${arenaId}/edit`}>Concluir ativação</Link>
          </Button>
        </Card>
      )}
      <Card className="overflow-hidden rounded-2xl border-none bg-[#071F33] text-white shadow-xl">
        <div className="grid lg:grid-cols-[1.25fr_1fr]">
          <div className="relative overflow-hidden p-7 lg:p-8">
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-arena-button/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/10 p-2.5">
                    <Landmark className="h-5 w-5 text-[#FFB000]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Conta Arena</p>
                    <p className="font-bold">Saldo de reservas online</p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Atualizar conta financeira"
                  className="text-white hover:bg-white/10 hover:text-white"
                  disabled={refreshing}
                  onClick={() => void load(true)}
                >
                  <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                </Button>
              </div>

              <p className="mt-8 text-sm font-semibold text-white/55">Disponível para saque</p>
              <p className="mt-1 text-4xl font-black tracking-tight lg:text-5xl">
                {formatCents(overview.balanceCents)}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Subconta isolada por Arena
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-xs font-bold text-white/65">
                  <Clock3 className="h-3.5 w-3.5" />
                  Extrato até {new Date(`${overview.statementPeriod.finishDate}T12:00:00`).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/[0.04] p-7 lg:border-l lg:border-t-0 lg:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Destino do saque</p>
                <p className="mt-2 text-lg font-black">
                  {overview.destination.configured
                    ? overview.destination.maskedPixKey
                    : 'Ainda não configurado'}
                </p>
                <p className="mt-1 text-sm text-white/50">
                  {overview.destination.configured
                    ? `Chave ${overview.destination.pixKeyType} protegida no cofre`
                    : 'Cadastre uma chave Pix da própria Arena.'}
                </p>
              </div>
              <WalletCards className="h-6 w-6 text-[#FFB000]" />
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button
                className="bg-white text-[#071F33] hover:bg-white/90"
                onClick={() => setDestinationOpen(true)}
              >
                {overview.destination.configured ? 'Alterar destino' : 'Cadastrar Pix'}
              </Button>
              <Button
                className="bg-arena-button text-white hover:bg-arena-button/90"
                disabled={!overview.accountReady || !overview.destination.configured}
                onClick={openWithdrawal}
              >
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Solicitar saque
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-none bg-white p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-arena-navy-800">Saques da subconta</h2>
              <p className="text-sm text-slate-500">Acompanhamento e conciliação por operação.</p>
            </div>
            <ArrowDownToLine className="h-5 w-5 text-arena-button" />
          </div>
          <div className="mt-5 space-y-3">
            {overview.withdrawals.length ? overview.withdrawals.slice(0, 6).map((withdrawal) => {
              const status = WITHDRAWAL_STATUS[withdrawal.status]
              return (
                <div key={withdrawal.id} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
                  <div>
                    <p className="font-black text-arena-navy-800">{formatCents(withdrawal.amountCents)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDate(withdrawal.requestedAt)}</p>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', status.className)}>
                    {status.label}
                  </span>
                </div>
              )
            }) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Nenhum saque solicitado.
              </div>
            )}
          </div>
        </Card>

        <Card className="rounded-2xl border-none bg-white p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-arena-navy-800">Extrato Asaas</h2>
              <p className="text-sm text-slate-500">Últimos lançamentos conciliados.</p>
            </div>
            <Building2 className="h-5 w-5 text-arena-button" />
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            {overview.statement.length ? overview.statement.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-arena-navy-800">
                    {entry.description || entry.type}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{entry.occurredOn}</p>
                </div>
                <p className={cn(
                  'shrink-0 text-sm font-black',
                  entry.amountCents >= 0 ? 'text-emerald-600' : 'text-red-500',
                )}>
                  {entry.amountCents >= 0 ? '+' : ''}{formatCents(entry.amountCents)}
                </p>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Nenhum lançamento no período fechado.
              </div>
            )}
          </div>
        </Card>
      </div>

      <Dialog open={destinationOpen} onOpenChange={(open) => !savingDestination && setDestinationOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Destino Pix dos saques</DialogTitle>
            <DialogDescription>
              A chave será armazenada no cofre do backend. Depois de salva, somente a versão mascarada ficará visível.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="grid gap-2 text-sm font-bold text-arena-navy-800">
              Tipo da chave
              <select
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                value={pixKeyType}
                onChange={(event) => setPixKeyType(event.target.value as ArenaPixKeyType)}
              >
                {PIX_KEY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-arena-navy-800">
              Chave Pix
              <input
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                autoComplete="off"
                value={pixKey}
                onChange={(event) => setPixKey(event.target.value)}
                placeholder="Informe a chave da Arena"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={savingDestination} onClick={() => setDestinationOpen(false)}>Cancelar</Button>
            <Button disabled={savingDestination || !pixKey.trim()} onClick={() => void saveDestination()}>
              {savingDestination ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Salvar no cofre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawalOpen} onOpenChange={(open) => !withdrawing && setWithdrawalOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar saque Pix</DialogTitle>
            <DialogDescription>
              Confira o valor. A solicitação será registrada com uma chave idempotente antes da transferência.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-slate-50 p-5">
            <label className="grid gap-2 text-sm font-bold text-arena-navy-800">
              Valor do saque
              <div className="flex h-12 items-center rounded-lg border border-slate-200 bg-white px-3">
                <span className="mr-2 text-sm font-bold text-slate-400">R$</span>
                <input
                  className="min-w-0 flex-1 bg-transparent text-lg font-black outline-none"
                  inputMode="decimal"
                  value={withdrawalAmount}
                  onChange={(event) => setWithdrawalAmount(event.target.value)}
                  placeholder="0,00"
                />
              </div>
            </label>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Destino: {overview.destination.maskedPixKey}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={withdrawing} onClick={() => setWithdrawalOpen(false)}>Voltar</Button>
            <Button disabled={withdrawing || !amountFromInput(withdrawalAmount)} onClick={() => void requestWithdrawal()}>
              {withdrawing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
              Confirmar saque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
