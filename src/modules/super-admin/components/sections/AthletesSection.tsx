"use client"

import { useMemo, useState } from "react"
import { Activity, Crown, UserRound, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { PlatformAdminOverview } from "@/modules/platform-admin/types/platform-admin.types"
import {
  EmptyState,
  FilterChip,
  MetricCard,
  PageIntro,
  SearchField,
  formatDate,
} from "@/modules/super-admin/components/admin-ui"

export function AthletesSection({ overview }: { overview: PlatformAdminOverview }) {
  const [query, setQuery] = useState("")
  const [plan, setPlan] = useState<"all" | "free" | "plus">("all")
  const [selectedId, setSelectedId] = useState<string | null>(overview.athletes[0]?.id ?? null)

  const athletes = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return overview.athletes.filter((athlete) => {
      const matchesPlan = plan === "all" || athlete.plan === plan
      return matchesPlan && `${athlete.name} ${athlete.email}`.toLowerCase().includes(normalized)
    })
  }, [overview.athletes, plan, query])

  const selected = overview.athletes.find((athlete) => athlete.id === selectedId) ?? null
  const arenaById = new Map(overview.arenas.map((arena) => [arena.id, arena]))
  const activeAthletes = overview.athletes.filter((athlete) => athlete.bookingsLast30Days > 0)

  return (
    <>
      <PageIntro section="athletes" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Atletas cadastrados" value={overview.athletes.length.toLocaleString("pt-BR")} detail="Contas finais do aplicativo" icon={UsersRound} tone="navy" />
        <MetricCard label="Plano Plus" value={overview.athletes.filter((athlete) => athlete.plan === "plus").length.toLocaleString("pt-BR")} detail="Entitlements ativos ou em trial" icon={Crown} tone="orange" />
        <MetricCard label="Ativos em 30 dias" value={activeAthletes.length.toLocaleString("pt-BR")} detail="Com ao menos uma reserva" icon={Activity} />
        <MetricCard label="Taxa de atividade" value={`${overview.athletes.length ? Math.round((activeAthletes.length / overview.athletes.length) * 100) : 0}%`} detail="Ativos sobre a base cadastrada" icon={Activity} />
      </div>

      <section className="mt-4 rounded-2xl border border-slate-900/10 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
          <SearchField value={query} onChange={setQuery} placeholder="Buscar atleta por nome ou e-mail" />
          <div className="flex flex-wrap gap-2">
            <FilterChip active={plan === "all"} onClick={() => setPlan("all")}>Todos os planos</FilterChip>
            <FilterChip active={plan === "free"} onClick={() => setPlan("free")}>Free</FilterChip>
            <FilterChip active={plan === "plus"} onClick={() => setPlan("plus")} accent>Plus</FilterChip>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-900/10 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><p className="text-xs font-semibold text-slate-500">{athletes.length} atleta{athletes.length === 1 ? "" : "s"}</p><p className="font-mono text-[9px] uppercase tracking-[.16em] text-slate-400">Selecione uma linha</p></div>
          <div className="divide-y divide-slate-100 sm:hidden">
            {athletes.map((athlete) => (
              <button
                type="button"
                key={athlete.id}
                onClick={() => setSelectedId(athlete.id)}
                className={cn("block w-full p-4 text-left transition-colors hover:bg-orange-50/50", selectedId === athlete.id && "bg-orange-50")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-bold">{athlete.name}</p><p className="mt-1 truncate text-xs text-slate-500">{athlete.email}</p></div>
                  <Badge className={athlete.plan === "plus" ? "bg-orange-100 text-orange-900 hover:bg-orange-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>{athlete.plan === "plus" ? "Plus" : "Free"}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><span className="block text-slate-400">Origem</span><strong className="mt-1 block">{athlete.origin === "aplicativo" ? "Aplicativo" : "Arena"}</strong></div>
                  <div><span className="block text-slate-400">Arenas</span><strong className="mt-1 block">{athlete.linkedArenaIds.length}</strong></div>
                  <div><span className="block text-slate-400">Reservas 30d</span><strong className="mt-1 block">{athlete.bookingsLast30Days}</strong></div>
                </div>
              </button>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-arena-navy-950 font-mono text-[9px] uppercase tracking-[.16em] text-slate-400"><tr><th className="px-5 py-4">Atleta</th><th className="px-5 py-4">Plano</th><th className="px-5 py-4">Origem</th><th className="px-5 py-4">Arenas</th><th className="px-5 py-4">Reservas 30d</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {athletes.map((athlete) => (
                  <tr
                    key={athlete.id}
                    onClick={() => setSelectedId(athlete.id)}
                    className={cn("cursor-pointer transition-colors hover:bg-orange-50/50", selectedId === athlete.id && "bg-orange-50")}
                  >
                    <td className="px-5 py-4"><p className="font-bold">{athlete.name}</p><p className="mt-1 text-xs text-slate-500">{athlete.email}</p></td>
                    <td className="px-5 py-4"><Badge className={athlete.plan === "plus" ? "bg-orange-100 text-orange-900 hover:bg-orange-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>{athlete.plan === "plus" ? "Plus" : "Free"}</Badge></td>
                    <td className="px-5 py-4 text-slate-600">{athlete.origin === "aplicativo" ? "Aplicativo" : "Arena"}</td>
                    <td className="px-5 py-4 font-bold">{athlete.linkedArenaIds.length}</td>
                    <td className="px-5 py-4"><span className="font-heading text-lg font-black">{athlete.bookingsLast30Days}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {athletes.length === 0 && <EmptyState icon={UsersRound} title="Nenhum atleta encontrado" description="Ajuste a busca ou o filtro de plano." />}
        </section>

        <aside className="h-fit overflow-hidden rounded-2xl border border-slate-900/10 bg-white xl:sticky xl:top-24">
          {selected ? (
            <>
              <div className="border-b border-slate-200 bg-arena-navy-950 p-5 text-white">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-500 text-arena-navy-950"><UserRound className="h-5 w-5" /></span>
                <p className="mt-4 truncate font-heading text-xl font-black">{selected.name}</p>
                <p className="mt-1 truncate text-xs text-slate-400">{selected.email}</p>
              </div>
              <dl className="space-y-4 p-5 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Plano do app</dt><dd className="font-bold uppercase">{selected.plan}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Status</dt><dd className="font-bold">{selected.planStatus}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Cadastro</dt><dd className="font-bold">{formatDate(selected.createdAt)}</dd></div>
                <div className="border-t border-slate-100 pt-4"><dt className="text-xs font-semibold text-slate-500">Arenas vinculadas</dt><dd className="mt-2 space-y-2">{selected.linkedArenaIds.map((id) => <div key={id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold">{arenaById.get(id)?.name ?? id}</div>)}{selected.linkedArenaIds.length === 0 && <span className="text-xs text-slate-400">Nenhuma arena vinculada.</span>}</dd></div>
              </dl>
            </>
          ) : (
            <EmptyState icon={UserRound} title="Selecione um atleta" description="Os detalhes da conta aparecerão aqui." />
          )}
        </aside>
      </div>
    </>
  )
}
