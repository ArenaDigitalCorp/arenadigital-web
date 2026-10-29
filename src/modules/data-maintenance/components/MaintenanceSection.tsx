'use client'

import { NativeSelect } from "@/components/ui/native-select"
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Database, FileClock, RotateCcw, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { executeArenaCleanup, listArenaCleanups, previewArenaCleanup, restoreArenaCleanup } from '../actions'
import type { CleanupArena, CleanupModule, CleanupOperation } from '../types'
import { CLEANUP_MODULES, CLEANUP_GROUPS, cleanupModuleLabel } from '../catalog'

type Props = { arenas: CleanupArena[]; environment: string; initialArenaId?: string; loadError?: string }
const money = (value: string) => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:3}).format(Number(value))
const date = (value: string) => new Date(value).toLocaleString('pt-BR')
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()

export function MaintenanceSection({ arenas, environment, initialArenaId, loadError }: Props) {
  const [arenaId,setArenaId] = useState(arenas.some(arena => arena.id===initialArenaId) ? initialArenaId! : '')
  const [selectedModules,setSelectedModules] = useState<CleanupModule[]>([])
  const [moduleSearch,setModuleSearch] = useState('')
  const [expandedGroups,setExpandedGroups] = useState<string[]>([])
  const [reason,setReason] = useState('')
  const [cutoff,setCutoff] = useState('')
  const [preview,setPreview] = useState<CleanupOperation|null>(null)
  const [confirmation,setConfirmation] = useState('')
  const [testData,setTestData] = useState(false)
  const [error,setError] = useState<string|null>(loadError ?? null)
  const [notice,setNotice] = useState<string|null>(null)
  const [unavailable,setUnavailable] = useState(false)
  const [history,setHistory] = useState<{arenaId:string;items:CleanupOperation[];hasMore:boolean}>({arenaId:'',items:[],hasMore:false})
  const [historyLoading,setHistoryLoading] = useState(false)
  const [restore,setRestore] = useState<CleanupOperation|null>(null)
  const [restoreName,setRestoreName] = useState('')
  const [restoreReason,setRestoreReason] = useState('')
  const [pending,startTransition] = useTransition()
  const revision = useRef(0)
  const historyRevision = useRef(0)
  const arena = arenas.find(item => item.id===arenaId)
  const visiblePreview = preview?.arenaId===arenaId ? preview : null
  const visibleHistory = history.arenaId===arenaId ? history.items : []

  function invalidatePreview() {
    revision.current += 1
    setPreview(null); setConfirmation(''); setTestData(false); setError(null); setNotice(null)
    setRestore(null); setRestoreName(''); setRestoreReason('')
  }
  function toggleModule(id: CleanupModule, checked: boolean) {
    invalidatePreview()
    setSelectedModules(current=>{
      const next = checked ? [...new Set([...current,id])] : current.filter(value=>value!==id)
      if(checked && id==='cash_sessions' && !next.includes('financial_transactions') && !next.includes('manual_transactions'))next.push('manual_transactions')
      return next
    })
  }
  const refreshHistory = useCallback(async (id: string, cursor: {createdAt:string;id:string}|null = null) => {
    const request = ++historyRevision.current
    setHistoryLoading(true)
    try {
      const result = await listArenaCleanups(id,cursor)
      if (request!==historyRevision.current) return
      if (result.success) { setHistory(current=>({arenaId:id,items:cursor && current.arenaId===id ? [...new Map([...current.items,...result.data].map(item=>[item.id,item])).values()] : result.data,hasMore:result.data.length===20})); setUnavailable(false) }
      else { setError(result.unavailable ? null : result.error); setUnavailable(!!result.unavailable) }
    } catch { if(request===historyRevision.current) setError('Não foi possível carregar o histórico. Tente novamente.') }
    finally { if(request===historyRevision.current) setHistoryLoading(false) }
  },[])
  useEffect(() => {
    if (!arenaId) return
    void refreshHistory(arenaId)
    return () => { historyRevision.current += 1 }
  },[arenaId,refreshHistory])

  function generatePreview() {
    const request = revision.current
    const id = arenaId
    const modules = [...selectedModules]
    setError(null); setNotice(null); setPreview(null); setConfirmation(''); setTestData(false)
    startTransition(async () => {
      try {
        const parsedCutoff = cutoff ? new Date(cutoff) : null
        if(parsedCutoff && !Number.isFinite(parsedCutoff.getTime())) { setError('Informe uma data de corte válida.'); return }
        const result = await previewArenaCleanup({arenaId:id,modules,reason,cutoff:parsedCutoff?.toISOString() ?? null})
        if(request!==revision.current) return
        if(!result.success) { setError(result.error); return }
        if(result.data.arenaId!==id) { setError('A arena da prévia não corresponde à seleção.'); return }
        setPreview(result.data)
        void refreshHistory(id)
      } catch { if(request===revision.current) setError('Não foi possível gerar a prévia. Nenhuma limpeza foi executada.') }
    })
  }
  function execute() {
    if(!visiblePreview || !testData || confirmation.trim()!==visiblePreview.arenaName.trim()) return
    const operation=visiblePreview, request=revision.current
    setError(null)
    startTransition(async () => {
      try {
        const result = await executeArenaCleanup({arenaId:operation.arenaId,operationId:operation.id,confirmationName:confirmation,confirmTestData:testData})
        if(request!==revision.current) return
        if(!result.success) { setError(result.error); return }
        setPreview(null); setConfirmation(''); setTestData(false)
        setNotice('Limpeza concluída. A cópia recuperável e o relatório foram registrados no histórico.')
      } catch { if(request===revision.current) setError('A resposta não foi confirmada. Confira o histórico antes de tentar novamente.') }
      finally { if(request===revision.current) void refreshHistory(operation.arenaId) }
    })
  }
  function restoreData() {
    if(!restore || restore.arenaId!==arenaId) return
    const operation=restore, request=revision.current
    setError(null)
    startTransition(async () => {
      try {
        const result=await restoreArenaCleanup({arenaId:operation.arenaId,operationId:operation.id,confirmationName:restoreName,reason:restoreReason})
        if(request!==revision.current) return
        if(!result.success) { setError(result.error); return }
        setRestore(null); setRestoreName(''); setRestoreReason(''); setPreview(null)
        setNotice('Registros restaurados. Nenhum dado novo foi sobrescrito.')
      } catch { if(request===revision.current) setError('Confira o histórico para confirmar o resultado da restauração.') }
      finally { if(request===revision.current) void refreshHistory(operation.arenaId) }
    })
  }

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Governança da plataforma</p>
        <h1 className="mt-1 font-heading text-3xl font-black tracking-tight text-arena-navy-950">Manutenção de dados</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Prepare uma arena para começar a operar. Escolha os dados, revise o alcance e só então confirme a limpeza.</p></div>
      <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold"><Database className="h-3.5 w-3.5"/>{environment}</span>
    </header>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</div>}
    {unavailable && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">A manutenção de dados aguarda a atualização do banco neste ambiente. A limpeza permanece indisponível.</div>}
    {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>{notice}</div>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-orange-700">01 · Escolher o alcance</p><h2 className="mt-1 font-heading text-lg font-bold">Arena e dados selecionados</h2></div>
        <fieldset disabled={pending} className="space-y-5 p-5 disabled:opacity-70">
          <label className="block text-xs font-bold text-slate-700">Arena
            <NativeSelect aria-label="Arena para manutenção" value={arenaId} onChange={event=>{invalidatePreview();setArenaId(event.target.value);setSelectedModules([]);setReason('');setCutoff('');setUnavailable(false)}} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal">
              <option value="">Selecione uma arena</option>{arenas.map(item=><option key={item.id} value={item.id}>{item.name}{item.document ? ` · ${item.document}` : ''}</option>)}
            </NativeSelect>
          </label>
          {arena && <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600"><strong className="block text-sm text-slate-900">{arena.name}</strong><span>{arena.document || 'Documento não informado'} · {arena.kind==='demo' ? 'Demonstração' : 'Arena cliente'}</span></div>}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="text-sm font-bold text-slate-950">O que deseja excluir?</h3><p className="mt-1 text-xs text-slate-500">{selectedModules.length} de {CLEANUP_MODULES.length} opções selecionadas</p></div>
              <div className="flex gap-3 text-xs"><button type="button" className="font-bold text-orange-700 hover:underline disabled:opacity-50" onClick={()=>{invalidatePreview();setSelectedModules(current=>moduleSearch?[...new Set([...current,...CLEANUP_MODULES.filter(item=>normalize(`${item.label} ${item.description} ${item.group}`).includes(normalize(moduleSearch))).map(item=>item.id)])]:CLEANUP_MODULES.map(item=>item.id))}}>{moduleSearch?'Selecionar resultados':'Selecionar todas as opções'}</button><button type="button" className="text-slate-500 hover:underline" onClick={()=>{invalidatePreview();setSelectedModules([])}}>Limpar seleção</button></div>
            </div>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"/><Input aria-label="Buscar grupo de dados" placeholder="Buscar reservas, atletas, estoque…" className="pl-9" value={moduleSearch} onChange={event=>setModuleSearch(event.target.value)}/></div>
            <div className="space-y-2">
              {CLEANUP_GROUPS.map(group=>{
                const matches = CLEANUP_MODULES.filter(item=>item.group===group && normalize(`${item.label} ${item.description} ${item.group}`).includes(normalize(moduleSearch)))
                if(matches.length===0)return null
                const all = CLEANUP_MODULES.filter(item=>item.group===group)
                const count = all.filter(item=>selectedModules.includes(item.id)).length
                return <details key={group} open={!!moduleSearch || expandedGroups.includes(group)} onToggle={event=>{if(moduleSearch)return;const open=event.currentTarget.open;setExpandedGroups(current=>open?(current.includes(group)?current:[...current,group]):current.filter(value=>value!==group))}} className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold text-slate-800 [&::-webkit-details-marker]:hidden"><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"/><span className="flex-1">{group}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${count?'bg-orange-100 text-orange-800':'bg-slate-100 text-slate-500'}`}>{count}/{all.length}</span></summary>
                  <div className="space-y-2 border-t border-slate-100 p-3">
                    <button type="button" className="mb-1 text-[11px] font-bold text-orange-700 hover:underline" onClick={()=>{invalidatePreview();setSelectedModules(current=>matches.every(item=>current.includes(item.id))?current.filter(id=>!matches.some(item=>item.id===id)):[...new Set([...current,...matches.map(item=>item.id)])])}}>{matches.every(item=>selectedModules.includes(item.id))?(moduleSearch?'Desmarcar resultados':'Desmarcar grupo'):(moduleSearch?'Selecionar resultados do grupo':'Selecionar grupo')}</button>
                    {matches.map(item=><label key={item.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${selectedModules.includes(item.id)?'border-orange-300 bg-orange-50/50':'border-slate-100 hover:bg-slate-50'}`}>
                      <input type="checkbox" aria-label={item.label} className="mt-1 h-4 w-4 shrink-0 accent-orange-600" checked={selectedModules.includes(item.id)} onChange={event=>toggleModule(item.id,event.target.checked)}/>
                      <span className="min-w-0"><strong className="block text-sm">{item.label}</strong><small className="mt-1 block text-xs leading-5 text-slate-600">{item.description}</small></span>
                    </label>)}
                  </div>
                </details>
              })}
              {!CLEANUP_MODULES.some(item=>normalize(`${item.label} ${item.description} ${item.group}`).includes(normalize(moduleSearch))) && <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">Nenhum grupo encontrado.</p>}
            </div>
            <p className="text-xs leading-5 text-slate-500">Cada opção alcança os registros desse grupo nesta arena, até o corte informado. A prévia indica os vínculos que exigem outros grupos.</p>
          </div>
          <label className="block text-xs font-bold text-slate-700">Dados criados até <span className="font-normal text-slate-400">· opcional</span>
            <Input aria-label="Data de corte" type="datetime-local" className="mt-2" value={cutoff} onChange={event=>{invalidatePreview();setCutoff(event.target.value)}}/>
            <span className="mt-1.5 block font-normal leading-5 text-slate-500">Sem data, a prévia considera os registros existentes naquele momento. O corte usa a data de criação, não a data de vencimento.</span>
          </label>
          <label className="block text-xs font-bold text-slate-700">Motivo da limpeza
            <Textarea aria-label="Motivo da limpeza" className="mt-2 min-h-24" placeholder="Ex.: encerrar os testes antes do início da operação real." value={reason} maxLength={500} onChange={event=>{invalidatePreview();setReason(event.target.value)}}/>
          </label>
          <Button onClick={generatePreview} disabled={pending || historyLoading || unavailable || !arena || selectedModules.length===0 || reason.trim().length<8} className="w-full rounded-xl bg-arena-navy-950 text-white hover:bg-arena-navy-800">{pending?'Processando…':'Gerar prévia'}<ArrowRight className="h-4 w-4"/></Button>
          <p className="text-center text-xs text-slate-500">Gerar a prévia não remove os dados da arena.</p>
        </fieldset>
      </section>
      <div className="space-y-5 xl:sticky xl:top-5">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-950"><ShieldCheck className="h-4 w-4"/>O que fica preservado</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">Cadastro da empresa, proprietário e contas globais dos atletas e usuários. Vínculos e acessos de outras arenas permanecem intactos.</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Assinatura da plataforma, credenciais, auditoria e registros de pagamentos externos ficam protegidos. Dos demais grupos, somente o que selecionares poderá ser removido.</p>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Prévia da limpeza">
          <div className="border-b border-slate-100 p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-orange-700">02 · Revisar e confirmar</p><h2 className="mt-1 font-heading text-lg font-bold">Prévia da limpeza</h2></div>
          {!visiblePreview ? <div className="px-5 py-10 text-center"><FileClock className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 text-sm text-slate-500">Selecione a arena e gere uma prévia para conferir o alcance.</p></div> : <div className="space-y-4 p-5">
            <p className="text-sm"><strong>{visiblePreview.arenaName}</strong><br/><span className="text-xs text-slate-500">Criados até {date(visiblePreview.cutoff)} · prévia válida até {date(visiblePreview.expiresAt)}</span></p>
            <div className="rounded-xl bg-arena-navy-950 p-4 text-white"><p className="text-xs text-white/60">Total exclusivo desta seleção</p><p className="mt-1 text-2xl font-black">{visiblePreview.summary.recordCount ?? visiblePreview.summary.transactionCount+visiblePreview.summary.sessionCount} <span className="text-sm font-normal text-white/75">registros para excluir</span></p>{!!visiblePreview.summary.effectCount && <p className="mt-2 text-xs text-white/75">{visiblePreview.summary.effectCount} saldos ou configurações serão zerados.</p>}</div>
            {!!visiblePreview.summary.moduleCounts?.length && <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3" aria-label="Registros por grupo"><h3 className="mb-2 text-xs font-bold text-slate-950">Registros por grupo</h3>{visiblePreview.summary.moduleCounts.map(item=><div key={item.module} className="flex items-start justify-between gap-3 py-1 text-xs"><span className="text-slate-600">{item.label}</span><strong className="tabular-nums text-slate-950">{item.count}</strong></div>)}<p className="border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-400">Um registro compartilhado entre grupos aparece uma única vez no total.</p></div>}
            <dl className="grid grid-cols-2 gap-3">
              {[['Lançamentos',String(visiblePreview.summary.transactionCount)],['Caixas',String(visiblePreview.summary.sessionCount)],['Entradas',money(visiblePreview.summary.incomingTotal)],['Saídas',money(visiblePreview.summary.outgoingTotal)]].map(([label,value])=><div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words font-heading text-lg font-bold">{value}</dd></div>)}
            </dl>
            <p className="text-xs leading-5 text-slate-600">{visiblePreview.summary.preservedTransactionCount} lançamentos preservados, incluindo {visiblePreview.summary.preservedAutomaticCount} automáticos.</p>
            {visiblePreview.summary.openSessionCount>0 && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">A seleção inclui {visiblePreview.summary.openSessionCount} caixa(s) aberto(s). Será necessário abrir um novo caixa após a limpeza.</p>}
            {visiblePreview.summary.blockers.length>0 ? <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">{visiblePreview.summary.blockers.map((blocker,index)=><li key={`${blocker.code}-${index}`} className="flex gap-2 text-xs leading-5 text-amber-950"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0"/><span>{blocker.message} ({blocker.count}){blocker.requiredModule && !selectedModules.includes(blocker.requiredModule) && <button type="button" disabled={pending} className="mt-1 block font-bold underline underline-offset-2" onClick={()=>toggleModule(blocker.requiredModule!,true)}>Incluir {cleanupModuleLabel(blocker.requiredModule)}</button>}</span></li>)}</ul> : !visiblePreview.summary.canExecute ? <p className="text-sm text-slate-500">Nenhum registro elegível para remover.</p> : <fieldset disabled={pending} className="space-y-3 border-t border-slate-100 pt-4">
              <label className="block text-xs font-bold">Para confirmar, digite <span className="select-all">{visiblePreview.arenaName}</span><Input aria-label="Nome da arena para confirmar limpeza" className="mt-2" value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/></label>
              <label className="flex gap-2 text-xs leading-5"><input type="checkbox" aria-label="Confirmação dos dados selecionados" className="mt-1 h-4 w-4 shrink-0 accent-rose-700" checked={testData} onChange={event=>setTestData(event.target.checked)}/><span>Confirmo que os registros selecionados são dados de teste e revisei o alcance da limpeza.</span></label>
              <Button className="w-full rounded-xl bg-rose-700 text-white hover:bg-rose-800" disabled={pending || !testData || confirmation.trim()!==visiblePreview.arenaName.trim()} onClick={execute}>Confirmar limpeza</Button>
              <p className="text-xs leading-5 text-slate-500">Uma cópia recuperável será guardada antes da exclusão. Nenhuma cobrança externa será cancelada ou estornada.</p>
            </fieldset>}
          </div>}
        </section>
      </div>
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-heading text-lg font-bold">Histórico e recuperação</h2><p className="mt-1 text-xs text-slate-500">Prévias, limpezas e recuperações da arena selecionada. Carregue as anteriores para consultar todo o histórico.</p></div><Button variant="outline" disabled={!arenaId || pending || historyLoading} onClick={()=>void refreshHistory(arenaId)}>Atualizar</Button></div>
      {visibleHistory.length===0 ? <p className="p-6 text-sm text-slate-500">{historyLoading?'Carregando histórico…':arenaId?'Nenhuma operação registrada para esta arena.':'Selecione uma arena para consultar o histórico.'}</p> : <div className="divide-y divide-slate-100">{visibleHistory.map(operation=><article key={operation.id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div className="min-w-0"><p className="flex flex-wrap items-center gap-2 text-sm font-bold">{date(operation.createdAt)}<span className={`rounded-full px-2 py-0.5 text-[10px] ${operation.status==='completed'?'bg-emerald-50 text-emerald-800':operation.status==='restored'?'bg-sky-50 text-sky-800':'bg-slate-100 text-slate-600'}`}>{operation.status==='completed'?'Concluída':operation.status==='restored'?'Restaurada':'Prévia'}</span></p><p className="mt-1 break-words text-xs leading-5 text-slate-600">{operation.reason}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{operation.modules.map(cleanupModuleLabel).join(' · ')}</p><p className="mt-1 text-xs text-slate-400">{operation.summary.recordCount ?? operation.summary.transactionCount+operation.summary.sessionCount} registros · {operation.modules.length} grupos · {operation.id.slice(0,8)}</p></div>
        {operation.status==='completed' && <Button variant="outline" disabled={pending} className="shrink-0" onClick={()=>{setRestore(operation);setRestoreName('');setRestoreReason('');setError(null)}}><RotateCcw className="h-3.5 w-3.5"/>Restaurar…</Button>}
      </article>)}</div>}
      {history.arenaId===arenaId && history.hasMore && <div className="border-t border-slate-100 p-4 text-center"><Button variant="outline" disabled={pending || historyLoading} onClick={()=>{const last=visibleHistory.at(-1);if(last)void refreshHistory(arenaId,{createdAt:last.createdAt,id:last.id})}}>{historyLoading?'Carregando…':'Carregar operações anteriores'}</Button></div>}
      {restore?.arenaId===arenaId && <fieldset disabled={pending} className="space-y-3 border-t border-sky-200 bg-sky-50/50 p-5">
        <h3 className="text-sm font-bold">Restaurar a limpeza de {date(restore.createdAt)}</h3><p className="text-xs leading-5 text-slate-600">Os registros originais serão recuperados. Se houver conflito com novos dados, caixa fechado ou estrutura alterada, a restauração será bloqueada.</p>
        <label className="block text-xs font-bold">Digite {restore.arenaName}<Input aria-label="Nome da arena para restaurar" className="mt-2" value={restoreName} onChange={event=>setRestoreName(event.target.value)}/></label>
        <label className="block text-xs font-bold">Motivo da restauração<Textarea aria-label="Motivo da restauração" className="mt-2" maxLength={500} value={restoreReason} onChange={event=>setRestoreReason(event.target.value)}/></label>
        <div className="flex flex-wrap gap-2"><Button onClick={restoreData} disabled={pending || restoreName.trim()!==restore.arenaName.trim() || restoreReason.trim().length<8}>Confirmar restauração</Button><Button variant="outline" onClick={()=>setRestore(null)}>Cancelar</Button></div>
      </fieldset>}
    </section>
  </div>
}
