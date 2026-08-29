"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CircleDollarSign,
  FileClock,
  KeyRound,
  Settings2,
  Sparkles,
  WalletCards,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ArenaPixSplitSettingsCard } from "@/modules/arenas/components/ArenaPixSplitSettingsCard"
import { manageInternalEmployeePlanAction } from "@/modules/platform-admin/actions/platformAdminActions"
import type { PlatformAdminOverview } from "@/modules/platform-admin/types/platform-admin.types"
import {
  EmptyState,
  PageIntro,
  Panel,
  formatDate,
} from "@/modules/super-admin/components/admin-ui"

type SettingsTab = "payments" | "internal-plans" | "audit"

const TABS: Array<{ value: SettingsTab; label: string; description: string; icon: typeof Settings2 }> = [
  { value: "payments", label: "Pix e split", description: "Contas de recebimento", icon: WalletCards },
  { value: "internal-plans", label: "Planos internos", description: "Acesso sem cobrança", icon: Sparkles },
  { value: "audit", label: "Auditoria", description: "Eventos de segurança", icon: FileClock },
]

export function SettingsSection({ overview, initialArenaId }: { overview: PlatformAdminOverview; initialArenaId?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const customerArenas = overview.arenas.filter((arena) => arena.platformKind === "customer")
  const activePrincipals = overview.principals.filter((principal) => principal.status === "active")
  const [tab, setTab] = useState<SettingsTab>("payments")
  const [paymentArenaId, setPaymentArenaId] = useState(
    customerArenas.some((arena) => arena.id === initialArenaId) ? (initialArenaId ?? "") : (customerArenas[0]?.id ?? ""),
  )
  const [employeeId, setEmployeeId] = useState(activePrincipals[0]?.userId ?? "")
  const [arenaId, setArenaId] = useState("")
  const [planEnabled, setPlanEnabled] = useState(true)
  const [planReason, setPlanReason] = useState("")

  const selectedPaymentArena = customerArenas.find((arena) => arena.id === paymentArenaId)
  const eligibleArenas = overview.arenas.filter(
    (arena) => arena.ownerId === employeeId || overview.memberships.some(
      (membership) => membership.userId === employeeId && membership.arenaId === arena.id && ["Ativo", "ativo", "active"].includes(membership.status),
    ),
  )

  function saveInternalPlan() {
    if (!employeeId || !arenaId || planReason.trim().length < 8) {
      toast.error("Selecione funcionário, arena e informe um motivo com pelo menos 8 caracteres.")
      return
    }
    startTransition(async () => {
      const result = await manageInternalEmployeePlanAction({ employeeUserId: employeeId, arenaId, enabled: planEnabled, reason: planReason })
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível atualizar o plano interno.")
        return
      }
      toast.success(planEnabled ? "Plano interno concedido." : "Plano interno revogado.")
      setPlanReason("")
      router.refresh()
    })
  }

  return (
    <>
      <PageIntro section="settings" />

      <div className="grid gap-2 rounded-2xl border border-slate-900/10 bg-white p-2 md:grid-cols-3">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={tab === item.value}
            onClick={() => setTab(item.value)}
            className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition", tab === item.value ? "border-arena-navy-950 bg-arena-navy-950 text-white shadow-lg" : "border-transparent text-slate-600 hover:bg-slate-50")}
          >
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tab === item.value ? "bg-orange-500 text-arena-navy-950" : "bg-slate-100 text-slate-600")}><item.icon className="h-4 w-4" /></span>
            <span><strong className="block text-sm">{item.label}</strong><small className={cn("mt-0.5 block text-[10px]", tab === item.value ? "text-slate-400" : "text-slate-500")}>{item.description}</small></span>
          </button>
        ))}
      </div>

      {tab === "payments" && (
        <Panel
          eyebrow="Recebimento por arena"
          title="Pix e split"
          description="Onboarding da subconta, aprovação cadastral e taxa aplicada às reservas do aplicativo."
          className="mt-4"
          action={customerArenas.length > 0 ? (
            <label className="text-xs font-bold text-slate-600">Arena<select value={paymentArenaId} onChange={(event) => setPaymentArenaId(event.target.value)} className="mt-1 block h-10 min-w-64 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950">{customerArenas.map((arena) => <option key={arena.id} value={arena.id}>{arena.name}</option>)}</select></label>
          ) : undefined}
        >
          <div className="p-4">
            {selectedPaymentArena ? (
              <ArenaPixSplitSettingsCard
                key={selectedPaymentArena.id}
                arenaId={selectedPaymentArena.id}
                arenaName={selectedPaymentArena.name}
                initialSettings={selectedPaymentArena.pixSplitSettings}
                registration={{
                  email: selectedPaymentArena.registrationEmail,
                  phone: selectedPaymentArena.registrationPhone,
                  document: selectedPaymentArena.registrationDocument,
                  address: selectedPaymentArena.registrationAddress,
                  addressNumber: selectedPaymentArena.registrationAddressNumber,
                  complement: selectedPaymentArena.registrationComplement,
                  province: selectedPaymentArena.registrationProvince,
                  postalCode: selectedPaymentArena.registrationPostalCode,
                }}
              />
            ) : (
              <EmptyState icon={WalletCards} title="Nenhuma arena cliente" description="Locais públicos não recebem configuração financeira até virarem clientes." />
            )}
          </div>
        </Panel>
      )}

      {tab === "internal-plans" && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
          <Panel eyebrow="Acesso operacional" title="Conceder plano interno" description="Uso de funcionário, sem cobrança e com motivo auditável.">
            <div className="space-y-4 p-5">
              <label className="block text-xs font-bold text-slate-600">Funcionário<select value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setArenaId("") }} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal"><option value="">Selecione</option>{activePrincipals.map((principal) => <option key={principal.userId} value={principal.userId}>{principal.name || principal.email}</option>)}</select></label>
              <label className="block text-xs font-bold text-slate-600">Arena vinculada<select value={arenaId} onChange={(event) => setArenaId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal"><option value="">Selecione</option>{eligibleArenas.map((arena) => <option key={arena.id} value={arena.id}>{arena.name}</option>)}</select></label>
              <label className="block text-xs font-bold text-slate-600">Operação<select value={planEnabled ? "grant" : "revoke"} onChange={(event) => setPlanEnabled(event.target.value === "grant")} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal"><option value="grant">Conceder plano interno</option><option value="revoke">Revogar plano interno</option></select></label>
              <Textarea value={planReason} onChange={(event) => setPlanReason(event.target.value)} placeholder="Motivo obrigatório para auditoria" className="min-h-24" />
              <Button onClick={saveInternalPlan} disabled={pending} className={cn("w-full rounded-xl", planEnabled ? "bg-orange-500 text-arena-navy-950 hover:bg-orange-400" : "bg-rose-700 text-white hover:bg-rose-600")}><CircleDollarSign className="h-4 w-4" />{planEnabled ? "Conceder sem cobrança" : "Revogar plano"}</Button>
            </div>
          </Panel>

          <Panel eyebrow="Concessões ativas" title="Planos internos" description="Clique em uma concessão para preparar sua revogação.">
            {overview.internalPlanAssignments.length === 0 ? (
              <EmptyState icon={Sparkles} title="Nenhum plano interno" description="As concessões sem cobrança aparecerão aqui." />
            ) : (
              <div className="divide-y divide-slate-100">
                {overview.internalPlanAssignments.map((assignment) => (
                  <button
                    type="button"
                    key={`${assignment.arenaId}:${assignment.employeeUserId}`}
                    onClick={() => { setEmployeeId(assignment.employeeUserId); setArenaId(assignment.arenaId); setPlanEnabled(false); setPlanReason("Revogação administrativa do acesso interno") }}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-orange-50/50"
                  >
                    <div className="min-w-0"><p className="truncate text-sm font-bold">{overview.arenas.find((arena) => arena.id === assignment.arenaId)?.name ?? assignment.arenaId}</p><p className="mt-1 truncate text-xs text-slate-500">{overview.users.find((user) => user.id === assignment.employeeUserId)?.email ?? assignment.employeeUserId}</p></div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800"><KeyRound className="h-3 w-3" /> Ativo</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === "audit" && (
        <Panel eyebrow="Segurança" title="Eventos recentes" description="Alterações administrativas com ator, razão e data." className="mt-4" dark>
          {overview.audit.length === 0 ? (
            <EmptyState icon={FileClock} title="Sem eventos recentes" description="A trilha de auditoria aparecerá após ações administrativas." />
          ) : (
            <div className="divide-y divide-white/10">
              {overview.audit.slice(0, 30).map((event) => (
                <article key={event.id} className="grid gap-2 px-5 py-4 md:grid-cols-[210px_minmax(0,1fr)_120px] md:items-center">
                  <p className="text-xs font-bold text-emerald-200">{event.eventType.replaceAll("_", " ")}</p>
                  <p className="text-xs leading-5 text-slate-300">{event.reason}</p>
                  <time className="text-[10px] text-slate-500 md:text-right">{formatDate(event.createdAt)}</time>
                </article>
              ))}
            </div>
          )}
        </Panel>
      )}
    </>
  )
}
