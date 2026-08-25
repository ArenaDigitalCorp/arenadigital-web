"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Database,
  FileCheck2,
  LoaderCircle,
  ShieldCheck,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PublicArenaImportDialog } from "@/modules/platform-admin/components/PublicArenaImportDialog"
import { PublicArenaImportCampaigns } from "@/modules/platform-admin/components/PublicArenaImportCampaigns"
import { listPublicArenaImportBatchesAction } from "@/modules/platform-admin/actions/platformAdminActions"
import type {
  PlatformAdminOverview,
  PublicArenaImportBatch,
  PublicArenaImportBatchSummary,
  PublicArenaImportSource,
} from "@/modules/platform-admin/types/platform-admin.types"
import {
  EmptyState,
  PageIntro,
  formatDate,
} from "@/modules/super-admin/components/admin-ui"

const SOURCE_COPY: Record<PublicArenaImportSource, string> = {
  csv: "Arquivo CSV",
  openstreetmap: "OpenStreetMap",
  receita_cnpj: "Arquivo Receita / CNPJ",
  brasilapi: "Arquivo BrasilAPI",
}

const BATCH_HISTORY_LIMIT = 100
const INITIAL_VISIBLE_BATCHES = 12

const IMPORT_STEPS = [
  {
    title: "Escolha a origem",
    description: "Envie um CSV ou busque locais esportivos em um município.",
    icon: Upload,
  },
  {
    title: "Revise o lote",
    description: "Confira as arenas prontas, duplicadas e com dados inválidos.",
    icon: FileCheck2,
  },
  {
    title: "Adicione ao catálogo",
    description: "Selecione apenas o que deve entrar. Tudo começa oculto no app.",
    icon: ShieldCheck,
  },
] as const

function batchSummary(batch: PublicArenaImportBatch): PublicArenaImportBatchSummary {
  return {
    id: batch.id,
    operationId: batch.operationId,
    source: batch.source,
    filename: batch.filename,
    status: batch.status,
    counts: batch.counts,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  }
}

function BatchCounts({ batch }: { batch: PublicArenaImportBatchSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      <span><strong className="text-slate-900">{batch.counts.ready}</strong> para revisar</span>
      <span><strong className="text-amber-700">{batch.counts.duplicate}</strong> duplicadas</span>
      <span><strong className="text-rose-700">{batch.counts.invalid}</strong> inválidas</span>
      <span><strong className="text-emerald-700">{batch.counts.applied}</strong> adicionadas</span>
    </div>
  )
}

export function ImportsSection({ overview }: { overview: PlatformAdminOverview }) {
  const [batches, setBatches] = useState<PublicArenaImportBatchSummary[]>([])
  const [loading, setLoading] = useState(overview.currentAccessLevel === "super_admin")
  const [error, setError] = useState<string | null>(null)
  const [visibleBatchCount, setVisibleBatchCount] = useState(INITIAL_VISIBLE_BATCHES)

  const loadBatches = useCallback(async () => {
    if (overview.currentAccessLevel !== "super_admin") return

    try {
      const result = await listPublicArenaImportBatchesAction(BATCH_HISTORY_LIMIT)
      if (!result.success) {
        setError(result.error ?? "Não foi possível carregar os lotes recentes.")
      } else {
        setBatches(result.batches)
        setError(null)
      }
    } catch {
      setError("Não foi possível carregar os lotes recentes.")
    } finally {
      setLoading(false)
    }
  }, [overview.currentAccessLevel])

  useEffect(() => {
    if (overview.currentAccessLevel !== "super_admin") return

    let active = true
    void listPublicArenaImportBatchesAction(BATCH_HISTORY_LIMIT).then((result) => {
      if (!active) return
      if (!result.success) {
        setError(result.error ?? "Não foi possível carregar os lotes recentes.")
      } else {
        setBatches(result.batches)
        setError(null)
      }
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setError("Não foi possível carregar os lotes recentes.")
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [overview.currentAccessLevel])

  const publicListings = overview.arenas.filter((arena) => arena.platformKind === "public_listing")
  const visibleListings = publicListings.filter((arena) => arena.appDiscoverable)
  const incompleteListings = publicListings.filter((arena) => !arena.hasLocation || !arena.cityName)
  const reviewCount = useMemo(
    () => batches.reduce((sum, batch) => sum + batch.counts.ready, 0),
    [batches],
  )
  const orderedBatches = useMemo(
    () => [...batches].sort((left, right) => Number(right.counts.ready > 0) - Number(left.counts.ready > 0)),
    [batches],
  )
  const visibleBatches = orderedBatches.slice(0, visibleBatchCount)

  function refreshBatch(updatedBatch: PublicArenaImportBatch) {
    const updatedSummary = batchSummary(updatedBatch)
    setBatches((current) => [
      updatedSummary,
      ...current.filter((batch) => batch.id !== updatedSummary.id),
    ].slice(0, BATCH_HISTORY_LIMIT))
  }

  function retryBatches() {
    setError(null)
    setLoading(true)
    void loadBatches()
  }

  return (
    <>
      <PageIntro
        section="imports"
        action={overview.currentAccessLevel === "super_admin" ? (
          <PublicArenaImportDialog onBatchChange={refreshBatch} />
        ) : undefined}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500">No catálogo público</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{publicListings.length.toLocaleString("pt-BR")}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Visíveis no app</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{visibleListings.length.toLocaleString("pt-BR")}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Precisam de localização</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{incompleteListings.length.toLocaleString("pt-BR")}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 border-t border-emerald-100 bg-emerald-50/70 px-5 py-3 text-sm text-emerald-950">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <p><strong>Importar não publica.</strong> As arenas entram ocultas e sem cliente, assinatura ou quadra.</p>
        </div>
      </section>

      {overview.currentAccessLevel === "super_admin" && (
        <Tabs defaultValue="batches" className="mt-6 gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Operação de importação</h2>
              <p className="mt-1 text-sm text-slate-500">Revise lotes existentes ou acompanhe buscas em vários municípios.</p>
            </div>
            <TabsList className="h-10 w-full rounded-xl bg-slate-200/70 p-1 sm:w-auto">
              <TabsTrigger value="batches" className="rounded-lg px-4 text-xs">
                Lotes
                {reviewCount > 0 && <Badge className="ml-1 h-5 min-w-5 bg-orange-600 px-1.5 text-[10px] text-white">{reviewCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="rounded-lg px-4 text-xs">Campanhas</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="batches">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-semibold text-slate-950">Lotes recentes</h3>
                <p className="mt-1 text-xs text-slate-500">Abra qualquer lote para continuar a revisão de onde parou.</p>
              </div>

              {error && batches.length > 0 && (
                <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between" role="alert">
                  <span className="flex items-center gap-2">
                    <CircleAlert className="h-4 w-4 shrink-0 text-amber-700" />
                    {error} Os lotes abaixo podem estar desatualizados.
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={retryBatches}>Tentar novamente</Button>
                </div>
              )}

              {loading ? (
                <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando lotes
                </div>
              ) : error && batches.length === 0 ? (
                <EmptyState
                  icon={CircleAlert}
                  title="Lotes indisponíveis"
                  description={error}
                  action={(
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={retryBatches}
                    >
                      Tentar novamente
                    </Button>
                  )}
                />
              ) : batches.length === 0 ? (
                <EmptyState icon={Database} title="Nenhum lote criado" description="Comece em “Nova importação” para enviar um CSV ou buscar arenas em um município." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {visibleBatches.map((batch) => (
                    <article key={batch.id} className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-950">{batch.filename || SOURCE_COPY[batch.source]}</p>
                          <Badge variant="outline" className="font-normal text-[10px] text-slate-600">{SOURCE_COPY[batch.source]}</Badge>
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-400">{formatDate(batch.createdAt)} · lote {batch.id.slice(0, 8)}</p>
                        <div className="mt-2"><BatchCounts batch={batch} /></div>
                      </div>
                      <PublicArenaImportDialog
                        batchId={batch.id}
                        onBatchChange={refreshBatch}
                        triggerLabel={batch.counts.ready > 0 ? "Revisar lote" : "Ver lote"}
                        triggerVariant={batch.counts.ready > 0 ? "default" : "outline"}
                      />
                    </article>
                  ))}
                  {visibleBatchCount < orderedBatches.length && (
                    <div className="flex justify-center px-5 py-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleBatchCount((current) => Math.min(current + INITIAL_VISIBLE_BATCHES, orderedBatches.length))}
                      >
                        Mostrar mais lotes
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="campaigns">
            <PublicArenaImportCampaigns onBatchesChange={loadBatches} />
          </TabsContent>
        </Tabs>
      )}

      <details className="group mt-5 rounded-2xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset">
          Como funciona a importação?
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-5 border-t border-slate-100 px-5 py-5 md:grid-cols-3">
          {IMPORT_STEPS.map((step, index) => (
            <div key={step.title} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                <step.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-950">{index + 1}. {step.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
              </div>
            </div>
          ))}
          <p className="md:col-span-3 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            A publicação no app continua sendo uma decisão separada na tela da arena.
          </p>
        </div>
      </details>
    </>
  )
}
