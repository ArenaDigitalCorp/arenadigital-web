'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNowStrict, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Settings2,
  ShieldCheck,
  TimerReset,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { reviewAppBookingRequestAction } from '@/modules/bookings/actions/appBookingRequestActions'
import type {
  AppBookingRequestStatus,
  AppBookingRequestView,
} from '@/modules/bookings/types/app-booking-request.types'

type Filter = 'pending' | 'approved' | 'rejected' | 'expired' | 'all'

interface Props {
  arenaId: string
  initialRequests: AppBookingRequestView[]
  acceptsRequests: boolean
  initialError?: string
}

const STATUS_META: Record<AppBookingRequestStatus, {
  label: string
  classes: string
  icon: typeof CalendarClock
}> = {
  pending: {
    label: 'Aguardando análise',
    classes: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: Clock3,
  },
  approved: {
    label: 'Aprovada',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Recusada',
    classes: 'border-rose-200 bg-rose-50 text-rose-800',
    icon: XCircle,
  },
  expired: {
    label: 'Expirada',
    classes: 'border-slate-200 bg-slate-100 text-slate-600',
    icon: TimerReset,
  },
}

function formatMoney(value: number) {
  return value > 0
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'A consultar'
}

function formatDuration(minutes: number) {
  const hours = minutes / 60
  return `${hours}h`
}

function requestDate(request: AppBookingRequestView) {
  return format(parseISO(request.startTime), "EEEE, dd 'de' MMMM", { locale: ptBR })
}

function requestTime(request: AppBookingRequestView) {
  return `${format(parseISO(request.startTime), 'HH:mm')}–${format(parseISO(request.endTime), 'HH:mm')}`
}

function StatusBadge({ status }: { status: AppBookingRequestStatus }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={cn('gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide', meta.classes)}>
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  )
}

function Metric({ icon: Icon, label, value, detail, tone }: {
  icon: typeof CalendarClock
  label: string
  value: number
  detail: string
  tone: string
}) {
  return (
    <Card className="relative overflow-hidden border-none bg-white p-5 shadow-sm">
      <div className={cn('absolute -right-5 -top-5 size-24 rounded-full opacity-10', tone)} />
      <div className="relative flex items-center gap-4">
        <div className={cn('flex size-11 items-center justify-center rounded-2xl text-white shadow-sm', tone)}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-arena-navy-800/40">{label}</p>
          <p className="mt-0.5 text-2xl font-black text-arena-navy-800">{value}</p>
          <p className="text-[11px] font-medium text-arena-navy-800/45">{detail}</p>
        </div>
      </div>
    </Card>
  )
}

export function AppBookingRequestsPageClient({
  arenaId,
  initialRequests,
  acceptsRequests,
  initialError,
}: Props) {
  const router = useRouter()
  const [requests, setRequests] = useState(initialRequests)
  const [filter, setFilter] = useState<Filter>('pending')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showReject, setShowReject] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [loadingAction, setLoadingAction] = useState<'approve' | 'reject' | null>(null)
  const [isPending, startTransition] = useTransition()

  const selected = requests.find((request) => request.id === selectedId) ?? null
  const pendingCount = requests.filter((request) => request.status === 'pending').length
  const approvedToday = requests.filter(
    (request) => request.status === 'approved' && request.reviewedAt && isToday(parseISO(request.reviewedAt))
  ).length
  const conflictCount = requests.filter(
    (request) => request.status === 'pending' && request.hasConflict
  ).length

  const filtered = useMemo(() => {
    const result = filter === 'all'
      ? requests
      : requests.filter((request) => request.status === filter)
    return [...result].sort((left, right) => {
      if (left.status === 'pending' && right.status === 'pending') {
        return Date.parse(left.startTime) - Date.parse(right.startTime)
      }
      return Date.parse(right.createdAt) - Date.parse(left.createdAt)
    })
  }, [filter, requests])

  function closeDetails() {
    setSelectedId(null)
    setShowReject(false)
    setRejectionReason('')
  }

  function review(decision: 'approve' | 'reject') {
    if (!selected) return
    setLoadingAction(decision)
    startTransition(async () => {
      const result = await reviewAppBookingRequestAction({
        arenaId,
        requestId: selected.id,
        decision,
        rejectionReason: decision === 'reject' ? rejectionReason : undefined,
      })

      if (!result.success || !result.status) {
        const errorMessage = result.error ?? 'Não foi possível analisar a solicitação.'
        if (errorMessage.toLowerCase().includes('conflito')) {
          setRequests((current) => current.map((request) => (
            request.id === selected.id ? { ...request, hasConflict: true } : request
          )))
        }
        toast.error(errorMessage)
        setLoadingAction(null)
        return
      }

      setRequests((current) => current.map((request) => (
        request.id === selected.id
          ? {
              ...request,
              status: result.status as AppBookingRequestStatus,
              acceptedBookingId: result.bookingId ?? request.acceptedBookingId,
              reviewedAt: new Date().toISOString(),
              rejectionReason: decision === 'reject' ? rejectionReason || null : null,
              hasConflict: false,
            }
          : request
      )))

      if (result.status === 'approved') toast.success('Pré-reserva aprovada e horário bloqueado.')
      else if (result.status === 'rejected') toast.success('Solicitação recusada.')
      else if (result.status === 'expired') toast.error('O horário desta solicitação já passou.')

      setLoadingAction(null)
      closeDetails()
      router.refresh()
    })
  }

  const tabs: Array<{ value: Filter; label: string; count?: number }> = [
    { value: 'pending', label: 'Pendentes', count: pendingCount },
    { value: 'approved', label: 'Aprovadas' },
    { value: 'rejected', label: 'Recusadas' },
    { value: 'expired', label: 'Expiradas' },
    { value: 'all', label: 'Todas', count: requests.length },
  ]

  return (
    <div className="space-y-7 pb-12">
      <section className="relative overflow-hidden rounded-3xl bg-arena-navy-800 px-6 py-7 text-white shadow-[0_24px_70px_-35px_rgba(15,39,59,0.75)] sm:px-8">
        <div className="absolute inset-y-0 right-0 w-2/5 bg-[radial-gradient(circle_at_center,rgba(240,125,42,0.28),transparent_70%)]" />
        <div className="absolute -bottom-20 right-16 size-48 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/75">
              <ShieldCheck className="size-3.5 text-arena-accent" />
              Fila operacional
            </div>
            <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">Pré-reservas</h1>
            <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-white/60">
              Analise os pedidos enviados pelo aplicativo. O horário permanece livre até a aprovação da arena.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 backdrop-blur-sm">
            <div className={cn('size-2.5 rounded-full', acceptsRequests ? 'bg-emerald-400' : 'bg-amber-400')} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Recebimento pelo app</p>
              <p className="text-sm font-bold">{acceptsRequests ? 'Ativado' : 'Desativado'}</p>
            </div>
          </div>
        </div>
      </section>

      {!acceptsRequests && (
        <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Settings2 className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-black text-amber-900">Novas solicitações estão desativadas</p>
              <p className="mt-0.5 text-xs font-medium text-amber-800/70">
                A fila existente continua disponível para análise.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
            <Link href={`/dashboard/arenas/${arenaId}/edit`}>
              Configurar arena
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}

      {initialError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          {initialError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={CalendarClock} label="Aguardando" value={pendingCount} detail="pedidos para analisar" tone="bg-amber-500" />
        <Metric icon={CalendarCheck2} label="Aprovadas hoje" value={approvedToday} detail="horários confirmados" tone="bg-emerald-600" />
        <Metric icon={AlertTriangle} label="Com conflito" value={conflictCount} detail="horários já ocupados" tone="bg-rose-500" />
      </div>

      <section className="overflow-hidden rounded-3xl border border-arena-navy-800/8 bg-white shadow-sm">
        <div className="flex gap-2 overflow-x-auto border-b border-arena-navy-800/7 px-4 py-4 sm:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition-colors',
                filter === tab.value
                  ? 'bg-arena-navy-800 text-white shadow-sm'
                  : 'bg-arena-navy-800/[0.04] text-arena-navy-800/55 hover:bg-arena-navy-800/[0.08]'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px]',
                  filter === tab.value ? 'bg-white/15 text-white' : 'bg-white text-arena-navy-800/50'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <div className="flex size-16 items-center justify-center rounded-3xl bg-arena-navy-800/[0.04]">
              <CalendarClock className="size-7 text-arena-navy-800/25" />
            </div>
            <p className="mt-5 text-base font-black text-arena-navy-800">Nenhuma solicitação por aqui</p>
            <p className="mt-1 max-w-sm text-sm font-medium text-arena-navy-800/45">
              Quando um atleta enviar um pedido pelo aplicativo, ele aparecerá nesta fila.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-arena-navy-800/7">
            {filtered.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => setSelectedId(request.id)}
                className="group grid w-full gap-4 px-5 py-5 text-left transition-colors hover:bg-arena-app-surface sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto] sm:items-center sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-arena-navy-800 text-sm font-black text-white shadow-sm">
                    {(request.athlete?.nome_perfil ?? 'A').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-arena-navy-800">
                        {request.athlete?.nome_perfil ?? 'Atleta'}
                      </p>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-arena-navy-800/45">
                      {request.court?.name ?? 'Espaço'} · {request.sport?.name ?? 'Esporte'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs sm:block">
                  <p className="font-black capitalize text-arena-navy-800">{requestDate(request)}</p>
                  <p className="mt-1 font-semibold text-arena-navy-800/50">
                    {requestTime(request)} · {formatDuration(request.durationMinutes)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  {request.hasConflict && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700">
                      <AlertTriangle className="size-3" />
                      Horário ocupado
                    </span>
                  )}
                  <p className="text-sm font-black text-arena-navy-800">{formatMoney(request.quotedRentalPrice)}</p>
                  <ArrowUpRight className="size-4 text-arena-navy-800/25 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && closeDetails()}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[620px] overflow-hidden rounded-3xl border-none bg-arena-soft p-0 shadow-2xl">
          {selected && (
            <>
              <div className="bg-arena-navy-800 px-6 py-6 text-white">
                <DialogHeader>
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <StatusBadge status={selected.status} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                      Recebida {formatDistanceToNowStrict(parseISO(selected.createdAt), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                  <DialogTitle className="font-heading text-2xl font-black text-white">
                    {selected.athlete?.nome_perfil ?? 'Atleta'}
                  </DialogTitle>
                  <DialogDescription className="text-sm font-medium text-white/55">
                    Solicitação para {selected.court?.name ?? 'espaço da arena'}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="max-h-[65vh] space-y-5 overflow-y-auto p-6">
                {selected.hasConflict && selected.status === 'pending' && (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" />
                    <div>
                      <p className="text-sm font-black text-rose-900">O horário não está mais disponível</p>
                      <p className="mt-0.5 text-xs font-medium leading-relaxed text-rose-800/70">
                        Outra reserva já ocupa parte deste período. Esta solicitação pode ser recusada, mas não aprovada.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-arena-navy-800/8 bg-white p-4">
                    <div className="flex items-center gap-2 text-arena-navy-800/40">
                      <CalendarClock className="size-4" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Data e horário</span>
                    </div>
                    <p className="mt-3 text-sm font-black capitalize text-arena-navy-800">{requestDate(selected)}</p>
                    <p className="mt-1 text-xs font-semibold text-arena-navy-800/50">
                      {requestTime(selected)} · {formatDuration(selected.durationMinutes)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-arena-navy-800/8 bg-white p-4">
                    <div className="flex items-center gap-2 text-arena-navy-800/40">
                      <MapPin className="size-4" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Espaço</span>
                    </div>
                    <p className="mt-3 text-sm font-black text-arena-navy-800">{selected.court?.name ?? 'Espaço'}</p>
                    <p className="mt-1 text-xs font-semibold text-arena-navy-800/50">{selected.sport?.name ?? 'Esporte'}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-arena-navy-800/8 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-arena-navy-800/40">
                      <UsersRound className="size-4" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Participantes</span>
                    </div>
                    <span className="text-xs font-black text-arena-navy-800/45">{selected.participants.length}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.participants.map((participant) => (
                      <span key={participant.id} className="inline-flex items-center gap-1.5 rounded-full bg-arena-app-surface px-3 py-1.5 text-xs font-bold text-arena-navy-800">
                        <UserRound className="size-3.5 text-arena-navy-800/35" />
                        {participant.athlete?.nome_perfil ?? 'Atleta'}
                        {participant.role === 'responsavel' && <span className="text-[9px] font-black uppercase text-arena-button">Responsável</span>}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-arena-navy-800 px-5 py-4 text-white">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Valor estimado</p>
                    <p className="mt-1 text-xs font-medium text-white/55">Sem cobrança automática</p>
                  </div>
                  <p className="text-xl font-black">{formatMoney(selected.quotedRentalPrice)}</p>
                </div>

                {selected.status === 'rejected' && selected.rejectionReason && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-arena-navy-800/40">Motivo informado</p>
                    <p className="mt-2 text-sm font-medium text-arena-navy-800/70">{selected.rejectionReason}</p>
                  </div>
                )}

                {selected.status === 'pending' && showReject && (
                  <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <label htmlFor="rejection-reason" className="text-xs font-black text-rose-900">
                      Motivo da recusa <span className="font-medium text-rose-700/60">(opcional)</span>
                    </label>
                    <Textarea
                      id="rejection-reason"
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      maxLength={500}
                      placeholder="Ex.: horário indisponível para manutenção"
                      className="min-h-20 border-rose-200 bg-white"
                    />
                  </div>
                )}
              </div>

              {selected.status === 'pending' && (
                <div className="flex flex-col-reverse gap-3 border-t border-arena-navy-800/8 bg-white px-6 py-5 sm:flex-row sm:justify-end">
                  {showReject ? (
                    <>
                      <Button variant="ghost" onClick={() => setShowReject(false)} disabled={isPending}>
                        Voltar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => review('reject')}
                        disabled={isPending}
                      >
                        {loadingAction === 'reject' ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                        Confirmar recusa
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setShowReject(true)} disabled={isPending}>
                        <X className="size-4" />
                        Recusar
                      </Button>
                      <Button
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => review('approve')}
                        disabled={isPending || selected.hasConflict}
                      >
                        {loadingAction === 'approve' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Aprovar e bloquear horário
                      </Button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
