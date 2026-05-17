"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOut, User as UserIcon } from "lucide-react"
import { useUser } from "@/hooks/useUser"
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
  className?: string
  avatarClassName?: string
}

export function UserMenu({ afterSignOutUrl = "/", className, avatarClassName }: UserMenuProps) {
  const router = useRouter()
  const { user, signOut } = useUser()

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-center h-9 w-9 rounded-full bg-arena-button text-white text-xs font-semibold ring-2 ring-white/15 transition hover:brightness-110 focus:outline-none focus:ring-arena-button-hover",
            avatarClassName,
            className,
          )}
          aria-label="Menu da conta"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-[#001D2D] border-slate-700 text-white">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <span className="truncate text-sm font-medium">{displayName}</span>
            {user.email && fullName && (
              <span className="truncate text-xs text-white/60">{user.email}</span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem onClick={() => router.push('/dashboard')} className="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10">
          <UserIcon className="h-4 w-4 mr-2" />
          Minha conta
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-rose-300 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-200">
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
