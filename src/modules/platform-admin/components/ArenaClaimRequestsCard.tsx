'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock3, LoaderCircle, ShieldAlert, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { reviewArenaClaimRequestAction } from '@/modules/platform-admin/actions/platformAdminActions'
import type { PlatformArenaClaimRequest } from '@/modules/platform-admin/types/platform-admin.types'

const STATUS_COPY: Record<PlatformArenaClaimRequest['status'], { label: string; classes: string }> = {
  pending: { label: 'Aguardando revisão', classes: 'border-amber-200 bg-amber-50 text-amber-900' },
  approved: { label: 'Aprovada', classes: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  rejected: { label: 'Rejeitada', classes: 'border-rose-200 bg-rose-50 text-rose-800' },
  blocked: { label: 'Conflito de cadastro', classes: 'border-orange-200 bg-orange-50 text-orange-900' },
}

function requestDescription(request: PlatformArenaClaimRequest) {
  if (request.requestKind === 'existing_customer_conflict') {
    return 'O documento já pertence a uma arena cliente. Oriente a recuperação do acesso; nenhuma arena duplicada foi criada.'
  }
  if (request.requestKind === 'ambiguous_match') {
    return 'Mais de uma arena pode corresponder ao cadastro. É preciso conferir os dados manualmente; nenhuma arena foi alterada.'
  }
  return 'O local já existe no catálogo público. A aprovação mantém o mesmo arena_id e libera a conta gestora.'
}

export function ArenaClaimRequestsCard({ requests }: { requests: PlatformArenaClaimRequest[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [discoverability, setDiscoverability] = useState<Record<string, boolean>>({})
  const orderedRequests = [...requests].sort((left, right) => {
    if (left.status === 'pending' && right.status !== 'pending') return -1
    if (left.status !== 'pending' && right.status === 'pending') return 1
    return Date.parse(right.createdAt) - Date.parse(left.createdAt)
  })

  function review(request: PlatformArenaClaimRequest, decision: 'approve' | 'reject') {
    const reason = reasons[request.id]?.trim() ?? ''
    if (reason.length < 8) {
      toast.error('Informe um motivo de auditoria com ao menos 8 caracteres.')
      return
    }

    setActiveRequestId(request.id)
    startTransition(async () => {
      const result = await reviewArenaClaimRequestAction({
        requestId: request.id,
        decision,
        reason,
        keepDiscoverable: discoverability[request.id] ?? true,
      })
      setActiveRequestId(null)
      if (!result.success) {
        toast.error(result.error ?? 'Não foi possível revisar a solicitação.')
        return
      }
      toast.success(decision === 'approve' ? 'Arena vinculada e acesso liberado.' : 'Solicitação rejeitada.')
      router.refresh()
    })
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-900/10 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">Entrada de clientes</p>
          <h2 className="mt-1 font-heading text-xl font-black">Solicitações de propriedade</h2>
          <p className="mt-1 text-sm text-slate-500">Valide o vínculo sem duplicar arenas que já existem no catálogo.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">
          <Clock3 className="h-3.5 w-3.5" /> {requests.filter((request) => request.status === 'pending').length} pendente(s)
        </span>
      </div>

      {orderedRequests.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-500">
          Nenhuma solicitação de propriedade recebida.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {orderedRequests.map((request) => {
            const status = STATUS_COPY[request.status]
            const canApprove = request.status === 'pending' && request.requestKind === 'public_listing_claim'
            const isWorking = pending && activeRequestId === request.id
            return (
              <article key={request.id} className="grid gap-5 px-6 py-5 xl:grid-cols-[1fr_380px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-bold', status.classes)}>{status.label}</span>
                    <span className="text-xs text-slate-400">
                      {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(request.createdAt))}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-black text-slate-950">{request.arenaName || request.submittedArenaName}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {request.municipalityName || 'Município não identificado'} · solicitado por {request.requesterName || request.requesterEmail}
                  </p>
                  <p className="mt-3 max-w-2xl text-xs leading-5 text-slate-500">{requestDescription(request)}</p>
                  {request.reviewReason && <p className="mt-3 text-xs text-slate-500"><strong>Revisão:</strong> {request.reviewReason}</p>}
                </div>

                {request.status === 'pending' ? (
                  <div className="space-y-3">
                    {canApprove && (
                      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={discoverability[request.id] ?? true}
                          onChange={(event) => setDiscoverability((current) => ({ ...current, [request.id]: event.target.checked }))}
                          className="mt-0.5"
                        />
                        <span><strong className="block text-slate-900">Manter visível no aplicativo</strong>A reserva só será habilitada quando houver quadra ativa.</span>
                      </label>
                    )}
                    <Textarea
                      value={reasons[request.id] ?? ''}
                      onChange={(event) => setReasons((current) => ({ ...current, [request.id]: event.target.value }))}
                      placeholder="Motivo obrigatório para auditoria"
                      className="min-h-20"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {canApprove && (
                        <Button onClick={() => review(request, 'approve')} disabled={pending} className="bg-emerald-700 text-white hover:bg-emerald-600">
                          {isWorking ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} Aprovar vínculo
                        </Button>
                      )}
                      <Button onClick={() => review(request, 'reject')} disabled={pending} variant="outline" className={cn(!canApprove && 'sm:col-span-2')}>
                        {isWorking ? <LoaderCircle className="animate-spin" /> : <XCircle />} Rejeitar
                      </Button>
                    </div>
                  </div>
                ) : request.status === 'blocked' ? (
                  <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                    <ShieldAlert className="h-5 w-5 shrink-0" /> Resolver acesso com o solicitante antes de qualquer alteração manual.
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
