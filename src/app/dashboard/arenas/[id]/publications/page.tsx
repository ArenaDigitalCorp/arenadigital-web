import { redirect } from "next/navigation";
import {
  assertArenaAdminAccess,
  getPlatformAccessLevel,
  requireAuthenticatedDbUser,
} from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { listPublications } from "@/modules/publications/actions";
import { PublicationsManager } from "@/modules/publications/PublicationsManager";
export default async function ArenaPublicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireAuthenticatedDbUser();
  const level = await getPlatformAccessLevel(actor.dbUserId);
  if (level === "super_admin" || level === "platform_admin")
    redirect("/dashboard/admin/mobile-content");
  await assertArenaAdminAccess(id);
  const [items, { data, error }] = await Promise.all([
    listPublications(id),
    getSupabaseAdmin().from("arenas").select("id,name").eq("id", id).single(),
  ]);
  if (error || !data) throw new Error("Não foi possível carregar a arena.");
  const sportsResult = await getSupabaseAdmin()
    .from("sports")
    .select("id,name")
    .order("name");
  if (sportsResult.error)
    throw new Error("Não foi possível carregar modalidades.");
  return (
    <PublicationsManager
      sports={sportsResult.data ?? []}
      key={id}
      initialItems={items}
      arenaId={id}
      platform={false}
      arenas={[data]}
    />
  );
}
