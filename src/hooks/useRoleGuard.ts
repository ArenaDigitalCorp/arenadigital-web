"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useArena } from "@/contexts/ArenaContext"

/**
 * Guard de acesso baseado em perfil.
 *
 * Perfis permitidos:
 *   - Administrador: Owner | Gestor → acesso irrestrito
 *   - Usuário comum: Atendente       → acesso padrão (sem Espaços, Rel, Config)
 *   - Caixa: Caixa                   → somente Estações
 *
 * @param allowedRoles Lista de roles que podem acessar a rota.
 *                     Usar ['admin'] para Owner/Gestor, ou roles explícitas.
 */
export function useRoleGuard(allowedRoles: Array<'Owner' | 'Gestor' | 'Atendente' | 'Caixa' | 'admin'>) {
    const router = useRouter()
    const { selectedArena, selectedArenaDetails, isLoadingArenas } = useArena()

    useEffect(() => {
        if (isLoadingArenas || !selectedArenaDetails) return

        const role = selectedArenaDetails.role
        const isOwner = selectedArenaDetails.isOwner

        // 'admin' é um alias para Owner + Gestor
        const hasAccess = allowedRoles.some((allowed) => {
            if (allowed === 'admin') return isOwner || role === 'Gestor'
            return role === allowed || (allowed === 'Owner' && isOwner)
        })

        if (!hasAccess) {
            // Caixa → redirecionar para estações
            if (role === 'Caixa') {
                if (selectedArenaDetails.assignedStationId) {
                    router.replace(`/dashboard/arenas/${selectedArena}/stations/${selectedArenaDetails.assignedStationId}`)
                } else {
                    router.replace(`/dashboard/arenas/${selectedArena}/stations`)
                }
            } else {
                // Demais perfis sem acesso → dashboard
                router.replace('/dashboard')
            }
        }
    }, [isLoadingArenas, selectedArenaDetails, selectedArena, router, allowedRoles])

    const isLoading = isLoadingArenas || !selectedArenaDetails
    const role = selectedArenaDetails?.role
    const isOwner = selectedArenaDetails?.isOwner ?? false

    const hasAccess = !isLoading && allowedRoles.some((allowed) => {
        if (allowed === 'admin') return isOwner || role === 'Gestor'
        return role === allowed || (allowed === 'Owner' && isOwner)
    })

    return { isLoading, hasAccess }
}
