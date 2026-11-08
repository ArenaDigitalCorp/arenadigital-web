import { AuthorizationError, assertPlatformAdminAccess } from "@/lib/server-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  publicationContextSchema,
  type PublicationAction,
  type PublicationContext,
} from "./model";

/** Context chooses authorship; an administrative role never substitutes for arena membership. */
export async function authorizePublicationScope(
  arenaId: string | null,
  operation: PublicationAction | "read" | "upload" = "read",
  context: PublicationContext = arenaId ? "arena" : "platform",
) {
  const scope = publicationContextSchema.parse(context);
  if (arenaId !== null) z.string().uuid().parse(arenaId);
  if (scope === "platform") {
    await assertPlatformAdminAccess();
    if (arenaId && !["read", "pause", "block", "unblock"].includes(operation)) {
      throw new AuthorizationError(
        "Na área admin, publique somente como Arena Digital. Para publicar pela sua arena, acesse Publicações no painel da arena.",
      );
    }
    return;
  }
  if (!arenaId || operation === "block" || operation === "unblock") {
    throw new AuthorizationError(
      "Esta ação não está disponível no contexto da arena.",
    );
  }
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("can_author_home_publication", {
    p_arena_id: arenaId,
  });
  if (error) throw new Error("Não foi possível verificar seu vínculo com a arena.");
  if (data !== true)
    throw new AuthorizationError(
      "Somente o dono ou gestor desta arena pode gerenciar suas publicações.",
    );
}
