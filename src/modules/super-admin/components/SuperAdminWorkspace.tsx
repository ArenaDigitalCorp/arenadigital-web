"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Crown,
  KeyRound,
  MapPinned,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react"
import { toast } from "sonner"
import { ArenaPixSplitSettingsCard } from "@/modules/arenas/components/ArenaPixSplitSettingsCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { PublicArenaListingDialog } from "@/modules/platform-admin/components/PublicArenaListingDialog"
import { PublicArenaImportDialog } from "@/modules/platform-admin/components/PublicArenaImportDialog"
import {
  manageInternalEmployeePlanAction,
  managePlatformPrincipalAction,
} from "@/modules/platform-admin/actions/platformAdminActions"
import type {
  PlatformAccessLevel,
  PlatformAdminOverview,
  PlatformArena,
  PlatformArenaKind,
} from "@/modules/platform-admin/types/platform-admin.types"
import type { SuperAdminSection } from "@/modules/super-admin/sections"

const STATUS_META: Record<PlatformArena["commercialStatus"], { label: string; dot: string; badge: string }> = {
  cliente_ativo: { label: "Cliente ativo", dot: "bg-emerald-500", badge: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  inadimplente: { label: "Inadimplente", dot: "bg-rose-500", badge: "border-rose-200 bg-rose-50 text-rose-800" },
  prospect: { label: "Prospect", dot: "bg-amber-500", badge: "border-amber-200 bg-amber-50 text-amber-900" },
  desativada: { label: "Desativada", dot: "bg-slate-400", badge: "border-slate-200 bg-slate-100 text-slate-700" },
  catalogo_publico: { label: "Catálogo público", dot: "bg-sky-500", badge: "border-sky-200 bg-sky-50 text-sky-800" },
  demonstracao: { label: "Demonstração", dot: "bg-violet-500", badge: "border-violet-200 bg-violet-50 text-violet-800" },
}

const COMMERCIAL_STATUS_ORDER: PlatformArena["commercialStatus"][] = [
  "cliente_ativo",
  "inadimplente",
  "prospect",
  "desativada",
  "catalogo_publico",
  "demonstracao",
]

const KIND_META: Record<PlatformArenaKind, { label: string; badge: string }> = {
  customer: { label: "Cliente", badge: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  public_listing: { label: "Catálogo público", badge: "border-sky-200 bg-sky-50 text-sky-800" },
  demo: { label: "Demo / pitch", badge: "border-violet-200 bg-violet-50 text-violet-800" },
}

const SECTION_COPY: Record<SuperAdminSection, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "Visão executiva", title: "A operação inteira, em uma tela.", description: "Clientes, receita, comunidade e sinais de risco atualizados a partir da base da plataforma." },
  arenas: { eyebrow: "Base nacional", title: "Clientes e locais públicos", description: "A mesma malha de locais que sustenta o produto, separando relação comercial, catálogo e disponibilidade no aplicativo." },
  finance: { eyebrow: "Receita recorrente", title: "Financeiro da plataforma", description: "Assinaturas, MRR estimado e contas que exigem acompanhamento comercial." },
  athletes: { eyebrow: "Comunidade", title: "Atletas da plataforma", description: "Planos, origem, vínculos com arenas e frequência recente de cada conta." },
  engagement: { eyebrow: "Saúde da base", title: "Uso e engajamento", description: "Ranking de atividade e alertas precoces de arenas que podem entrar em risco de churn." },
  settings: { eyebrow: "Governança", title: "Configurações globais", description: "Equipe interna, acessos sem cobrança, Pix, split e trilha de auditoria da Arena Digital." },
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100)
}

function date(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

function PageIntro({ section, action }: { section: SuperAdminSection; action?: React.ReactNode }) {
  const copy = SECTION_COPY[section]
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 border-b border-slate-900/10 pb-7 xl:flex-row xl:items-end">
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-orange-700">{copy.eyebrow}</p>
        <h1 className="mt-2 max-w-4xl font-heading text-3xl font-black tracking-tight text-[#07141d] md:text-[42px] md:leading-[1.08]">{copy.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">{copy.description}</p>
      </div>
      {action}
    </div>
  )
}

function MetricCard({ label, value, detail, icon: Icon, tone = "dark" }: { label: string; value: string; detail: string; icon: React.ComponentType<{ className?: string }>; tone?: "dark" | "light" | "orange" }) {
  return (
    <div className={cn(
      "relative min-h-40 overflow-hidden rounded-2xl border p-5",
      tone === "dark" && "border-slate-800 bg-[#07141d] text-white",
      tone === "light" && "border-slate-900/10 bg-white text-slate-950",
      tone === "orange" && "border-orange-400 bg-orange-500 text-slate-950",
    )}>
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border-[22px] border-current opacity-[.05]" />
      <div className="flex items-start justify-between gap-4">
        <p className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.2em]", tone === "dark" ? "text-slate-400" : "text-slate-600")}>{label}</p>
        <Icon className="h-5 w-5 opacity-65" />
      </div>
      <p className="mt-7 font-heading text-4xl font-black tracking-tight">{value}</p>
      <p className={cn("mt-2 text-xs", tone === "dark" ? "text-slate-400" : "text-slate-700")}>{detail}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: PlatformArena["commercialStatus"] }) {
  const meta = STATUS_META[status]
  return <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold", meta.badge)}><span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />{meta.label}</span>
}

function KindBadge({ kind }: { kind: PlatformArenaKind }) {
  const meta = KIND_META[kind]
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold", meta.badge)}>{meta.label}</span>
}

function Overview({ overview }: { overview: PlatformAdminOverview }) {
  const active = overview.arenas.filter((arena) => arena.commercialStatus === "cliente_ativo" && arena.planPriceCents > 0)
  const overdue = overview.arenas.filter((arena) => arena.commercialStatus === "inadimplente")
  const prospects = overview.arenas.filter((arena) => arena.commercialStatus === "prospect")
  const publicListings = overview.arenas.filter((arena) => arena.commercialStatus === "catalogo_publico")
  const mrr = active.reduce((total, arena) => total + arena.planPriceCents, 0)
  const dormant = active.filter((arena) => arena.bookingsLast30Days === 0)
  const ranked = [...overview.arenas].sort((a, b) => b.bookingsLast30Days - a.bookingsLast30Days).slice(0, 6)
  const maxBookings = Math.max(...ranked.map((arena) => arena.bookingsLast30Days), 1)

  return (
    <>
      <PageIntro section="overview" action={<div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Dados operacionais ao vivo</div>} />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard label="MRR estimado" value={money(mrr)} detail={`${active.length} assinatura${active.length === 1 ? "" : "s"} ativa${active.length === 1 ? "" : "s"}`} icon={BadgeDollarSign} tone="orange" />
        <MetricCard label="Arenas no mapa" value={String(overview.arenas.filter((arena) => arena.hasLocation).length)} detail={`${publicListings.length} loca${publicListings.length === 1 ? "l" : "is"} no catálogo · ${prospects.length} prospect${prospects.length === 1 ? "" : "s"}`} icon={MapPinned} tone="dark" />
        <MetricCard label="Atletas" value={overview.athletes.length.toLocaleString("pt-BR")} detail={`${overview.athletes.filter((athlete) => athlete.bookingsLast30Days > 0).length} ativos em 30 dias`} icon={UsersRound} tone="light" />
        <MetricCard label="Atenção" value={String(overdue.length + dormant.length)} detail={`${overdue.length} em atraso · ${dormant.length} sem uso`} icon={CircleAlert} tone="light" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <section className="rounded-2xl border border-slate-900/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Pulso da plataforma</p><h2 className="mt-1 font-heading text-xl font-black">Arenas mais ativas</h2></div>
            <Link href="/admin/engagement" className="text-xs font-bold text-orange-700 hover:text-orange-900">Ver engajamento <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link>
          </div>
          <div className="mt-6 space-y-5">
            {ranked.map((arena, index) => (
              <div key={arena.id} className="grid grid-cols-[28px_minmax(0,1fr)_55px] items-center gap-3">
                <span className="font-mono text-xs text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0"><div className="mb-2 flex items-center justify-between gap-3"><p className="truncate text-sm font-bold">{arena.name}</p><p className="shrink-0 text-xs text-slate-500">{arena.athleteCount} atletas</p></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${Math.max((arena.bookingsLast30Days / maxBookings) * 100, 3)}%` }} /></div></div>
                <span className="text-right font-heading text-lg font-black">{arena.bookingsLast30Days}</span>
              </div>
            ))}
            {ranked.length === 0 && <p className="py-8 text-center text-sm text-slate-500">A atividade aparecerá quando as arenas começarem a registrar reservas.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#07141d] p-6 text-white shadow-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-orange-300">Composição da base</p>
          <h2 className="mt-1 font-heading text-xl font-black">Relação com a plataforma</h2>
          <div className="mt-6 space-y-3">
            {COMMERCIAL_STATUS_ORDER.map((status) => {
              const count = overview.arenas.filter((arena) => arena.commercialStatus === status).length
              return <div key={status} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.035] px-4 py-3"><div className="flex items-center gap-3"><span className={cn("h-2.5 w-2.5 rounded-full", STATUS_META[status].dot)} /><span className="text-sm text-slate-300">{STATUS_META[status].label}</span></div><strong className="font-heading text-xl">{count}</strong></div>
            })}
          </div>
        </section>
      </div>
    </>
  )
}

function Arenas({ overview }: { overview: PlatformAdminOverview }) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | PlatformArena["commercialStatus"]>("all")
  const [kindFilter, setKindFilter] = useState<"all" | PlatformArenaKind>("all")
  const [view, setView] = useState<"list" | "map">("list")
  const arenas = overview.arenas.filter((arena) => {
    const matchesFilter = filter === "all" || arena.commercialStatus === filter
    const matchesKind = kindFilter === "all" || arena.platformKind === kindFilter
    const haystack = `${arena.name} ${arena.ownerName ?? ""} ${arena.ownerEmail} ${arena.cityName ?? ""}`.toLowerCase()
    return matchesFilter && matchesKind && haystack.includes(query.trim().toLowerCase())
  })
  const mappedArenas = arenas.filter((arena) => arena.latitude !== null && arena.longitude !== null)

  return (
    <>
      <PageIntro section="arenas" action={overview.currentAccessLevel === "super_admin" ? <div className="flex flex-wrap gap-2"><PublicArenaImportDialog /><PublicArenaListingDialog /></div> : undefined} />
      <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por arena, responsável ou cidade" className="h-12 border-slate-300 bg-white pl-11" /></div>
        <div className="flex flex-wrap gap-2">
          {(["all", ...COMMERCIAL_STATUS_ORDER] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className={cn("rounded-xl border px-3 py-2 text-xs font-bold transition", filter === value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-500")}>{value === "all" ? "Todas" : STATUS_META[value].label}</button>)}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "customer", "public_listing", "demo"] as const).map((value) => <button key={value} onClick={() => setKindFilter(value)} className={cn("rounded-lg border px-3 py-2 text-xs font-bold transition", kindFilter === value ? "border-orange-500 bg-orange-500 text-slate-950" : "border-slate-300 bg-white text-slate-600 hover:border-slate-500")}>{value === "all" ? "Todos os tipos" : KIND_META[value].label}</button>)}
      </div>
      <div className="mb-4 flex justify-end gap-2">
        <button onClick={() => setView("list")} className={cn("rounded-lg border px-3 py-2 text-xs font-bold", view === "list" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-600")}>Lista</button>
        <button onClick={() => setView("map")} className={cn("rounded-lg border px-3 py-2 text-xs font-bold", view === "map" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-600")}><MapPinned className="mr-1.5 inline h-3.5 w-3.5" />Mapa</button>
      </div>
      {view === "map" && (
        <section className="mb-5 grid overflow-hidden rounded-2xl border border-slate-900/10 bg-[#07141d] text-white shadow-sm lg:grid-cols-[1fr_340px]">
          <div className="relative min-h-[560px] overflow-hidden border-white/10 lg:border-r">
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] [background-size:32px_32px]" />
            <svg viewBox="0 0 420 460" className="absolute left-1/2 top-1/2 h-[88%] -translate-x-1/2 -translate-y-1/2 text-emerald-950/60" aria-hidden="true">
              <path fill="currentColor" stroke="rgba(255,255,255,.18)" strokeWidth="2" d="M113 19 169 12 217 31 254 27 282 49 324 56 351 88 384 105 365 139 375 173 346 197 341 231 314 250 302 292 278 315 267 354 231 381 211 426 181 448 160 414 135 389 126 352 97 324 88 287 58 265 66 226 43 196 56 158 75 136 72 96 94 70Z" />
            </svg>
            {mappedArenas.map((arena) => {
              const left = Math.min(94, Math.max(6, (((arena.longitude ?? -54) + 74) / 40) * 100))
              const top = Math.min(94, Math.max(6, ((5 - (arena.latitude ?? -15)) / 39) * 100))
              return <button key={arena.id} title={`${arena.name} · ${STATUS_META[arena.commercialStatus].label}`} className={cn("absolute z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_5px_rgba(255,255,255,.08)] transition hover:z-20 hover:scale-150", STATUS_META[arena.commercialStatus].dot)} style={{ left: `${left}%`, top: `${top}%` }} />
            })}
            <div className="absolute bottom-5 left-5 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur"><p className="font-heading text-2xl font-black">{mappedArenas.length}</p><p className="text-xs text-slate-400">arenas geolocalizadas no filtro</p></div>
          </div>
          <div className="p-6"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-orange-300">Cobertura</p><h2 className="mt-1 font-heading text-xl font-black">Mapa de arenas do Brasil</h2><p className="mt-2 text-sm leading-6 text-slate-400">Clientes e locais públicos usam a mesma base geográfica, mas preservam relações distintas com a plataforma.</p><div className="mt-6 space-y-3">{COMMERCIAL_STATUS_ORDER.map((status) => <div key={status} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5"><span className="flex items-center gap-2 text-sm text-slate-300"><span className={cn("h-2 w-2 rounded-full", STATUS_META[status].dot)} />{STATUS_META[status].label}</span><strong>{mappedArenas.filter((arena) => arena.commercialStatus === status).length}</strong></div>)}</div><div className="mt-6 rounded-xl border border-amber-300/15 bg-amber-300/5 p-4 text-xs leading-5 text-amber-100">{arenas.length - mappedArenas.length} arena{arenas.length - mappedArenas.length === 1 ? "" : "s"} ainda {arenas.length - mappedArenas.length === 1 ? "precisa" : "precisam"} de coordenadas.</div></div>
        </section>
      )}
      {view === "list" && <section className="overflow-hidden rounded-2xl border border-slate-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-[#07141d] font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400"><tr><th className="px-5 py-4">Arena</th><th className="px-5 py-4">Classificação</th><th className="px-5 py-4">Responsável</th><th className="px-5 py-4">Plano</th><th className="px-5 py-4">Estrutura</th><th className="px-5 py-4">Atividade 30d</th><th className="px-5 py-4" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {arenas.map((arena) => <tr key={arena.id} className="group hover:bg-orange-50/40">
                <td className="px-5 py-4"><div className="flex items-start gap-3"><div className={cn("mt-1 grid h-9 w-9 place-items-center rounded-xl", arena.hasLocation ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400")}><MapPinned className="h-4 w-4" /></div><div><p className="font-bold text-slate-950">{arena.name}</p><p className="mt-1 text-xs text-slate-500">{[arena.cityName, arena.stateCode].filter(Boolean).join(" · ") || "Localização incompleta"}</p></div></div></td>
                <td className="px-5 py-4"><div className="flex flex-wrap gap-2"><StatusBadge status={arena.commercialStatus} /><KindBadge kind={arena.platformKind} />{!arena.appDiscoverable && <Badge variant="outline" className="border-slate-200 text-slate-500">Oculta no app</Badge>}</div></td>
                <td className="px-5 py-4"><p className="font-semibold">{arena.ownerName || "Sem responsável"}</p><p className="mt-1 text-xs text-slate-500">{arena.ownerEmail}</p></td>
                <td className="px-5 py-4"><p className="font-semibold">{arena.planLabel || arena.planKey || "Sem assinatura"}</p><p className="mt-1 text-xs text-slate-500">{arena.subscriptionStatus || "—"}</p></td>
                <td className="px-5 py-4"><p className="font-semibold">{arena.courtCount} quadras</p><p className="mt-1 text-xs text-slate-500">{arena.athleteCount} atletas</p></td>
                <td className="px-5 py-4"><p className="font-heading text-lg font-black">{arena.bookingsLast30Days}</p><p className="text-xs text-slate-500">reservas</p></td>
                <td className="px-5 py-4 text-right"><Link href={`/admin/arenas/${arena.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 hover:text-orange-900">Abrir <ChevronRight className="h-4 w-4" /></Link></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {arenas.length === 0 && <p className="px-6 py-12 text-center text-sm text-slate-500">Nenhuma arena corresponde aos filtros.</p>}
      </section>}
    </>
  )
}

function Finance({ overview }: { overview: PlatformAdminOverview }) {
  const paying = overview.arenas.filter((arena) => arena.commercialStatus === "cliente_ativo" && arena.planPriceCents > 0)
  const overdue = overview.arenas.filter((arena) => arena.commercialStatus === "inadimplente")
  const mrr = paying.reduce((sum, arena) => sum + arena.planPriceCents, 0)
  const planGroups = new Map<string, { label: string; count: number; revenue: number }>()
  for (const arena of paying) {
    const key = arena.planKey ?? "sem-plano"
    const group = planGroups.get(key) ?? { label: arena.planLabel || key, count: 0, revenue: 0 }
    group.count += 1
    group.revenue += arena.planPriceCents
    planGroups.set(key, group)
  }

  return <>
    <PageIntro section="finance" />
    <div className="grid gap-4 md:grid-cols-3"><MetricCard label="MRR estimado" value={money(mrr)} detail="Planos ativos, sem internos" icon={CircleDollarSign} tone="orange" /><MetricCard label="Clientes pagantes" value={String(paying.length)} detail={`${overview.arenas.length ? Math.round((paying.length / overview.arenas.length) * 100) : 0}% da base cadastrada`} icon={CheckCircle2} tone="dark" /><MetricCard label="Em atraso" value={String(overdue.length)} detail="Assinaturas past_due ou unpaid" icon={CircleAlert} tone="light" /></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <section className="rounded-2xl border border-slate-900/10 bg-white p-6"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-slate-500">Composição</p><h2 className="mt-1 font-heading text-xl font-black">Receita por plano</h2><div className="mt-6 space-y-3">{[...planGroups.values()].map((group) => <div key={group.label} className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><div><p className="font-bold">{group.label}</p><p className="text-xs text-slate-500">{group.count} arena{group.count === 1 ? "" : "s"}</p></div><strong className="font-heading text-lg">{money(group.revenue)}</strong></div>)}{planGroups.size === 0 && <p className="text-sm text-slate-500">Nenhuma assinatura ativa encontrada.</p>}</div></section>
      <section className="overflow-hidden rounded-2xl border border-slate-900/10 bg-white"><div className="border-b border-slate-200 px-6 py-5"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-rose-600">Cobrança</p><h2 className="mt-1 font-heading text-xl font-black">Inadimplentes</h2></div>{overdue.map((arena) => <div key={arena.id} className="flex flex-col justify-between gap-3 border-b border-slate-100 px-6 py-4 last:border-0 sm:flex-row sm:items-center"><div><p className="font-bold">{arena.name}</p><p className="text-xs text-slate-500">{arena.ownerEmail} · {arena.planLabel || arena.planKey}</p></div><div className="text-left sm:text-right"><StatusBadge status="inadimplente" /><p className="mt-1 text-xs text-slate-500">Período: {date(arena.currentPeriodEnd)}</p></div></div>)}{overdue.length === 0 && <div className="px-6 py-12 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500" /><p className="mt-3 text-sm font-semibold">Nenhuma arena em atraso.</p></div>}</section>
    </div>
  </>
}

function Athletes({ overview }: { overview: PlatformAdminOverview }) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const athletes = overview.athletes.filter((athlete) => `${athlete.name} ${athlete.email}`.toLowerCase().includes(query.toLowerCase()))
  const selected = overview.athletes.find((athlete) => athlete.id === selectedId)
  const arenaById = new Map(overview.arenas.map((arena) => [arena.id, arena]))

  return <>
    <PageIntro section="athletes" />
    <div className="mb-5 grid gap-4 md:grid-cols-3"><MetricCard label="Atletas cadastrados" value={String(overview.athletes.length)} detail="Contas finais do aplicativo" icon={UsersRound} tone="dark" /><MetricCard label="Plano Plus" value={String(overview.athletes.filter((athlete) => athlete.plan === "plus").length)} detail="Entitlements ativos ou em trial" icon={Crown} tone="orange" /><MetricCard label="Ativos em 30 dias" value={String(overview.athletes.filter((athlete) => athlete.bookingsLast30Days > 0).length)} detail="Com ao menos uma reserva" icon={Activity} tone="light" /></div>
    <div className="relative mb-4"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar atleta por nome ou e-mail" className="h-12 border-slate-300 bg-white pl-11" /></div>
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="overflow-hidden rounded-2xl border border-slate-900/10 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[#07141d] font-mono text-[9px] uppercase tracking-[.18em] text-slate-400"><tr><th className="px-5 py-4">Atleta</th><th className="px-5 py-4">Plano</th><th className="px-5 py-4">Origem</th><th className="px-5 py-4">Arenas</th><th className="px-5 py-4">Reservas 30d</th></tr></thead><tbody className="divide-y divide-slate-100">{athletes.map((athlete) => <tr key={athlete.id} onClick={() => setSelectedId(athlete.id)} className={cn("cursor-pointer hover:bg-orange-50/50", selectedId === athlete.id && "bg-orange-50")}><td className="px-5 py-4"><p className="font-bold">{athlete.name}</p><p className="mt-1 text-xs text-slate-500">{athlete.email}</p></td><td className="px-5 py-4"><Badge className={athlete.plan === "plus" ? "bg-orange-100 text-orange-900" : "bg-slate-100 text-slate-700"}>{athlete.plan === "plus" ? "Plus" : "Free"}</Badge></td><td className="px-5 py-4 text-slate-600">{athlete.origin === "aplicativo" ? "Aplicativo" : "Arena"}</td><td className="px-5 py-4 font-bold">{athlete.linkedArenaIds.length}</td><td className="px-5 py-4 font-heading text-lg font-black">{athlete.bookingsLast30Days}</td></tr>)}</tbody></table></div></section>
      <aside className="h-fit rounded-2xl border border-slate-900/10 bg-white p-6 xl:sticky xl:top-24">{selected ? <><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-orange-800"><UserRound className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate font-heading text-xl font-black">{selected.name}</p><p className="truncate text-xs text-slate-500">{selected.email}</p></div></div><div className="my-5 h-px bg-slate-200" /><dl className="space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Plano do app</dt><dd className="font-bold uppercase">{selected.plan}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Status</dt><dd className="font-bold">{selected.planStatus}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Cadastro</dt><dd className="font-bold">{date(selected.createdAt)}</dd></div><div><dt className="text-slate-500">Arenas vinculadas</dt><dd className="mt-2 space-y-2">{selected.linkedArenaIds.map((id) => <div key={id} className="rounded-lg bg-slate-50 px-3 py-2 font-semibold">{arenaById.get(id)?.name ?? id}</div>)}{selected.linkedArenaIds.length === 0 && <span className="text-slate-400">Nenhuma</span>}</dd></div></dl></> : <div className="py-10 text-center"><UserRound className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-600">Selecione um atleta para ver os detalhes da conta.</p></div>}</aside>
    </div>
  </>
}

function Engagement({ overview }: { overview: PlatformAdminOverview }) {
  const ranked = [...overview.arenas].sort((a, b) => b.bookingsLast30Days - a.bookingsLast30Days)
  const activeClients = overview.arenas.filter((arena) => arena.commercialStatus === "cliente_ativo" && arena.planPriceCents > 0)
  const dormant = activeClients.filter((arena) => arena.bookingsLast30Days === 0)
  const falling = activeClients.filter((arena) => arena.bookingsPrevious30Days > 0 && arena.bookingsLast30Days < arena.bookingsPrevious30Days * 0.6)
  return <><PageIntro section="engagement" /><div className="grid gap-4 md:grid-cols-3"><MetricCard label="Reservas em 30 dias" value={String(overview.arenas.reduce((sum, arena) => sum + arena.bookingsLast30Days, 0))} detail="Movimento de toda a base" icon={CalendarClock} tone="dark" /><MetricCard label="Arenas adormecidas" value={String(dormant.length)} detail="Clientes ativos sem reservas" icon={TrendingDown} tone="light" /><MetricCard label="Queda relevante" value={String(falling.length)} detail="Redução superior a 40%" icon={CircleAlert} tone="orange" /></div><section className="mt-5 overflow-hidden rounded-2xl border border-slate-900/10 bg-white"><div className="border-b border-slate-200 px-6 py-5"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-slate-500">Ranking</p><h2 className="mt-1 font-heading text-xl font-black">Atividade por arena</h2></div><div className="divide-y divide-slate-100">{ranked.map((arena, index) => { const delta = arena.bookingsPrevious30Days === 0 ? (arena.bookingsLast30Days > 0 ? 100 : 0) : Math.round(((arena.bookingsLast30Days - arena.bookingsPrevious30Days) / arena.bookingsPrevious30Days) * 100); return <div key={arena.id} className="grid gap-4 px-6 py-4 md:grid-cols-[50px_1fr_130px_130px] md:items-center"><span className="font-mono text-sm text-slate-400">#{String(index + 1).padStart(2, "0")}</span><div><p className="font-bold">{arena.name}</p><p className="text-xs text-slate-500">{arena.athleteCount} atletas · {arena.courtCount} quadras</p></div><div><p className="font-heading text-xl font-black">{arena.bookingsLast30Days}</p><p className="text-xs text-slate-500">reservas / 30d</p></div><div className={cn("flex items-center gap-1 text-sm font-bold", delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-700" : "text-slate-500")}>{delta > 0 ? <TrendingUp className="h-4 w-4" /> : delta < 0 ? <TrendingDown className="h-4 w-4" /> : null}{delta > 0 ? "+" : ""}{delta}%</div></div>})}</div></section></>
}

function accessLabel(level: PlatformAccessLevel) {
  return level === "super_admin" ? "Super admin" : level === "platform_admin" ? "Admin da plataforma" : "Funcionário"
}

function SettingsView({ overview, initialArenaId }: { overview: PlatformAdminOverview; initialArenaId?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const customerArenas = overview.arenas.filter((arena) => arena.platformKind === "customer")
  const [settingsTab, setSettingsTab] = useState<"access" | "billing" | "audit">(initialArenaId ? "billing" : "access")
  const [userId, setUserId] = useState("")
  const [level, setLevel] = useState<PlatformAccessLevel>("employee")
  const [principalEnabled, setPrincipalEnabled] = useState(true)
  const [principalExpiresAt, setPrincipalExpiresAt] = useState("")
  const [reason, setReason] = useState("")
  const [employeeId, setEmployeeId] = useState(overview.principals.find((item) => item.status === "active")?.userId ?? "")
  const [arenaId, setArenaId] = useState("")
  const [planEnabled, setPlanEnabled] = useState(true)
  const [planReason, setPlanReason] = useState("")
  const [pixArenaId, setPixArenaId] = useState(customerArenas.some((arena) => arena.id === initialArenaId) ? (initialArenaId ?? "") : (customerArenas[0]?.id ?? ""))
  const activePrincipals = overview.principals.filter((item) => item.status === "active")
  const selectedPixArena = customerArenas.find((arena) => arena.id === pixArenaId)
  const eligibleArenas = overview.arenas.filter((arena) => arena.ownerId === employeeId || overview.memberships.some((membership) => membership.userId === employeeId && membership.arenaId === arena.id && ["Ativo", "ativo", "active"].includes(membership.status)))

  function savePrincipal() {
    if (!userId || reason.trim().length < 8) return toast.error("Selecione a conta e informe um motivo com pelo menos 8 caracteres.")
    startTransition(async () => { const result = await managePlatformPrincipalAction({ targetUserId: userId, accessLevel: level, enabled: principalEnabled, reason, expiresAt: principalEnabled && principalExpiresAt ? new Date(principalExpiresAt).toISOString() : null }); if (!result.success) { toast.error(result.error); return }; toast.success(principalEnabled ? "Acesso atualizado e auditado." : "Acesso revogado e auditado."); setReason(""); router.refresh() })
  }
  function saveInternalPlan() {
    if (!employeeId || !arenaId || planReason.trim().length < 8) return toast.error("Selecione funcionário, arena e informe um motivo.")
    startTransition(async () => { const result = await manageInternalEmployeePlanAction({ employeeUserId: employeeId, arenaId, enabled: planEnabled, reason: planReason }); if (!result.success) { toast.error(result.error); return }; toast.success(planEnabled ? "Plano interno concedido." : "Plano interno revogado."); setPlanReason(""); router.refresh() })
  }

  return <><PageIntro section="settings" />
    <div className="mb-5 flex flex-wrap gap-2">
      {([
        ["access", "Acessos"],
        ["billing", "Pix e split"],
        ["audit", "Auditoria"],
      ] as const).map(([value, label]) => (
        <button key={value} onClick={() => setSettingsTab(value)} className={cn("rounded-xl border px-4 py-2 text-sm font-bold", settingsTab === value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-500")}>{label}</button>
      ))}
    </div>
    {settingsTab === "access" && <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-900/10 bg-white p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-heading text-lg font-black">Administradores</p><p className="text-xs text-slate-500">Permissões globais da plataforma</p></div></div><div className="mt-5 space-y-3">{activePrincipals.map((principal) => <div key={principal.userId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{principal.name || principal.email}</p><p className="truncate text-xs text-slate-500">{principal.email}</p></div><Badge variant="outline">{accessLabel(principal.accessLevel)}</Badge></div>)}</div><div className="my-5 h-px bg-slate-200" /><div className="space-y-3"><select value={userId} onChange={(event) => setUserId(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">Selecione uma conta</option>{overview.users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><select value={level} onChange={(event) => setLevel(event.target.value as PlatformAccessLevel)} disabled={!principalEnabled} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100"><option value="employee">Funcionário</option><option value="platform_admin">Admin da plataforma</option><option value="super_admin">Super admin</option></select><select value={principalEnabled ? "enable" : "revoke"} onChange={(event) => setPrincipalEnabled(event.target.value === "enable")} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="enable">Conceder / alterar</option><option value="revoke">Revogar acesso</option></select></div>{principalEnabled && <label className="block text-xs font-semibold text-slate-600">Expiração opcional<Input type="datetime-local" value={principalExpiresAt} onChange={(event) => setPrincipalExpiresAt(event.target.value)} className="mt-1 h-11" /></label>}<Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo obrigatório para auditoria" /><Button onClick={savePrincipal} disabled={pending} className={cn("w-full text-white", principalEnabled ? "bg-slate-950 hover:bg-slate-800" : "bg-rose-700 hover:bg-rose-600")}><KeyRound className="mr-2 h-4 w-4" />{principalEnabled ? "Salvar acesso" : "Revogar acesso"}</Button></div></section>
      <section className="rounded-2xl border border-slate-900/10 bg-white p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100 text-orange-800"><Sparkles className="h-5 w-5" /></div><div><p className="font-heading text-lg font-black">Plano interno</p><p className="text-xs text-slate-500">Acesso de funcionário, sem cobrança</p></div></div><div className="mt-5 space-y-3"><select value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setArenaId("") }} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">Selecione o funcionário</option>{activePrincipals.map((principal) => <option key={principal.userId} value={principal.userId}>{principal.name || principal.email}</option>)}</select><select value={arenaId} onChange={(event) => setArenaId(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">Selecione uma arena vinculada</option>{eligibleArenas.map((arena) => <option key={arena.id} value={arena.id}>{arena.name}</option>)}</select><select value={planEnabled ? "grant" : "revoke"} onChange={(event) => setPlanEnabled(event.target.value === "grant")} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="grant">Conceder plano interno</option><option value="revoke">Revogar plano interno</option></select><Textarea value={planReason} onChange={(event) => setPlanReason(event.target.value)} placeholder="Motivo obrigatório para auditoria" /><Button onClick={saveInternalPlan} disabled={pending} className={cn("w-full", planEnabled ? "bg-orange-500 text-slate-950 hover:bg-orange-400" : "bg-rose-700 text-white hover:bg-rose-600")}><CircleDollarSign className="mr-2 h-4 w-4" />{planEnabled ? "Conceder acesso sem cobrança" : "Revogar plano interno"}</Button></div><div className="mt-5 space-y-2">{overview.internalPlanAssignments.map((assignment) => <button type="button" key={assignment.arenaId} onClick={() => { setEmployeeId(assignment.employeeUserId); setArenaId(assignment.arenaId); setPlanEnabled(false); setPlanReason("Revogação administrativa do acesso interno") }} className="flex w-full items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-900"><span>{overview.arenas.find((arena) => arena.id === assignment.arenaId)?.name ?? assignment.arenaId} · ativo</span><span className="font-bold">Preparar revogação</span></button>)}</div></section>
    </div>}
    {settingsTab === "billing" && <section className="rounded-2xl border border-slate-900/10 bg-white p-6"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-orange-600" /><h2 className="font-heading text-xl font-black">Pix e split por arena</h2></div><p className="mt-1 text-sm text-slate-500">Onboarding da subconta, aprovação cadastral e taxa aplicada às reservas do aplicativo.</p></div>{customerArenas.length > 0 && <label className="text-xs font-semibold text-slate-600">Arena<select value={pixArenaId} onChange={(event) => setPixArenaId(event.target.value)} className="mt-1 block h-11 min-w-64 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950">{customerArenas.map((arena) => <option key={arena.id} value={arena.id}>{arena.name}</option>)}</select></label>}</div>{selectedPixArena ? <ArenaPixSplitSettingsCard key={selectedPixArena.id} arenaId={selectedPixArena.id} arenaName={selectedPixArena.name} initialSettings={selectedPixArena.pixSplitSettings} registration={{ email: selectedPixArena.registrationEmail, phone: selectedPixArena.registrationPhone, document: selectedPixArena.registrationDocument, address: selectedPixArena.registrationAddress, addressNumber: selectedPixArena.registrationAddressNumber, complement: selectedPixArena.registrationComplement, province: selectedPixArena.registrationProvince, postalCode: selectedPixArena.registrationPostalCode }} /> : <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Nenhuma arena cliente disponível para configurar pagamentos.</p>}</section>}
    {settingsTab === "audit" && <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#07141d] text-white"><div className="border-b border-white/10 px-6 py-5"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-emerald-300">Auditoria</p><h2 className="mt-1 font-heading text-xl font-black">Eventos recentes de segurança</h2></div><div className="divide-y divide-white/10">{overview.audit.slice(0, 15).map((event) => <div key={event.id} className="grid gap-2 px-6 py-4 md:grid-cols-[220px_1fr_120px]"><p className="text-sm font-bold text-emerald-200">{event.eventType.replaceAll("_", " ")}</p><p className="text-sm text-slate-300">{event.reason}</p><time className="text-xs text-slate-500 md:text-right">{date(event.createdAt)}</time></div>)}</div></section>}
  </>
}

export function SuperAdminWorkspace({ overview, section, initialArenaId }: { overview: PlatformAdminOverview; section: SuperAdminSection; initialArenaId?: string }) {
  if (section === "arenas") return <Arenas overview={overview} />
  if (section === "finance") return <Finance overview={overview} />
  if (section === "athletes") return <Athletes overview={overview} />
  if (section === "engagement") return <Engagement overview={overview} />
  if (section === "settings") return <SettingsView overview={overview} initialArenaId={initialArenaId} />
  return <Overview overview={overview} />
}
