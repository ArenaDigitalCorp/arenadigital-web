import { supabase } from "@/shared/database/supabaseClient";

import { startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, addHours } from 'date-fns';

export type DashboardStats = {
    receita: number;
    receitaChange: number;
    reservas: number;
    quadras: number;
    ativos: number;
};

export type OccupancyRow = {
    courtName: string;
    percentage: number;
    booked: number;
    total: number;
};

export class DashboardService {
    /**
     * Resolve arena IDs once. Empty `selectedArenaId` yields [] (avoids querying with invalid id).
     */
    static async getArenaIds(ownerId: string, selectedArenaId: string | "all") {
        if (selectedArenaId === "all") {
            const { data: arenas } = await supabase
                .from('arenas')
                .select('id')
                .eq('owner_id', ownerId);
            return arenas?.map(a => a.id) || [];
        }
        if (!selectedArenaId) return [];
        return [selectedArenaId];
    }

    private static getCurrentDayName(): string {
        const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
        return days[new Date().getDay()];
    }

    private static buildOccupancyRows(
        courts: { id: string; name: string; day_config: unknown }[],
        bookings: { court_id: string; start_time: string; end_time: string }[],
        dayName: string
    ): OccupancyRow[] {
        const occupancyData = courts.map(court => {
            const courtBookings = bookings.filter(b => b.court_id === court.id);

            const dayConfigs = Array.isArray(court.day_config) ? court.day_config : [];
            const configForToday = dayConfigs.find((c: { day?: string; enabled?: boolean }) =>
                c.day?.toLowerCase() === dayName.toLowerCase() ||
                c.day?.toLowerCase().includes(dayName.toLowerCase().split('-')[0])
            );

            if (!configForToday || !configForToday.enabled) {
                return {
                    courtName: court.name,
                    percentage: 0,
                    booked: 0,
                    total: 0
                };
            }

            const startHour = parseInt(configForToday.startTime.split(':')[0], 10);
            const endHour = parseInt(configForToday.endTime.split(':')[0], 10);

            const totalPossibleBookings = endHour >= startHour
                ? endHour - startHour
                : (24 - startHour) + endHour;

            const bookedCount = courtBookings.filter(b => {
                const bStart = new Date(b.start_time);
                const bHour = bStart.getHours();

                if (endHour >= startHour) {
                    return bHour >= startHour && bHour < endHour;
                }
                return bHour >= startHour || bHour < endHour;
            }).length;

            const percentage = totalPossibleBookings > 0
                ? Math.round((bookedCount / totalPossibleBookings) * 100)
                : 0;

            return {
                courtName: court.name,
                percentage: Math.min(percentage, 100),
                booked: bookedCount,
                total: totalPossibleBookings
            };
        });

        return occupancyData.sort((a, b) => a.courtName.localeCompare(b.courtName));
    }

    /**
     * Uma passagem: resolve `arenaIds`, busca quadras uma vez, paraleliza consultas de bookings/transactions.
     * Substitui chamar separadamente getOverviewStats + getOccupancyOverview (menos round-trips duplicados).
     */
    static async getDashboardPageData(
        ownerId: string,
        selectedArenaId: string | "all"
    ): Promise<{ stats: DashboardStats; occupancy: OccupancyRow[] }> {
        const arenaIds = await this.getArenaIds(ownerId, selectedArenaId);
        if (arenaIds.length === 0) {
            return {
                stats: { receita: 0, receitaChange: 0, reservas: 0, quadras: 0, ativos: 0 },
                occupancy: [],
            };
        }

        const now = new Date();
        const todayStart = startOfDay(now).toISOString();
        const todayEnd = endOfDay(now).toISOString();
        const currentMonthStart = startOfMonth(now).toISOString();
        const currentMonthEnd = endOfMonth(now).toISOString();
        const previousMonthDate = subMonths(now, 1);
        const previousMonthStart = startOfMonth(previousMonthDate).toISOString();
        const previousMonthEnd = endOfMonth(previousMonthDate).toISOString();
        const searchLimitStr = addHours(endOfDay(now), 6).toISOString();
        const dayName = this.getCurrentDayName();

        const { data: courts, error: courtsError } = await supabase
            .from('courts')
            .select('id, name, day_config, arena_id')
            .in('arena_id', arenaIds)
            .eq('status', 'ativo');

        if (courtsError) throw courtsError;

        const courtList = courts || [];
        const courtIds = courtList.map(c => c.id);

        const occupancyBookingsPromise =
            courtIds.length === 0
                ? Promise.resolve({ data: [] as { court_id: string; start_time: string; end_time: string }[] })
                : supabase
                    .from('bookings')
                    .select('court_id, start_time, end_time')
                    .in('court_id', courtIds)
                    .in('status', ['confirmed', 'pending'])
                    .gte('start_time', todayStart)
                    .lte('start_time', searchLimitStr);

        const [
            bookingCountResult,
            currentMonthTx,
            previousMonthTx,
            activeAthletesResult,
            occupancyBookingsResult,
        ] = await Promise.all([
            supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .in('arena_id', arenaIds)
                .eq('status', 'confirmed')
                .gte('start_time', todayStart)
                .lte('start_time', todayEnd),
            supabase
                .from('transactions')
                .select('total_value')
                .in('arena_id', arenaIds)
                .eq('type', 'entrada')
                .gte('launch_date', currentMonthStart)
                .lte('launch_date', currentMonthEnd),
            supabase
                .from('transactions')
                .select('total_value')
                .in('arena_id', arenaIds)
                .eq('type', 'entrada')
                .gte('launch_date', previousMonthStart)
                .lte('launch_date', previousMonthEnd),
            supabase
                .from('bookings')
                .select('athlete_id')
                .in('arena_id', arenaIds)
                .eq('status', 'confirmed')
                .gte('start_time', currentMonthStart)
                .lte('start_time', currentMonthEnd)
                .not('athlete_id', 'is', null),
            occupancyBookingsPromise,
        ]);

        const receita =
            currentMonthTx.data?.reduce((acc, curr) => acc + Number(curr.total_value), 0) || 0;
        const previousRevenue =
            previousMonthTx.data?.reduce((acc, curr) => acc + Number(curr.total_value), 0) || 0;

        let receitaChange = 0;
        if (previousRevenue > 0) {
            receitaChange = ((receita - previousRevenue) / previousRevenue) * 100;
        } else if (receita > 0) {
            receitaChange = 100;
        }

        const occupancy = this.buildOccupancyRows(
            courtList,
            occupancyBookingsResult.data || [],
            dayName
        );

        return {
            stats: {
                receita,
                receitaChange,
                reservas: bookingCountResult.count || 0,
                quadras: courtList.length,
                ativos: new Set(activeAthletesResult.data?.map(b => b.athlete_id)).size,
            },
            occupancy,
        };
    }
}
