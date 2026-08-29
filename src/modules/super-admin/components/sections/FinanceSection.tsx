import Link from "next/link"
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Landmark,
  WalletCards,
} from "lucide-react"
import type { PlatformAdminOverview } from "@/modules/platform-admin/types/platform-admin.types"
import {
  EmptyState,
  MetricCard,
  PageIntro,
  Panel,
  StatusBadge,
  formatDate,
  formatMoney,
} from "@/modules/super-admin/components/admin-ui"

export function FinanceSection({ overview }: { overview: PlatformAdminOverview }) {
  const paying = overview.arenas.filter(
    (arena) => arena.commercialStatus === "cliente_ativo" && arena.planPriceCents > 0,
  )
  const overdue = overview.arenas.filter((arena) => arena.commercialStatus === "inadimplente")
  const customers = overview.arenas.filter((arena) => arena.platformKind === "customer")
  const activePaymentAccounts = customers.filter(
    (arena) => arena.pixSplitSettings.hasPaymentAccount && arena.pixSplitSettings.status === "active",
  )
  const paymentReview = customers.filter(
    (arena) => arena.pixSplitSettings.hasPaymentAccount && arena.pixSplitSettings.status !== "active",
  )
  const mrr = paying.reduce((sum, arena) => sum + arena.planPriceCents, 0)
  const annualRunRate = mrr * 12

  const planGroups = new Map<string, { label: string; count: number; revenue: number }>()
  for (const arena of paying) {
    const key = arena.planKey ?? "sem-plano"
    const group = planGroups.get(key) ?? {
      label: arena.planLabel || key,
      count: 0,
      revenue: 0,
    }
    group.count += 1
    group.revenue += arena.planPriceCents
    planGroups.set(key, group)
  }

  return (
    <>
      <PageIntro
        section="finance"
        action={(
          <Link href="/admin/settings" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold hover:border-slate-500">
            <WalletCards className="h-4 w-4" /> Configurar recebimento
          </Link>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="MRR estimado" value={formatMoney(mrr)} detail="Planos ativos, sem acessos internos" icon={CircleDollarSign} tone="orange" />
        <MetricCard label="Receita anualizada" value={formatMoney(annualRunRate)} detail="Projeção simples do MRR atual" icon={Landmark} tone="navy" />
        <MetricCard label="Contas de recebimento" value={activePaymentAccounts.length.toLocaleString("pt-BR")} detail={`${paymentReview.length} aguardando ativação ou revisão`} icon={WalletCards} />
        <MetricCard label="Em atraso" value={overdue.length.toLocaleString("pt-BR")} detail="Assinaturas que exigem acompanhamento" icon={CircleAlert} tone={overdue.length > 0 ? "warning" : "paper"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <Panel eyebrow="Composição" title="Receita por plano" description="Participação dos planos ativos no MRR atual.">
          <div className="space-y-3 p-4">
            {[...planGroups.values()].map((group) => {
              const share = mrr > 0 ? Math.round((group.revenue / mrr) * 100) : 0
              return (
                <div key={group.label} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-sm font-bold">{group.label}</p><p className="mt-1 text-xs text-slate-500">{group.count} arena{group.count === 1 ? "" : "s"} · {share}% do MRR</p></div>
                    <strong className="font-heading text-lg">{formatMoney(group.revenue)}</strong>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${share}%` }} /></div>
                </div>
              )
            })}
            {planGroups.size === 0 && <EmptyState icon={CircleDollarSign} title="Sem receita recorrente" description="As assinaturas ativas aparecerão agrupadas por plano." />}
          </div>
        </Panel>

        <Panel eyebrow="Cobrança" title="Contas em atraso" description="Priorize contato e regularização antes de suspender qualquer operação.">
          {overdue.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Cobrança em dia" description="Nenhuma arena foi classificada como inadimplente." />
          ) : (
            <div className="divide-y divide-slate-100">
              {overdue.map((arena) => (
                <article key={arena.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <Link href={`/admin/arenas/${arena.id}`} className="inline-flex max-w-full items-center gap-1 font-bold hover:text-orange-800">
                      <span className="truncate">{arena.name}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                    <p className="mt-1 truncate text-xs text-slate-500">{arena.ownerEmail} · {arena.planLabel || arena.planKey || "Sem plano"}</p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <StatusBadge status="inadimplente" />
                    <p className="mt-1 text-[11px] text-slate-500">Período: {formatDate(arena.currentPeriodEnd)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel eyebrow="Infraestrutura financeira" title="Prontidão de Pix e split" description="A conta pode existir sem estar aprovada para receber reservas do aplicativo." className="mt-4">
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-800">Ativas</p><p className="mt-2 font-heading text-3xl font-black text-emerald-950">{activePaymentAccounts.length}</p><p className="mt-1 text-[11px] text-emerald-800/70">Conta aprovada e split habilitado</p></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-800">Em análise</p><p className="mt-2 font-heading text-3xl font-black text-amber-950">{paymentReview.length}</p><p className="mt-1 text-[11px] text-amber-800/70">Cadastro iniciado, ainda sem ativação</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-700">Não iniciadas</p><p className="mt-2 font-heading text-3xl font-black text-slate-950">{customers.filter((arena) => !arena.pixSplitSettings.hasPaymentAccount).length}</p><p className="mt-1 text-[11px] text-slate-500">Nenhuma subconta configurada</p></div>
        </div>
      </Panel>
    </>
  )
}
