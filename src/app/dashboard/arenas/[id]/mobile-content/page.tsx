import { redirect } from "next/navigation"
import { assertArenaAdminAccess } from "@/lib/server-auth"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { SupabaseArenaRepository } from "@/modules/arenas/repositories/SupabaseArenaRepository"
import { MobileContentPageClient } from "@/modules/mobile-content/components/MobileContentPageClient"
import {
  listArenaAthletesForMobileContentAction,
  listArenaHighlightsAction,
  listArenaOpenGamesAction,
  listArenaPromotionsAction,
} from "@/modules/mobile-content/actions/mobileContentActions"
import type { MobileContentOption } from "@/modules/mobile-content/types/mobile-content.types"

export default async function ArenaMobileContentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  try {
    await assertArenaAdminAccess(id)
  } catch {
    redirect("/dashboard/settings/arenas")
  }

  const supabase = getSupabaseAdmin()
  const arenaRepo = new SupabaseArenaRepository(supabase)

  const [arena, courtsRaw, promotions, highlights, openGames, athletes] = await Promise.all([
    arenaRepo.findById(id),
    supabase.from("courts").select("id, name").eq("arena_id", id).order("name"),
    listArenaPromotionsAction(id),
    listArenaHighlightsAction(id),
    listArenaOpenGamesAction(id),
    listArenaAthletesForMobileContentAction(id),
  ])

  if (!arena) redirect("/dashboard/settings/arenas")

  const courts = ((courtsRaw.data ?? []) as MobileContentOption[]).map((court) => ({
    id: court.id,
    name: court.name,
  }))

  return (
    <MobileContentPageClient
      arenaId={id}
      arenaName={arena.name}
      courts={courts}
      sports={arena.sports ?? []}
      athletes={athletes.success ? athletes.data : []}
      initialPromotions={promotions.success ? promotions.data : []}
      initialHighlights={highlights.success ? highlights.data : []}
      initialOpenGames={openGames.success ? openGames.data : []}
    />
  )
}
