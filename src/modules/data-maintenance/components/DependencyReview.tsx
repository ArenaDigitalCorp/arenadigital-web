'use client'

import { ArrowRight, Check, Link2, LockKeyhole, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cleanupModuleLabel } from '../catalog'
import { dependencyGroups } from '../dependencies'
import type { CleanupOperation } from '../types'

type Props = { operation: CleanupOperation; pending: boolean; onRefresh: () => void }

export function DependencyReview({ operation, pending, onRefresh }: Props) {
  const groups = dependencyGroups(operation.summary.dependencies ?? [], operation.modules)
  const required = groups.filter(group => group.status === 'required')
  const protectedGroups = groups.filter(group => group.status === 'protected')
  const included = groups.filter(group => group.status === 'included')
  const blocked=protectedGroups.length>0 || (operation.summary.blockers?.length??0)>0
  const bookingGroups=operation.summary.bookingGroups
  const paymentHistory=operation.summary.groupPaymentHistory
  const reasonLabels={financial:'Histórico financeiro preservado.',other_arena:'Este vínculo pertence a outra arena.',after_cutoff:'Este vínculo foi criado depois da data de corte.',protected_reference:'Este registro precisa ser preservado e não pode entrar nesta limpeza.'}

  function row(group: typeof groups[number]) {
    return <div key={group.key} className="grid min-w-0 gap-3 border-t border-slate-100 py-4 first:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] leading-5 text-slate-500">
          {group.from.map((from,index) => <span key={from}>{index > 0 && <span className="mr-1.5 text-slate-300">+</span>}{cleanupModuleLabel(from)}</span>)}
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="exige"/>
        </div>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-slate-900"><span>{group.to ? cleanupModuleLabel(group.to) : group.label}</span><span className="text-xs font-normal text-slate-500">{group.count} vínculo{group.count === 1 ? '' : 's'}</span></p>
        {group.status==='protected' && <p className="mt-1 text-xs leading-5 text-rose-800">{(group.reasons.length?group.reasons:['protected_reference'] as const).map(reason=>reasonLabels[reason]).join(' ')}</p>}
      </div>
      <span className={`inline-flex w-fit items-center gap-1.5 text-xs font-medium ${group.status === 'protected' ? 'text-rose-700' : group.status==='required'?'text-amber-800':'text-emerald-700'}`}>{group.status==='included'?<Check className="h-3.5 w-3.5"/>:<LockKeyhole className="h-3.5 w-3.5"/>}{group.status==='protected'?'Bloqueia a limpeza':group.status==='required'?'Revalidar seleção':'Incluído na seleção'}</span>
    </div>
  }

  return <section aria-label="Vínculos da limpeza" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
      <div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Link2 className="h-4 w-4 text-orange-600"/>Vínculos e impedimentos</h3><p className="mt-1 text-xs leading-5 text-slate-500">Confira o que está na seleção e o que impede a limpeza.</p></div>
      {required.length > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{required.length} pendente{required.length === 1 ? '' : 's'}</span>}
    </div>
    <div className="px-5 sm:px-6">
      {required.length > 0 ? <div>{required.map(row)}<div className="mb-5 mt-2 rounded-xl bg-slate-50 p-4"><p className="text-xs leading-5 text-slate-600">Os vínculos mudaram desde a seleção. Atualize a análise para conferir os grupos necessários.</p><Button type="button" disabled={pending} variant="outline" className="mt-3 w-full" onClick={onRefresh}><RotateCcw className="h-4 w-4"/>Atualizar vínculos</Button></div></div>
        : blocked ? <p className="flex items-start gap-2 py-5 text-sm text-rose-900"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0"/>A seleção tem impedimentos. Confira os avisos antes de continuar.</p>
        : <p className="flex items-center gap-2 py-5 text-sm text-slate-600"><Check className="h-4 w-4 text-emerald-700"/>{groups.length?'Os vínculos necessários estão na seleção.':'Nenhum vínculo adicional precisa ser incluído.'}</p>}
      {bookingGroups && bookingGroups.groups>0 && <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-800">Reservas em grupo do app na seleção</p><p className="mt-1 text-xs leading-5 text-slate-500">{bookingGroups.groups} {bookingGroups.groups===1?'grupo':'grupos'} · {bookingGroups.items} {bookingGroups.items===1?'reserva':'reservas'} · {bookingGroups.policySnapshots} {bookingGroups.policySnapshots===1?'registro de regras de cancelamento':'registros de regras de cancelamento'}</p></div>}
      {paymentHistory && paymentHistory.payments>0 && <div aria-label="Cobranças incluídas na limpeza" className="mb-5 rounded-xl border border-orange-200 bg-orange-50/60 p-4"><p className="text-xs font-semibold text-slate-900">Também será excluído junto das reservas</p><dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">{[['Cobranças',paymentHistory.payments],['Eventos',paymentHistory.webhooks],['Decisões de estorno',paymentHistory.refundDecisions],['Tentativas de estorno',paymentHistory.refundAttempts]].map(([label,count])=><div key={label}><dt className="text-[11px] leading-5 text-slate-500">{label}</dt><dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{count}</dd></div>)}</dl><p className="mt-3 border-t border-orange-200/70 pt-3 text-[11px] leading-5 text-slate-600">Registros locais. A limpeza não cancela cobranças nem envia estornos ao Asaas.</p></div>}
      {protectedGroups.length > 0 && <div className="mb-5 border-t border-slate-200 pt-4"><p className="text-xs font-bold text-rose-800">O que está bloqueando a limpeza</p>{protectedGroups.map(row)}</div>}
      {included.length > 0 && <details className="border-t border-slate-100 py-4"><summary className="cursor-pointer text-xs font-medium text-slate-500">Ver {included.length} grupo{included.length === 1 ? '' : 's'} com vínculos já incluídos</summary><div className="mt-2">{included.map(row)}</div></details>}
      {groups.length>0 && <p className="border-t border-slate-100 py-3 text-[11px] leading-5 text-slate-500">Os números de vínculos contam relações entre dados. Um mesmo registro pode ter mais de uma relação.</p>}
    </div>
  </section>
}
