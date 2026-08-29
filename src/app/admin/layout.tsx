import { redirect } from "next/navigation"
import {
  AuthorizationError,
  assertPlatformSuperAdminAccess,
  hasDirectArenaOwnership,
} from "@/lib/server-auth"
import { SuperAdminShell } from "@/modules/super-admin/components/SuperAdminShell"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let canReturnToOwnedArena = false

  try {
    const profile = await assertPlatformSuperAdminAccess()
    canReturnToOwnedArena = await hasDirectArenaOwnership(profile.dbUserId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.status === 401) redirect("/sign-in?redirect_to=%2Fadmin%2Foverview")
      redirect("/dashboard")
    }
    throw error
  }

  return (
    <SuperAdminShell canReturnToOwnedArena={canReturnToOwnedArena}>
      {children}
    </SuperAdminShell>
  )
}
