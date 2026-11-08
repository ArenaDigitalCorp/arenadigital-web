import { authorizePublicationScope } from "@/modules/publications/authorization";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { SupabaseArenaRepository } from "@/modules/arenas/repositories/SupabaseArenaRepository";
import {
  listArenaAthletesForMobileContentAction,
  listArenaOpenGamesAction,
  listArenaPromotionsAction,
} from "@/modules/mobile-content/actions/mobileContentActions";
import { listPublications } from "@/modules/publications/actions";
import { PublicationsManager } from "@/modules/publications/PublicationsManager";
export default async function ArenaPublicationsPage({
  params,
}: {
  params: Promise<{ arenaId: string }>;
}) {
  const { arenaId: id } = await params;
  await authorizePublicationScope(id, "read", "arena");
  const supabase = getSupabaseAdmin();
  const arenaRepository = new SupabaseArenaRepository(supabase);
  const [items, arena, promotions, openGames, athletes, sportsResult] = await Promise.all([
    listPublications(id, "arena"),
    arenaRepository.findById(id),
    listArenaPromotionsAction(id),
    listArenaOpenGamesAction(id),
    listArenaAthletesForMobileContentAction(id),
    supabase.from("sports").select("id,name").order("name"),
  ]);
  if (!arena) throw new Error("Não foi possível carregar a arena.");
  if (!promotions.success) throw new Error(promotions.error);
  if (!openGames.success) throw new Error(openGames.error);
  if (!athletes.success) throw new Error(athletes.error);
  if (sportsResult.error)
    throw new Error("Não foi possível carregar modalidades.");
  return (
    <PublicationsManager
      sports={sportsResult.data ?? []}
      key={id}
      initialItems={items}
      initialPromotions={promotions.data}
      initialOpenGames={openGames.data}
      athletes={athletes.data}
      arenaSports={arena.sports ?? []}
      arenaId={id}
      platform={false}
      arenas={[{ id: arena.id, name: arena.name }]}
    />
  );
}
