"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { CheckCircle2, Database, Download, FileSpreadsheet, LoaderCircle, MapPinned, Upload } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  applyPublicArenaImportBatchAction,
  discoverOpenStreetMapArenasAction,
  getPublicArenaListingFormOptionsAction,
  getPublicArenaMunicipalitiesAction,
  stagePublicArenaImportBatchAction,
} from "@/modules/platform-admin/actions/platformAdminActions"
import { parsePublicArenaCsv, publicArenaImportCsvTemplate } from "@/modules/platform-admin/lib/public-arena-import"
import type {
  PlatformReferenceMunicipality,
  PublicArenaImportBatch,
  PublicArenaImportPreviewRow,
  PublicArenaImportSource,
  PublicArenaListingFormOptions,
} from "@/modules/platform-admin/types/platform-admin.types"

type ImportMode = "csv" | "openstreetmap"
type Step = "source" | "preview" | "review"

const STATUS_LABEL = {
  ready: "Pronta",
  duplicate: "Duplicada",
  invalid: "Inválida",
  applied: "Aplicada",
} as const

function downloadCsvTemplate() {
  const blob = new Blob([publicArenaImportCsvTemplate()], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "modelo-importacao-arenas.csv"
  anchor.click()
  URL.revokeObjectURL(url)
}

export function PublicArenaImportDialog() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>("source")
  const [mode, setMode] = useState<ImportMode>("csv")
  const [source, setSource] = useState<PublicArenaImportSource>("csv")
  const [filename, setFilename] = useState<string | null>(null)
  const [preview, setPreview] = useState<PublicArenaImportPreviewRow[]>([])
  const [batch, setBatch] = useState<PublicArenaImportBatch | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState("Importação revisada para ampliar o catálogo público")
  const [options, setOptions] = useState<PublicArenaListingFormOptions | null>(null)
  const [municipalities, setMunicipalities] = useState<PlatformReferenceMunicipality[]>([])
  const [stateCode, setStateCode] = useState<number | null>(null)
  const [municipalityId, setMunicipalityId] = useState<number | null>(null)
  const [sportIds, setSportIds] = useState<string[]>([])
  const operationId = useRef(crypto.randomUUID())

  useEffect(() => {
    if (!open || options) return
    void getPublicArenaListingFormOptionsAction().then((result) => {
      if (!result.success || !result.data) toast.error(result.error ?? "Não foi possível carregar estados e esportes.")
      else setOptions(result.data)
    })
  }, [open, options])

  const readyIds = useMemo(
    () => batch?.items.filter((item) => item.status === "ready").map((item) => item.id) ?? [],
    [batch],
  )

  function resetImportData() {
    setStep("source")
    setFilename(null)
    setPreview([])
    setBatch(null)
    setSelected(new Set())
    operationId.current = crypto.randomUUID()
  }

  async function loadCsv(file: File | undefined) {
    if (!file) return
    try {
      const rows = parsePublicArenaCsv(await file.text())
      setFilename(file.name)
      setPreview(rows)
      setBatch(null)
      setStep("preview")
      operationId.current = crypto.randomUUID()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV inválido.")
    }
  }

  async function loadMunicipalities(code: number) {
    setStateCode(code)
    setMunicipalityId(null)
    setMunicipalities([])
    const result = await getPublicArenaMunicipalitiesAction(code)
    if (!result.success) toast.error(result.error ?? "Não foi possível carregar os municípios.")
    else setMunicipalities(result.data)
  }

  function discoverOsm() {
    if (!stateCode || !municipalityId || sportIds.length === 0) {
      toast.error("Selecione estado, município e ao menos um esporte.")
      return
    }
    startTransition(async () => {
      const result = await discoverOpenStreetMapArenasAction({ stateCode, municipalityId, sportIds })
      if (!result.success || !result.items) {
        toast.error(result.error ?? "Não foi possível consultar o OpenStreetMap.")
        return
      }
      if (result.items.length === 0) {
        toast.info("Nenhum local esportivo identificado neste município.")
        return
      }
      setSource("openstreetmap")
      setFilename(`openstreetmap-${municipalityId}.json`)
      setPreview(result.items.map((item, index) => ({ rowNumber: index + 1, item, errors: [] })))
      setBatch(null)
      setStep("preview")
      operationId.current = crypto.randomUUID()
    })
  }

  function stage() {
    if (reason.trim().length < 8 || preview.length === 0) {
      toast.error("Informe o motivo e carregue ao menos uma arena.")
      return
    }
    startTransition(async () => {
      const result = await stagePublicArenaImportBatchAction({
        operationId: operationId.current,
        source,
        filename,
        items: preview.map((row) => row.item),
        reason,
      })
      if (!result.success || !result.batch) {
        toast.error(result.error ?? "Não foi possível validar o lote.")
        return
      }
      setBatch(result.batch)
      setSelected(new Set(result.batch.items.filter((item) => item.status === "ready").map((item) => item.id)))
      setStep("review")
      toast.success("Lote validado. Revise as linhas prontas antes de aplicar.")
    })
  }

  function applySelected() {
    if (!batch || selected.size === 0) {
      toast.error("Selecione ao menos uma linha pronta.")
      return
    }
    startTransition(async () => {
      const result = await applyPublicArenaImportBatchAction({
        batchId: batch.id,
        itemIds: [...selected],
        reason,
      })
      if (!result.success || !result.batch) {
        toast.error(result.error ?? "Não foi possível aplicar o lote.")
        return
      }
      setBatch(result.batch)
      setSelected(new Set())
      toast.success(`${result.batch.counts.applied} local(is) aplicado(s). Todos continuam ocultos no app.`)
    })
  }

  function toggleAllReady() {
    setSelected((current) => current.size === readyIds.length ? new Set() : new Set(readyIds))
  }

  const reviewRows = batch?.items ?? []

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); if (!next) resetImportData() } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 rounded-xl border-slate-300 bg-white px-4 font-bold">
          <Upload className="h-4 w-4" />Importar catálogo
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="bg-[#07141d] px-6 py-6 text-left text-white">
          <DialogTitle className="flex items-center gap-3 font-heading text-2xl font-black"><Database className="text-orange-400" />Sincronizar locais públicos</DialogTitle>
          <DialogDescription className="text-slate-400">Importe, valide e revise. Nenhuma arena aparece no app antes de uma publicação separada.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-6">
          {step === "source" && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => { setMode("csv"); setSource("csv") }} className={`rounded-2xl border p-5 text-left ${mode === "csv" ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white"}`}><FileSpreadsheet className="h-6 w-6" /><p className="mt-4 font-heading text-lg font-black">Arquivo CSV</p><p className="mt-1 text-sm text-slate-500">Até 500 linhas, com suporte a aspas, vírgulas e quebras de linha.</p></button>
                <button type="button" onClick={() => { setMode("openstreetmap"); setSource("openstreetmap") }} className={`rounded-2xl border p-5 text-left ${mode === "openstreetmap" ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white"}`}><MapPinned className="h-6 w-6" /><p className="mt-4 font-heading text-lg font-black">OpenStreetMap</p><p className="mt-1 text-sm text-slate-500">Descoberta pontual por município, sempre sujeita à revisão humana.</p></button>
              </div>

              {mode === "csv" ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">Selecione o CSV</p><p className="text-xs text-slate-500">Use IDs de esporte separados por |.</p></div><Button type="button" variant="ghost" onClick={downloadCsvTemplate}><Download className="h-4 w-4" />Baixar modelo</Button></div>
                  <select value={source} onChange={(event) => setSource(event.target.value as PublicArenaImportSource)} className="mb-4 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="csv">CSV próprio</option><option value="receita_cnpj">Exportação Receita/CNPJ</option><option value="brasilapi">Exportação BrasilAPI</option></select>
                  <Input type="file" accept=".csv,text/csv" onChange={(event) => void loadCsv(event.target.files?.[0])} />
                </div>
              ) : (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold">Estado<select value={stateCode ?? ""} onChange={(event) => void loadMunicipalities(Number(event.target.value))} className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal"><option value="">Selecione</option>{options?.states.map((state) => <option key={state.code} value={state.code}>{state.name} ({state.uf})</option>)}</select></label><label className="text-xs font-bold">Município<select value={municipalityId ?? ""} onChange={(event) => setMunicipalityId(Number(event.target.value) || null)} className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal"><option value="">Selecione</option>{municipalities.map((city) => <option key={city.code} value={city.code}>{city.name}</option>)}</select></label></div>
                  <div><Label className="text-xs font-bold">Esportes que serão associados</Label><div className="mt-2 grid gap-2 sm:grid-cols-3">{options?.sports.map((sport) => <label key={sport.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm"><Checkbox checked={sportIds.includes(sport.id)} onCheckedChange={(checked) => setSportIds((current) => checked ? [...new Set([...current, sport.id])] : current.filter((id) => id !== sport.id))} />{sport.name}</label>)}</div></div>
                  <p className="text-xs text-slate-500">Dados © OpenStreetMap contributors (ODbL). A consulta pública pode ficar temporariamente indisponível.</p>
                  <Button type="button" onClick={discoverOsm} disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <MapPinned />}Buscar locais no município</Button>
                </div>
              )}
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-heading text-xl font-black">Prévia local</p><p className="text-sm text-slate-500">{preview.length} linha(s) carregada(s) de {filename}.</p></div><Button variant="outline" onClick={() => setStep("source")}>Trocar origem</Button></div>
              <div className="max-h-[360px] overflow-auto rounded-xl border bg-white"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-slate-300"><tr><th className="p-3">Linha</th><th className="p-3">Nome</th><th className="p-3">Município</th><th className="p-3">Esportes</th><th className="p-3">Pré-validação</th></tr></thead><tbody className="divide-y">{preview.map((row) => <tr key={row.rowNumber}><td className="p-3">{row.rowNumber}</td><td className="p-3 font-bold">{row.item.name || "—"}</td><td className="p-3">{row.item.municipality_id ?? "—"}</td><td className="p-3">{row.item.sport_ids.length}</td><td className="p-3">{row.errors.length ? <span className="text-rose-700">{row.errors.join(" ")}</span> : <span className="text-emerald-700">Pronta para validar</span>}</td></tr>)}</tbody></table></div>
              <label className="block"><Label>Motivo para auditoria</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2" /></label>
              <div className="flex justify-end"><Button onClick={stage} disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Upload />}Enviar para validação</Button></div>
            </div>
          )}

          {step === "review" && batch && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-heading text-xl font-black">Revisão persistida</p><p className="text-sm text-slate-500">Lote {batch.id.slice(0, 8)} · {batch.source}</p></div><div className="flex flex-wrap gap-2"><Badge>{batch.counts.ready} prontas</Badge><Badge variant="outline">{batch.counts.duplicate} duplicadas</Badge><Badge variant="destructive">{batch.counts.invalid} inválidas</Badge><Badge className="bg-emerald-700">{batch.counts.applied} aplicadas</Badge></div></div>
              <div className="max-h-[410px] overflow-auto rounded-xl border bg-white"><table className="w-full min-w-[900px] text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-slate-300"><tr><th className="p-3"><Checkbox checked={readyIds.length > 0 && selected.size === readyIds.length} onCheckedChange={toggleAllReady} /></th><th className="p-3">Linha</th><th className="p-3">Local</th><th className="p-3">Status</th><th className="p-3">Validação</th></tr></thead><tbody className="divide-y">{reviewRows.map((item) => <tr key={item.id}><td className="p-3"><Checkbox disabled={item.status !== "ready"} checked={selected.has(item.id)} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(item.id); else next.delete(item.id); return next })} /></td><td className="p-3">{item.rowNumber}</td><td className="p-3"><p className="font-bold">{item.name}</p><p className="text-slate-500">{item.address}</p></td><td className="p-3">{STATUS_LABEL[item.status]}</td><td className="p-3 text-rose-700">{item.errors.join(" ") || "Sem pendências"}</td></tr>)}</tbody></table></div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="flex items-center gap-2 text-sm text-emerald-900"><CheckCircle2 className="h-5 w-5" />Aplicar cria arenas ocultas, sem cliente, assinatura ou quadra.</p><Button onClick={applySelected} disabled={pending || selected.size === 0}>{pending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}Aplicar {selected.size} selecionada(s)</Button></div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
