"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess } from '@/lib/server-auth'
import { subDays } from 'date-fns'

export interface AthleteOverviewItem {
    id: string
    nome: string
    cpf: string | null
    data_nascimento: string | null
    telefone: string | null
    esportes: string[]
    total_reservas: number
    ultima_reserva: string | null
    dias_ate_aniversario?: number
}

function getDaysUntilBirthday(dataNascimento: string | null): number | null {
    if (!dataNascimento) return null
    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Parse date parts directly from the string (avoids UTC-vs-local ambiguity
        // that occurs when new Date("YYYY-MM-DD") is treated as UTC midnight)
        const parts = dataNascimento.split('T')[0].split('-')
        const month = parseInt(parts[1], 10) - 1  // 0-indexed
        const day = parseInt(parts[2], 10)
        const thisYear = today.getFullYear()

        let birthday = new Date(thisYear, month, day)
        birthday.setHours(0, 0, 0, 0)

        let diff = Math.round((birthday.getTime() - today.getTime()) / (86400 * 1000))
        if (diff < 0) {
            birthday = new Date(thisYear + 1, month, day)
            birthday.setHours(0, 0, 0, 0)
            diff = Math.round((birthday.getTime() - today.getTime()) / (86400 * 1000))
        }
        return diff
    } catch {
        return null
    }
}

export interface BarCategory {
    id: string
    label: string
    count: number
    color: string
    description: string
    athletes: AthleteOverviewItem[]
}

export async function getClientesOverviewAction(arenaId: string): Promise<{
    success: boolean
    categories?: BarCategory[]
    error?: string
}> {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const supabase = getSupabaseAdmin()

        // Fetch all athletes linked to this arena
        const { data: athletesRaw, error: athletesError } = await supabase
            .from('atleta')
            .select(`
                id,
                nome_perfil,
                cpf,
                data_nascimento,
                telefone,
                arenas_atleta!inner(id_arena),
                atleta_esportes(sport:id_esporte(name))
            `)
            .eq('arenas_atleta.id_arena', arenaId)
            .order('nome_perfil', { ascending: true })

        if (athletesError) throw new Error(athletesError.message)

        const athletes: AthleteOverviewItem[] = (athletesRaw ?? []).map((a: any) => ({
            id: a.id,
            nome: a.nome_perfil ?? '',
            cpf: a.cpf ?? null,
            data_nascimento: a.data_nascimento ?? null,
            telefone: a.telefone ?? null,
            esportes: (a.atleta_esportes ?? []).map((e: any) => e.sport?.name).filter(Boolean),
            total_reservas: 0,
            ultima_reserva: null,
        }))

        const athleteIds = athletes.map(a => a.id)
        if (athleteIds.length === 0) {
            return { success: true, categories: buildCategories(athletes, []) }
        }

        // Fetch all bookings for these athletes in this arena
        const { data: bookingsRaw, error: bookingsError } = await supabase
            .from('bookings')
            .select('athlete_id, start_time, status')
            .eq('arena_id', arenaId)
            .in('athlete_id', athleteIds)
            .neq('status', 'cancelled')
            .order('start_time', { ascending: false })

        if (bookingsError) throw new Error(bookingsError.message)

        const bookings = bookingsRaw ?? []

        // Enrich athletes with booking data
        const bookingsByAthlete = new Map<string, { count: number; latest: string | null }>()
        for (const b of bookings) {
            if (!b.athlete_id) continue
            const existing = bookingsByAthlete.get(b.athlete_id)
            if (!existing) {
                bookingsByAthlete.set(b.athlete_id, { count: 1, latest: b.start_time })
            } else {
                existing.count += 1
                if (!existing.latest || b.start_time > existing.latest) {
                    existing.latest = b.start_time
                }
            }
        }

        const enriched = athletes.map(a => ({
            ...a,
            total_reservas: bookingsByAthlete.get(a.id)?.count ?? 0,
            ultima_reserva: bookingsByAthlete.get(a.id)?.latest ?? null,
        }))

        return { success: true, categories: buildCategories(enriched, bookings) }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

function buildCategories(
    athletes: AthleteOverviewItem[],
    _bookings: any[]
): BarCategory[] {
    const ninetyDaysAgo = subDays(new Date(), 90).toISOString()
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString()

    const aniversariantes = athletes
        .map(a => ({ ...a, dias_ate_aniversario: getDaysUntilBirthday(a.data_nascimento) ?? 999 }))
        .filter(a => a.dias_ate_aniversario <= 6)
        .sort((a, b) => a.dias_ate_aniversario - b.dias_ate_aniversario)

    const semReserva = athletes.filter(a => a.total_reservas === 0)
    const umaReserva = athletes.filter(a => a.total_reservas === 1)
    const frequentes = athletes.filter(a => a.total_reservas >= 5)
    const inativos = athletes.filter(
        a => a.total_reservas > 0 && (!a.ultima_reserva || a.ultima_reserva < ninetyDaysAgo)
    )
    const recentes = athletes.filter(
        a => a.ultima_reserva && a.ultima_reserva >= thirtyDaysAgo
    )

    return [
        {
            id: 'sem_reserva',
            label: 'Cadastrados sem reserva',
            description: 'Atletas cadastrados na arena mas que nunca fizeram uma reserva',
            count: semReserva.length,
            color: 'var(--arena-button)',
            athletes: semReserva,
        },
        {
            id: 'uma_reserva',
            label: 'Somente 1 reserva',
            description: 'Atletas que realizaram exatamente 1 reserva',
            count: umaReserva.length,
            color: '#3B82F6',
            athletes: umaReserva,
        },
        {
            id: 'recentes',
            label: 'Ativos recentes',
            description: 'Atletas com reserva nos últimos 30 dias',
            count: recentes.length,
            color: '#10B981',
            athletes: recentes,
        },
        {
            id: 'frequentes',
            label: 'Clientes frequentes',
            description: 'Atletas com 5 ou mais reservas realizadas',
            count: frequentes.length,
            color: '#8B5CF6',
            athletes: frequentes,
        },
        {
            id: 'inativos',
            label: 'Clientes inativos',
            description: 'Atletas com reservas, mas sem atividade nos últimos 90 dias',
            count: inativos.length,
            color: '#94A3B8',
            athletes: inativos,
        },
        {
            id: 'aniversariantes',
            label: 'Aniversariantes',
            description: 'Clientes que fazem aniversário nos próximos 7 dias',
            count: aniversariantes.length,
            color: '#F59E0B',
            athletes: aniversariantes,
        },
    ]
}
