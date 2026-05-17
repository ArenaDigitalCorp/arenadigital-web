"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, IdCard, KeyRound, LogOut, Mail, Shield, User as UserIcon } from "lucide-react"
import { useUser } from "@/hooks/useUser"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.trim() || "?"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type UserMenuProps = {
  afterSignOutUrl?: string
  accountHref?: string
  align?: "start" | "center" | "end"
  className?: string
  avatarClassName?: string
  showName?: boolean
}

type DbUser = {
  id: string
  clerk_user_id: string | null
  email: string
  name: string | null
  cpf: string | null
  role: string | null
  created_at: string
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Nao informado"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function DetailRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm", className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-arena-button/10 text-arena-button">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-1 break-words text-sm font-semibold text-arena-navy-800">
          {value}
        </div>
      </div>
    </div>
  )
}

export function UserMenu({
  afterSignOutUrl = "/",
  align = "end",
  className,
  avatarClassName,
  showName = false,
}: UserMenuProps) {
  const router = useRouter()
  const { user, signOut } = useUser()
  const [accountOpen, setAccountOpen] = React.useState(false)
  const [dbUser, setDbUser] = React.useState<DbUser | null>(null)
  const [accountLoading, setAccountLoading] = React.useState(false)
  const [accountError, setAccountError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!accountOpen) return

    let cancelled = false
    async function loadAccount() {
      setAccountLoading(true)
      setAccountError(null)
      try {
        const response = await fetch("/api/user/me")
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json() as DbUser
        if (!cancelled) setDbUser(data)
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Erro ao carregar conta"
          setAccountError(message)
        }
      } finally {
        if (!cancelled) setAccountLoading(false)
      }
    }

    loadAccount()
    return () => {
      cancelled = true
    }
  }, [accountOpen])

  if (!user) return null

  const meta = user.user_metadata ?? {}
  const fullName =
    [meta.firstName, meta.lastName].filter(Boolean).join(' ') ||
    (typeof meta.name === 'string' ? meta.name : null)
  const initials = getInitials(fullName, user.email)
  const displayName = fullName || user.email || 'Minha conta'

  const handleSignOut = async () => {
    await signOut()
    router.push(afterSignOutUrl)
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              showName
                ? "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-white/85 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-arena-button-hover"
                : "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-arena-button-hover",
              className,
            )}
            aria-label="Menu da conta"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-arena-button text-xs font-semibold text-white ring-2 ring-white/15",
                avatarClassName,
              )}
            >
              {initials}
            </span>
            {showName && (
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {displayName}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-56 bg-[#001D2D] border-slate-700 text-white">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <span className="truncate text-sm font-medium">{displayName}</span>
              {user.email && fullName && (
                <span className="truncate text-xs text-white/60">{user.email}</span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onClick={() => setAccountOpen(true)} className="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10">
            <UserIcon className="h-4 w-4 mr-2" />
            Minha conta
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-rose-300 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-200">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[720px] overflow-hidden rounded-2xl border-none bg-arena-soft p-0 shadow-2xl">
          <DialogHeader className="relative overflow-hidden bg-arena-navy-800 px-7 pb-7 pt-6 text-left text-white">
            <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-arena-button text-lg font-black text-white shadow-lg shadow-black/20 ring-4 ring-white/10">
                  {initials}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-2xl font-black tracking-tight text-white">
                    Minha conta
                  </DialogTitle>
                  <DialogDescription className="mt-1 truncate text-sm text-white/65">
                    {user.email ?? "Email nao informado"}
                  </DialogDescription>
                </div>
              </div>
              <div className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                {dbUser?.role ?? "Conta Arena"}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 px-7 pb-7 pt-6">
            {accountError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Nao consegui carregar os dados completos da conta: {accountError}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Usuario</p>
                  <p className="mt-1 truncate text-xl font-black text-arena-navy-800">{displayName}</p>
                </div>
                <div className="rounded-lg bg-arena-soft px-3 py-2 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Status</p>
                  <p className="mt-1 text-sm font-bold text-emerald-700">Ativo</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow icon={Mail} label="Email" value={dbUser?.email ?? user.email ?? "Nao informado"} />
              <DetailRow icon={UserIcon} label="Nome" value={dbUser?.name ?? fullName ?? "Nao informado"} />
              <DetailRow icon={IdCard} label="CPF" value={dbUser?.cpf ?? "Nao informado"} />
              <DetailRow icon={Shield} label="Perfil" value={dbUser?.role ?? "Nao informado"} />
              <DetailRow icon={CalendarDays} label="Conta criada em" value={formatDate(dbUser?.created_at ?? user.created_at)} />
              <DetailRow icon={KeyRound} label="Ultimo acesso" value={formatDate(user.last_sign_in_at)} />
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">ID do usuario</p>
              <p className="mt-2 break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">{dbUser?.id ?? user.id}</p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAccountOpen(false)}
                className="h-11 border-slate-300 px-5 font-semibold text-arena-navy-800"
              >
                Fechar
              </Button>
              <Button
                type="button"
                disabled={accountLoading}
                onClick={handleSignOut}
                className="h-11 bg-rose-600 px-5 font-semibold text-white hover:bg-rose-700"
              >
                Sair da conta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
