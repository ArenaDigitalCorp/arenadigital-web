"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaResourceAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { loadAccessibleArenas } from '@/lib/accessible-arenas'
import { applyBookingFilter, calendarFilter, canSeeBookings } from '@/modules/bookings/lib/booking-access'
import type { ArenaResource } from '@/lib/arena-resources'
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination'
import { startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, addHours, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import type { DashboardStats, OccupancyPeriod, OccupancyRow } from '@/modules/dashboard/types/dashboard.types'

const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

function getWeekdayName(date: Date) {
    return WEEKDAY_NAMES[date.getDay()]
}

function getOccupancyPeriodRange(period: OccupancyPeriod, now: Date) {
    switch (period) {
        case 'week':
            return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
        case 'month':
            return { start: startOfMonth(now), end: endOfMonth(now) }
        case 'day':
        default:
            return { start: startOfDay(now), end: endOfDay(now) }
    }
}

function buildOccupancyRows(
    courts: { id: string; name: string; day_config: unknown }[],
    bookings: { court_id: string; start_time: string; end_time: string }[],
    periodDates: Date[]
): OccupancyRow[] {
    return courts.map(court => {
        const dayConfigs = Array.isArray(court.day_config) ? court.day_config : []
        const courtBookings = bookings.filter(b => b.court_id === court.id)

        let totalPossibleBookings = 0
        let bookedCount = 0

        for (const date of periodDates) {
            const dayName = getWeekdayName(date)
            const configForDay = dayConfigs.find((c: any) =>
                c.day?.toLowerCase() === dayName.toLowerCase() ||
                c.day?.toLowerCase().includes(dayName.toLowerCase().split('-')[0])
            )

            if (!configForDay || !configForDay.enabled) continue

            const startHour = parseInt(configForDay.startTime.split(':')[0], 10)
            const endHour = parseInt(configForDay.endTime.split(':')[0], 10)
            const hoursForDay = endHour >= startHour ? endHour - startHour : (24 - startHour) + endHour
            totalPossibleBookings += hoursForDay

            const dayStart = startOfDay(date)
            const dayEnd = endOfDay(date)
            bookedCount += courtBookings.filter(b => {
                const bDate = new Date(b.start_time)
                if (bDate < dayStart || bDate > dayEnd) return false
                const bHour = bDate.getHours()
                if (endHour >= startHour) return bHour >= startHour && bHour < endHour
                return bHour >= startHour || bHour < endHour
            }).length
        }

        const percentage = totalPossibleBookings > 0
            ? Math.min(Math.round((bookedCount / totalPossibleBookings) * 100), 100)
            : 0

        return { courtName: court.name, percentage, booked: bookedCount, total: totalPossibleBookings }
    }).sort((a, b) => a.courtName.localeCompare(b.courtName))
}

type DashboardArena = { id: string; resources: readonly string[] }

// One batch for each visible combination (single, monthly, or both). Each
// query constrains its own arena IDs so grants never bleed across tenants.
function bookingGroups(arenas: DashboardArena[]) {
    const groups = new Map<string | undefined, string[]>()
    for (const arena of arenas) {
        if (!canSeeBookings(arena.resources)) continue
        const filter = calendarFilter(arena.resources)
        const ids = groups.get(filter) ?? []
        ids.push(arena.id)
        groups.set(filter, ids)
    }
    return Array.from(groups, ([filter, arenaIds]) => ({ filter, arenaIds }))
}

export async function getDashboardDataAction(
    selectedArenaId: string | 'all',
    occupancyPeriod: OccupancyPeriod = 'day'
): Promise<{ success: boolean; stats?: DashboardStats; occupancy?: OccupancyRow[]; error?: string }> {
    try {
        const targets: DashboardArena[] = selectedArenaId === 'all'
            ? await loadAccessibleArenas((await requireAuthenticatedDbUser()).dbUserId)
            : [{ id: selectedArenaId, resources: (await assertArenaResourceAccess(selectedArenaId, 'dashboard')).resources }]
        const dashboards = targets.filter(arena => arena.resources.includes('dashboard'))
        const allowed = (...keys: ArenaResource[]) => dashboards.filter(arena =>
            keys.every(key => arena.resources.includes(key))).map(arena => arena.id)
        const financialArenas = allowed('finance.overview')
        const countsByScope = bookingGroups(dashboards)
        const athletesByScope = bookingGroups(dashboards.filter(arena => arena.resources.includes('athletes')))
        const spaceArenas = allowed('spaces')
        const occupancyByScope = bookingGroups(dashboards.filter(arena => arena.resources.includes('spaces')))
        const occupancyArenas = new Set(occupancyByScope.flatMap(group => group.arenaIds))
        const supabase = getSupabaseAdmin()
        const now = new Date()
        const todayStart = startOfDay(now).toISOString()
        const todayEnd = endOfDay(now).toISOString()
        const currentMonthStart = startOfMonth(now).toISOString()
        const currentMonthEnd = endOfMonth(now).toISOString()
        const previousMonthDate = subMonths(now, 1)
        const previousMonthStart = startOfMonth(previousMonthDate).toISOString()
        const previousMonthEnd = endOfMonth(previousMonthDate).toISOString()
        const occupancyRange = getOccupancyPeriodRange(occupancyPeriod, now)
        const occupancyRangeStartStr = startOfDay(occupancyRange.start).toISOString()
        const occupancyRangeEndStr = addHours(endOfDay(occupancyRange.end), 6).toISOString()
        const occupancyPeriodDates = eachDayOfInterval({ start: occupancyRange.start, end: occupancyRange.end })

        // Only occupancy depends on courts. Revenue and reservation reads can
        // start immediately instead of waiting for that unrelated round trip.
        const occupancyPromise = (async () => {
            const { data: courts } = spaceArenas.length === 0 ? { data: [] } : await supabase
                .from('courts')
                .select('id, name, day_config, arena_id')
                .in('arena_id', spaceArenas)
                .eq('status', 'ativo')

            const courtList = courts ?? []
            const bookingsByScope = await Promise.all(occupancyByScope.map(async ({ filter, arenaIds }) => {
                const courtIds = courtList.filter(court => arenaIds.includes(court.arena_id)).map(court => court.id)
                if (!courtIds.length) return []
                const query = supabase.from('bookings').select('court_id, start_time, end_time')
                    .in('arena_id', arenaIds).in('court_id', courtIds).in('status', ['confirmed', 'pending'])
                    .gte('start_time', occupancyRangeStartStr).lte('start_time', occupancyRangeEndStr)
                    .order('id', { ascending: true })
                const { data, error } = await fetchAllSupabaseRows(applyBookingFilter(query, filter))
                if (error) throw new Error(error.message)
                return data ?? []
            }))
            return { courtList, occupancyBookings: bookingsByScope.flat() }
        })()

        const [bookingCountResult, currentMonthTx, previousMonthTx, activeAthletesResult, { courtList, occupancyBookings }] =
            await Promise.all([
                Promise.all(countsByScope.map(async ({ filter, arenaIds }) => {
                    const query = supabase.from('bookings').select('*', { count: 'exact', head: true })
                        .in('arena_id', arenaIds).eq('status', 'confirmed')
                        .gte('start_time', todayStart).lte('start_time', todayEnd)
                    const { count, error } = await applyBookingFilter(query, filter)
                    if (error) throw new Error(error.message)
                    return count ?? 0
                })),
                financialArenas.length === 0 ? { data: [] } : fetchAllSupabaseRows(supabase.from('transactions').select('total_value')
                    .in('arena_id', financialArenas).eq('type', 'entrada')
                    .gte('launch_date', currentMonthStart).lte('launch_date', currentMonthEnd)
                    .order('id', { ascending: true })),
                financialArenas.length === 0 ? { data: [] } : fetchAllSupabaseRows(supabase.from('transactions').select('total_value')
                    .in('arena_id', financialArenas).eq('type', 'entrada')
                    .gte('launch_date', previousMonthStart).lte('launch_date', previousMonthEnd)
                    .order('id', { ascending: true })),
                Promise.all(athletesByScope.map(async ({ filter, arenaIds }) => {
                    const query = supabase.from('bookings').select('athlete_id')
                        .in('arena_id', arenaIds).eq('status', 'confirmed').not('athlete_id', 'is', null)
                        .gte('start_time', currentMonthStart).lte('start_time', currentMonthEnd)
                        .order('id', { ascending: true })
                    const { data, error } = await fetchAllSupabaseRows(applyBookingFilter(query, filter))
                    if (error) throw new Error(error.message)
                    return data ?? []
                })),
                occupancyPromise,
            ])

        const receita = currentMonthTx.data?.reduce((acc, curr) => acc + Number(curr.total_value), 0) ?? 0
        const previousRevenue = previousMonthTx.data?.reduce((acc, curr) => acc + Number(curr.total_value), 0) ?? 0

        let receitaChange = 0
        if (previousRevenue > 0) receitaChange = ((receita - previousRevenue) / previousRevenue) * 100
        else if (receita > 0) receitaChange = 100

        return {
            success: true,
            stats: {
                receita,
                receitaChange,
                reservas: bookingCountResult.reduce((total, count) => total + count, 0),
                quadras: courtList.length,
                ativos: new Set(activeAthletesResult.flat().map(b => b.athlete_id)).size,
            },
            occupancy: buildOccupancyRows(courtList.filter(c => occupancyArenas.has(c.arena_id)), occupancyBookings, occupancyPeriodDates),
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar dashboard'
        return { success: false, error: message }
    }
}
