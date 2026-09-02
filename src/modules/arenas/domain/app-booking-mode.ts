export const APP_BOOKING_MODES = ['disabled', 'pre_booking', 'online_payment'] as const

export type AppBookingMode = (typeof APP_BOOKING_MODES)[number]

export function normalizeAppBookingMode(
  value: unknown,
  legacyAcceptsRequests = false,
): AppBookingMode {
  if (value === 'disabled' || value === 'pre_booking' || value === 'online_payment') return value
  return legacyAcceptsRequests ? 'pre_booking' : 'disabled'
}

export function appBookingModeAcceptsPreBookings(mode: AppBookingMode): boolean {
  return mode === 'pre_booking'
}
