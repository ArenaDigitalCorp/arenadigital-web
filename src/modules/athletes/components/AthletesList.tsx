"use client"

import { useEffect, useState, useCallback } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { AthleteService } from "@/modules/athletes/services/athleteService"
import { AthletesTable, type Athlete } from "./AthletesTable"

interface AthletesListProps {
    arenaId: string | null
}

export function AthletesList({ arenaId }: AthletesListProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [athletes, setAthletes] = useState<Athlete[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const loadAthletes = useCallback(async () => {
        if (!arenaId) return
        try {
            setIsLoading(true)
            const data = await AthleteService.getAthletesByArena(arenaId, searchTerm)
            setAthletes(data)
        } catch (error) {
            console.error("Error loading athletes:", error)
        } finally {
            setIsLoading(false)
        }
    }, [arenaId, searchTerm])

    useEffect(() => {
        const timer = setTimeout(() => { loadAthletes() }, 300)
        return () => clearTimeout(timer)
    }, [loadAthletes])

    if (!arenaId) {
        return (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
                Carregando dados da arena...
            </div>
        )
    }

    return (
        <Card className="border-none shadow-sm">
            <CardContent className="p-0">
                <div className="p-6 space-y-6">
                    <h2 className="text-xl font-semibold text-[#002B40]">Atletas vinculados</h2>

                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por atleta"
                            className="pl-10 h-11"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <AthletesTable athletes={athletes} isLoading={isLoading} />
                </div>
            </CardContent>
        </Card>
    )
}
