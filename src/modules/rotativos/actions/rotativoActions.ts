"use server"

import { auth } from '@clerk/nextjs/server'
import { UserService } from '@/modules/users/services/userService'
import { ArenaService } from '@/modules/arenas/services/arenaService'
import { RotativoService } from '@/modules/rotativos/services/rotativoService'
import { revalidatePath } from 'next/cache'

export async function createRotativoAction(formData: any) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUser = await UserService.getUserByClerkId(clerkId)
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const { arenaId, ...rest } = formData

        await RotativoService.createRotativo({
            ...rest,
            id_arena: arenaId
        })

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

        const dbUser = await UserService.getUserByClerkId(clerkId)
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const data = await RotativoService.getRotativosByDate(arenaId, date)
        return { success: true, data }
    } catch (error: any) {
        console.error("Error in getRotativosAction:", error)
        return { success: false, error: error.message || "Erro ao buscar rotativos" }
    }
}

export async function registerAthleteAction(rotativoId: string, athleteId: string, value: number) {
    try {
        await RotativoService.registerAthlete(rotativoId, athleteId, value)
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

        const data = await RotativoService.getRotativosByMonth(arenaId, startDate, endDate)
        return { success: true, data }
    } catch (error: any) {
        console.error("Error in getRotativosByMonthAction:", error)
        return { success: false, error: error.message || "Erro ao buscar rotativos do mês" }
    }
}

export async function getParticipantsAction(rotativoId: string) {
    try {
        const data = await RotativoService.getRotativoInscritos(rotativoId)
        return { success: true, data }
    } catch (error: any) {
        console.error("Error in getParticipantsAction:", error)
        return { success: false, error: error.message || "Erro ao buscar participantes" }
    }
}
