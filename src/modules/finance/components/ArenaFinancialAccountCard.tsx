'use client'

import { NativeSelect } from "@/components/ui/native-select"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { toast } from 'sonner'
import { MaskedInput } from '@/components/ui/masked-input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { parseBrazilianDecimal } from '@/lib/format'
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
} from '@/modules/finance/types/arena-financial-account.types'
import { cn } from '@/lib/utils'
import { AsaasProviderNotice } from '@/components/payments/asaas-provider-notice'

const PIX_KEY_TYPES: Array<{ value: ArenaPixKeyType; label: string }> = [
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'CPF', label: 'CPF' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'EVP', label: 'Chave aleatória' },
]

function closedPeriod() {
  const finish = new Date()
  finish.setDate(finish.getDate() - 1)
  const start = new Date(finish)
  start.setDate(start.getDate() - 29)
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    finishDate: format(finish, 'yyyy-MM-dd'),
  }
}

function formatCents(value: number | null) {
  if (value === null) return 'Indisponível'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100)
}

function amountFromInput(value: string): number | null {
  const parsed = parseBrazilianDecimal(value)
  if (parsed === null || parsed <= 0) return null
  const cents = Math.round(parsed * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

export function ArenaFinancialAccountCard({ arenaId, receivingContext = false }: { arenaId: string; receivingContext?: boolean }) {
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
        {!receivingContext && <AsaasProviderNotice className="mt-4" />}
      </Card>
    )
  }

  return (
    <>
      {!receivingContext && <AsaasProviderNotice className="mb-6" />}
      {!receivingContext && !overview.accountReady && (
        <Card className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-amber-950">Ative a conta de recebimento da Arena</p>
            <p className="mt-1 text-sm text-amber-900/70">
              Conclua o cadastro no Asaas para liberar reservas online, saldo e saques.
            </p>
          </div>
          <Button asChild className="shrink-0 bg-amber-950 text-white hover:bg-amber-900">
            <Link href={`/dashboard/arenas/${arenaId}/edit?tab=receiving#receiving-account-title`}>
              Ir para o cadastro
            </Link>
          </Button>
        </Card>
      )}
      <Card className="gap-0 overflow-hidden rounded-xl border-0 bg-[#071F33] py-0 text-white shadow-sm">
        <div className="grid md:grid-cols-[1.55fr_1fr]">
          <div className="min-w-0 px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                <WalletCards className="size-4" /> Carteira da arena
              </p>
              <Button size="icon" variant="ghost" aria-label="Atualizar conta financeira"
                className="size-8 text-slate-300 hover:bg-white/10 hover:text-white"
                disabled={refreshing} onClick={() => void load(true)}>
                <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-300">Saldo disponível para saque</p>
            <p className={cn('mt-1 font-heading font-bold tracking-tight', overview.balanceCents === null ? 'text-xl leading-8' : 'text-3xl leading-9 tabular-nums')}>
              {formatCents(overview.balanceCents)}
            </p>
            {overview.balanceCents === null && <p className="mt-1 text-xs leading-5 text-slate-400">
              {overview.accountReady ? 'Não foi possível consultar o saldo. Tente atualizar.' : 'O saldo ficará disponível após a aprovação da conta.'}
            </p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-300">
                <Clock3 className="size-3" />
                Extrato até {new Date(`${overview.statementPeriod.finishDate}T12:00:00`).toLocaleDateString('pt-BR')}
              </span>
              {overview.accountReady && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                <ShieldCheck className="size-3" /> Subconta protegida
              </span>}
            </div>
          </div>
          <div className="flex min-w-0 flex-col justify-center border-t border-white/10 bg-[#152D40] px-5 py-5 sm:px-6 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Destino Pix do saque</p>
            <p className="mt-2 break-all text-sm font-semibold">
              {overview.destination.configured ? overview.destination.maskedPixKey : 'Ainda não configurado'}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {overview.destination.configured
                ? `Chave ${overview.destination.pixKeyType} protegida no cofre`
                : 'Cadastre uma chave Pix da própria Arena.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" className="h-9 bg-white px-3 text-xs font-medium text-arena-navy-800 hover:bg-slate-100"
                onClick={() => setDestinationOpen(true)}>
                {overview.destination.configured ? 'Alterar destino' : 'Cadastrar Pix'}
              </Button>
              <Button size="sm" className="h-9 bg-arena-button px-3 text-xs font-medium text-white hover:bg-arena-button-hover disabled:bg-white/10 disabled:text-slate-400 disabled:opacity-100"
                disabled={!overview.accountReady || !overview.destination.configured} onClick={openWithdrawal}>
                <ArrowDownToLine className="size-3.5" /> Solicitar saque
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={destinationOpen} onOpenChange={(open) => !savingDestination && setDestinationOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Destino Pix dos saques</DialogTitle>
            <DialogDescription>
              Informe uma chave Pix da própria arena para receber os saques processados pelo Asaas. Depois de salva, ela será exibida parcialmente para proteger seus dados.
            </DialogDescription>
          </DialogHeader>
          <AsaasProviderNotice />
          <div className="grid gap-4 py-2">
            <label className="grid gap-2 text-sm font-bold text-arena-navy-800">
              Tipo da chave
              <NativeSelect
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                value={pixKeyType}
                onChange={(event) => { setPixKeyType(event.target.value as ArenaPixKeyType); setPixKey('') }}
              >
                {PIX_KEY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </NativeSelect>
            </label>
            <label className="grid gap-2 text-sm font-bold text-arena-navy-800">
              Chave Pix
              {pixKeyType === 'CPF' || pixKeyType === 'CNPJ' || pixKeyType === 'PHONE' ? (
                <MaskedInput
                  mask={pixKeyType === 'CPF' ? 'cpf' : pixKeyType === 'CNPJ' ? 'cnpj' : 'phone'}
                  autoComplete="off" value={pixKey} onChange={event => setPixKey(event.target.value)}
                  placeholder="Informe a chave da Arena"
                />
              ) : (
                <input className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                  type={pixKeyType === 'EMAIL' ? 'email' : 'text'} autoComplete="off"
                  value={pixKey} onChange={event => setPixKey(event.target.value)} placeholder="Informe a chave da Arena" />
              )}
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
              Confira o valor e o destino. A transferência Pix será processada pelo Asaas.
            </DialogDescription>
          </DialogHeader>
          <AsaasProviderNotice />
          <div className="rounded-2xl bg-slate-50 p-5">
            <label className="grid gap-2 text-sm font-bold text-arena-navy-800">
              Valor do saque
              <div className="flex h-12 items-center rounded-lg border border-slate-200 bg-white px-3">
                <span className="mr-2 text-sm font-bold text-slate-400">R$</span>
                <DecimalInput
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
