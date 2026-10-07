import { redirect } from "next/navigation"
import {
  AuthorizationError,
  assertPlatformSuperAdminAccess,
  hasExplicitArenaAccess,
} from "@/lib/server-auth"
import { SuperAdminShell } from "@/modules/super-admin/components/SuperAdminShell"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let canReturnToArena = false

  try {
    const profile = await assertPlatformSuperAdminAccess()
    canReturnToArena = await hasExplicitArenaAccess(profile.dbUserId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.status === 401) redirect("/sign-in?redirect_to=%2Fadmin%2Foverview")
      redirect("/dashboard")
    }
    throw error
  }

  return (
    <SuperAdminShell canReturnToArena={canReturnToArena}>
      {children}
    </SuperAdminShell>
  )
}
