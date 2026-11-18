export type BookingResource = 'bookings.single' | 'bookings.recurring'

type BookingKind = { booking_type?: string | null; plano_mensalista_id?: string | null }

export function resourceForBooking(row: BookingKind): BookingResource {
  return row.plano_mensalista_id || row.booking_type === 'mensalista' ? 'bookings.recurring' : 'bookings.single'
}

// PostgREST OR filters mirror resourceForBooking, including legacy null types.
export function calendarFilter(resources: readonly string[]): string | undefined {
  const single = resources.includes('bookings.single')
  const recurring = resources.includes('bookings.recurring')
  if (single && recurring) return undefined
  if (recurring) return 'plano_mensalista_id.not.is.null,booking_type.eq.mensalista'
  if (single) return 'and(plano_mensalista_id.is.null,or(booking_type.is.null,booking_type.neq.mensalista))'
  throw new Error('Sem acesso às reservas desta arena.')
}

export function canSeeBookings(resources: readonly string[]) {
  return resources.includes('bookings.single') || resources.includes('bookings.recurring')
}

export function applyBookingFilter<T extends { or(filters: string): T }>(query: T, filter: string | undefined): T {
  return filter ? query.or(filter) : query
}
