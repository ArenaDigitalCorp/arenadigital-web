"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  MapPinned,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  createPublicArenaImportCampaignAction,
  getPublicArenaListingFormOptionsAction,
  getPublicArenaMunicipalitiesAction,
  listPublicArenaImportCampaignsAction,
  retryPublicArenaImportCampaignAction,
  runPublicArenaImportWorkerAction,
  setPublicArenaImportCampaignStatusAction,
} from "@/modules/platform-admin/actions/platformAdminActions"
import type {
  PlatformReferenceMunicipality,
  PublicArenaImportCampaign,
  PublicArenaListingFormOptions,
} from "@/modules/platform-admin/types/platform-admin.types"

const STATUS_LABEL: Record<PublicArenaImportCampaign["status"], string> = {
  running: "Em execução",
  paused: "Pausada",
  completed: "Concluída",
  completed_with_errors: "Concluída com falhas",
}

const STATUS_TONE: Record<PublicArenaImportCampaign["status"], string> = {
  running: "border-sky-200 bg-sky-50 text-sky-800",
  paused: "border-amber-200 bg-amber-50 text-amber-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  completed_with_errors: "border-rose-200 bg-rose-50 text-rose-800",
}

function progress(campaign: PublicArenaImportCampaign): number {
  if (campaign.totalCount === 0) return 0
  return Math.round(((campaign.stagedCount + campaign.emptyCount + campaign.failedCount) / campaign.totalCount) * 100)
}

export function PublicArenaImportCampaigns() {
  const [pending, startTransition] = useTransition()
  const [options, setOptions] = useState<PublicArenaListingFormOptions | null>(null)
  const [campaigns, setCampaigns] = useState<PublicArenaImportCampaign[]>([])
  const [municipalities, setMunicipalities] = useState<PlatformReferenceMunicipality[]>([])
  const [stateCode, setStateCode] = useState<number | null>(null)
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<Map<number, string>>(new Map())
  const [sportIds, setSportIds] = useState<string[]>([])
  const [name, setName] = useState("Expansão regional do catálogo")
  const [reason, setReason] = useState("Descoberta automatizada para ampliar o catálogo público")
  const [autoRun, setAutoRun] = useState(false)
  const [loading, setLoading] = useState(true)
  const operationId = useRef(crypto.randomUUID())
  const runningCycle = useRef(false)

  const loadCampaigns = useCallback(async (quiet = false) => {
    const result = await listPublicArenaImportCampaignsAction(12)
    if (!result.success) {
      if (!quiet) toast.error(result.error ?? "Não foi possível carregar as campanhas.")
      return
    }
    setCampaigns(result.campaigns)
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([
      getPublicArenaListingFormOptionsAction(),
      listPublicArenaImportCampaignsAction(12),
    ]).then(([optionsResult, campaignsResult]) => {
      if (!active) return
      if (optionsResult.success && optionsResult.data) setOptions(optionsResult.data)
      else toast.error(optionsResult.error ?? "Não foi possível carregar estados e esportes.")
      if (campaignsResult.success) setCampaigns(campaignsResult.campaigns)
      else toast.error(campaignsResult.error ?? "Não foi possível carregar as campanhas.")
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const hasRunningCampaign = campaigns.some((campaign) => campaign.status === "running")

  const runCycle = useCallback(async (quiet = false) => {
    if (runningCycle.current) return
    runningCycle.current = true
    try {
      const result = await runPublicArenaImportWorkerAction(1)
      if (!result.success) {
        if (!quiet) toast.error(result.error ?? "Não foi possível executar o próximo município.")
        return
      }
      if (!quiet) {
        if (result.claimed === 0) toast.info("Nenhum município está pronto para processamento agora.")
        else toast.success(`${result.staged} lote(s) preparado(s), ${result.empty} município(s) sem resultado.`)
      }
      await loadCampaigns(true)
    } finally {
      runningCycle.current = false
    }
  }, [loadCampaigns])

  useEffect(() => {
    if (!autoRun || !hasRunningCampaign) return
    const timer = window.setInterval(() => void runCycle(true), 35_000)
    return () => window.clearInterval(timer)
  }, [autoRun, hasRunningCampaign, runCycle])

  async function loadMunicipalities(code: number) {
    setStateCode(code || null)
    setMunicipalities([])
    if (!code) return
    const result = await getPublicArenaMunicipalitiesAction(code)
    if (!result.success) toast.error(result.error ?? "Não foi possível carregar os municípios.")
    else setMunicipalities(result.data)
  }

  function toggleMunicipality(municipality: PlatformReferenceMunicipality, checked: boolean) {
    setSelectedMunicipalities((current) => {
      const next = new Map(current)
      if (checked) {
        if (next.size >= 100) {
          toast.error("Cada campanha pode ter no máximo 100 municípios.")
          return current
        }
        next.set(municipality.code, municipality.name)
      } else {
        next.delete(municipality.code)
      }
      return next
    })
  }

  function selectVisibleMunicipalities() {
    setSelectedMunicipalities((current) => {
      const next = new Map(current)
      for (const municipality of municipalities) {
        if (next.size >= 100) break
        next.set(municipality.code, municipality.name)
      }
      return next
    })
  }

  function createCampaign() {
    if (selectedMunicipalities.size === 0 || sportIds.length === 0) {
      toast.error("Selecione ao menos um município e um esporte.")
      return
    }
    startTransition(async () => {
      const result = await createPublicArenaImportCampaignAction({
        operationId: operationId.current,
        name,
        municipalityIds: [...selectedMunicipalities.keys()],
        sportIds,
        maxAttempts: 3,
        maxResultsPerMunicipality: 150,
        startImmediately: true,
        reason,
      })
      if (!result.success || !result.campaign) {
        toast.error(result.error ?? "Não foi possível criar a campanha.")
        return
      }
      operationId.current = crypto.randomUUID()
      setSelectedMunicipalities(new Map())
      setCampaigns((current) => [result.campaign!, ...current.filter((item) => item.id !== result.campaign!.id)])
      setAutoRun(true)
      toast.success("Campanha criada. A descoberta já pode processar os municípios selecionados.")
      await runCycle(true)
    })
  }

  function updateStatus(campaign: PublicArenaImportCampaign) {
    const nextStatus = campaign.status === "running" ? "paused" : "running"
    startTransition(async () => {
      const result = await setPublicArenaImportCampaignStatusAction({
        campaignId: campaign.id,
        status: nextStatus,
        reason: nextStatus === "paused" ? "Pausa operacional solicitada no painel" : "Retomada operacional solicitada no painel",
      })
      if (!result.success) toast.error(result.error ?? "Não foi possível alterar a campanha.")
      else {
        toast.success(nextStatus === "paused" ? "Campanha pausada." : "Campanha retomada.")
        await loadCampaigns(true)
      }
    })
  }

  function retryFailures(campaignId: string) {
    startTransition(async () => {
      const result = await retryPublicArenaImportCampaignAction({
        campaignId,
        reason: "Nova tentativa manual após revisão das falhas da campanha",
      })
      if (!result.success) toast.error(result.error ?? "Não foi possível repetir as falhas.")
      else {
        setAutoRun(true)
        toast.success("Municípios com falha voltaram para a fila.")
        await runCycle(true)
      }
    })
  }

  const selectedPreview = useMemo(
    () => [...selectedMunicipalities.entries()].slice(0, 8),
    [selectedMunicipalities],
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-700">Nova campanha</p>
              <h3 className="mt-1 font-heading text-xl font-black text-slate-950">Descoberta por território</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Escolha até 100 municípios. Cada resultado vira um lote de revisão, nunca uma arena publicada.</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-700"><MapPinned className="h-5 w-5" /></span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold">Nome da campanha<Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label>
            <label className="text-xs font-bold">Estado para selecionar municípios
              <select value={stateCode ?? ""} onChange={(event) => void loadMunicipalities(Number(event.target.value))} className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal">
                <option value="">Selecione</option>
                {options?.states.map((state) => <option key={state.code} value={state.code}>{state.name} ({state.uf})</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Municípios ({selectedMunicipalities.size}/100)</Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={selectVisibleMunicipalities} disabled={municipalities.length === 0}>Selecionar visíveis</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedMunicipalities(new Map())} disabled={selectedMunicipalities.size === 0}>Limpar</Button>
              </div>
            </div>
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
              {municipalities.length === 0 ? <p className="py-6 text-center text-xs text-slate-400">Escolha um estado para carregar os municípios.</p> : municipalities.map((municipality) => (
                <label key={municipality.code} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white">
                  <Checkbox checked={selectedMunicipalities.has(municipality.code)} onCheckedChange={(checked) => toggleMunicipality(municipality, checked === true)} />
                  {municipality.name}
                </label>
              ))}
            </div>
            {selectedPreview.length > 0 && <p className="mt-2 truncate text-[10px] text-slate-500">Selecionados: {selectedPreview.map(([, city]) => city).join(", ")}{selectedMunicipalities.size > 8 ? "…" : ""}</p>}
          </div>

          <div className="mt-4">
            <Label>Esportes associados</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {options?.sports.map((sport) => (
                <label key={sport.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <Checkbox checked={sportIds.includes(sport.id)} onCheckedChange={(checked) => setSportIds((current) => checked ? [...new Set([...current, sport.id])].slice(0, 12) : current.filter((id) => id !== sport.id))} />
                  {sport.name}
                </label>
              ))}
            </div>
          </div>

          <label className="mt-4 block"><Label>Motivo para auditoria</Label><Textarea className="mt-2 min-h-20" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></label>
          <Button className="mt-4 w-full" onClick={createCampaign} disabled={pending || loading}>{pending ? <LoaderCircle className="animate-spin" /> : <Bot />}Criar e iniciar campanha</Button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-sky-700">Fila persistente</p>
              <h3 className="mt-1 font-heading text-xl font-black text-slate-950">Campanhas recentes</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600">
                <Checkbox checked={autoRun} onCheckedChange={(checked) => setAutoRun(checked === true)} />
                Automático nesta tela
              </label>
              <Button variant="outline" size="sm" onClick={() => void runCycle(false)} disabled={pending || !hasRunningCampaign}><RefreshCw className={pending ? "animate-spin" : ""} />Executar ciclo</Button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Carregando campanhas</div>
          ) : campaigns.length === 0 ? (
            <div className="grid min-h-72 place-items-center p-8 text-center"><div><Bot className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-bold">Nenhuma campanha criada</p><p className="mt-1 text-xs text-slate-500">A primeira campanha aparecerá aqui com progresso e controles.</p></div></div>
          ) : (
            <div className="max-h-[720px] divide-y divide-slate-100 overflow-y-auto">
              {campaigns.map((campaign) => {
                const campaignProgress = progress(campaign)
                return (
                  <article key={campaign.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-sm font-black text-slate-950">{campaign.name}</h4>
                          <Badge variant="outline" className={STATUS_TONE[campaign.status]}>{STATUS_LABEL[campaign.status]}</Badge>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Clock3 className="h-3 w-3" />{new Date(campaign.createdAt).toLocaleString("pt-BR")}</p>
                      </div>
                      <div className="flex gap-2">
                        {(campaign.status === "running" || campaign.status === "paused") && <Button variant="outline" size="sm" onClick={() => updateStatus(campaign)} disabled={pending}>{campaign.status === "running" ? <Pause /> : <Play />}{campaign.status === "running" ? "Pausar" : "Retomar"}</Button>}
                        {campaign.failedCount > 0 && <Button variant="outline" size="sm" onClick={() => retryFailures(campaign.id)} disabled={pending}><RotateCcw />Repetir falhas</Button>}
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all" style={{ width: `${campaignProgress}%` }} /></div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500"><span>{campaignProgress}% concluído</span><span>{campaign.totalCount} município(s)</span></div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-lg bg-sky-50 px-3 py-2"><strong className="block text-sm text-sky-800">{campaign.pendingCount + campaign.processingCount}</strong><span className="text-[9px] text-sky-700">na fila</span></div>
                      <div className="rounded-lg bg-emerald-50 px-3 py-2"><strong className="block text-sm text-emerald-800">{campaign.stagedCount}</strong><span className="text-[9px] text-emerald-700">lotes prontos</span></div>
                      <div className="rounded-lg bg-slate-100 px-3 py-2"><strong className="block text-sm text-slate-700">{campaign.emptyCount}</strong><span className="text-[9px] text-slate-500">sem resultado</span></div>
                      <div className={`rounded-lg px-3 py-2 ${campaign.failedCount > 0 ? "bg-rose-50" : "bg-slate-100"}`}><strong className={`block text-sm ${campaign.failedCount > 0 ? "text-rose-800" : "text-slate-700"}`}>{campaign.failedCount}</strong><span className={campaign.failedCount > 0 ? "text-[9px] text-rose-700" : "text-[9px] text-slate-500"}>falhas</span></div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" />{campaign.readyCount} candidatas prontas</span>
                      <span>{campaign.duplicateCount} duplicadas</span>
                      {campaign.invalidCount > 0 && <span className="flex items-center gap-1 text-rose-700"><CircleAlert className="h-3 w-3" />{campaign.invalidCount} inválidas</span>}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-[10px] leading-4 text-slate-500">O modo automático executa um município a cada 35 segundos enquanto esta tela permanece aberta. Dados © OpenStreetMap contributors.</div>
        </section>
      </div>
    </div>
  )
}
