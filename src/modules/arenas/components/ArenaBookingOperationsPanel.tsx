"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarRange, CheckCircle2, FileText, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AsaasProviderNotice } from '@/components/payments/asaas-provider-notice'
import { ArenaAppBookingSettingsCard } from './ArenaAppBookingSettingsCard'
import { ArenaCancellationPolicyCard } from './ArenaCancellationPolicyCard'
import { ArenaPixSplitSettingsCard } from './ArenaPixSplitSettingsCard'
import { normalizeAppBookingMode, type AppBookingMode } from '../domain/app-booking-mode'
import { getArenaReceivingSetupAction, setArenaReceivingBookingModeAction } from '../actions/receivingSetupActions'
import type { ArenaReceivingSetup } from '../types/receiving-setup.types'
import type { ArenaCancellationPolicySettings } from '../types/cancellation-policy.types'
import type { ArenaPixSplitSettings } from '../types/pix-split.types'

type Props = {
  arenaId:string; arenaName:string; initialMode:unknown; legacyAcceptsRequests?:boolean;
  initialSetup:ArenaReceivingSetup|null; initialSetupError?:string;
  paymentSettings:ArenaPixSplitSettings; cancellationPolicySettings:ArenaCancellationPolicySettings;
  registration:{legalName?:string|null;email:string;phone:string;document:string;address:string;addressNumber:string;complement:string;province:string;postalCode:string}
}
export function ArenaBookingOperationsPanel({arenaId,arenaName,initialMode,legacyAcceptsRequests=false,initialSetup,initialSetupError,paymentSettings,cancellationPolicySettings,registration}:Props) {
  const [setup,setSetup]=useState(initialSetup)
  const [selectedMode,setSelectedMode]=useState<AppBookingMode>(initialSetup?.active_mode??normalizeAppBookingMode(initialMode,legacyAcceptsRequests))
  const [onlineConfigurationOpened,setOnlineConfigurationOpened]=useState(selectedMode==='online_payment')
  const [busy,setBusy]=useState(false)
  const [refreshingFiscalStatus,setRefreshingFiscalStatus]=useState(false)
  const [error,setError]=useState(initialSetupError??'')
  const [notice,setNotice]=useState('')
  const requestVersion=useRef(0)
  const selectionVersion=useRef(0)
  const mutationInFlight=useRef(false)
  const mounted=useRef(true)
  const setupRef=useRef(setup)
  const selectedModeRef=useRef(selectedMode)
  setupRef.current=setup
  selectedModeRef.current=selectedMode
  const [hasPolicy,setHasPolicy]=useState(Boolean(cancellationPolicySettings.currentPolicy))
  const [accountStarted,setAccountStarted]=useState(paymentSettings.onboardingStarted)
  const [documentsReady,setDocumentsReady]=useState(paymentSettings.enabled||paymentSettings.documentationStatus==='APPROVED')
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;requestVersion.current++}},[])
  const refresh=useCallback(async()=>{
    if(mutationInFlight.current)return
    const generation=++requestVersion.current
    const selectionAtStart=selectionVersion.current
    try {
      const result=await getArenaReceivingSetupAction(arenaId)
      if(!mounted.current||mutationInFlight.current||generation!==requestVersion.current)return
      if(!result.success){setError(result.error);return}
      const previous=setupRef.current
      // Follow server changes only while the user has no unsaved mode choice.
      // A delayed status check must never replace a choice made during the request.
      const followSavedMode=selectionAtStart===selectionVersion.current
        &&(!previous||selectedModeRef.current===previous.active_mode)
      setupRef.current=result.data
      setSetup(result.data)
      if(followSavedMode){
        selectedModeRef.current=result.data.active_mode
        setSelectedMode(result.data.active_mode)
        if(result.data.active_mode==='online_payment')setOnlineConfigurationOpened(true)
      }
      if(previous?.intent_status==='pending'&&result.data.intent_status==='activated'){
        setNotice('Pagamento online ativado. O Pix está disponível para reservas no aplicativo.')
      }
      setError('')
    } catch {
      if(mounted.current&&!mutationInFlight.current&&generation===requestVersion.current){
        setError('Não foi possível atualizar o status. Confira sua conexão e tente novamente.')
      }
    }
  },[arenaId])
  useEffect(()=>{
    if(setup?.intent_status!=='pending')return
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},15000)
    const onFocus=()=>{if(document.visibilityState==='visible')void refresh()}
    document.addEventListener('visibilitychange',onFocus)
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',onFocus)}
  },[setup?.intent_status,refresh])
  async function refreshFiscalStatus() {
    setRefreshingFiscalStatus(true)
    try { await refresh() }
    finally { if(mounted.current)setRefreshingFiscalStatus(false) }
  }
  const onPaymentChange=useCallback((settings:ArenaPixSplitSettings)=>{setAccountStarted(settings.onboardingStarted);void refresh()},[refresh])
  const onPolicyChange=useCallback((settings:ArenaCancellationPolicySettings)=>{setHasPolicy(Boolean(settings.currentPolicy));void refresh()},[refresh])
  async function saveMode(mode:AppBookingMode, cancelPending=false) {
    const current=setupRef.current
    if(!current||mutationInFlight.current)return
    const generation=++requestVersion.current
    mutationInFlight.current=true
    setBusy(true);setError('');setNotice('')
    try {
      const result=await setArenaReceivingBookingModeAction(arenaId,mode,current.intent_revision,cancelPending)
      if(!mounted.current)return
      if(!result.success){setError(result.error);return}
      // Mutation response is authoritative; invalidate reads started while saving.
      requestVersion.current=Math.max(requestVersion.current,generation)+1
      setupRef.current=result.data;selectedModeRef.current=result.data.active_mode
      setSetup(result.data);setSelectedMode(result.data.active_mode)
      if(result.data.active_mode==='online_payment')setOnlineConfigurationOpened(true)
      if(result.data.intent_status==='pending'){
        setNotice('Solicitação registrada. A modalidade atual será mantida até a ativação do pagamento online.')
      }else{
        setNotice(result.data.active_mode==='online_payment'?'Pagamento online ativo.':'Modalidade salva. Não há ativação online pendente.')
      }
    } catch {if(mounted.current)setError('Não foi possível confirmar a operação. Atualize o status antes de tentar novamente.')}
    finally {mutationInFlight.current=false;if(mounted.current)setBusy(false)}
  }
  const onlineSelected=selectedMode==='online_payment'
  const pending=setup?.intent_status==='pending'
  const onlineActive=setup?.active_mode==='online_payment'
  const fiscalSetupMissing=setup?.missing.includes('fiscal_setup')??false
  const fiscalStatusText=pending
    ? 'A solicitação fica registrada. O Pix online será ativado automaticamente quando a configuração fiscal e os demais requisitos estiverem prontos. O painel consulta o status enquanto você acompanha a solicitação.'
    : onlineActive
      ? 'Novas reservas por Pix aguardam a regularização fiscal. Use a atualização de status após a confirmação da equipe.'
      : 'Com a política publicada e os documentos enviados, você pode solicitar o pagamento online. A ativação aguarda a configuração fiscal e os demais requisitos.'
  return <div className="space-y-5">
    <section id="booking-operations" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-7"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-arena-navy-800 text-white"><CalendarRange className="size-4"/></span><div><h2 className="font-heading text-base font-bold text-arena-navy-800">Configuração da operação de reservas</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">Defina a experiência no aplicativo. Política e conta de recebimento só são exigidas para pagamento online.</p></div></header>
      {error&&<div role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}<Button variant="ghost" size="sm" disabled={busy} onClick={()=>void refresh()}><RefreshCw className="size-3"/>Atualizar status</Button></div>}
      {notice&&<p role="status" className="mx-5 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {setup?.intent_status==='cancelled'&&setup.cancellation_reason==='arena_changed'&&<p role="status" className="mx-5 mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">O cadastro da arena foi alterado após a solicitação. A ativação automática foi cancelada; revise e solicite novamente se desejar.</p>}
      <div className="divide-y divide-slate-200">
        <ArenaAppBookingSettingsCard selectedMode={selectedMode} savedMode={setup?.active_mode??normalizeAppBookingMode(initialMode,legacyAcceptsRequests)} setup={setup} busy={busy} onSelectionChange={mode=>{selectionVersion.current++;selectedModeRef.current=mode;setSelectedMode(mode);if(mode==='online_payment')setOnlineConfigurationOpened(true)}} onSave={mode=>void saveMode(mode)} onCancel={()=>void saveMode(setupRef.current?.active_mode??'disabled',true)}/>
        {fiscalSetupMissing&&(onlineSelected||pending||onlineActive)&&(
          <div className="px-5 py-5 sm:px-7">
            <section aria-labelledby="receiving-fiscal-title" className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950">
              <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
                <FileText className="mt-0.5 size-4 shrink-0 text-amber-800" aria-hidden="true"/>
                <div role="status" className="space-y-1">
                  <h3 id="receiving-fiscal-title" className="text-sm font-bold">Configuração fiscal da NFS-e pendente</h3>
                  <p className="text-xs leading-relaxed">Confirme com a contabilidade o CNPJ emissor, o portal, o regime tributário, o código do serviço e, quando exigidos, a inscrição municipal e a numeração fiscal. Informe esses dados à equipe Arena Digital para configurar a emissão na subconta Asaas que recebe o Pix.</p>
                  <p className="text-xs leading-relaxed">{fiscalStatusText}</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={busy||refreshingFiscalStatus} onClick={()=>void refreshFiscalStatus()}>
                {refreshingFiscalStatus?<Loader2 className="motion-safe:animate-spin" aria-hidden="true"/>:<RefreshCw aria-hidden="true"/>}
                {refreshingFiscalStatus?'Atualizando status…':'Atualizar status do Pix'}
              </Button>
            </section>
          </div>
        )}
        {onlineConfigurationOpened&&setup&&<div hidden={!onlineSelected} className="divide-y divide-slate-200">
          <ArenaCancellationPolicyCard arenaId={arenaId} initialSettings={cancellationPolicySettings} onSettingsChange={onPolicyChange}/>
          <ArenaPixSplitSettingsCard accessMode="arena" arenaId={arenaId} arenaName={arenaName} initialSettings={paymentSettings} initialReceivingDraft={setup?.draft??null} registration={registration} onSettingsChange={onPaymentChange} onDocumentsReadyChange={setDocumentsReady}/>
          {!onlineActive&&<div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-7">
            <div className="space-y-1 text-xs text-slate-500">
              {!hasPolicy&&<p>Publique a política de cancelamento para solicitar.</p>}
              {!accountStarted&&<p>Envie o cadastro da conta de recebimento.</p>}
              {accountStarted&&!documentsReady&&<p>Envie os documentos exigidos e atualize a situação dos envios para solicitar.</p>}
              {hasPolicy&&accountStarted&&documentsReady&&<p>{pending?'Solicitação registrada. Acompanhe o status nesta página.':'Ao solicitar, a modalidade atual será mantida durante a análise.'}</p>}
              <p>A conta de recebimento precisa estar aprovada e operacional.</p>
            </div>
            <Button className="bg-arena-button text-white hover:bg-arena-button-hover" disabled={busy||!setup||!hasPolicy||!accountStarted||!documentsReady||pending} onClick={()=>void saveMode('online_payment')}>{busy?<Loader2 className="size-4 animate-spin"/>:<CheckCircle2 className="size-4"/>}{pending?'Solicitação registrada':'Solicitar pagamento online'}</Button>
          </div>}
        </div>}
      </div>
    </section>
    {onlineSelected&&<AsaasProviderNotice/>}
  </div>
}
