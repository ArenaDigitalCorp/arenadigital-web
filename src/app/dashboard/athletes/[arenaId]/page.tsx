"use client"
import React, { useState } from "react"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AthletesList } from "@/modules/athletes/components/AthletesList"
import { AthleteRegistrationModal } from "@/modules/athletes/components/AthleteRegistrationModal"


export default function AthletesPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const resolvedParams = React.use(params);
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-[#002B40]">Atletas</h1>
                    <p className="text-muted-foreground">
                        Faça a gestão dos atletas, envie e desconte moedas.
                    </p>
                </div>
                <Button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-[#FF6B00] hover:bg-[#E66000] text-white gap-2 px-6 py-6 h-auto text-base rounded-lg font-semibold shadow-md active:scale-95 transition-all"
                >
                    Vincular atleta
                    <Plus className="h-5 w-5" />
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
