"use client"

import type { PlatformAdminOverview } from "@/modules/platform-admin/types/platform-admin.types"
import { ArenasSection } from "@/modules/super-admin/components/sections/ArenasSection"
import { AthletesSection } from "@/modules/super-admin/components/sections/AthletesSection"
import { EngagementSection } from "@/modules/super-admin/components/sections/EngagementSection"
import { FinanceSection } from "@/modules/super-admin/components/sections/FinanceSection"
import { ImportsSection } from "@/modules/super-admin/components/sections/ImportsSection"
import { OverviewSection } from "@/modules/super-admin/components/sections/OverviewSection"
import { SettingsSection } from "@/modules/super-admin/components/sections/SettingsSection"
import { UsersSection } from "@/modules/super-admin/components/sections/UsersSection"
import type { SuperAdminSection } from "@/modules/super-admin/sections"

type SuperAdminWorkspaceProps = {
  overview: PlatformAdminOverview
  section: SuperAdminSection
  initialArenaId?: string
}

export function SuperAdminWorkspace({ overview, section, initialArenaId }: SuperAdminWorkspaceProps) {
  if (section === "arenas") return <ArenasSection overview={overview} />
  if (section === "imports") return <ImportsSection overview={overview} />
  if (section === "finance") return <FinanceSection overview={overview} />
  if (section === "athletes") return <AthletesSection overview={overview} />
  if (section === "users") return <UsersSection overview={overview} />
  if (section === "engagement") return <EngagementSection overview={overview} />
  if (section === "settings") return <SettingsSection overview={overview} initialArenaId={initialArenaId} />
  return <OverviewSection overview={overview} />
}
