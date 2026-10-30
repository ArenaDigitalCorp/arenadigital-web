'use client'

import { formatCpfCnpj } from '@/lib/brasil-document'
import { NativeSelect } from "@/components/ui/native-select"
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Clock3, FileClock, Layers3, LockKeyhole, RotateCcw, Search, ShieldCheck, X, LoaderCircle, CornerDownRight, WalletCards, CalendarDays, GraduationCap, ReceiptText, RefreshCcw, UsersRound, Package, LayoutGrid, HeartHandshake, MessagesSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { executeArenaCleanup, listArenaCleanups, previewArenaCleanup, restoreArenaCleanup, resolveArenaCleanupSelection } from '../actions'
import type { CleanupArena, CleanupModule, CleanupOperation, CleanupSelection } from '../types'
import { CLEANUP_MODULES, CLEANUP_GROUPS, cleanupModuleLabel } from '../catalog'
import { DependencyReview } from './DependencyReview'
import { selectionOwnership } from '../dependencies'

type Props = { arenas: CleanupArena[]; environment: string; initialArenaId?: string; loadError?: string }
const money = (value: string) => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:3}).format(Number(value))
const date = (value: string) => new Date(value).toLocaleString('pt-BR')
const GROUP_ICONS:Record<string,typeof WalletCards>={'Financeiro':WalletCards,'Reservas e agenda':CalendarDays,'Mensalistas e turmas':GraduationCap,'Comandas e atendimento':ReceiptText,'Rotativos':RefreshCcw,'Pessoas':UsersRound,'Catálogo e estoque':Package,'Estrutura e regras':LayoutGrid,'Relacionamento e conteúdo':HeartHandshake,'Comunicação':MessagesSquare}
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()

export function MaintenanceSection({ arenas, environment, initialArenaId, loadError }: Props) {
  const [arenaId,setArenaId] = useState(arenas.some(arena => arena.id===initialArenaId) ? initialArenaId! : '')
  const [rootModules,setRootModules] = useState<CleanupModule[]>([])
  const [selection,setSelection] = useState<{data:CleanupSelection;inputCutoff:string}|null>(null)
  const [resolving,setResolving] = useState(false)
  const [moduleSearch,setModuleSearch] = useState('')
  const [activeGroup,setActiveGroup] = useState<string>(CLEANUP_GROUPS[0])
  const [step,setStep] = useState<1|2|3>(1)
  const [tab,setTab] = useState<'cleanup'|'history'>('cleanup')
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
  const rootsRef = useRef<CleanupModule[]>([])
  const selectionRevision = useRef(0)
  const revision = useRef(0)
  const historyRevision = useRef(0)
  const arena = arenas.find(item => item.id===arenaId)
  const visiblePreview = preview?.arenaId===arenaId ? preview : null
  const visibleHistory = history.arenaId===arenaId ? history.items : []
  const currentSelection = selection?.data.arenaId===arenaId && selection.inputCutoff===cutoff && JSON.stringify(selection.data.requestedModules)===JSON.stringify(rootModules) ? selection.data : null
  const selectedModules = currentSelection?.modules ?? rootModules
  const addedModules = selectedModules.filter(id=>!rootModules.includes(id))
  const ownership = selectionOwnership(rootModules,selectedModules,currentSelection?.dependencies ?? [])
  const selectionReady = !!currentSelection && !resolving && ownership.fullyExplained && rootModules.length>0


  function invalidatePreview() {
    revision.current += 1
    setStep(1)
    setPreview(null); setConfirmation(''); setTestData(false); setError(null); setNotice(null)
    setRestore(null); setRestoreName(''); setRestoreReason('')
  }
  async function resolveModules(roots: CleanupModule[], inputCutoff = cutoff, fixedCutoff?: string): Promise<CleanupSelection|null> {
    const request = ++selectionRevision.current
    const id = arenaId
    setSelection(null); setResolving(true); setError(null)
    try {
      const parsed = inputCutoff ? new Date(inputCutoff) : null
      if (parsed && !Number.isFinite(parsed.getTime())) throw new Error('invalid-cutoff')
      const result = await resolveArenaCleanupSelection({arenaId:id,modules:roots,cutoff:fixedCutoff ?? parsed?.toISOString() ?? null})
      if (request!==selectionRevision.current) return null
      if (!result.success) {setError(result.error);setUnavailable(!!result.unavailable);return null}
      if (result.data.arenaId!==id || JSON.stringify(result.data.requestedModules)!==JSON.stringify(roots) || !selectionOwnership(roots,result.data.modules,result.data.dependencies).fullyExplained) {
        setError('Não foi possível validar os vínculos desta seleção. Tente novamente.');return null
      }
      setSelection({data:result.data,inputCutoff});setUnavailable(false)
      return result.data
    } catch {
      if(request===selectionRevision.current) setError('Não foi possível conferir os vínculos. Revise o corte e tente novamente.')
      return null
    } finally {if(request===selectionRevision.current)setResolving(false)}
  }
  function selectRoots(next: CleanupModule[]) {
    if(pending)return
    const roots=[...new Set(next)]
    invalidatePreview();rootsRef.current=roots;setRootModules(roots)
    selectionRevision.current+=1;setSelection(null);setResolving(false)
    if(roots.length)void resolveModules(roots)
  }
  function toggleModule(id: CleanupModule, checked: boolean) {
    if(!checked && ownership.requiredBy(id).length)return
    selectRoots(checked?[...rootsRef.current,id]:rootsRef.current.filter(value=>value!==id))
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

  function generatePreview(cutoffOverride?: string) {
    const request = ++revision.current
    const id = arenaId, roots=[...rootsRef.current]
    setStep(2);setError(null);setNotice(null);setPreview(null);setConfirmation('');setTestData(false)
    startTransition(async () => {
      try {
        const plan=await resolveModules(roots,cutoff,cutoffOverride)
        if(request!==revision.current || !plan)return
        const result=await previewArenaCleanup({arenaId:id,modules:plan.modules,reason,cutoff:plan.cutoff})
        if(request!==revision.current)return
        if(!result.success){setError(result.error);return}
        if(result.data.arenaId!==id){setError('A arena da prévia não corresponde à seleção.');return}
        setPreview(result.data);void refreshHistory(id)
      } catch {if(request===revision.current)setError('Não foi possível gerar a prévia. Nenhuma limpeza foi executada.')}
    })
  }
  function execute() {
    if(pending || resolving || !selectionReady || !visiblePreview || !visiblePreview.summary.canExecute || visiblePreview.summary.blockers.length>0 || !testData || confirmation.trim()!==visiblePreview.arenaName.trim()) return
    const operation=visiblePreview, request=revision.current
    setError(null)
    startTransition(async () => {
      try {
        const result = await executeArenaCleanup({arenaId:operation.arenaId,operationId:operation.id,confirmationName:confirmation,confirmTestData:testData})
        if(request!==revision.current) return
        if(!result.success) { setError(result.error); return }
        setPreview(null); setConfirmation(''); setTestData(false); setStep(1); setTab('history')
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
        setRestore(null); setRestoreName(''); setRestoreReason(''); setPreview(null); setStep(1)
        setNotice('Registros restaurados. Nenhum dado novo foi sobrescrito.')
      } catch { if(request===revision.current) setError('Confira o histórico para confirmar o resultado da restauração.') }
      finally { if(request===revision.current) void refreshHistory(operation.arenaId) }
    })
  }

  const matches = CLEANUP_MODULES.filter(item=>moduleSearch ? normalize(`${item.label} ${item.description} ${item.group}`).includes(normalize(moduleSearch)) : item.group===activeGroup)
  const ready = selectionReady && !!visiblePreview && visiblePreview.status==='preview' && visiblePreview.summary.canExecute && visiblePreview.summary.blockers.length===0
  const recordCount = visiblePreview ? visiblePreview.summary.recordCount ?? visiblePreview.summary.transactionCount+visiblePreview.summary.sessionCount : 0
  const moduleCount = (id: CleanupModule) => visiblePreview?.summary.moduleCounts?.find(item=>item.module===id)?.count ?? (id==='manual_transactions'||id==='financial_transactions' ? visiblePreview?.summary.transactionCount : id==='cash_sessions' ? visiblePreview?.summary.sessionCount : undefined)
  const unresolved = visiblePreview?.summary.dependencies?.filter(edge=>edge.missingCount+edge.blockedCount>0) ?? []
  const otherBlockers = visiblePreview?.summary.blockers.filter(blocker=>!((blocker.code==='linked_source' && unresolved.some(edge=>edge.kind==='financial_source'||edge.kind==='stock_source')) || (blocker.code==='linked_records' && unresolved.some(edge=>edge.kind==='foreign_key')) || (blocker.code==='closed_sessions' && unresolved.some(edge=>edge.kind==='closed_cash')))) ?? []
  function changeArena(id: string) {
    invalidatePreview(); historyRevision.current += 1; setHistoryLoading(false); setHistory({arenaId:'',items:[],hasMore:false}); selectionRevision.current+=1;rootsRef.current=[];setRootModules([]);setSelection(null);setResolving(false);setArenaId(id); setReason(''); setCutoff(''); setUnavailable(false)
  }
  function selectVisible() {
    selectRoots([...rootsRef.current,...matches.filter(item=>!selectedModules.includes(item.id)).map(item=>item.id)])
  }
  function changeCutoff(value: string) {
    invalidatePreview();setCutoff(value);selectionRevision.current+=1;setSelection(null);setResolving(false)
    if(rootsRef.current.length)void resolveModules([...rootsRef.current],value)
  }

  return <div className="space-y-4 pb-8 text-slate-900">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">Administração · Dados da arena</p><h1 className="mt-1 font-heading text-[26px] font-bold leading-tight tracking-tight sm:text-[28px]">Manutenção de arenas</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Escolha os dados. Os vínculos entram juntos, com controle em cada etapa.</p></div>
      <span className="mt-1 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-orange-500"/>{environment}</span>
    </header>

    <section aria-label="Empresa selecionada" className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
      <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-arena-navy-950 sm:flex"><Building2 className="h-5 w-5"/></span>
      <div className="min-w-0 flex-1"><label htmlFor="maintenance-arena" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Empresa / arena</label><NativeSelect id="maintenance-arena" aria-label="Arena para manutenção" value={arenaId} disabled={pending} onChange={event=>changeArena(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"><option value="">Escolha a arena para começar</option>{arenas.map(item=><option key={item.id} value={item.id}>{item.name}{item.document?` · ${formatCpfCnpj(item.document)}`:''}</option>)}</NativeSelect></div>
      <div className="text-xs leading-5 text-slate-500 sm:max-w-48 sm:border-l sm:border-slate-200 sm:pl-5">{arena ? <><p className="font-medium text-slate-700">{formatCpfCnpj(arena.document) || 'Documento não informado'}</p><p>{arena.kind==='demo'?'Arena de demonstração':'Arena cliente'}</p></> : <p>Toda a operação será limitada à empresa escolhida.</p>}</div>
    </section>

    <nav aria-label="Área da manutenção" className="flex gap-5 border-b border-slate-200 sm:gap-8">
      {[['cleanup','Nova limpeza'],['history','Histórico e restauração']].map(([value,label])=><button key={value} type="button" aria-current={tab===value?'page':undefined} disabled={pending} onClick={()=>setTab(value as 'cleanup'|'history')} className={`relative -mb-px min-h-11 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors disabled:opacity-50 ${tab===value?'border-orange-500 text-arena-navy-950':'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>)}
    </nav>
    {error && <div role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900"><AlertTriangle className="mt-1 h-4 w-4 shrink-0"/>{error}</div>}
    {unavailable && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">A manutenção de dados aguarda a atualização do banco neste ambiente.</div>}
    {notice && <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0"/>{notice}</div>}

    {tab==='cleanup' ? <>
      <nav aria-label="Etapas da limpeza" className="grid grid-cols-3 gap-2 sm:gap-6">
        {(['Selecionar dados','Revisar vínculos','Confirmar'] as const).map((label,index)=>{const number=(index+1) as 1|2|3;return <button key={label} type="button" aria-current={step===number?'step':undefined} disabled={pending || (number===2 && !visiblePreview) || (number===3 && !ready)} onClick={()=>setStep(number)} className={`flex items-center gap-2 border-b-2 pb-3 text-left disabled:cursor-default ${step===number?'border-arena-navy-950':'border-slate-200'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${step===number?'bg-arena-navy-950 text-white':step>number?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-400'}`}>{step>number?<Check className="h-3.5 w-3.5"/>:`0${number}`}</span><span className={`text-[11px] font-semibold sm:text-sm ${step===number?'text-slate-900':'text-slate-500'}`}>{label}</span></button>})}
      </nav>
      {step===1 && <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="Seleção dos dados" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="text-base font-bold">O que deseja limpar?</h2><p className="mt-1 text-xs text-slate-500">Ao marcar um grupo, os vínculos necessários já entram na seleção.</p></div><button type="button" disabled={!arena || pending} onClick={()=>selectRoots([...rootsRef.current,...CLEANUP_MODULES.filter(item=>!selectedModules.includes(item.id)).map(item=>item.id)])} className="text-xs font-semibold text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline disabled:opacity-40">Selecionar tudo</button></div>
          <fieldset disabled={!arena || pending || resolving} className="min-w-0 disabled:opacity-50">
            <div className="border-b border-slate-100 p-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"/><Input aria-label="Buscar grupo de dados" value={moduleSearch} placeholder="Buscar em todas as áreas…" onChange={event=>setModuleSearch(event.target.value)} className="h-10 border-slate-200 bg-slate-50 pl-9"/></div></div>
            <div className="grid md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="border-b border-slate-100 bg-slate-50/70 p-4 md:hidden"><label className="mb-1.5 block text-xs font-medium text-slate-500" htmlFor="maintenance-area">Área de dados</label><NativeSelect id="maintenance-area" aria-label="Área de dados" value={activeGroup} onChange={event=>{setActiveGroup(event.target.value);setModuleSearch('')}} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{CLEANUP_GROUPS.map(group=><option key={group} value={group}>{group}</option>)}</NativeSelect></div>
              <nav aria-label="Categorias dos dados" className="hidden border-r border-slate-100 bg-slate-50/70 p-2 md:block">{CLEANUP_GROUPS.map(group=>{const count=CLEANUP_MODULES.filter(item=>item.group===group && selectedModules.includes(item.id)).length;const GroupIcon=GROUP_ICONS[group]??Layers3;return <button key={group} type="button" onClick={()=>{setActiveGroup(group);setModuleSearch('')}} aria-pressed={activeGroup===group && !moduleSearch} className={`mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-xs leading-5 ${activeGroup===group && !moduleSearch?'bg-white font-bold text-arena-navy-950 shadow-xs ring-1 ring-slate-200':'text-slate-500 hover:bg-white/70 hover:text-slate-900'}`}><GroupIcon className="h-3.5 w-3.5 shrink-0 opacity-60"/><span className="flex-1">{group}</span>{count>0 && <span className="rounded bg-orange-100 px-1.5 text-[10px] font-bold text-orange-800">{count}</span>}</button>})}</nav>
              <div className="min-w-0 p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{moduleSearch?'Resultados da busca':activeGroup}</h3><button type="button" onClick={selectVisible} disabled={!matches.length} className="text-[11px] font-semibold text-orange-700 hover:underline">{moduleSearch?'Selecionar resultados':'Selecionar área'}</button></div><div className="space-y-2">{matches.map(item=>{
                const requiredBy=ownership.requiredBy(item.id),locked=requiredBy.length>0,checked=selectedModules.includes(item.id)
                const children=rootModules.includes(item.id) && !locked ? ownership.descendants.get(item.id)??[] : []
                return <div key={item.id} className={`overflow-hidden rounded-xl border transition-colors ${locked?'border-slate-200 bg-slate-50/80':checked?'border-orange-400 bg-white shadow-[0_0_0_1px_rgba(251,146,60,.12)]':'border-slate-200 bg-white hover:border-slate-400'}`}>
                  <label className={`flex gap-3 p-4 ${locked?'cursor-default':'cursor-pointer'}`}>
                    <input aria-label={item.label} aria-describedby={locked?`required-${item.id}`:undefined} disabled={locked || resolving || pending} type="checkbox" checked={checked} onChange={event=>toggleModule(item.id,event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-arena-navy-950 disabled:accent-slate-500"/>
                    <span className="min-w-0 flex-1"><strong className={`block text-[13px] font-semibold leading-5 ${locked?'text-slate-600':'text-arena-navy-950'}`}>{item.label}</strong>
                      {locked?<span id={`required-${item.id}`} className="mt-1 flex items-start gap-1.5 text-[11px] leading-5 text-slate-500"><LockKeyhole className="mt-1 h-3 w-3 shrink-0"/>Obrigatório por {requiredBy.map(cleanupModuleLabel).join(' e ')}</span>:<small className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</small>}
                    </span>{checked && !locked && <span className="ml-auto h-fit shrink-0 rounded-md bg-orange-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-orange-900">Sua escolha</span>}
                  </label>
                  {children.length>0 && <div className="border-t border-orange-100 bg-orange-50/40 px-4 py-3"><p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-orange-900"><CornerDownRight className="h-3 w-3"/>{children.length} {children.length===1?'grupo vinculado':'grupos vinculados'}</p><ul className="grid gap-x-3 gap-y-1.5 border-l border-orange-200 pl-3 sm:grid-cols-2">{children.map(id=><li key={id} className="flex min-w-0 items-start gap-1.5 text-[11px] leading-5 text-slate-600"><CheckCircle2 className="mt-1 h-3 w-3 shrink-0 text-emerald-600"/><span>{cleanupModuleLabel(id)}</span></li>)}</ul></div>}
                </div>
              })}</div>{matches.length===0 && <p className="py-10 text-center text-sm text-slate-500">Nenhum grupo encontrado.</p>}</div>
            </div>
          </fieldset>
        </section>
        <aside className="space-y-4 xl:sticky xl:top-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="bg-arena-navy-950 p-5 text-white"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/50">Alcance da seleção</p><div className="mt-2 flex items-end justify-between"><h2 className="text-2xl font-bold">{selectedModules.length} <span className="text-sm font-normal text-white/70">{selectedModules.length===1?'grupo':'grupos'}</span></h2>{resolving?<LoaderCircle className="h-4 w-4 animate-spin text-orange-400"/>:<Layers3 className="h-5 w-5 text-white/30"/>}</div><div className="mt-3 flex gap-4 border-t border-white/10 pt-3 text-[11px] text-white/65"><span>{rootModules.length} {rootModules.length===1?'escolha':'escolhas'}</span><span>{addedModules.length} {addedModules.length===1?'vinculado':'vinculados'}</span></div></div>
            <div className="p-5">{rootModules.length ? <><ul className="max-h-72 space-y-3 overflow-y-auto" aria-label="Grupos selecionados">{selectedModules.map(id=>{const requiredBy=ownership.requiredBy(id),locked=requiredBy.length>0;return <li key={id} className="flex items-start justify-between gap-3 text-xs leading-5"><div className="min-w-0"><p className={locked?'text-slate-500':'font-semibold text-slate-900'}>{cleanupModuleLabel(id)}</p>{locked && <p className="mt-0.5 text-[10px] leading-4 text-slate-400">Vinculado a {requiredBy.map(cleanupModuleLabel).join(' e ')}</p>}</div>{locked?<LockKeyhole className="mt-1 h-3 w-3 shrink-0 text-slate-400"/>:<button type="button" disabled={pending || resolving} aria-label={`Remover ${cleanupModuleLabel(id)} da seleção`} onClick={()=>toggleModule(id,false)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"><X className="h-3.5 w-3.5"/></button>}</li>})}</ul><button type="button" disabled={pending} className="mt-4 text-xs text-slate-500 underline underline-offset-4" onClick={()=>selectRoots([])}>Limpar seleção</button></>:<p className="py-2 text-xs leading-6 text-slate-500">Marque os dados que deseja limpar. Os grupos necessários serão incluídos automaticamente.</p>}</div>
            <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[11px] leading-5 text-slate-500">Cada grupo inclui todos os seus dados nesta arena até a data de corte.</p>
            {resolving && <p role="status" className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">Conferindo vínculos desta arena…</p>}
            {!resolving && rootModules.length>0 && !selectionReady && <div className="border-t border-slate-100 px-5 py-3"><button type="button" className="text-xs font-semibold text-orange-700 underline underline-offset-4" disabled={pending} onClick={()=>void resolveModules([...rootsRef.current])}>Tentar conferir os vínculos novamente</button></div>}
          </section>
          <fieldset disabled={!arena || pending} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 disabled:opacity-50"><legend className="sr-only">Detalhes da limpeza</legend><label className="block text-xs font-semibold text-slate-700">Motivo da limpeza<Textarea aria-label="Motivo da limpeza" value={reason} maxLength={500} onChange={event=>{invalidatePreview();setReason(event.target.value)}} placeholder="Ex.: encerrar o período de testes." className="mt-2 min-h-20 border-slate-200 text-sm font-normal"/></label><label className="block text-xs font-semibold text-slate-700">Dados criados até <span className="font-normal text-slate-400">· opcional</span><Input aria-label="Data de corte" type="datetime-local" value={cutoff} onChange={event=>changeCutoff(event.target.value)} className="mt-2 min-w-0 border-slate-200 font-normal"/><span className="mt-1.5 block text-[11px] font-normal leading-5 text-slate-500">Sem data, considera os dados existentes na análise.</span></label><Button type="button" onClick={()=>generatePreview()} disabled={pending || historyLoading || unavailable || !arena || !selectionReady || reason.trim().length<8} className="w-full bg-arena-navy-950 text-white hover:bg-arena-navy-800">Analisar seleção<ArrowRight className="h-4 w-4"/></Button><p className="text-center text-[11px] text-slate-500">Esta etapa não exclui dados.</p></fieldset>
          <div className="flex gap-2 px-1 text-[11px] leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"/><p>Cadastro da empresa, proprietário, contas globais dos atletas e usuários e dados de outras arenas ficam preservados.</p></div>
        </aside>
      </div>}

      {step===2 && <div className="space-y-5">
        {pending ? <div role="status" className="rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center"><FileClock className="mx-auto h-7 w-7 animate-pulse text-orange-600"/><h2 className="mt-4 text-base font-bold">Analisando a limpeza</h2><p className="mt-2 text-sm text-slate-500">Conferindo os dados selecionados e seus vínculos.</p></div> : !visiblePreview ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-sm text-slate-500">A análise não foi concluída. Revise a seleção para tentar novamente.</p><Button variant="outline" className="mt-4" onClick={()=>setStep(1)}>Voltar à seleção</Button></div> : <>
          <section className="overflow-hidden rounded-2xl bg-arena-navy-950 text-white"><div className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-end sm:p-6"><div><p className="text-xs text-white/60">Alcance da limpeza · {visiblePreview.arenaName}</p><h2 className="mt-2 text-3xl font-bold tracking-tight">{recordCount.toLocaleString('pt-BR')} <span className="text-base font-normal text-white/80">{recordCount===1?'registro selecionado':'registros selecionados'}</span></h2>{!!visiblePreview.summary.effectCount && <p className="mt-2 text-xs text-white/70">+ {visiblePreview.summary.effectCount} saldos ou configurações a zerar</p>}</div><div className="text-xs leading-6 text-white/70"><p>{visiblePreview.modules.length} {visiblePreview.modules.length===1?'grupo':'grupos'} na seleção</p><p>Criados até {date(visiblePreview.cutoff)}</p></div></div><div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">{[['Lançamentos',String(visiblePreview.summary.transactionCount)],['Caixas',String(visiblePreview.summary.sessionCount)],['Entradas',money(visiblePreview.summary.incomingTotal)],['Saídas',money(visiblePreview.summary.outgoingTotal)]].map(([label,value])=><div key={label} className="border-r border-white/10 px-5 py-3 last:border-0 sm:px-6"><p className="text-[10px] text-white/50">{label}</p><p className="mt-0.5 break-words text-sm font-semibold">{value}</p></div>)}</div></section>
          <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
            <section aria-label="Dados que serão removidos" className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-bold">Na sua limpeza</h3><button type="button" onClick={()=>setStep(1)} className="text-xs font-semibold text-orange-700 hover:underline">Editar seleção</button></div><div className="divide-y divide-slate-100 px-5">{visiblePreview.modules.map(id=><div key={id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><p className="text-xs font-semibold leading-5">{cleanupModuleLabel(id)}</p><p className="text-[10px] leading-5 text-slate-400">{addedModules.includes(id)?'Incluído por vínculo':CLEANUP_MODULES.find(item=>item.id===id)?.group}</p></div><span className="text-xs font-semibold tabular-nums text-slate-600">{moduleCount(id) ?? '—'}</span></div>)}</div><p className="border-t border-slate-100 px-5 py-3 text-[11px] leading-5 text-slate-500">Registros compartilhados são contados uma vez no total.</p></section>
            <div className="space-y-4">{visiblePreview.summary.dependencies && <DependencyReview operation={visiblePreview} pending={pending || resolving} onRefresh={()=>generatePreview(visiblePreview.cutoff)}/>} {otherBlockers.length>0 && <section aria-label="Impedimentos da limpeza" className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5"><h3 className="text-sm font-bold text-rose-900">Precisamos resolver estes pontos</h3><ul className="mt-3 space-y-3">{otherBlockers.map((blocker,index)=><li key={`${blocker.code}-${index}`} className="text-xs leading-5 text-rose-900">{blocker.message} <span className="font-semibold">({blocker.count})</span>{blocker.requiredModule && !selectedModules.includes(blocker.requiredModule) && <button type="button" className="mt-1 block font-bold underline underline-offset-2" onClick={()=>toggleModule(blocker.requiredModule!,true)}>Incluir {cleanupModuleLabel(blocker.requiredModule)}</button>}</li>)}</ul></section>}{visiblePreview.summary.openSessionCount>0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">A seleção inclui {visiblePreview.summary.openSessionCount} caixa(s) aberto(s). Será necessário abrir um novo caixa após a limpeza.</p>}</div>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0"/><p>{ready?'Vínculos conferidos. Revise a confirmação antes de excluir.':visiblePreview.summary.blockers.length?'A análise encontrou impedimentos. Confira os avisos acima.':'Nenhum registro elegível para remover.'}</p></div><Button disabled={!ready} onClick={()=>setStep(3)} className="shrink-0 bg-arena-navy-950 text-white hover:bg-arena-navy-800">Revisar confirmação<ArrowRight className="h-4 w-4"/></Button></div>
        </>}
      </div>}

      {step===3 && visiblePreview && <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 p-5 sm:p-7"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><ShieldCheck className="h-5 w-5"/></span><h2 className="mt-4 text-xl font-bold">Confirme a limpeza de {visiblePreview.arenaName}</h2><p className="mt-2 text-sm leading-6 text-slate-500">Confira a empresa e o alcance. Uma cópia recuperável será guardada antes da exclusão.</p></div><div className="space-y-5 p-5 sm:p-7"><dl className="grid gap-x-5 gap-y-4 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-2">{[['Empresa',visiblePreview.arenaName],['Documento',formatCpfCnpj(arena?.document)||'Não informado'],['Alcance',`${recordCount} ${recordCount===1?'registro':'registros'} · ${visiblePreview.modules.length} ${visiblePreview.modules.length===1?'grupo':'grupos'}`],['Corte',date(visiblePreview.cutoff)],['Motivo',visiblePreview.reason],['Prévia válida até',date(visiblePreview.expiresAt)]].map(([label,value])=><div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold leading-5 text-slate-800">{value}</dd></div>)}</dl><details className="border-b border-slate-100 pb-4"><summary className="cursor-pointer text-xs font-semibold text-slate-600">{visiblePreview.modules.length===1?'Conferir o grupo selecionado':`Conferir os ${visiblePreview.modules.length} grupos selecionados`}</summary><ul className="mt-3 space-y-1 text-xs leading-5 text-slate-500">{visiblePreview.modules.map(id=><li key={id}>{cleanupModuleLabel(id)}</li>)}</ul></details><fieldset disabled={pending} className="space-y-4"><label className="block text-xs font-semibold">Digite o nome da empresa para confirmar<Input aria-label="Nome da arena para confirmar limpeza" value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" placeholder={visiblePreview.arenaName} className="mt-2 border-slate-300 font-normal"/></label><label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-xs leading-5 text-slate-600"><input type="checkbox" aria-label="Confirmação dos dados selecionados" checked={testData} onChange={event=>setTestData(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-rose-700"/><span>Confirmo que os registros selecionados são dados de teste e revisei todos os grupos e vínculos desta limpeza.</span></label><Button type="button" disabled={!ready || pending || !testData || confirmation.trim()!==visiblePreview.arenaName.trim()} onClick={execute} className="w-full bg-rose-700 text-white hover:bg-rose-800">{pending?'Concluindo limpeza…':'Confirmar limpeza'}</Button></fieldset><div className="flex flex-wrap items-center justify-between gap-3 text-xs"><button type="button" disabled={pending} onClick={()=>setStep(2)} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900"><ArrowLeft className="h-3.5 w-3.5"/>Voltar à revisão</button><button type="button" disabled={pending} onClick={()=>generatePreview(visiblePreview.cutoff)} className="font-medium text-slate-500 underline underline-offset-4">Atualizar análise</button></div><p className="text-[11px] leading-5 text-slate-500">Cobranças externas não serão canceladas ou estornadas.</p></div></section>}
    </> : <section aria-label="Histórico e recuperação" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="text-base font-bold">Histórico e restauração</h2><p className="mt-1 text-xs text-slate-500">Consulte as operações e recupere uma limpeza concluída.</p></div><Button size="sm" variant="outline" disabled={!arenaId || pending || historyLoading} onClick={()=>void refreshHistory(arenaId)}><RotateCcw className="h-3.5 w-3.5"/>Atualizar</Button></div>
      {!visibleHistory.length ? <div className="px-5 py-16 text-center"><Clock3 className="mx-auto h-7 w-7 text-slate-300"/><p className="mt-3 text-sm text-slate-500">{historyLoading?'Carregando histórico…':arenaId?'Nenhuma operação registrada para esta arena.':'Escolha uma arena para consultar as operações.'}</p></div> : <div className="divide-y divide-slate-100">{visibleHistory.map(operation=><article key={operation.id} className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${operation.status==='completed'?'bg-emerald-50 text-emerald-800':operation.status==='restored'?'bg-sky-50 text-sky-800':'bg-slate-100 text-slate-500'}`}>{operation.status==='completed'?'Concluída':operation.status==='restored'?'Restaurada':'Análise'}</span><span className="text-[11px] text-slate-400">{date(operation.createdAt)}</span></div><p className="mt-2 text-sm font-semibold leading-5">{operation.reason}</p><p className="mt-1 text-xs text-slate-500">{operation.summary.recordCount ?? operation.summary.transactionCount+operation.summary.sessionCount} {(operation.summary.recordCount ?? operation.summary.transactionCount+operation.summary.sessionCount)===1?'registro':'registros'} · {operation.modules.length} {operation.modules.length===1?'grupo':'grupos'} · <span className="font-mono text-[10px]">{operation.id.slice(0,8)}</span></p><details className="mt-2"><summary className="cursor-pointer text-[11px] font-medium text-slate-500">Ver grupos da operação</summary><p className="mt-2 text-xs leading-5 text-slate-500">{operation.modules.map(cleanupModuleLabel).join(' · ')}</p></details></div>{operation.status==='completed' && <Button size="sm" variant="outline" disabled={pending} className="w-fit" onClick={()=>{setRestore(operation);setRestoreName('');setRestoreReason('');setError(null)}}><RotateCcw className="h-3.5 w-3.5"/>Restaurar…</Button>}</article>)}</div>}
      {history.arenaId===arenaId && history.hasMore && <div className="border-t border-slate-100 p-4 text-center"><Button variant="outline" disabled={pending || historyLoading} onClick={()=>{const last=visibleHistory.at(-1);if(last)void refreshHistory(arenaId,{createdAt:last.createdAt,id:last.id})}}>{historyLoading?'Carregando…':'Carregar operações anteriores'}</Button></div>}
      {restore?.arenaId===arenaId && <fieldset disabled={pending} className="space-y-4 border-t border-sky-200 bg-sky-50/50 p-5 sm:p-6"><h3 className="text-base font-bold">Restaurar a limpeza de {date(restore.createdAt)}</h3><p className="max-w-2xl text-xs leading-6 text-slate-600">Os registros serão recuperados com seus dados originais. Havendo conflito com informações novas, a restauração será bloqueada.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold">Digite {restore.arenaName}<Input aria-label="Nome da arena para restaurar" value={restoreName} onChange={event=>setRestoreName(event.target.value)} className="mt-2 bg-white font-normal"/></label><label className="block text-xs font-semibold">Motivo da restauração<Textarea aria-label="Motivo da restauração" value={restoreReason} maxLength={500} onChange={event=>setRestoreReason(event.target.value)} className="mt-2 bg-white font-normal"/></label></div><div className="flex flex-wrap gap-2"><Button onClick={restoreData} disabled={pending || restoreName.trim()!==restore.arenaName.trim() || restoreReason.trim().length<8} className="bg-arena-navy-950 text-white hover:bg-arena-navy-800">{pending?'Restaurando…':'Confirmar restauração'}</Button><Button variant="outline" onClick={()=>setRestore(null)}>Cancelar</Button></div></fieldset>}
    </section>}
  </div>
}
