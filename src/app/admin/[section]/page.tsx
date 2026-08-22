import { notFound } from "next/navigation"
import { getPlatformAdminOverview } from "@/modules/platform-admin/actions/platformAdminActions"
import {
  SuperAdminWorkspace,
} from "@/modules/super-admin/components/SuperAdminWorkspace"
import { SUPER_ADMIN_SECTIONS, type SuperAdminSection } from "@/modules/super-admin/sections"

export default async function AdminSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ arena?: string }> }) {
  const { section } = await params
  const { arena } = await searchParams
  if (!SUPER_ADMIN_SECTIONS.includes(section as SuperAdminSection)) notFound()
  const overview = await getPlatformAdminOverview({
    includePaymentSettings: section === "settings" || section === "finance",
  })
  return <SuperAdminWorkspace overview={overview} section={section as SuperAdminSection} initialArenaId={arena} />
}
