"use server";
import { authorizePublicationScope } from "./authorization";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertPlatformAdminAccess } from "@/lib/server-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  publicationSchema,
  publicationContextSchema,
  type PublicationContext,
  eventSchema,
  actionSchema,
  type PublicationAction,
} from "./model";

async function authorize(
  arenaId: string | null,
  operation: PublicationAction | "read" = "read",
  context: PublicationContext = arenaId ? "arena" : "platform",
) {
  if (arenaId) z.string().uuid().parse(arenaId);
  await authorizePublicationScope(arenaId, operation, context);
}

async function rpc(name: string, args: Record<string, unknown>) {
  const client = await createSupabaseServerClient();
  const api = client as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await api.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export async function listPublications(
  arenaId: string | null,
  context: PublicationContext = arenaId ? "arena" : "platform",
) {
  await authorize(arenaId, "read", context);
  return publicationSchema
    .array()
    .parse(await rpc("list_home_publications", { p_arena_id: arenaId }));
}
export async function publicationHistory(
  id: string,
  arenaId: string | null,
  context: PublicationContext = arenaId ? "arena" : "platform",
) {
  try {
    await authorize(arenaId, "read", context);
    z.string().uuid().parse(id);
    if (context === "arena") {
      const items = await listPublications(arenaId, context);
      if (!items.some((item) => item.id === id))
        throw new Error("Publicação não encontrada nesta arena.");
    }
    return {
      success: true as const,
      data: eventSchema
        .array()
        .parse(await rpc("home_publication_history", { p_id: id })),
    };
  } catch (e) {
    return {
      success: false as const,
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível carregar o histórico.",
    };
  }
}
export async function changePublication(input: unknown) {
  try {
    const value = z
      .object({
        action: actionSchema,
        context: publicationContextSchema,
        id: z.string().uuid().nullable(),
        arenaId: z.string().uuid().nullable(),
        revision: z.number().int().positive().nullable(),
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .strict()
      .parse(input);
    await authorize(value.arenaId, value.action, value.context);
    if (value.action === "block" || value.action === "unblock")
      await assertPlatformAdminAccess();
    const data = publicationSchema.parse(
      await rpc("manage_home_publication", {
        p_action: value.action,
        p_context: value.context,
        p_id: value.id,
        p_arena_id: value.arenaId,
        p_payload: value.payload,
        p_revision: value.revision,
      }),
    );
    for (const path of [
      "/admin/publications",
      "/dashboard/admin/mobile-content",
      ...(value.arenaId
        ? [`/dashboard/publications/${value.arenaId}`, `/dashboard/arenas/${value.arenaId}/publications`]
        : []),
    ]) {
      try {
        revalidatePath(path);
      } catch {
        /* Mutation already committed; the response updates the list. */
      }
    }
    return { success: true as const, data };
  } catch (e) {
    return {
      success: false as const,
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível salvar a publicação.",
    };
  }
}

export async function searchPublicationCities(query: string) {
  await assertPlatformAdminAccess();
  const term = z.string().trim().min(2).max(80).parse(query);
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("municipios")
    .select("codigo_ibge,nome,estados(uf)")
    .ilike("nome", `${term.replace(/[%_]/g, "")}%`)
    .order("nome")
    .limit(30);
  if (error) throw new Error("Não foi possível buscar cidades.");
  return (data ?? []).map((city) => ({
    id: city.codigo_ibge,
    name: `${city.nome}/${city.estados?.uf ?? ""}`,
  }));
}
