"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Activity,
  ArrowLeft,
  Building2,
  CircleDollarSign,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react"
import { UserMenu } from "@/components/auth/UserMenu"
import { cn } from "@/lib/utils"

const NAVIGATION = [
  { href: "/admin/overview", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/arenas", label: "Arenas", icon: Building2 },
  { href: "/admin/finance", label: "Financeiro", icon: CircleDollarSign },
  { href: "/admin/athletes", label: "Atletas", icon: UsersRound },
  { href: "/admin/engagement", label: "Uso e engajamento", icon: Activity },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
] as const

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-1.5" aria-label="Navegação do painel administrativo">
      {NAVIGATION.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-white text-slate-950 shadow-[0_10px_30px_rgba(0,0,0,.2)]"
                : "text-slate-300 hover:bg-white/7 hover:text-white",
            )}
          >
            <item.icon className={cn("h-[18px] w-[18px]", active ? "text-orange-600" : "text-slate-500 group-hover:text-orange-300")} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500 font-heading text-sm font-black text-slate-950 shadow-[0_0_35px_rgba(249,116,21,.35)]">
        AD
      </div>
      <div>
        <p className="font-heading text-sm font-black tracking-wide text-white">ARENA DIGITAL</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-orange-300">Command center</p>
      </div>
    </div>
  )
}

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-[100dvh] bg-[#f2f0eb] text-slate-950">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[282px] flex-col overflow-hidden border-r border-white/10 bg-[#07141d] px-5 py-6 transition-transform lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_0%,rgba(249,116,21,.22),transparent_33%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:auto,24px_24px,24px_24px]" />
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between">
            <Brand />
            <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar navegação">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="my-7 h-px bg-gradient-to-r from-orange-400/60 to-transparent" />
          <AdminNavigation onNavigate={() => setMobileOpen(false)} />

          <div className="mt-auto space-y-4">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> Ambiente restrito
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">Ações sensíveis são autorizadas no servidor e registradas em auditoria.</p>
            </div>
            <Link href="/dashboard" className="flex items-center gap-2 px-2 text-xs font-semibold text-slate-400 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Voltar para minha arena
            </Link>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[282px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-900/10 bg-[#f2f0eb]/90 px-5 backdrop-blur-xl md:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl border border-slate-300 bg-white p-2.5 shadow-sm lg:hidden" aria-label="Abrir navegação">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-orange-700">Backoffice interno</p>
              <p className="text-sm font-bold text-slate-700">Gestão da plataforma</p>
            </div>
          </div>
          <UserMenu afterSignOutUrl="/" showName avatarClassName="bg-orange-500 text-slate-950 ring-slate-900/10" className="text-slate-800 hover:bg-slate-950/5" />
        </header>

        <main className="px-5 py-7 md:px-8 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  )
}
