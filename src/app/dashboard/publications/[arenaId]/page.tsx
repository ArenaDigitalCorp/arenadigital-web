import { authorizePublicationScope } from "@/modules/publications/authorization";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { listPublications } from "@/modules/publications/actions";
import { PublicationsManager } from "@/modules/publications/PublicationsManager";
export default async function ArenaPublicationsPage({
  params,
}: {
  params: Promise<{ arenaId: string }>;
}) {
  const { arenaId: id } = await params;
  await authorizePublicationScope(id, "read", "arena");
  const [items, { data, error }] = await Promise.all([
    listPublications(id, "arena"),
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
