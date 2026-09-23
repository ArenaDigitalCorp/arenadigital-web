"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination'
import { startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, addHours, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import type { DashboardStats, OccupancyPeriod, OccupancyRow } from '@/modules/dashboard/types/dashboard.types'

async function resolveArenaIds(supabase: ReturnType<typeof getSupabaseAdmin>, ownerId: string, selectedArenaId: string | 'all') {
    if (selectedArenaId === 'all') {
        const { data: linkedArenas, error: linkedError } = await supabase
            .from('arena_users')
            .select('arena_id')
            .eq('user_id', ownerId)
            .in('status', ['Ativo', 'ativo', 'active'])

        if (linkedError) {
            throw new Error(`Failed to load linked arenas: ${linkedError.message}`)
        }

        const linkedArenaIds = linkedArenas?.map((arena) => arena.arena_id) ?? []

        let query = supabase.from('arenas').select('id')
        query = linkedArenaIds.length > 0
            ? query.or(`owner_id.eq.${ownerId},id.in.(${linkedArenaIds.join(',')})`)
            : query.eq('owner_id', ownerId)

        const { data, error } = await query
        if (error) {
            throw new Error(`Failed to load arenas: ${error.message}`)
        }

        return data?.map(a => a.id) ?? []
    }
    if (!selectedArenaId) return []
    return [selectedArenaId]
}

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

export async function getDashboardDataAction(
    selectedArenaId: string | 'all',
    occupancyPeriod: OccupancyPeriod = 'day'
): Promise<{ success: boolean; stats?: DashboardStats; occupancy?: OccupancyRow[]; error?: string }> {
    try {
        const { dbUserId } = await requireAuthenticatedDbUser()
        const supabase = getSupabaseAdmin()
        if (selectedArenaId !== 'all') {
            await assertArenaBackofficeAccess(selectedArenaId)
        }
        const arenaIds = await resolveArenaIds(supabase, dbUserId, selectedArenaId)

        if (arenaIds.length === 0) {
            return {
                success: true,
                stats: { receita: 0, receitaChange: 0, reservas: 0, quadras: 0, ativos: 0 },
                occupancy: [],
            }
        }

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

        const { data: courts } = await supabase
            .from('courts')
            .select('id, name, day_config, arena_id')
            .in('arena_id', arenaIds)
            .eq('status', 'ativo')

        const courtList = courts ?? []
        const courtIds = courtList.map(c => c.id)

        const occupancyBookingsPromise = courtIds.length === 0
            ? Promise.resolve({ data: [] as any[], error: null })
            : fetchAllSupabaseRows(supabase
                .from('bookings')
                .select('court_id, start_time, end_time')
                .in('court_id', courtIds)
                .in('status', ['confirmed', 'pending'])
                .gte('start_time', occupancyRangeStartStr)
                .lte('start_time', occupancyRangeEndStr)
                .order('id', { ascending: true }))

        const [bookingCountResult, currentMonthTx, previousMonthTx, activeAthletesResult, occupancyBookingsResult] =
            await Promise.all([
                supabase.from('bookings').select('*', { count: 'exact', head: true })
                    .in('arena_id', arenaIds).eq('status', 'confirmed')
                    .gte('start_time', todayStart).lte('start_time', todayEnd),
                fetchAllSupabaseRows(supabase.from('transactions').select('total_value')
                    .in('arena_id', arenaIds).eq('type', 'entrada')
                    .gte('launch_date', currentMonthStart).lte('launch_date', currentMonthEnd)
                    .order('id', { ascending: true })),
                fetchAllSupabaseRows(supabase.from('transactions').select('total_value')
                    .in('arena_id', arenaIds).eq('type', 'entrada')
                    .gte('launch_date', previousMonthStart).lte('launch_date', previousMonthEnd)
                    .order('id', { ascending: true })),
                fetchAllSupabaseRows(supabase.from('bookings').select('athlete_id')
                    .in('arena_id', arenaIds).eq('status', 'confirmed')
                    .gte('start_time', currentMonthStart).lte('start_time', currentMonthEnd)
                    .not('athlete_id', 'is', null)
                    .order('id', { ascending: true })),
                occupancyBookingsPromise,
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
                reservas: bookingCountResult.count ?? 0,
                quadras: courtList.length,
                ativos: new Set(activeAthletesResult.data?.map(b => b.athlete_id)).size,
            },
            occupancy: buildOccupancyRows(courtList, occupancyBookingsResult.data ?? [], occupancyPeriodDates),
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar dashboard'
        return { success: false, error: message }
    }
}
