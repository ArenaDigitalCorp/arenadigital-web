import Link from "next/link"
import {
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  CircleAlert,
  ShieldCheck,
  UsersRound,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlatformAdminOverview } from "@/modules/platform-admin/types/platform-admin.types"
import {
  COMMERCIAL_STATUS_ORDER,
  MetricCard,
  PageIntro,
  Panel,
  STATUS_META,
  formatMoney,
} from "@/modules/super-admin/components/admin-ui"

export function OverviewSection({ overview }: { overview: PlatformAdminOverview }) {
  const activeCustomers = overview.arenas.filter(
    (arena) => arena.commercialStatus === "cliente_ativo" && arena.planPriceCents > 0,
  )
  const overdue = overview.arenas.filter((arena) => arena.commercialStatus === "inadimplente")
  const publicListings = overview.arenas.filter((arena) => arena.platformKind === "public_listing")
  const pendingClaims = overview.arenaClaimRequests.filter((request) => request.status === "pending")
  const mrr = activeCustomers.reduce((total, arena) => total + arena.planPriceCents, 0)
  const ranked = [...overview.arenas]
    .sort((left, right) => right.bookingsLast30Days - left.bookingsLast30Days)
    .slice(0, 6)
  const maxBookings = Math.max(...ranked.map((arena) => arena.bookingsLast30Days), 1)

  const attentionItems = [
    {
      label: "Solicitações de propriedade",
      value: pendingClaims.length,
      href: "/admin/arenas",
      tone: "text-amber-700 bg-amber-50 border-amber-200",
    },
    {
      label: "Assinaturas em atraso",
      value: overdue.length,
      href: "/admin/finance",
      tone: "text-rose-700 bg-rose-50 border-rose-200",
    },
    {
      label: "Locais sem geolocalização",
      value: overview.arenas.filter((arena) => !arena.hasLocation).length,
      href: "/admin/arenas",
      tone: "text-slate-700 bg-slate-50 border-slate-200",
    },
  ]

  return (
    <>
      <PageIntro
        section="overview"
        signal={(
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Base local atualizada
          </span>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          label="MRR estimado"
          value={formatMoney(mrr)}
          detail={`${activeCustomers.length} cliente${activeCustomers.length === 1 ? "" : "s"} pagante${activeCustomers.length === 1 ? "" : "s"}`}
          icon={BadgeDollarSign}
          tone="orange"
        />
        <MetricCard
          label="Arenas monitoradas"
          value={overview.arenas.length.toLocaleString("pt-BR")}
          detail={`${publicListings.length} no catálogo público`}
          icon={Building2}
          tone="navy"
        />
        <MetricCard
          label="Atletas"
          value={overview.athletes.length.toLocaleString("pt-BR")}
          detail={`${overview.athletes.filter((athlete) => athlete.bookingsLast30Days > 0).length} ativos em 30 dias`}
          icon={UsersRound}
        />
        <MetricCard
          label="Ações pendentes"
          value={attentionItems.reduce((sum, item) => sum + item.value, 0).toLocaleString("pt-BR")}
          detail="Propriedade, cobrança e qualidade do catálogo"
          icon={CircleAlert}
          tone={attentionItems.some((item) => item.value > 0) ? "warning" : "paper"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_.85fr]">
        <Panel
          eyebrow="Pulso da plataforma"
          title="Arenas mais ativas"
          description="Reservas confirmadas nos últimos 30 dias."
          action={(
            <Link href="/admin/engagement" className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 hover:text-orange-900">
              Ver análise <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        >
          <div className="space-y-5 p-5">
            {ranked.map((arena, index) => (
              <div key={arena.id} className="grid grid-cols-[28px_minmax(0,1fr)_48px] items-center gap-3">
                <span className="font-mono text-[11px] text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold">{arena.name}</p>
                    <p className="shrink-0 text-[11px] text-slate-500">{arena.athleteCount} atletas</p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                      style={{ width: `${Math.max((arena.bookingsLast30Days / maxBookings) * 100, 3)}%` }}
                    />
                  </div>
                </div>
                <span className="text-right font-heading text-lg font-black">{arena.bookingsLast30Days}</span>
              </div>
            ))}
            {ranked.length === 0 && <p className="py-6 text-center text-sm text-slate-500">A atividade aparecerá após as primeiras reservas.</p>}
          </div>
        </Panel>

        <Panel eyebrow="Fila de trabalho" title="Precisa da sua atenção" description="Atalhos para decisões administrativas.">
          <div className="space-y-2 p-4">
            {attentionItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn("flex items-center justify-between rounded-xl border px-4 py-3 transition hover:-translate-y-px", item.tone)}
              >
                <span className="text-xs font-bold">{item.label}</span>
                <strong className="font-heading text-xl">{item.value}</strong>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_.65fr]">
        <Panel eyebrow="Composição" title="Relação comercial" description="Classificação atual de toda a base.">
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMMERCIAL_STATUS_ORDER.map((status) => {
              const count = overview.arenas.filter((arena) => arena.commercialStatus === status).length
              return (
                <div key={status} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span className={cn("h-2 w-2 rounded-full", STATUS_META[status].dot)} />
                    {STATUS_META[status].label}
                  </span>
                  <strong>{count}</strong>
                </div>
              )
            })}
          </div>
        </Panel>

        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-arena-navy-950 p-5 text-white">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-500/15 blur-2xl" />
          <ShieldCheck className="relative h-5 w-5 text-emerald-300" />
          <p className="relative mt-5 font-mono text-[9px] font-bold uppercase tracking-[.2em] text-emerald-300">Controle de acesso</p>
          <h2 className="relative mt-1 font-heading text-xl font-black">Admin separado das arenas</h2>
          <p className="relative mt-2 text-xs leading-5 text-slate-400">A conta administrativa governa a plataforma sem assumir silenciosamente os dados de um cliente.</p>
          <Link href="/admin/users" className="relative mt-5 inline-flex items-center gap-1 text-xs font-bold text-orange-300 hover:text-orange-200">
            Revisar usuários <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </>
  )
}
