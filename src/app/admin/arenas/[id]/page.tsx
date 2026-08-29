import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  MapPinned,
  Settings2,
  UserRound,
  UsersRound,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getPlatformAdminOverview } from "@/modules/platform-admin/actions/platformAdminActions"
import { PlatformArenaProfileCard } from "@/modules/platform-admin/components/PlatformArenaProfileCard"
import { PublicArenaCustomerClaimCard } from "@/modules/platform-admin/components/PublicArenaCustomerClaimCard"
import {
  MetricCard,
  Panel,
  StatusBadge,
  formatMoney,
} from "@/modules/super-admin/components/admin-ui"

const KIND_LABELS = {
  customer: "Cliente",
  public_listing: "Catálogo público",
  demo: "Demo / pitch",
} as const

export default async function AdminArenaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const overview = await getPlatformAdminOverview()
  const arena = overview.arenas.find((item) => item.id === id)
  if (!arena) notFound()

  return (
    <div className="space-y-4">
      <Link href="/admin/arenas" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-slate-500 hover:text-slate-950">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para arenas
      </Link>

      <header className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-arena-navy-950 px-5 py-7 text-white sm:px-7">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-50 [background-image:radial-gradient(circle_at_center,rgba(249,116,21,.42),transparent_62%)]" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={arena.commercialStatus} />
              <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-300">{KIND_LABELS[arena.platformKind]}</Badge>
              <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-300">{arena.appDiscoverable ? "Visível no app" : "Oculta no app"}</Badge>
            </div>
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-500 text-arena-navy-950"><MapPinned className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-orange-300">Perfil da arena</p>
                <h1 className="mt-1 truncate font-heading text-3xl font-black tracking-tight sm:text-[42px] sm:leading-none">{arena.name}</h1>
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">{[arena.cityName, arena.stateCode].filter(Boolean).join(" · ") || "Endereço geográfico pendente"}</p>
              </div>
            </div>
          </div>
          {arena.platformKind === "customer" && (
            <Link href={`/admin/settings?arena=${arena.id}`} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-arena-navy-950 transition hover:bg-orange-100">
              <Settings2 className="h-4 w-4" /> Configurar Pix e split
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Plano" value={arena.planLabel || arena.planKey || "—"} detail={arena.subscriptionStatus || "Sem assinatura"} icon={CircleDollarSign} tone="navy" />
        <MetricCard label="Mensalidade" value={formatMoney(arena.planPriceCents)} detail={arena.planPriceCents > 0 ? "MRR contratado" : "Sem cobrança"} icon={CircleDollarSign} tone="orange" />
        <MetricCard label="Comunidade" value={arena.athleteCount.toLocaleString("pt-BR")} detail="Atletas vinculados" icon={UsersRound} />
        <MetricCard label="Uso recente" value={arena.bookingsLast30Days.toLocaleString("pt-BR")} detail="Reservas confirmadas / 30d" icon={Activity} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PlatformArenaProfileCard arena={arena} />
        <Panel eyebrow="Responsável" title="Conta proprietária" description="A identidade do cliente é distinta do acesso administrativo da plataforma.">
          <dl className="space-y-4 p-5 text-sm">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100 text-orange-800"><UserRound className="h-4 w-4" /></span><div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Nome</dt><dd className="truncate font-bold">{arena.ownerName || "Não definido"}</dd></div></div>
            <div className="border-t border-slate-100 pt-4"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">E-mail</dt><dd className="mt-1 break-all font-bold">{arena.ownerEmail}</dd></div>
          </dl>
        </Panel>
      </div>

      {arena.platformKind === "public_listing" && arena.ownerId === null && <PublicArenaCustomerClaimCard arena={arena} />}

      <Panel eyebrow="Estrutura" title="Operação cadastrada" description="Sinais mínimos disponíveis para esta arena.">
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-heading text-2xl font-black">{arena.courtCount}</p><p className="mt-1 text-xs text-slate-500">quadras ativas</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-heading text-2xl font-black">{arena.hasLocation ? "Sim" : "Não"}</p><p className="mt-1 text-xs text-slate-500">geolocalização</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-heading text-2xl font-black">{arena.bookingsPrevious30Days}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" /> reservas no período anterior</p></div>
        </div>
      </Panel>
    </div>
  )
}
