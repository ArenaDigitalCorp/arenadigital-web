"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle2,
  CircleAlert,
  Database,
  FileSpreadsheet,
  History,
  LoaderCircle,
  MapPinned,
  Radar,
  ScanSearch,
  ShieldCheck,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PublicArenaImportDialog } from "@/modules/platform-admin/components/PublicArenaImportDialog"
import { PublicArenaListingDialog } from "@/modules/platform-admin/components/PublicArenaListingDialog"
import { listPublicArenaImportBatchesAction } from "@/modules/platform-admin/actions/platformAdminActions"
import type {
  PlatformAdminOverview,
  PublicArenaImportBatchSummary,
  PublicArenaImportSource,
} from "@/modules/platform-admin/types/platform-admin.types"
import {
  EmptyState,
  MetricCard,
  PageIntro,
  Panel,
  formatDate,
} from "@/modules/super-admin/components/admin-ui"

const SOURCE_COPY: Record<PublicArenaImportSource, string> = {
  csv: "CSV próprio",
  openstreetmap: "OpenStreetMap",
  receita_cnpj: "Receita / CNPJ",
  brasilapi: "BrasilAPI",
}

const WORKFLOW = [
  {
    index: "01",
    title: "Descobrir",
    description: "Buscar locais esportivos por município no OpenStreetMap ou carregar uma fonte estruturada.",
    icon: ScanSearch,
  },
  {
    index: "02",
    title: "Qualificar",
    description: "Completar município, esportes, documento, endereço e coordenadas antes de considerar publicação.",
    icon: Radar,
  },
  {
    index: "03",
    title: "Deduplicar",
    description: "Comparar CNPJ, referência externa e identidade normalizada para não fragmentar a mesma arena.",
    icon: Database,
  },
  {
    index: "04",
    title: "Publicar",
    description: "Aplicar apenas linhas revisadas. O local nasce oculto e só entra no app em uma decisão separada.",
    icon: ShieldCheck,
  },
] as const

export function ImportsSection({ overview }: { overview: PlatformAdminOverview }) {
  const [batches, setBatches] = useState<PublicArenaImportBatchSummary[]>([])
  const [loading, setLoading] = useState(overview.currentAccessLevel === "super_admin")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (overview.currentAccessLevel !== "super_admin") {
      return
    }
    let active = true
    void listPublicArenaImportBatchesAction(12).then((result) => {
      if (!active) return
      if (!result.success) {
        setError(result.error ?? "Não foi possível carregar os lotes recentes.")
      } else {
        setBatches(result.batches)
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [overview.currentAccessLevel])

  const publicListings = overview.arenas.filter((arena) => arena.platformKind === "public_listing")
  const visibleListings = publicListings.filter((arena) => arena.appDiscoverable)
  const incompleteListings = publicListings.filter((arena) => !arena.hasLocation || !arena.cityName)
  const importedCount = batches.reduce((sum, batch) => sum + batch.counts.applied, 0)

  return (
    <>
      <PageIntro
        section="imports"
        signal={(
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-800">
            Descoberta OpenStreetMap disponível
          </span>
        )}
        action={overview.currentAccessLevel === "super_admin" ? (
          <>
            <PublicArenaListingDialog />
            <PublicArenaImportDialog />
          </>
        ) : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Catálogo público" value={publicListings.length.toLocaleString("pt-BR")} detail="Locais sem tenant cliente" icon={MapPinned} tone="navy" />
        <MetricCard label="Publicados no app" value={visibleListings.length.toLocaleString("pt-BR")} detail="Descoberta habilitada" icon={CheckCircle2} tone="orange" />
        <MetricCard label="Importados nos lotes" value={importedCount.toLocaleString("pt-BR")} detail="Histórico recente carregado" icon={Upload} />
        <MetricCard label="Qualidade pendente" value={incompleteListings.length.toLocaleString("pt-BR")} detail="Sem município ou coordenadas" icon={CircleAlert} tone={incompleteListings.length > 0 ? "warning" : "paper"} />
      </div>

      <Panel
        eyebrow="Plano operacional"
        title="Do mapa público ao catálogo confiável"
        description="Automação amplia a cobertura; revisão humana decide o que representa a Arena Digital."
        className="mt-4"
      >
        <div className="grid gap-px bg-slate-200 lg:grid-cols-4">
          {WORKFLOW.map((step) => (
            <article key={step.index} className="relative bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold tracking-[.18em] text-orange-700">{step.index}</span>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700"><step.icon className="h-4 w-4" /></span>
              </div>
              <h3 className="mt-5 font-heading text-lg font-black">{step.title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-500">{step.description}</p>
            </article>
          ))}
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
        <Panel eyebrow="Fontes" title="Como alimentar a base" description="Cada origem passa pelo mesmo staging e pela mesma revisão.">
          <div className="space-y-3 p-4">
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-3"><MapPinned className="h-5 w-5 text-orange-700" /><p className="text-sm font-black">Busca por município</p></div>
              <p className="mt-2 text-xs leading-5 text-orange-950/70">Consulta pontual ao OpenStreetMap para centros esportivos, quadras e estádios. Boa para expansão territorial orientada.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3"><FileSpreadsheet className="h-5 w-5 text-slate-700" /><p className="text-sm font-black">Arquivo estruturado</p></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">CSV próprio ou exportação tratada de bases de CNPJ. Ideal para campanhas e lotes já qualificados.</p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-950">
              <strong className="block">Próxima automação recomendada</strong>
              Agendar descoberta por regiões prioritárias, guardar checkpoint por município e limitar concorrência/rate limit. O pipeline deve continuar criando rascunhos, nunca publicação automática.
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Auditoria" title="Lotes recentes" description="Staging persistido, contagem de duplicatas e aplicação seletiva." action={<History className="h-4 w-4 text-slate-400" />}>
          {loading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando histórico</div>
          ) : error ? (
            <EmptyState icon={CircleAlert} title="Histórico indisponível" description={error} />
          ) : batches.length === 0 ? (
            <EmptyState icon={Database} title="Nenhum lote criado" description="Use “Importar catálogo” para iniciar a primeira busca ou carga revisada." />
          ) : (
            <div className="divide-y divide-slate-100">
              {batches.map((batch) => (
                <article key={batch.id} className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold">{batch.filename || SOURCE_COPY[batch.source]}</p>
                      <Badge variant="outline" className="text-[10px]">{SOURCE_COPY[batch.source]}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-slate-400">{batch.id.slice(0, 8)} · {formatDate(batch.createdAt)}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg bg-emerald-50 px-2 py-2"><strong className="block text-sm text-emerald-800">{batch.counts.applied}</strong><span className="text-[9px] text-emerald-700">aplicadas</span></div>
                    <div className="rounded-lg bg-sky-50 px-2 py-2"><strong className="block text-sm text-sky-800">{batch.counts.ready}</strong><span className="text-[9px] text-sky-700">prontas</span></div>
                    <div className="rounded-lg bg-amber-50 px-2 py-2"><strong className="block text-sm text-amber-800">{batch.counts.duplicate}</strong><span className="text-[9px] text-amber-700">duplicadas</span></div>
                    <div className="rounded-lg bg-rose-50 px-2 py-2"><strong className="block text-sm text-rose-800">{batch.counts.invalid}</strong><span className="text-[9px] text-rose-700">inválidas</span></div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
