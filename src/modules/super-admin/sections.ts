export const SUPER_ADMIN_SECTIONS = [
  "overview",
  "arenas",
  "imports",
  "finance",
  "athletes",
  "users",
  "engagement",
  "settings",
] as const

export type SuperAdminSection = (typeof SUPER_ADMIN_SECTIONS)[number]
