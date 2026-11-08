import { assertPlatformAdminAccess } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { listPublications } from "@/modules/publications/actions";
import { PublicationsManager } from "@/modules/publications/PublicationsManager";
export default async function PublicationsPage() {
  await assertPlatformAdminAccess();
  const items = await listPublications(null);
  const sportsResult = await getSupabaseAdmin()
    .from("sports")
    .select("id,name")
    .order("name");
  if (sportsResult.error)
    throw new Error("Não foi possível carregar modalidades.");
  return (
    <PublicationsManager
      sports={sportsResult.data ?? []}
      initialItems={items}
      arenaId={null}
      platform
      arenas={[]}
    />
  );
}
