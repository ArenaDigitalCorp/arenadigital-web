"use client"
import React, { useState } from "react"
import { useRouter } from "next/navigation"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AthletesList } from "@/modules/athletes/components/AthletesList"
import { AthleteRegistrationModal } from "@/modules/athletes/components/AthleteRegistrationModal"
import { useArena } from "@/contexts/ArenaContext"


export default function AthletesPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const resolvedParams = React.use(params);
    const router = useRouter()
    const { arenas } = useArena()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    const currentArena = arenas.find((arena) => arena.id === resolvedParams.arenaId)

    React.useEffect(() => {
        if (currentArena?.role === 'Caixa' && currentArena.assignedStationId) {
            router.replace(`/dashboard/arenas/${resolvedParams.arenaId}/stations/${currentArena.assignedStationId}`)
        }
    }, [currentArena, resolvedParams.arenaId, router])

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-arena-navy-800">Atletas</h1>
                    <p className="text-muted-foreground">
                        Faça a gestão dos atletas, envie e desconte moedas.
                    </p>
                </div>
                <Button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-arena-button hover:bg-arena-button-hover text-white font-semibold shadow-sm"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Cadastrar atleta
                </Button>
            </div>

            <AthletesList arenaId={resolvedParams.arenaId} key={refreshTrigger} />

            <AthleteRegistrationModal
                arenaId={resolvedParams.arenaId}
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                onSuccess={() => {
                    setRefreshTrigger(prev => prev + 1)
                }}
            />
        </div>
    )
}
