import { supabase } from "@/shared/database/supabaseClient";

import { startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';

export class DashboardService {
    static async getOverviewStats(ownerId: string) {
        // 1. Get Arena IDs for this owner
        const { data: arenas } = await supabase
            .from('arenas')
            .select('id')
            .eq('owner_id', ownerId);

        const arenaIds = arenas?.map(a => a.id) || [];

        if (arenaIds.length === 0) {
            return { receita: 0, receitaChange: 0, reservas: 0, quadras: 0, ativos: 0 };
        }

        // 2. Count Bookings
        const { count: bookingCount } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .in('arena_id', arenaIds)
            .eq('status', 'confirmed');

        // 3. Count Courts
        const { count: courtCount } = await supabase
            .from('courts')
            .select('*', { count: 'exact', head: true })
            .in('arena_id', arenaIds)
            .eq('is_active', true);

        // 4. Calculate Revenue (Current Month vs Previous Month)
        const now = new Date();
        const currentMonthStart = startOfMonth(now).toISOString();
        const currentMonthEnd = endOfMonth(now).toISOString();

        const previousMonthDate = subMonths(now, 1);
        const previousMonthStart = startOfMonth(previousMonthDate).toISOString();
        const previousMonthEnd = endOfMonth(previousMonthDate).toISOString();

        // Fetch Current Month Revenue
        const { data: currentMonthData } = await supabase
            .from('transactions')
            .select('total_value')
            .in('arena_id', arenaIds)
            .eq('type', 'entrada')
            .gte('launch_date', currentMonthStart)
            .lte('launch_date', currentMonthEnd);

        const currentRevenue = currentMonthData?.reduce((acc, curr) => acc + Number(curr.total_value), 0) || 0;

        // Fetch Previous Month Revenue
        const { data: previousMonthData } = await supabase
            .from('transactions')
            .select('total_value')
            .in('arena_id', arenaIds)
            .eq('type', 'entrada')
            .gte('launch_date', previousMonthStart)
            .lte('launch_date', previousMonthEnd);

        const previousRevenue = previousMonthData?.reduce((acc, curr) => acc + Number(curr.total_value), 0) || 0;

        // Calculate Percentage Change
        let percentageChange = 0;
        if (previousRevenue > 0) {
            percentageChange = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
        } else if (currentRevenue > 0) {
            percentageChange = 100; // If previous was 0 and current is > 0, consider 100% increase (or potentially infinite, but 100 is safer for UI)
        }

        return {
            receita: currentRevenue,
            receitaChange: percentageChange,
            reservas: bookingCount || 0,
            quadras: courtCount || 0,
            ativos: 0 // Placeholder
        };
    }
}
