import {
  AuthorizationError,
  assertArenaAdminAccess,
  assertPlatformAdminAccess,
  getPlatformAccessLevel,
  requireAuthenticatedDbUser,
} from "@/lib/server-auth";
import type { PublicationAction } from "./model";

/** Platform authorship is always global; arena access is read/moderation only. */
export async function authorizePublicationScope(
  arenaId: string | null,
  operation: PublicationAction | "read" | "upload" = "read",
) {
  const actor = await requireAuthenticatedDbUser();
  const level = await getPlatformAccessLevel(actor.dbUserId);
  if (level === "super_admin" || level === "platform_admin") {
    await assertPlatformAdminAccess();
    if (arenaId && !["read", "pause", "block", "unblock"].includes(operation)) {
      throw new AuthorizationError(
        "A plataforma publica somente como Arena Digital. Publicações de arenas são gerenciadas pelas próprias arenas.",
      );
    }
    return;
  }
  if (!arenaId) {
    await assertPlatformAdminAccess();
    return;
  }
  await assertArenaAdminAccess(arenaId);
}
