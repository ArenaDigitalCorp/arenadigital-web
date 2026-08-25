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
    <nav className="space-y-5" aria-label="Navegação do painel administrativo">
      {NAVIGATION.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
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
                    "group relative flex min-h-11 items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition",
                    active
                      ? "border-white/10 bg-white/10 text-white"
                      : "border-transparent text-slate-300 hover:border-white/5 hover:bg-white/[.055] hover:text-white",
                  )}
                >
                  {active && <span className="absolute -left-[17px] h-6 w-0.5 rounded-r-full bg-orange-400" />}
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                      active ? "bg-orange-400/10 text-orange-300" : "text-slate-500 group-hover:text-orange-300",
                    )}
                  >
                    <item.icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <strong className="min-w-0 truncate text-[13px] font-semibold leading-4">{item.label}</strong>
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
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500 font-heading text-sm font-bold text-arena-navy-950">
        AD
      </div>
      <div>
        <p className="font-heading text-[13px] font-bold tracking-wide text-white">ARENA DIGITAL</p>
        <p className="text-[10px] text-slate-500">Administração</p>
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
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#f7f7f5] text-slate-950">
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
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col overflow-hidden border-r border-white/10 bg-arena-navy-950 transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
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
            <div className="flex items-center gap-2 border-t border-white/10 px-1 pt-3 text-[11px] font-medium text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Ambiente restrito
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between border-b border-slate-200 bg-[#f7f7f5]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-300 bg-white shadow-sm lg:hidden" aria-label="Abrir navegação"><Menu className="h-5 w-5" /></button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{currentItem.label}</p>
              <p className="truncate text-[11px] text-slate-400">{currentItem.description}</p>
            </div>
          </div>
          <UserMenu afterSignOutUrl="/" showName avatarClassName="bg-orange-500 text-arena-navy-950 ring-slate-900/10" className="text-slate-800 hover:bg-slate-950/5" />
        </header>

        <main className="mx-auto min-w-0 max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  )
}
