import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaResourceAccess } from '@/lib/server-auth'
import { resourceForBooking } from './booking-access'

export async function assertSingleBookingAccess(bookingId: string, arenaId: string) {
  await assertArenaResourceAccess(arenaId, 'bookings.single')
  const { data, error } = await getSupabaseAdmin().from('bookings')
    .select('booking_type,plano_mensalista_id').eq('arena_id', arenaId).eq('id', bookingId).maybeSingle()
  if (error || !data || resourceForBooking(data) !== 'bookings.single') {
    throw new Error('Reserva avulsa indisponível nesta arena.')
  }
}
