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

  function row(group: typeof groups[number]) {
    return <div key={group.to ?? 'protected'} className="grid min-w-0 gap-3 border-t border-slate-100 py-4 first:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] leading-5 text-slate-500">
          {group.from.map((from,index) => <span key={from}>{index > 0 && <span className="mr-1.5 text-slate-300">+</span>}{cleanupModuleLabel(from)}</span>)}
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="exige"/>
        </div>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-slate-900"><span>{group.to ? cleanupModuleLabel(group.to) : group.label}</span><span className="text-xs font-normal text-slate-500">{group.count} vínculo{group.count === 1 ? '' : 's'}</span></p>
      </div>
      <span className={`inline-flex w-fit items-center gap-1.5 text-xs font-medium ${group.status === 'protected' ? 'text-rose-700' : group.status==='required'?'text-amber-800':'text-emerald-700'}`}>{group.status==='included'?<Check className="h-3.5 w-3.5"/>:<LockKeyhole className="h-3.5 w-3.5"/>}{group.status==='protected'?'Preservado':group.status==='required'?'Revalidar seleção':'Incluído automaticamente'}</span>
    </div>
  }

  return <section aria-label="Vínculos da limpeza" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
      <div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Link2 className="h-4 w-4 text-orange-600"/>O que precisa sair junto</h3><p className="mt-1 text-xs leading-5 text-slate-500">Os vínculos vêm dos dados desta arena.</p></div>
      {required.length > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{required.length} pendente{required.length === 1 ? '' : 's'}</span>}
    </div>
    <div className="px-5 sm:px-6">
      {required.length > 0 ? <div>{required.map(row)}<div className="mb-5 mt-2 rounded-xl bg-slate-50 p-4"><p className="text-xs leading-5 text-slate-600">Os vínculos mudaram desde a seleção. Atualize a análise para conferir os grupos necessários.</p><Button type="button" disabled={pending} variant="outline" className="mt-3 w-full" onClick={onRefresh}><RotateCcw className="h-4 w-4"/>Atualizar vínculos</Button></div></div>
        : <p className="flex items-center gap-2 py-5 text-sm text-slate-600"><Check className="h-4 w-4 text-emerald-700"/>Vínculos incluídos na seleção automaticamente.</p>}
      {protectedGroups.length > 0 && <div className="mb-5 border-t border-slate-200 pt-4"><p className="text-xs font-bold text-rose-800">Vínculos que impedem esta limpeza</p>{protectedGroups.map(row)}<p className="text-xs leading-5 text-slate-500">Dados protegidos, de outra arena ou fora do corte não podem ser adicionados por aqui.</p></div>}
      {included.length > 0 && <details className="border-t border-slate-100 py-4"><summary className="cursor-pointer text-xs font-medium text-slate-500">Ver {included.length} grupo{included.length === 1 ? '' : 's'} com vínculos já incluídos</summary><div className="mt-2">{included.map(row)}</div></details>}
    </div>
  </section>
}
