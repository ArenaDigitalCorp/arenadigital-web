"use server"

import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseRotativoRepository } from '@/modules/rotativos/repositories/SupabaseRotativoRepository'
import { revalidatePath } from 'next/cache'
import { createRotativoInputSchema } from '@/modules/rotativos/schemas/rotativo.schema'

export async function createRotativoAction(formData: unknown) {
    const parsed = createRotativoInputSchema.safeParse(formData)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
    }

    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const supabase = getSupabaseAdmin()
        const { data: dbUser } = await supabase.from('users').select('id').eq('clerk_user_id', clerkId).single()
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const { arenaId, ...rest } = parsed.data
        const repo = new SupabaseRotativoRepository(supabase)

        await repo.create({ ...rest, id_arena: arenaId })

        revalidatePath('/dashboard/rotativo')
        return { success: true }
    } catch (error: any) {
        console.error("Error in createRotativoAction:", error)
        return { success: false, error: error.message || "Erro ao criar rotativo" }
    }
}

export async function getRotativosAction(arenaId: string, date: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const supabase = getSupabaseAdmin()
        const { data: dbUser } = await supabase.from('users').select('id').eq('clerk_user_id', clerkId).single()
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const repo = new SupabaseRotativoRepository(supabase)
        const data = await repo.findByDate(arenaId, date)
        return { success: true, data }
    } catch (error: any) {
        console.error("Error in getRotativosAction:", error)
        return { success: false, error: error.message || "Erro ao buscar rotativos" }
    }
}

export async function registerAthleteAction(rotativoId: string, athleteId: string, value: number) {
    try {
        const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
        await repo.registerAthlete(rotativoId, athleteId, value)
        revalidatePath('/dashboard/rotativo')
        return { success: true }
    } catch (error: any) {
        console.error("Error in registerAthleteAction:", error)
        return { success: false, error: error.message || "Erro ao registrar atleta" }
    }
}

export async function getRotativosByMonthAction(arenaId: string, startDate: string, endDate: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
        const data = await repo.findByMonth(arenaId, startDate, endDate)
        return { success: true, data }
    } catch (error: any) {
        console.error("Error in getRotativosByMonthAction:", error)
        return { success: false, error: error.message || "Erro ao buscar rotativos do mês" }
    }
}

export async function getParticipantsAction(rotativoId: string) {
    try {
        const repo = new SupabaseRotativoRepository(getSupabaseAdmin())
        const data = await repo.getInscritos(rotativoId)
        return { success: true, data }
    } catch (error: any) {
        console.error("Error in getParticipantsAction:", error)
        return { success: false, error: error.message || "Erro ao buscar participantes" }
    }
}
