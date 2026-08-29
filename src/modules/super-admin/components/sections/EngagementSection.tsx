import Link from "next/link"
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  CircleAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlatformAdminOverview } from "@/modules/platform-admin/types/platform-admin.types"
import {
  EmptyState,
  MetricCard,
  PageIntro,
  Panel,
} from "@/modules/super-admin/components/admin-ui"

function engagementDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

export function EngagementSection({ overview }: { overview: PlatformAdminOverview }) {
  const ranked = [...overview.arenas].sort((left, right) => right.bookingsLast30Days - left.bookingsLast30Days)
  const activeClients = overview.arenas.filter(
    (arena) => arena.commercialStatus === "cliente_ativo" && arena.planPriceCents > 0,
  )
  const dormant = activeClients.filter((arena) => arena.bookingsLast30Days === 0)
  const falling = activeClients.filter(
    (arena) => arena.bookingsPrevious30Days > 0 && arena.bookingsLast30Days < arena.bookingsPrevious30Days * 0.6,
  )
  const growing = activeClients.filter(
    (arena) => arena.bookingsLast30Days > arena.bookingsPrevious30Days * 1.2,
  )
  const totalBookings = overview.arenas.reduce((sum, arena) => sum + arena.bookingsLast30Days, 0)

  return (
    <>
      <PageIntro section="engagement" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Reservas em 30 dias" value={totalBookings.toLocaleString("pt-BR")} detail="Movimento confirmado da base" icon={CalendarClock} tone="navy" />
        <MetricCard label="Em crescimento" value={growing.length.toLocaleString("pt-BR")} detail="Alta superior a 20%" icon={TrendingUp} tone="orange" />
        <MetricCard label="Adormecidas" value={dormant.length.toLocaleString("pt-BR")} detail="Clientes ativos sem reservas" icon={Activity} />
        <MetricCard label="Queda relevante" value={falling.length.toLocaleString("pt-BR")} detail="Redução superior a 40%" icon={CircleAlert} tone={falling.length > 0 ? "warning" : "paper"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <Panel eyebrow="Ranking" title="Atividade por arena" description="Comparativo dos últimos 30 dias com o período anterior.">
          {ranked.length === 0 ? (
            <EmptyState icon={Activity} title="Ainda sem atividade" description="O ranking aparecerá quando houver reservas confirmadas." />
          ) : (
            <div className="divide-y divide-slate-100">
              {ranked.map((arena, index) => {
                const delta = engagementDelta(arena.bookingsLast30Days, arena.bookingsPrevious30Days)
                return (
                  <article key={arena.id} className="grid gap-3 px-5 py-4 md:grid-cols-[42px_minmax(0,1fr)_110px_100px] md:items-center">
                    <span className="font-mono text-xs text-slate-400">#{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <Link href={`/admin/arenas/${arena.id}`} className="inline-flex max-w-full items-center gap-1 font-bold hover:text-orange-800"><span className="truncate">{arena.name}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></Link>
                      <p className="mt-1 text-xs text-slate-500">{arena.athleteCount} atletas · {arena.courtCount} quadras</p>
                    </div>
                    <div><p className="font-heading text-xl font-black">{arena.bookingsLast30Days}</p><p className="text-[10px] text-slate-500">reservas / 30d</p></div>
                    <div className={cn("inline-flex items-center gap-1 text-sm font-bold", delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-700" : "text-slate-500")}>
                      {delta > 0 ? <TrendingUp className="h-4 w-4" /> : delta < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                      {delta > 0 ? "+" : ""}{delta}%
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel eyebrow="Acompanhamento" title="Sinais de churn" description="A queda de uso é sinal para contato, não bloqueio automático.">
          <div className="space-y-3 p-4">
            {[...new Map([...dormant, ...falling].map((arena) => [arena.id, arena])).values()].map((arena) => {
              const isDormant = arena.bookingsLast30Days === 0
              return (
                <Link key={arena.id} href={`/admin/arenas/${arena.id}`} className={cn("block rounded-xl border p-4 transition hover:-translate-y-px", isDormant ? "border-slate-200 bg-slate-50" : "border-rose-200 bg-rose-50")}>
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{arena.name}</p><p className="mt-1 text-xs text-slate-500">{isDormant ? "Sem reservas no período" : "Queda acentuada de atividade"}</p></div>{isDormant ? <Activity className="h-4 w-4 text-slate-500" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}</div>
                </Link>
              )
            })}
            {dormant.length === 0 && falling.length === 0 && <EmptyState icon={TrendingUp} title="Base saudável" description="Nenhum cliente ativo está adormecido ou em queda relevante." />}
          </div>
        </Panel>
      </div>
    </>
  )
}
