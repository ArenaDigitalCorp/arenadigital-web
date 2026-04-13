"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Map as MapIcon, Calendar as CalendarIcon, TrendingUp, Clock } from "lucide-react"
import { useEffect, useState } from "react"
import { useArena } from "@/contexts/ArenaContext"
import { getDashboardDataAction } from "@/modules/dashboard/actions/dashboardActions"
import { Skeleton } from "@/components/ui/skeleton"
import { OccupancyChart } from "@/modules/dashboard/components/OccupancyChart"
import type { DashboardStats, OccupancyRow } from "@/modules/dashboard/services/dashboardService"

export default function DashboardPage() {
    const { selectedArena, isLoadingArenas } = useArena()
    const [stats, setStats] = useState<DashboardStats>({ receita: 0, receitaChange: 0, reservas: 0, quadras: 0, ativos: 0 })
    const [occupancyData, setOccupancyData] = useState<OccupancyRow[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (isLoadingArenas) return

        async function loadStats() {
            setIsLoading(true)
            try {
                const res = await getDashboardDataAction(selectedArena ?? 'all')
                if (res.success) {
                    setStats(res.stats!)
                    setOccupancyData(res.occupancy!)
                }
            } finally {
                setIsLoading(false)
            }
        }

        loadStats()
    }, [selectedArena, isLoadingArenas])

    if (isLoading || isLoadingArenas) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
                <Skeleton className="h-[400px] w-full" />
            </div>
        )
    }

    const cards = [
        {
            title: "Receita Total",
            value: `R$ ${stats.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            icon: TrendingUp,
            description: `${stats.receitaChange >= 0 ? '+' : ''}${stats.receitaChange.toFixed(1)}% em relação ao mês passado`,
            color: stats.receitaChange >= 0 ? "text-emerald-500" : "text-red-500",
        },
        {
            title: "Reservas",
            value: stats.reservas.toString(),
            icon: CalendarIcon,
            description: "Reservas confirmadas hoje",
            color: "text-blue-500",
        },
        {
            title: "Quadras Ativas",
            value: stats.quadras.toString(),
            icon: MapIcon,
            description: "Prontas para uso",
            color: "text-orange-500",
        },
        {
            title: "Atletas Ativos",
            value: stats.ativos.toString(),
            icon: Users,
            description: "Jogando este mês",
            color: "text-purple-500",
        },
    ]

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground">Bem-vindo de volta! Aqui está um resumo da sua arena.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {cards.map((card) => (
                    <Card key={card.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                            <card.icon className={`h-4 w-4 ${card.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{card.value}</div>
                            <p className="text-xs text-muted-foreground">{card.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Ocupação dos espaços para hoje</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <OccupancyChart data={occupancyData} />
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Atividade Recente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            <div className="flex items-center">
                                <div className="bg-muted p-2 rounded-full mr-4">
                                    <Clock className="h-4 w-4" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">Nenhuma atividade recente</p>
                                    <p className="text-sm text-muted-foreground">As últimas ações aparecerão aqui.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
