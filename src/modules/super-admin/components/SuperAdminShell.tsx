"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Activity,
  ArrowLeft,
  Building2,
  Database,
  LayoutDashboard,
  Menu,
  Settings2,
  ShieldCheck,
  UserCog,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react"
import { UserMenu } from "@/components/auth/UserMenu"
import { cn } from "@/lib/utils"

type NavigationItem = {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

const NAVIGATION: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: "Painel",
    items: [
      { href: "/admin/overview", label: "Visão geral", description: "Pulso da operação", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/admin/arenas", label: "Arenas", description: "Clientes e catálogo", icon: Building2 },
      { href: "/admin/imports", label: "Importação", description: "Descoberta em lote", icon: Database },
      { href: "/admin/athletes", label: "Atletas", description: "Comunidade do app", icon: UsersRound },
      { href: "/admin/users", label: "Usuários", description: "Identidade e acesso", icon: UserCog },
    ],
  },
  {
    label: "Negócio",
    items: [
      { href: "/admin/finance", label: "Financeiro", description: "Receita e cobrança", icon: WalletCards },
      { href: "/admin/engagement", label: "Engajamento", description: "Saúde da base", icon: Activity },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/settings", label: "Configurações", description: "Governança global", icon: Settings2 },
    ],
  },
]

const ALL_ITEMS = NAVIGATION.flatMap((group) => group.items)

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/admin/overview" && pathname.startsWith(`${href}/`))
}

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-6" aria-label="Navegação do painel administrativo">
      {NAVIGATION.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-slate-600">{group.label}</p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-[52px] items-center gap-3 rounded-xl border px-2.5 py-2 transition",
                    active
                      ? "border-white/10 bg-white text-arena-navy-950 shadow-[0_12px_28px_rgba(0,0,0,.22)]"
                      : "border-transparent text-slate-300 hover:border-white/5 hover:bg-white/[.055] hover:text-white",
                  )}
                >
                  {active && <span className="absolute -left-[21px] h-7 w-1 rounded-r-full bg-orange-500" />}
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
                      active ? "bg-orange-500 text-arena-navy-950" : "bg-white/[.055] text-slate-500 group-hover:text-orange-300",
                    )}
                  >
                    <item.icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-[13px] leading-4">{item.label}</strong>
                    <small className={cn("mt-0.5 block truncate text-[9px] leading-3", active ? "text-slate-500" : "text-slate-600 group-hover:text-slate-400")}>{item.description}</small>
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#f97415,#f9a91f)] font-heading text-sm font-black text-arena-navy-950 shadow-[0_0_35px_rgba(249,116,21,.28)]">
        <span className="absolute inset-0 opacity-25 [background-image:linear-gradient(135deg,transparent_45%,white_45%,white_48%,transparent_48%)] [background-size:12px_12px]" />
        <span className="relative">AD</span>
      </div>
      <div>
        <p className="font-heading text-[13px] font-black tracking-wide text-white">ARENA DIGITAL</p>
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-orange-300">Operações da plataforma</p>
      </div>
    </div>
  )
}

export function SuperAdminShell({
  children,
  canReturnToOwnedArena,
}: {
  children: React.ReactNode
  canReturnToOwnedArena: boolean
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const currentItem = ALL_ITEMS.find((item) => isActivePath(pathname, item.href)) ?? ALL_ITEMS[0]

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#f3f1ec] text-slate-950">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-arena-navy-950/65 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[274px] flex-col overflow-hidden border-r border-white/10 bg-arena-navy-950 transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:radial-gradient(circle_at_15%_0%,rgba(249,116,21,.22),transparent_28%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:auto,24px_24px,24px_24px]" />
        <div className="relative flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between px-5 py-5">
            <Brand />
            <button type="button" className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar navegação"><X className="h-5 w-5" /></button>
          </div>
          <div className="mx-5 h-px bg-gradient-to-r from-orange-400/60 to-transparent" />

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.16)_transparent]">
            <AdminNavigation onNavigate={() => setMobileOpen(false)} />
          </div>

          <div className="p-4 pt-0">
            {canReturnToOwnedArena && (
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-orange-400/30 hover:bg-white/[.055] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 text-orange-300" />
                Voltar para minha arena
              </Link>
            )}
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3.5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-300"><ShieldCheck className="h-4 w-4" /> Ambiente restrito</div>
              <p className="mt-1.5 text-[9px] leading-4 text-slate-500">Ações sensíveis exigem autorização de servidor e auditoria.</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-[274px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-slate-900/10 bg-[#f3f1ec]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-300 bg-white shadow-sm lg:hidden" aria-label="Abrir navegação"><Menu className="h-5 w-5" /></button>
            <div className="min-w-0">
              <p className="font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-orange-700">Backoffice interno</p>
              <p className="truncate text-sm font-bold text-slate-700">{currentItem.label} <span className="font-normal text-slate-400">/ {currentItem.description}</span></p>
            </div>
          </div>
          <UserMenu afterSignOutUrl="/" showName avatarClassName="bg-orange-500 text-arena-navy-950 ring-slate-900/10" className="text-slate-800 hover:bg-slate-950/5" />
        </header>

        <main className="mx-auto min-w-0 max-w-[1660px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  )
}
