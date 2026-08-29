"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, ShieldCheck, UserCheck, UserRound, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { managePlatformPrincipalAction } from "@/modules/platform-admin/actions/platformAdminActions"
import type {
  PlatformAccessLevel,
  PlatformAdminOverview,
} from "@/modules/platform-admin/types/platform-admin.types"
import {
  EmptyState,
  FilterChip,
  MetricCard,
  PageIntro,
  SearchField,
  formatDate,
} from "@/modules/super-admin/components/admin-ui"

function accessLabel(level: PlatformAccessLevel) {
  if (level === "super_admin") return "Super admin"
  if (level === "platform_admin") return "Admin da plataforma"
  return "Funcionário"
}

export function UsersSection({ overview }: { overview: PlatformAdminOverview }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [identityFilter, setIdentityFilter] = useState<"all" | "linked" | "missing">("all")
  const [selectedId, setSelectedId] = useState<string>(overview.users[0]?.id ?? "")
  const [accessLevel, setAccessLevel] = useState<PlatformAccessLevel>("employee")
  const [accessEnabled, setAccessEnabled] = useState(true)
  const [expiresAt, setExpiresAt] = useState("")
  const [reason, setReason] = useState("")

  const principalByUserId = useMemo(
    () => new Map(overview.principals.map((principal) => [principal.userId, principal])),
    [overview.principals],
  )

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return overview.users.filter((user) => {
      const matchesIdentity = identityFilter === "all" || (identityFilter === "linked" ? user.hasAuthIdentity : !user.hasAuthIdentity)
      return matchesIdentity && `${user.name ?? ""} ${user.email} ${user.role ?? ""}`.toLowerCase().includes(normalized)
    })
  }, [identityFilter, overview.users, query])

  const selectedUser = overview.users.find((user) => user.id === selectedId) ?? null
  const selectedPrincipal = selectedUser ? principalByUserId.get(selectedUser.id) : null
  const activePrincipals = overview.principals.filter((principal) => principal.status === "active")
  const managers = overview.users.filter((user) => user.role !== "atleta")
  const missingIdentity = overview.users.filter((user) => !user.hasAuthIdentity)

  function selectUser(userId: string) {
    const principal = principalByUserId.get(userId)
    setSelectedId(userId)
    setAccessLevel(principal?.accessLevel ?? "employee")
    setAccessEnabled(principal?.status !== "revoked")
    setExpiresAt(principal?.expiresAt ? principal.expiresAt.slice(0, 16) : "")
    setReason("")
  }

  function saveAccess() {
    if (!selectedUser || reason.trim().length < 8) {
      toast.error("Selecione uma conta e informe um motivo com pelo menos 8 caracteres.")
      return
    }
    startTransition(async () => {
      const result = await managePlatformPrincipalAction({
        targetUserId: selectedUser.id,
        accessLevel,
        enabled: accessEnabled,
        reason,
        expiresAt: accessEnabled && expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível atualizar o acesso.")
        return
      }
      toast.success(accessEnabled ? "Acesso administrativo atualizado." : "Acesso administrativo revogado.")
      setReason("")
      router.refresh()
    })
  }

  return (
    <>
      <PageIntro
        section="users"
        signal={missingIdentity.length > 0 ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">{missingIdentity.length} identidade{missingIdentity.length === 1 ? "" : "s"} pendente{missingIdentity.length === 1 ? "" : "s"}</span>
        ) : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Contas cadastradas" value={overview.users.length.toLocaleString("pt-BR")} detail="Perfis web e mobile" icon={UsersRound} tone="navy" />
        <MetricCard label="Gestores e equipe" value={managers.length.toLocaleString("pt-BR")} detail="Contas que não são atletas" icon={UserCheck} />
        <MetricCard label="Equipe da plataforma" value={activePrincipals.length.toLocaleString("pt-BR")} detail="Acessos administrativos ativos" icon={ShieldCheck} tone="orange" />
        <MetricCard label="Sem auth vinculada" value={missingIdentity.length.toLocaleString("pt-BR")} detail="Perfis legados ou incompletos" icon={KeyRound} tone={missingIdentity.length > 0 ? "warning" : "paper"} />
      </div>

      <section className="mt-4 rounded-2xl border border-slate-900/10 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
          <SearchField value={query} onChange={setQuery} placeholder="Buscar por nome, e-mail ou papel" />
          <div className="flex flex-wrap gap-2">
            <FilterChip active={identityFilter === "all"} onClick={() => setIdentityFilter("all")}>Todas</FilterChip>
            <FilterChip active={identityFilter === "linked"} onClick={() => setIdentityFilter("linked")}>Auth vinculada</FilterChip>
            <FilterChip active={identityFilter === "missing"} onClick={() => setIdentityFilter("missing")} accent>Sem auth</FilterChip>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-2xl border border-slate-900/10 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><p className="text-xs font-semibold text-slate-500">{filteredUsers.length} conta{filteredUsers.length === 1 ? "" : "s"}</p><p className="font-mono text-[9px] uppercase tracking-[.16em] text-slate-400">Identidade central</p></div>
          <div className="divide-y divide-slate-100 sm:hidden">
            {filteredUsers.map((user) => {
              const principal = principalByUserId.get(user.id)
              return (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => selectUser(user.id)}
                  className={cn("block w-full p-4 text-left transition-colors hover:bg-orange-50/50", selectedId === user.id && "bg-orange-50")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-bold">{user.name || "Nome não informado"}</p><p className="mt-1 truncate text-xs text-slate-500">{user.email}</p></div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{user.role || "sem role"}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <span className={cn("inline-flex items-center gap-1.5 font-bold", user.hasAuthIdentity ? "text-emerald-700" : "text-amber-700")}><span className={cn("h-1.5 w-1.5 rounded-full", user.hasAuthIdentity ? "bg-emerald-500" : "bg-amber-500")} />{user.hasAuthIdentity ? "Auth vinculada" : "Auth pendente"}</span>
                    <span className="text-slate-500">Acesso: <strong className="text-slate-700">{principal?.status === "active" ? accessLabel(principal.accessLevel) : "Nenhum"}</strong></span>
                    <span className="text-slate-400">{formatDate(user.createdAt)}</span>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-arena-navy-950 font-mono text-[9px] uppercase tracking-[.16em] text-slate-400"><tr><th className="px-5 py-4">Conta</th><th className="px-5 py-4">Papel</th><th className="px-5 py-4">Identidade</th><th className="px-5 py-4">Acesso global</th><th className="px-5 py-4">Cadastro</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const principal = principalByUserId.get(user.id)
                  return (
                    <tr key={user.id} onClick={() => selectUser(user.id)} className={cn("cursor-pointer transition-colors hover:bg-orange-50/50", selectedId === user.id && "bg-orange-50")}>
                      <td className="px-5 py-4"><p className="font-bold">{user.name || "Nome não informado"}</p><p className="mt-1 text-xs text-slate-500">{user.email}</p></td>
                      <td className="px-5 py-4"><Badge variant="outline" className="text-[10px]">{user.role || "sem role"}</Badge></td>
                      <td className="px-5 py-4"><span className={cn("inline-flex items-center gap-1.5 text-xs font-bold", user.hasAuthIdentity ? "text-emerald-700" : "text-amber-700")}><span className={cn("h-1.5 w-1.5 rounded-full", user.hasAuthIdentity ? "bg-emerald-500" : "bg-amber-500")} />{user.hasAuthIdentity ? "Vinculada" : "Pendente"}</span></td>
                      <td className="px-5 py-4"><span className="text-xs font-semibold text-slate-600">{principal?.status === "active" ? accessLabel(principal.accessLevel) : "Nenhum"}</span></td>
                      <td className="px-5 py-4 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && <EmptyState icon={UsersRound} title="Nenhuma conta encontrada" description="Ajuste o termo de busca ou o filtro de identidade." />}
        </section>

        <aside className="h-fit overflow-hidden rounded-2xl border border-slate-900/10 bg-white xl:sticky xl:top-24">
          {selectedUser ? (
            <>
              <div className="border-b border-slate-200 bg-arena-navy-950 p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-500 text-arena-navy-950"><UserRound className="h-5 w-5" /></span>
                  {selectedPrincipal?.status === "active" && <Badge className="bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/15">{accessLabel(selectedPrincipal.accessLevel)}</Badge>}
                </div>
                <p className="mt-4 truncate font-heading text-xl font-black">{selectedUser.name || selectedUser.email}</p>
                <p className="mt-1 truncate text-xs text-slate-400">{selectedUser.email}</p>
              </div>

              {overview.currentAccessLevel === "super_admin" ? (
                <div className="space-y-4 p-5">
                  <div><p className="text-sm font-black">Acesso à plataforma</p><p className="mt-1 text-xs leading-5 text-slate-500">Não concede acesso a nenhuma arena de cliente.</p></div>
                  <label className="block text-xs font-bold text-slate-600">Nível<select value={accessLevel} onChange={(event) => setAccessLevel(event.target.value as PlatformAccessLevel)} disabled={!accessEnabled} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal disabled:bg-slate-100"><option value="employee">Funcionário</option><option value="platform_admin">Admin da plataforma</option><option value="super_admin">Super admin</option></select></label>
                  <label className="block text-xs font-bold text-slate-600">Operação<select value={accessEnabled ? "enable" : "revoke"} onChange={(event) => setAccessEnabled(event.target.value === "enable")} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal"><option value="enable">Conceder ou alterar</option><option value="revoke">Revogar acesso</option></select></label>
                  {accessEnabled && <label className="block text-xs font-bold text-slate-600">Expiração opcional<Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-2 h-11 rounded-xl" /></label>}
                  <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo obrigatório para auditoria" className="min-h-24" />
                  <Button onClick={saveAccess} disabled={pending} className={cn("w-full rounded-xl text-white", accessEnabled ? "bg-arena-navy-950 hover:bg-arena-navy-800" : "bg-rose-700 hover:bg-rose-600")}><KeyRound className="h-4 w-4" />{accessEnabled ? "Salvar acesso" : "Revogar acesso"}</Button>
                </div>
              ) : (
                <div className="p-5 text-xs leading-5 text-slate-500">Somente um super admin pode alterar acessos globais.</div>
              )}
            </>
          ) : (
            <EmptyState icon={UserRound} title="Selecione uma conta" description="Identidade e acesso aparecerão aqui." />
          )}
        </aside>
      </div>
    </>
  )
}
