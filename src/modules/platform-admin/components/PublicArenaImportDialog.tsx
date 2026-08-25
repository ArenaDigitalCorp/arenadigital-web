"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  MapPinned,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  applyPublicArenaImportBatchAction,
  discoverOpenStreetMapArenasAction,
  getPublicArenaImportBatchAction,
  getPublicArenaListingFormOptionsAction,
  getPublicArenaMunicipalitiesAction,
  stagePublicArenaImportBatchAction,
} from "@/modules/platform-admin/actions/platformAdminActions"
import { parsePublicArenaCsv, publicArenaImportCsvTemplate } from "@/modules/platform-admin/lib/public-arena-import"
import type {
  PlatformReferenceMunicipality,
  PublicArenaImportBatch,
  PublicArenaImportItemStatus,
  PublicArenaImportPreviewRow,
  PublicArenaImportSource,
  PublicArenaListingFormOptions,
} from "@/modules/platform-admin/types/platform-admin.types"

type ImportMode = "csv" | "openstreetmap"
type Step = "source" | "preview" | "review"

type PublicArenaImportDialogProps = {
  batchId?: string
  initialMode?: ImportMode
  onBatchChange?: (batch: PublicArenaImportBatch) => void
  triggerLabel?: string
  triggerVariant?: "default" | "outline"
}

const STEP_ORDER: Step[] = ["source", "preview", "review"]

const STEP_COPY: Record<Step, string> = {
  source: "Origem",
  preview: "Prévia",
  review: "Revisão",
}

const STATUS_LABEL: Record<PublicArenaImportItemStatus, string> = {
  ready: "Pronta para adicionar",
  duplicate: "Duplicada",
  invalid: "Inválida",
  applied: "Adicionada",
}

const STATUS_TONE: Record<PublicArenaImportItemStatus, string> = {
  ready: "border-sky-200 bg-sky-50 text-sky-800",
  duplicate: "border-amber-200 bg-amber-50 text-amber-800",
  invalid: "border-rose-200 bg-rose-50 text-rose-800",
  applied: "border-emerald-200 bg-emerald-50 text-emerald-800",
}

function downloadCsvTemplate() {
  const blob = new Blob([publicArenaImportCsvTemplate()], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "modelo-importacao-arenas.csv"
  anchor.click()
  URL.revokeObjectURL(url)
}

function ImportStepper({ step, isExistingBatch }: { step: Step; isExistingBatch: boolean }) {
  const currentIndex = STEP_ORDER.indexOf(step)

  return (
    <ol className="grid grid-cols-3 border-t border-slate-100 px-5 py-3 sm:px-6" aria-label="Etapas da importação">
      {STEP_ORDER.map((stepName, index) => {
        const isCurrent = stepName === step
        const isComplete = index < currentIndex
        const isUnavailable = isExistingBatch && stepName !== "review"

        return (
          <li
            key={stepName}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "relative flex items-center gap-2 text-[11px] font-medium text-slate-400",
              isCurrent && "text-slate-950",
              isComplete && "text-emerald-700",
              isUnavailable && "opacity-45",
            )}
          >
            {index > 0 && <span className="absolute right-full top-1/2 hidden h-px w-[calc(100%-2.25rem)] -translate-y-1/2 bg-slate-200 sm:block" />}
            <span
              className={cn(
                "relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border bg-white text-[10px]",
                isCurrent && "border-orange-500 bg-orange-50 text-orange-800",
                isComplete && "border-emerald-500 bg-emerald-50 text-emerald-700",
              )}
            >
              {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className="truncate">{STEP_COPY[stepName]}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function PublicArenaImportDialog({
  batchId,
  initialMode = "csv",
  onBatchChange,
  triggerLabel = "Nova importação",
  triggerVariant = "default",
}: PublicArenaImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>(batchId ? "review" : "source")
  const [mode, setMode] = useState<ImportMode>(initialMode)
  const [source, setSource] = useState<PublicArenaImportSource>(initialMode === "csv" ? "csv" : "openstreetmap")
  const [filename, setFilename] = useState<string | null>(null)
  const [preview, setPreview] = useState<PublicArenaImportPreviewRow[]>([])
  const [batch, setBatch] = useState<PublicArenaImportBatch | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState("Importação revisada para ampliar o catálogo público")
  const [options, setOptions] = useState<PublicArenaListingFormOptions | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [municipalities, setMunicipalities] = useState<PlatformReferenceMunicipality[]>([])
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false)
  const [stateCode, setStateCode] = useState<number | null>(null)
  const [municipalityId, setMunicipalityId] = useState<number | null>(null)
  const [sportIds, setSportIds] = useState<string[]>([])
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)
  const operationId = useRef(crypto.randomUUID())
  const batchLoadRequestId = useRef(0)

  async function loadOptions() {
    setLoadingOptions(true)
    setOptionsError(null)
    const result = await getPublicArenaListingFormOptionsAction()
    if (!result.success || !result.data) {
      setOptionsError(result.error ?? "Não foi possível carregar estados e esportes.")
    } else {
      setOptions(result.data)
    }
    setLoadingOptions(false)
  }

  async function loadExistingBatch(existingBatchId: string) {
    const requestId = batchLoadRequestId.current + 1
    batchLoadRequestId.current = requestId
    setLoadingBatch(true)
    setBatchError(null)
    try {
      const result = await getPublicArenaImportBatchAction(existingBatchId)
      if (requestId !== batchLoadRequestId.current) return
      if (!result.success || !result.batch) {
        setBatchError(result.error ?? "Não foi possível carregar este lote.")
        return
      }
      setBatch(result.batch)
      setSelected(new Set(result.batch.items.filter((item) => item.status === "ready").map((item) => item.id)))
      setStep("review")
    } catch {
      if (requestId === batchLoadRequestId.current) {
        setBatchError("Não foi possível carregar este lote.")
      }
    } finally {
      if (requestId === batchLoadRequestId.current) {
        setLoadingBatch(false)
      }
    }
  }

  const readyIds = useMemo(
    () => batch?.items.filter((item) => item.status === "ready").map((item) => item.id) ?? [],
    [batch],
  )

  function resetImportData() {
    setStep(batchId ? "review" : "source")
    setMode(initialMode)
    setSource(initialMode === "csv" ? "csv" : "openstreetmap")
    setFilename(null)
    setPreview([])
    setBatch(null)
    setSelected(new Set())
    setMunicipalities([])
    setStateCode(null)
    setMunicipalityId(null)
    setSportIds([])
    setBatchError(null)
    batchLoadRequestId.current += 1
    setLoadingBatch(false)
    operationId.current = crypto.randomUUID()
  }

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      resetImportData()
      return
    }
    if (batchId) {
      void loadExistingBatch(batchId)
    } else if (mode === "openstreetmap" && !options && !loadingOptions) {
      void loadOptions()
    }
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
    const nextCode = code || null
    setStateCode(nextCode)
    setMunicipalityId(null)
    setMunicipalities([])
    if (!nextCode) return

    setLoadingMunicipalities(true)
    const result = await getPublicArenaMunicipalitiesAction(nextCode)
    if (!result.success) toast.error(result.error ?? "Não foi possível carregar os municípios.")
    else setMunicipalities(result.data)
    setLoadingMunicipalities(false)
  }

  function selectMode(nextMode: ImportMode) {
    setMode(nextMode)
    setSource(nextMode === "csv" ? "csv" : "openstreetmap")
    if (nextMode === "openstreetmap" && !options && !loadingOptions) {
      void loadOptions()
    }
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
      onBatchChange?.(result.batch)
      toast.success("Lote validado. Revise as arenas prontas antes de adicionar.")
    })
  }

  function applySelected() {
    if (!batch || selected.size === 0) {
      toast.error("Selecione ao menos uma arena pronta.")
      return
    }
    if (reason.trim().length < 8) {
      toast.error("Informe um motivo para auditoria com ao menos 8 caracteres.")
      return
    }

    const previousAppliedCount = batch.counts.applied
    startTransition(async () => {
      const result = await applyPublicArenaImportBatchAction({
        batchId: batch.id,
        itemIds: [...selected],
        reason,
      })
      if (!result.success || !result.batch) {
        toast.error(result.error ?? "Não foi possível adicionar as arenas ao catálogo.")
        return
      }
      setBatch(result.batch)
      setSelected(new Set())
      onBatchChange?.(result.batch)
      const appliedNow = Math.max(0, result.batch.counts.applied - previousAppliedCount)
      if (appliedNow === 0) {
        toast.info("Nenhuma nova arena foi adicionada. Atualize a revisão antes de tentar novamente.")
      } else {
        toast.success(`${appliedNow} ${appliedNow === 1 ? "arena adicionada" : "arenas adicionadas"} ao catálogo como ${appliedNow === 1 ? "oculta" : "ocultas"}.`)
      }
    })
  }

  function toggleAllReady() {
    setSelected((current) => current.size === readyIds.length ? new Set() : new Set(readyIds))
  }

  const reviewRows = batch?.items ?? []
  const isExistingBatch = Boolean(batchId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          className={cn(
            "h-10 rounded-xl px-4 font-semibold",
            triggerVariant === "default" && "bg-arena-navy-950 text-white hover:bg-arena-navy-900",
          )}
        >
          {isExistingBatch ? <FileSpreadsheet className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="px-5 pb-4 pt-5 pr-14 text-left sm:px-6 sm:pt-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-700">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-950 sm:text-2xl">
                {isExistingBatch ? "Revisar lote" : "Nova importação"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-5 text-slate-500">
                {isExistingBatch
                  ? "Continue uma revisão já salva e escolha o que deve entrar no catálogo."
                  : "Encontre arenas, valide os dados e escolha o que deve entrar no catálogo."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ImportStepper step={step} isExistingBatch={isExistingBatch} />

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-100 bg-slate-50/70 p-4 sm:p-6">
          {loadingBatch ? (
            <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando lote
            </div>
          ) : batchError ? (
            <div className="grid min-h-72 place-items-center text-center" role="alert">
              <div>
                <Database className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-950">Não foi possível abrir o lote</p>
                <p className="mt-1 max-w-md text-sm text-slate-500">{batchError}</p>
                {batchId && (
                  <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void loadExistingBatch(batchId)}>
                    <RefreshCw className="h-4 w-4" /> Tentar novamente
                  </Button>
                )}
              </div>
            </div>
          ) : step === "source" ? (
            <div className="mx-auto max-w-3xl space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Como você quer encontrar as arenas?</h3>
                <p className="mt-1 text-sm text-slate-500">Escolha um arquivo pronto ou faça uma busca em uma cidade.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={mode === "csv"}
                  onClick={() => selectMode("csv")}
                  className={cn(
                    "rounded-2xl border bg-white p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                    mode === "csv" ? "border-orange-500 ring-1 ring-orange-500" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700"><FileSpreadsheet className="h-4 w-4" /></span>
                  <p className="mt-3 text-sm font-semibold text-slate-950">Enviar arquivo CSV</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Para uma lista pronta, com até 500 arenas.</p>
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "openstreetmap"}
                  onClick={() => selectMode("openstreetmap")}
                  className={cn(
                    "rounded-2xl border bg-white p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                    mode === "openstreetmap" ? "border-orange-500 ring-1 ring-orange-500" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700"><MapPinned className="h-4 w-4" /></span>
                  <p className="mt-3 text-sm font-semibold text-slate-950">Buscar em um município</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Para descobrir locais públicos no OpenStreetMap.</p>
                </button>
              </div>

              {mode === "csv" ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-950">Selecione o arquivo</h4>
                      <p className="mt-1 text-xs text-slate-500">Use o modelo para garantir que todos os campos estejam no formato correto.</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={downloadCsvTemplate} className="self-start">
                      <Download className="h-4 w-4" /> Baixar modelo
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                    <label className="block text-xs font-medium text-slate-700">
                      Origem do arquivo
                      <select
                        value={source}
                        onChange={(event) => setSource(event.target.value as PublicArenaImportSource)}
                        className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      >
                        <option value="csv">CSV próprio</option>
                        <option value="receita_cnpj">Exportado da Receita / CNPJ</option>
                        <option value="brasilapi">Exportado da BrasilAPI</option>
                      </select>
                      <span className="mt-1 block text-[11px] font-normal leading-4 text-slate-400">Todas as origens usam o mesmo modelo CSV.</span>
                    </label>
                    <div>
                      <Label htmlFor="public-arena-csv" className="text-xs font-medium text-slate-700">Arquivo CSV</Label>
                      <Input
                        id="public-arena-csv"
                        type="file"
                        accept=".csv,text/csv"
                        className="mt-2 cursor-pointer"
                        onChange={(event) => void loadCsv(event.target.files?.[0])}
                      />
                      <p className="mt-1 text-[11px] text-slate-400">Máximo de 2 MB e 500 linhas.</p>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  {loadingOptions ? (
                    <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-slate-500">
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando opções
                    </div>
                  ) : optionsError ? (
                    <div className="py-8 text-center">
                      <p className="text-sm font-medium text-slate-900">Não foi possível preparar a busca.</p>
                      <p className="mt-1 text-xs text-slate-500">{optionsError}</p>
                      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void loadOptions()}>Tentar novamente</Button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-xs font-medium text-slate-700">
                          Estado
                          <select
                            value={stateCode ?? ""}
                            onChange={(event) => void loadMunicipalities(Number(event.target.value))}
                            className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                          >
                            <option value="">Selecione o estado</option>
                            {options?.states.map((state) => <option key={state.code} value={state.code}>{state.name} ({state.uf})</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-medium text-slate-700">
                          Município
                          <select
                            value={municipalityId ?? ""}
                            disabled={!stateCode || loadingMunicipalities}
                            onChange={(event) => setMunicipalityId(Number(event.target.value) || null)}
                            className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal outline-none disabled:bg-slate-50 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                          >
                            <option value="">{loadingMunicipalities ? "Carregando municípios…" : "Selecione o município"}</option>
                            {municipalities.map((city) => <option key={city.code} value={city.code}>{city.name}</option>)}
                          </select>
                        </label>
                      </div>

                      <div>
                        <Label className="text-xs font-medium text-slate-700">Esportes que serão associados a todas as arenas encontradas</Label>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {options?.sports.map((sport) => (
                            <label key={sport.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                              <Checkbox
                                checked={sportIds.includes(sport.id)}
                                onCheckedChange={(checked) => setSportIds((current) => checked ? [...new Set([...current, sport.id])] : current.filter((id) => id !== sport.id))}
                              />
                              {sport.name}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[11px] text-slate-400">Dados © OpenStreetMap contributors (ODbL).</p>
                        <Button type="button" onClick={discoverOsm} disabled={pending || !municipalityId || sportIds.length === 0}>
                          {pending ? <LoaderCircle className="animate-spin" /> : <Search />} Buscar arenas
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          ) : step === "preview" ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-slate-500" onClick={() => setStep("source")}>
                    <ArrowLeft className="h-4 w-4" /> Trocar origem
                  </Button>
                  <h3 className="text-lg font-semibold text-slate-950">Confira a prévia</h3>
                  <p className="mt-1 text-sm text-slate-500">{preview.length} arena(s) carregada(s) de {filename}.</p>
                </div>
                <Badge variant="outline" className="self-start border-slate-200 bg-white font-normal text-slate-600">Ainda não enviado</Badge>
              </div>

              <div className="max-h-[380px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                <div className="divide-y divide-slate-100">
                  {preview.map((row) => (
                    <article key={row.rowNumber} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[42px_minmax(0,1fr)_120px_100px] sm:items-center">
                      <span className="text-slate-400">#{row.rowNumber}</span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{row.item.name || "Nome não informado"}</p>
                        <p className="mt-0.5 text-slate-400">Município {row.item.municipality_id ?? "não informado"}</p>
                      </div>
                      <span className="text-slate-500">{row.item.sport_ids.length} esporte(s)</span>
                      <span className={row.errors.length ? "text-rose-700" : "text-emerald-700"}>
                        {row.errors.length ? row.errors.join(" ") : "Pronta para validar"}
                      </span>
                    </article>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <Label htmlFor="import-reason">Motivo para auditoria</Label>
                <Textarea id="import-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-20" maxLength={500} />
                <span className="mt-1 block text-[11px] text-slate-400">Este texto registra por que o lote foi criado e aplicado.</span>
              </div>

              <div className="flex justify-end">
                <Button onClick={stage} disabled={pending || reason.trim().length < 8}>
                  {pending ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Validar lote
                </Button>
              </div>
            </div>
          ) : batch ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  {!isExistingBatch && (
                    <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-slate-500" onClick={() => setStep("preview")} disabled={pending}>
                      <ArrowLeft className="h-4 w-4" /> Voltar à prévia
                    </Button>
                  )}
                  <h3 className="text-lg font-semibold text-slate-950">Revise o lote</h3>
                  <p className="mt-1 text-sm text-slate-500">Lote {batch.id.slice(0, 8)} · selecione apenas as arenas prontas.</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className={STATUS_TONE.ready}>{batch.counts.ready} prontas</Badge>
                  <Badge variant="outline" className={STATUS_TONE.duplicate}>{batch.counts.duplicate} duplicadas</Badge>
                  <Badge variant="outline" className={STATUS_TONE.invalid}>{batch.counts.invalid} inválidas</Badge>
                  <Badge variant="outline" className={STATUS_TONE.applied}>{batch.counts.applied} adicionadas</Badge>
                </div>
              </div>

              {readyIds.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                  <Checkbox
                    aria-label="Selecionar todas as arenas prontas"
                    checked={selected.size === readyIds.length}
                    onCheckedChange={toggleAllReady}
                  />
                  Selecionar todas as {readyIds.length} arenas prontas
                </label>
              )}

              <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                <div className="divide-y divide-slate-100">
                  {reviewRows.map((item) => (
                    <article key={item.id} className="flex items-start gap-3 px-4 py-3">
                      <Checkbox
                        className="mt-1"
                        aria-label={`Selecionar ${item.name}`}
                        disabled={item.status !== "ready"}
                        checked={selected.has(item.id)}
                        onCheckedChange={(checked) => setSelected((current) => {
                          const next = new Set(current)
                          if (checked) next.add(item.id)
                          else next.delete(item.id)
                          return next
                        })}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                          <p className="truncate text-sm font-semibold text-slate-950">{item.name}</p>
                          <Badge variant="outline" className={cn("self-start font-normal text-[10px]", STATUS_TONE[item.status])}>{STATUS_LABEL[item.status]}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{item.address || "Endereço não informado"}</p>
                        {item.errors.length > 0 ? (
                          <p className="mt-1 text-xs text-rose-700">{item.errors.join(" ")}</p>
                        ) : (
                          <p className="mt-1 text-xs text-emerald-700">Sem pendências</p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {readyIds.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <Label htmlFor={`import-apply-reason-${batch.id}`}>Motivo para auditoria desta aplicação</Label>
                  <Textarea
                    id={`import-apply-reason-${batch.id}`}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="mt-2 min-h-20"
                    minLength={8}
                    maxLength={500}
                  />
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">O motivo fica registrado com as arenas adicionadas. Use ao menos 8 caracteres.</p>
                </div>
              )}

              {readyIds.length === 0 ? (
                <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-950">{batch.counts.applied > 0 ? "Lote concluído" : "Nenhuma arena pronta para adicionar"}</p>
                      <p className="mt-1 text-xs leading-5 text-emerald-800">
                        {batch.counts.applied > 0
                          ? "As arenas foram adicionadas ao catálogo e continuam ocultas no app."
                          : "As linhas deste lote foram classificadas como duplicadas ou inválidas."}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="border-emerald-300 bg-white">Fechar</Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-start gap-2 text-sm text-slate-600">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <span>As arenas serão adicionadas <strong className="text-slate-950">ocultas</strong>, sem cliente, assinatura ou quadra.</span>
                  </p>
                  <Button onClick={applySelected} disabled={pending || selected.size === 0 || reason.trim().length < 8}>
                    {pending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
                    Adicionar {selected.size} ao catálogo
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
