import Link from "next/link"
import { notFound } from "next/navigation"
import { Activity, ArrowLeft, CalendarClock, CircleDollarSign, LayoutGrid, MapPinned, Settings2, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getPlatformAdminOverview } from "@/modules/platform-admin/actions/platformAdminActions"
import { PlatformArenaProfileCard } from "@/modules/platform-admin/components/PlatformArenaProfileCard"

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

export default async function AdminArenaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const overview = await getPlatformAdminOverview()
  const arena = overview.arenas.find((item) => item.id === id)
  if (!arena) notFound()

  const statusLabels = {
    cliente_ativo: "Cliente ativo",
    inadimplente: "Inadimplente",
    prospect: "Prospect",
    desativada: "Desativada",
  } as const
  const kindLabels = {
    customer: "Cliente",
    public_listing: "Catálogo público",
    demo: "Demo / pitch",
  } as const

  const cards = [
    { label: "Plano", value: arena.planLabel || arena.planKey || "Sem assinatura", detail: arena.subscriptionStatus || "—", icon: CircleDollarSign },
    { label: "Mensalidade", value: money(arena.planPriceCents), detail: arena.planPriceCents > 0 ? "MRR contratado" : "Sem cobrança", icon: CircleDollarSign },
    { label: "Comunidade", value: String(arena.athleteCount), detail: "atletas vinculados", icon: UsersRound },
    { label: "Uso recente", value: String(arena.bookingsLast30Days), detail: "reservas confirmadas / 30d", icon: Activity },
  ]

  return (
    <div className="space-y-6">
      <Link href="/admin/arenas" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" /> Voltar para arenas
      </Link>

      <header className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#07141d] px-6 py-8 text-white md:px-8">
        <div className="absolute inset-y-0 right-0 w-1/2 opacity-30 [background-image:radial-gradient(circle_at_center,rgba(249,116,21,.5),transparent_60%)]" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-orange-500 text-slate-950">{statusLabels[arena.commercialStatus]}</Badge>
              <Badge variant="outline" className="border-white/20 text-slate-300">{kindLabels[arena.platformKind]}</Badge>
              <Badge variant="outline" className="border-white/20 text-slate-300">{arena.appDiscoverable ? "Visível no app" : "Oculta no app"}</Badge>
              <Badge variant="outline" className="border-white/20 text-slate-300">Operação: {arena.status ?? "—"}</Badge>
            </div>
            <h1 className="font-heading text-3xl font-black md:text-5xl">{arena.name}</h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-400"><MapPinned className="h-4 w-4" />{[arena.cityName, arena.stateCode].filter(Boolean).join(" · ") || "Endereço geográfico pendente"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/arenas/${arena.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400"><LayoutGrid className="h-4 w-4" />Abrir espaços</Link>
            <Link href={`/admin/settings?arena=${arena.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 hover:bg-orange-100"><Settings2 className="h-4 w-4" />Configurar Pix e split</Link>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => <div key={item.label} className="rounded-2xl border border-slate-900/10 bg-white p-5"><div className="flex items-center justify-between"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-slate-500">{item.label}</p><item.icon className="h-4 w-4 text-orange-600" /></div><p className="mt-5 font-heading text-2xl font-black">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></div>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <PlatformArenaProfileCard arena={arena} />
        <section className="rounded-2xl border border-slate-900/10 bg-white p-6"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-slate-500">Responsável</p><h2 className="mt-1 font-heading text-xl font-black">Conta proprietária</h2><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt className="text-slate-500">Nome</dt><dd className="font-bold">{arena.ownerName || "Não definido"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">E-mail</dt><dd className="font-bold">{arena.ownerEmail}</dd></div></dl></section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-900/10 bg-white p-6"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-slate-500">Estrutura</p><h2 className="mt-1 font-heading text-xl font-black">Operação cadastrada</h2><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-4"><p className="font-heading text-2xl font-black">{arena.courtCount}</p><p className="text-xs text-slate-500">quadras ativas</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="font-heading text-2xl font-black">{arena.hasLocation ? "Sim" : "Não"}</p><p className="text-xs text-slate-500">no mapa</p></div></div><p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><CalendarClock className="h-4 w-4" /> Comparativo anterior: {arena.bookingsPrevious30Days} reservas</p></section>
      </div>
    </div>
  )
}
