"use client"

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  BadgeCheck,
  Building2,
  ChevronRight,
  CircleDollarSign,
  KeyRound,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  manageInternalEmployeePlanAction,
  managePlatformPrincipalAction,
} from '@/modules/platform-admin/actions/platformAdminActions'
import type {
  PlatformAccessLevel,
  PlatformAdminOverview,
} from '@/modules/platform-admin/types/platform-admin.types'

type Props = {
  overview: PlatformAdminOverview
  surface?: 'platform' | 'super-admin'
}

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring'

function formatDate(value: string | null) {
  if (!value) return 'Sem expiração'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function accessLabel(level: PlatformAccessLevel) {
  if (level === 'super_admin') return 'Superadmin'
  if (level === 'platform_admin') return 'Admin da plataforma'
  return 'Funcionário'
}

function eventLabel(event: string) {
  const labels: Record<string, string> = {
    platform_principal_bootstrapped: 'Admin migrado',
    platform_principal_granted: 'Acesso concedido',
    platform_principal_changed: 'Acesso alterado',
    platform_principal_revoked: 'Acesso revogado',
    internal_employee_plan_granted: 'Plano interno concedido',
    internal_employee_plan_revoked: 'Plano interno revogado',
  }
  return labels[event] ?? event
}

export function PlatformAdminConsole({ overview, surface = 'platform' }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')

  const [principalUserId, setPrincipalUserId] = useState('')
  const [principalLevel, setPrincipalLevel] = useState<PlatformAccessLevel>('employee')
  const [principalEnabled, setPrincipalEnabled] = useState(true)
  const [principalReason, setPrincipalReason] = useState('')
  const [principalExpiresAt, setPrincipalExpiresAt] = useState('')

  const activePrincipals = overview.principals.filter((principal) => principal.status === 'active')
  const employees = activePrincipals

  const [planEmployeeId, setPlanEmployeeId] = useState(employees[0]?.userId ?? '')
  const [planArenaId, setPlanArenaId] = useState('')
  const [planEnabled, setPlanEnabled] = useState(true)
  const [planReason, setPlanReason] = useState('')

  const principalByUser = useMemo(
    () => new Map(overview.principals.map((principal) => [principal.userId, principal])),
    [overview.principals],
  )

  const userById = useMemo(
    () => new Map(overview.users.map((user) => [user.id, user])),
    [overview.users],
  )

  const arenaById = useMemo(
    () => new Map(overview.arenas.map((arena) => [arena.id, arena])),
    [overview.arenas],
  )

  const isSuperAdminSurface = surface === 'super-admin'

  const linkedArenaIds = useMemo(() => {
    if (!planEmployeeId) return new Set<string>()
    const ids = new Set(
      overview.arenas
        .filter((arena) => arena.ownerId === planEmployeeId)
        .map((arena) => arena.id),
    )
    for (const membership of overview.memberships) {
      if (
        membership.userId === planEmployeeId &&
        ['Ativo', 'ativo', 'active'].includes(membership.status)
      ) {
        ids.add(membership.arenaId)
      }
    }
    return ids
  }, [overview.arenas, overview.memberships, planEmployeeId])

  const eligibleArenas = overview.arenas.filter((arena) => linkedArenaIds.has(arena.id))

  const filteredArenas = overview.arenas.filter((arena) => {
    const value = `${arena.name} ${arena.ownerName ?? ''} ${arena.ownerEmail}`.toLowerCase()
    return value.includes(search.trim().toLowerCase())
  })

  function submitPrincipal() {
    if (!principalUserId || principalReason.trim().length < 8) {
      toast.error('Selecione a conta e informe um motivo com pelo menos 8 caracteres.')
      return
    }

    startTransition(async () => {
      const result = await managePlatformPrincipalAction({
        targetUserId: principalUserId,
        accessLevel: principalLevel,
        enabled: principalEnabled,
        reason: principalReason,
        expiresAt:
          principalEnabled && principalExpiresAt
            ? new Date(principalExpiresAt).toISOString()
            : null,
      })
      if (!result.success) {
        toast.error(result.error ?? 'Não foi possível atualizar a equipe.')
        return
      }
      toast.success(principalEnabled ? 'Acesso da plataforma atualizado.' : 'Acesso revogado.')
      setPrincipalReason('')
      router.refresh()
    })
  }

  function submitInternalPlan() {
    if (!planEmployeeId || !planArenaId || planReason.trim().length < 8) {
      toast.error('Selecione funcionário e arena e informe um motivo com pelo menos 8 caracteres.')
      return
    }

    startTransition(async () => {
      const result = await manageInternalEmployeePlanAction({
        employeeUserId: planEmployeeId,
        arenaId: planArenaId,
        enabled: planEnabled,
        reason: planReason,
      })
      if (!result.success) {
        toast.error(result.error ?? 'Não foi possível atualizar o plano interno.')
        return
      }
      toast.success(planEnabled ? 'Plano interno concedido sem cobrança.' : 'Plano interno revogado.')
      setPlanReason('')
      router.refresh()
    })
  }

  function preparePlanRevocation(arenaId: string, employeeUserId: string) {
    setPlanEmployeeId(employeeUserId)
    setPlanArenaId(arenaId)
    setPlanEnabled(false)
    setPlanReason('Revogação administrativa do acesso interno')
    document.getElementById('internal-plan-control')?.scrollIntoView({ behavior: 'smooth' })
  }

  const metrics = [
    { label: 'Arenas monitoradas', value: overview.arenas.length, icon: Building2 },
    { label: 'Contas cadastradas', value: overview.users.length, icon: UsersRound },
    { label: 'Equipe da plataforma', value: activePrincipals.length, icon: ShieldCheck },
    { label: 'Planos internos', value: overview.internalPlanAssignments.length, icon: KeyRound },
  ]

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
      <header className="relative overflow-hidden rounded-2xl border border-slate-700 bg-arena-navy-800 px-6 py-7 text-white shadow-xl md:px-8">
        <div className="absolute inset-y-0 right-0 w-2/5 opacity-20 [background-image:repeating-linear-gradient(135deg,transparent,transparent_18px,rgba(255,255,255,.15)_18px,rgba(255,255,255,.15)_19px)]" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              {isSuperAdminSurface ? 'Super Admin Arena Digital · acesso máximo' : 'Central Arena Digital · acesso restrito'}
            </div>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
              {isSuperAdminSurface ? 'Super Admin' : 'Controle da plataforma'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
              {isSuperAdminSurface
                ? 'Área exclusiva para governança da equipe Arena Digital, permissões globais, Pix, split e auditoria.'
                : 'Administração global de arenas, contas, equipe interna e acessos sem cobrança — com cada operação registrada.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-emerald-200 hover:bg-emerald-400/10">
              <BadgeCheck className="mr-1.5 h-4 w-4" />
              {overview.currentAccessLevel === 'super_admin' ? 'Superadmin' : 'Admin da plataforma'}
            </Badge>
            <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/dashboard/admin/mobile-content">
                Conteúdo do app <ChevronRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{metric.label}</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-arena-navy-800">{metric.value}</p>
              </div>
              <div className="rounded-lg bg-arena-navy-800 p-2.5 text-emerald-300">
                <metric.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className={isSuperAdminSurface ? "grid gap-5 xl:grid-cols-2" : "grid gap-5"}>
        {isSuperAdminSurface && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-950 p-2 text-emerald-300"><ShieldCheck className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Equipe Arena Digital</h2>
                <p className="text-sm text-slate-500">Privilégios globais, separados dos papéis de cada arena.</p>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-6">
            {overview.currentAccessLevel !== 'super_admin' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Sua conta pode consultar esta área, mas apenas um superadmin altera a equipe.
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Conta
                <select
                  className={SELECT_CLASS}
                  value={principalUserId}
                  disabled={overview.currentAccessLevel !== 'super_admin'}
                  onChange={(event) => {
                    const id = event.target.value
                    const current = principalByUser.get(id)
                    setPrincipalUserId(id)
                    if (current) setPrincipalLevel(current.accessLevel)
                  }}
                >
                  <option value="">Selecione uma conta</option>
                  {overview.users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name || user.email} · {user.email}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Nível de acesso
                <select
                  className={SELECT_CLASS}
                  value={principalLevel}
                  disabled={overview.currentAccessLevel !== 'super_admin'}
                  onChange={(event) => setPrincipalLevel(event.target.value as PlatformAccessLevel)}
                >
                  <option value="employee">Funcionário</option>
                  <option value="platform_admin">Admin da plataforma</option>
                  <option value="super_admin">Superadmin</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Operação
                <select
                  className={SELECT_CLASS}
                  value={principalEnabled ? 'enable' : 'revoke'}
                  disabled={overview.currentAccessLevel !== 'super_admin'}
                  onChange={(event) => setPrincipalEnabled(event.target.value === 'enable')}
                >
                  <option value="enable">Conceder ou atualizar</option>
                  <option value="revoke">Revogar acesso</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Expiração opcional
                <Input
                  type="datetime-local"
                  value={principalExpiresAt}
                  disabled={!principalEnabled || overview.currentAccessLevel !== 'super_admin'}
                  onChange={(event) => setPrincipalExpiresAt(event.target.value)}
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Motivo auditável
              <Textarea
                value={principalReason}
                disabled={overview.currentAccessLevel !== 'super_admin'}
                onChange={(event) => setPrincipalReason(event.target.value)}
                placeholder="Ex.: admissão da pessoa no time de suporte Arena Digital"
                maxLength={500}
              />
            </label>
            <Button
              type="button"
              disabled={isPending || overview.currentAccessLevel !== 'super_admin'}
              onClick={submitPrincipal}
              className="bg-slate-950 text-white hover:bg-slate-800"
            >
              {isPending ? 'Registrando…' : 'Registrar alteração de acesso'}
            </Button>

            <div className="divide-y divide-slate-100 border-t border-slate-200 pt-2">
              {overview.principals.map((principal) => (
                <div key={principal.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">{principal.name || principal.email}</p>
                    <p className="text-xs text-slate-500">{principal.email} · {formatDate(principal.expiresAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{accessLabel(principal.accessLevel)}</Badge>
                    <Badge className={principal.status === 'active' ? 'bg-emerald-600' : 'bg-slate-400'}>
                      {principal.status === 'active' ? 'Ativo' : 'Revogado'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        <div id="internal-plan-control" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500 p-2 text-slate-950"><KeyRound className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Plano interno sem cobrança</h2>
                <p className="text-sm text-slate-500">Somente para funcionário explícito e arena vinculada.</p>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Funcionário
                <select
                  className={SELECT_CLASS}
                  value={planEmployeeId}
                  onChange={(event) => {
                    setPlanEmployeeId(event.target.value)
                    setPlanArenaId('')
                  }}
                >
                  <option value="">Selecione</option>
                  {employees.map((employee) => (
                    <option key={employee.userId} value={employee.userId}>
                      {employee.name || employee.email} · {accessLabel(employee.accessLevel)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Arena vinculada
                <select className={SELECT_CLASS} value={planArenaId} onChange={(event) => setPlanArenaId(event.target.value)}>
                  <option value="">Selecione</option>
                  {eligibleArenas.map((arena) => (
                    <option key={arena.id} value={arena.id}>{arena.name} · {arena.ownerEmail}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2">
                Operação
                <select className={SELECT_CLASS} value={planEnabled ? 'enable' : 'revoke'} onChange={(event) => setPlanEnabled(event.target.value === 'enable')}>
                  <option value="enable">Conceder plano interno</option>
                  <option value="revoke">Revogar plano interno</option>
                </select>
              </label>
            </div>
            {planEmployeeId && eligibleArenas.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Esta pessoa ainda não é proprietária nem integrante ativa de uma arena.
              </div>
            )}
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Motivo auditável
              <Textarea
                value={planReason}
                onChange={(event) => setPlanReason(event.target.value)}
                placeholder="Ex.: ambiente da nova pessoa do time de atendimento"
                maxLength={500}
              />
            </label>
            <Button type="button" disabled={isPending} onClick={submitInternalPlan} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
              <CircleDollarSign className="mr-2 h-4 w-4" />
              {isPending ? 'Registrando…' : 'Aplicar operação sem cobrança'}
            </Button>

            <div className="space-y-2 border-t border-slate-200 pt-4">
              {overview.internalPlanAssignments.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma arena utiliza plano interno.</p>
              )}
              {overview.internalPlanAssignments.map((assignment) => {
                const arena = arenaById.get(assignment.arenaId)
                const employee = principalByUser.get(assignment.employeeUserId)
                return (
                  <div key={assignment.arenaId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                    <div>
                      <p className="font-semibold text-slate-900">{arena?.name ?? assignment.arenaId}</p>
                      <p className="text-xs text-slate-600">{employee?.name || employee?.email || assignment.employeeUserId}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => preparePlanRevocation(assignment.arenaId, assignment.employeeUserId)}>
                      Preparar revogação
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <Activity className="h-3.5 w-3.5" /> Malha operacional
            </div>
            <h2 className="text-xl font-bold text-slate-950">Arenas e recebíveis</h2>
          </div>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar arena, owner ou e-mail" className="pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Arena</th>
                <th className="px-6 py-3 font-medium">Responsável</th>
                <th className="px-6 py-3 font-medium">Plano</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Criada em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredArenas.map((arena) => (
                <tr key={arena.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4"><p className="font-semibold text-slate-950">{arena.name}</p><p className="font-mono text-[10px] text-slate-400">{arena.id}</p></td>
                  <td className="px-6 py-4"><p className="text-slate-900">{arena.ownerName || 'Sem nome'}</p><p className="text-xs text-slate-500">{arena.ownerEmail}</p></td>
                  <td className="px-6 py-4"><Badge variant="outline">{arena.planKey ?? 'Sem assinatura'}</Badge></td>
                  <td className="px-6 py-4"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{arena.status ?? '—'}</span></td>
                  <td className="px-6 py-4 text-slate-600">{formatDate(arena.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-sm">
        <div className="border-b border-slate-800 px-6 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">Registro imutável</p>
          <h2 className="mt-1 text-xl font-bold">Últimos eventos de segurança</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {overview.audit.slice(0, 12).map((event) => (
            <div key={event.id} className="grid gap-2 px-6 py-4 md:grid-cols-[220px_1fr_180px] md:items-center">
              <div><p className="font-semibold text-emerald-200">{eventLabel(event.eventType)}</p><p className="font-mono text-[10px] text-slate-500">#{event.id}</p></div>
              <div><p className="text-sm text-slate-200">{event.reason}</p><p className="mt-1 text-xs text-slate-500">{userById.get(event.targetUserId ?? '')?.email ?? event.targetUserId ?? event.arenaId ?? 'Sistema'}</p></div>
              <time className="text-xs text-slate-400 md:text-right">{formatDate(event.createdAt)}</time>
            </div>
          ))}
          {overview.audit.length === 0 && <p className="px-6 py-8 text-sm text-slate-400">Nenhum evento administrativo registrado.</p>}
        </div>
      </section>
    </div>
  )
}
