"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  ClipboardCheck,
  List,
  Map,
  MapPinned,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArenaClaimRequestsCard } from "@/modules/platform-admin/components/ArenaClaimRequestsCard"
import { PublicArenaListingDialog } from "@/modules/platform-admin/components/PublicArenaListingDialog"
import type {
  PlatformAdminOverview,
  PlatformArena,
  PlatformArenaKind,
} from "@/modules/platform-admin/types/platform-admin.types"
import {
  COMMERCIAL_STATUS_ORDER,
  FilterChip,
  KindBadge,
  KIND_META,
  MetricCard,
  PageIntro,
  SearchField,
  StatusBadge,
  STATUS_META,
} from "@/modules/super-admin/components/admin-ui"

type ArenaView = "list" | "map"

function ArenaMap({ arenas }: { arenas: PlatformArena[] }) {
  const mappedArenas = arenas.filter((arena) => arena.latitude !== null && arena.longitude !== null)
  const missingCoordinates = arenas.length - mappedArenas.length

  return (
    <section className="grid overflow-hidden rounded-2xl border border-slate-800 bg-arena-navy-950 text-white shadow-sm lg:grid-cols-[1fr_330px]">
      <div className="relative min-h-[520px] overflow-hidden border-white/10 lg:border-r">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] [background-size:32px_32px]" />
        <svg viewBox="0 0 420 460" className="absolute left-1/2 top-1/2 h-[88%] -translate-x-1/2 -translate-y-1/2 text-emerald-950/60" aria-hidden="true">
          <path fill="currentColor" stroke="rgba(255,255,255,.18)" strokeWidth="2" d="M113 19 169 12 217 31 254 27 282 49 324 56 351 88 384 105 365 139 375 173 346 197 341 231 314 250 302 292 278 315 267 354 231 381 211 426 181 448 160 414 135 389 126 352 97 324 88 287 58 265 66 226 43 196 56 158 75 136 72 96 94 70Z" />
        </svg>
        {mappedArenas.map((arena) => {
          const left = Math.min(94, Math.max(6, (((arena.longitude ?? -54) + 74) / 40) * 100))
          const top = Math.min(94, Math.max(6, ((5 - (arena.latitude ?? -15)) / 39) * 100))
          return (
            <Link
              key={arena.id}
              href={`/admin/arenas/${arena.id}`}
              title={`${arena.name} · ${STATUS_META[arena.commercialStatus].label}`}
              className={cn(
                "absolute z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_5px_rgba(255,255,255,.08)] transition hover:z-20 hover:scale-150 focus:z-20 focus:scale-150 focus:outline-none focus:ring-2 focus:ring-orange-300",
                STATUS_META[arena.commercialStatus].dot,
              )}
              style={{ left: `${left}%`, top: `${top}%` }}
            />
          )
        })}
        <div className="absolute bottom-5 left-5 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
          <p className="font-heading text-2xl font-black">{mappedArenas.length}</p>
          <p className="text-xs text-slate-400">arenas no mapa deste filtro</p>
        </div>
      </div>
      <div className="p-5">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-orange-300">Cobertura geográfica</p>
        <h2 className="mt-1 font-heading text-xl font-black">Brasil em construção</h2>
        <p className="mt-2 text-xs leading-5 text-slate-400">O mapa é uma visão de cobertura, não uma ferramenta cartográfica de precisão.</p>
        <div className="mt-5 space-y-2">
          {COMMERCIAL_STATUS_ORDER.map((status) => (
            <div key={status} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs text-slate-300">
                <span className={cn("h-2 w-2 rounded-full", STATUS_META[status].dot)} />
                {STATUS_META[status].label}
              </span>
              <strong>{mappedArenas.filter((arena) => arena.commercialStatus === status).length}</strong>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/5 p-4 text-xs leading-5 text-amber-100">
          {missingCoordinates} arena{missingCoordinates === 1 ? "" : "s"} ainda {missingCoordinates === 1 ? "precisa" : "precisam"} de coordenadas.
        </div>
      </div>
    </section>
  )
}

export function ArenasSection({ overview }: { overview: PlatformAdminOverview }) {
  const [query, setQuery] = useState("")
  const [commercialStatus, setCommercialStatus] = useState<"all" | PlatformArena["commercialStatus"]>("all")
  const [kind, setKind] = useState<"all" | PlatformArenaKind>("all")
  const [view, setView] = useState<ArenaView>("list")

  const filteredArenas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return overview.arenas.filter((arena) => {
      const matchesStatus = commercialStatus === "all" || arena.commercialStatus === commercialStatus
      const matchesKind = kind === "all" || arena.platformKind === kind
      const searchable = `${arena.name} ${arena.ownerName ?? ""} ${arena.ownerEmail} ${arena.cityName ?? ""} ${arena.stateCode ?? ""}`.toLowerCase()
      return matchesStatus && matchesKind && searchable.includes(normalizedQuery)
    })
  }, [commercialStatus, kind, overview.arenas, query])

  const customers = overview.arenas.filter((arena) => arena.platformKind === "customer")
  const publicListings = overview.arenas.filter((arena) => arena.platformKind === "public_listing")
  const discoverable = overview.arenas.filter((arena) => arena.appDiscoverable)
  const pendingClaims = overview.arenaClaimRequests.filter((request) => request.status === "pending")

  return (
    <>
      <PageIntro
        section="arenas"
        signal={pendingClaims.length > 0 ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
            {pendingClaims.length} reivindicação{pendingClaims.length === 1 ? "" : "ões"} pendente{pendingClaims.length === 1 ? "" : "s"}
          </span>
        ) : undefined}
        action={overview.currentAccessLevel === "super_admin" ? (
          <>
            <Button asChild variant="outline" className="h-10 rounded-xl border-slate-300 bg-white font-bold">
              <Link href="/admin/imports"><Upload className="h-4 w-4" /> Importar em lote</Link>
            </Button>
            <PublicArenaListingDialog />
          </>
        ) : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Clientes" value={customers.length.toLocaleString("pt-BR")} detail="Com tenant e responsável" icon={Building2} tone="navy" />
        <MetricCard label="Catálogo público" value={publicListings.length.toLocaleString("pt-BR")} detail="Locais sem conta de gestão" icon={MapPinned} />
        <MetricCard label="Visíveis no app" value={discoverable.length.toLocaleString("pt-BR")} detail="Publicação habilitada" icon={Map} tone="orange" />
        <MetricCard label="Revisões" value={pendingClaims.length.toLocaleString("pt-BR")} detail="Propriedade aguardando decisão" icon={ClipboardCheck} tone={pendingClaims.length > 0 ? "warning" : "paper"} />
      </div>

      {overview.currentAccessLevel === "super_admin" && overview.arenaClaimRequests.length > 0 && (
        <div className="mt-4">
          <ArenaClaimRequestsCard requests={overview.arenaClaimRequests} />
        </div>
      )}

      <section className="mt-4 rounded-2xl border border-slate-900/10 bg-white p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto] xl:items-center">
          <SearchField value={query} onChange={setQuery} placeholder="Buscar por arena, responsável, cidade ou estado" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[9px] font-bold uppercase tracking-[.18em] text-slate-400">Exibição</span>
            <FilterChip active={view === "list"} onClick={() => setView("list")}><List className="mr-1.5 h-3.5 w-3.5" /> Lista</FilterChip>
            <FilterChip active={view === "map"} onClick={() => setView("map")}><Map className="mr-1.5 h-3.5 w-3.5" /> Mapa</FilterChip>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <FilterChip active={kind === "all"} onClick={() => setKind("all")} accent>Todos os tipos</FilterChip>
          {(["customer", "public_listing", "demo"] as const).map((value) => (
            <FilterChip key={value} active={kind === value} onClick={() => setKind(value)} accent>{KIND_META[value].label}</FilterChip>
          ))}
          <span className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />
          <FilterChip active={commercialStatus === "all"} onClick={() => setCommercialStatus("all")}>Todos os status</FilterChip>
          {COMMERCIAL_STATUS_ORDER.map((status) => (
            <FilterChip key={status} active={commercialStatus === status} onClick={() => setCommercialStatus(status)}>{STATUS_META[status].label}</FilterChip>
          ))}
        </div>
      </section>

      <div className="mt-4">
        {view === "map" ? (
          <ArenaMap arenas={filteredArenas} />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-900/10 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold text-slate-500">{filteredArenas.length} de {overview.arenas.length} arenas</p>
              <Link href="/admin/imports" className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 hover:text-orange-900">
                Ampliar catálogo <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100 sm:hidden">
              {filteredArenas.map((arena) => (
                <Link key={arena.id} href={`/admin/arenas/${arena.id}`} className="block p-4 transition-colors hover:bg-orange-50/50">
                  <div className="flex items-start gap-3">
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", arena.hasLocation ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                      <MapPinned className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-950">{arena.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{[arena.cityName, arena.stateCode].filter(Boolean).join(" · ") || "Localização incompleta"}</p>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <StatusBadge status={arena.commercialStatus} />
                        <KindBadge kind={arena.platformKind} />
                        {!arena.appDiscoverable && <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">Oculta</Badge>}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 p-2.5"><span className="block text-slate-400">Responsável</span><strong className="mt-1 block truncate">{arena.ownerName || "Não definido"}</strong></div>
                        <div className="rounded-xl bg-slate-50 p-2.5"><span className="block text-slate-400">Uso em 30 dias</span><strong className="mt-1 block">{arena.bookingsLast30Days} reservas</strong></div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-arena-navy-950 font-mono text-[9px] uppercase tracking-[.16em] text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Arena</th>
                    <th className="px-5 py-4">Classificação</th>
                    <th className="px-5 py-4">Responsável</th>
                    <th className="px-5 py-4">Plano</th>
                    <th className="px-5 py-4">Estrutura</th>
                    <th className="px-5 py-4">Uso 30d</th>
                    <th className="px-5 py-4"><span className="sr-only">Abrir</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredArenas.map((arena) => (
                    <tr key={arena.id} className="group transition-colors hover:bg-orange-50/50">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl", arena.hasLocation ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                            <MapPinned className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-64 truncate font-bold text-slate-950">{arena.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{[arena.cityName, arena.stateCode].filter(Boolean).join(" · ") || "Localização incompleta"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><div className="flex max-w-64 flex-wrap gap-1.5"><StatusBadge status={arena.commercialStatus} /><KindBadge kind={arena.platformKind} />{!arena.appDiscoverable && <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">Oculta</Badge>}</div></td>
                      <td className="px-5 py-4"><p className="max-w-48 truncate font-semibold">{arena.ownerName || "Sem responsável"}</p><p className="mt-1 max-w-48 truncate text-xs text-slate-500">{arena.ownerEmail}</p></td>
                      <td className="px-5 py-4"><p className="font-semibold">{arena.planLabel || arena.planKey || "Sem assinatura"}</p><p className="mt-1 text-xs text-slate-500">{arena.subscriptionStatus || "—"}</p></td>
                      <td className="px-5 py-4"><p className="font-semibold">{arena.courtCount} quadras</p><p className="mt-1 text-xs text-slate-500">{arena.athleteCount} atletas</p></td>
                      <td className="px-5 py-4"><p className="font-heading text-lg font-black">{arena.bookingsLast30Days}</p><p className="text-xs text-slate-500">reservas</p></td>
                      <td className="px-5 py-4 text-right"><Link href={`/admin/arenas/${arena.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800" aria-label={`Abrir ${arena.name}`}><ChevronRight className="h-4 w-4" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredArenas.length === 0 && <p className="px-6 py-12 text-center text-sm text-slate-500">Nenhuma arena corresponde aos filtros atuais.</p>}
          </section>
        )}
      </div>
    </>
  )
}
