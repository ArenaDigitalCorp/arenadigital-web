// Stable keys shared with the database catalog. Labels and group order come from the catalog.
export const ARENA_RESOURCES = [
  'dashboard', 'spaces', 'publications', 'athletes', 'classes', 'stations', 'catalog', 'rotativo', 'loyalty',
  'bookings.single', 'bookings.recurring', 'bookings.requests',
  'reports.customers', 'reports.payments', 'reports.stations',
  'finance.overview', 'finance.cash', 'finance.settings',
  'settings.users', 'settings.subscription', 'settings.arena', 'settings.receiving', 'settings.whatsapp', 'settings.templates',
] as const

export type ArenaResource = typeof ARENA_RESOURCES[number]

export function isArenaResource(value: unknown): value is ArenaResource {
  return typeof value === 'string' && (ARENA_RESOURCES as readonly string[]).includes(value)
}
