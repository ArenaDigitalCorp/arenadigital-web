export const SUPER_ADMIN_SECTIONS = ["overview", "arenas", "finance", "athletes", "engagement", "settings"] as const

export type SuperAdminSection = (typeof SUPER_ADMIN_SECTIONS)[number]
