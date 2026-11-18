"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Map as MapIcon, Calendar as CalendarIcon, TrendingUp, Clock } from "lucide-react"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useArena } from "@/contexts/ArenaContext"
import { getDashboardDataAction } from "@/modules/dashboard/actions/dashboardActions"
import { Skeleton } from "@/components/ui/skeleton"
import { canSeeBookings } from '@/modules/bookings/lib/booking-access'
import { OccupancyChart } from "@/modules/dashboard/components/OccupancyChart"
import type { DashboardStats, OccupancyPeriod, OccupancyRow } from "@/modules/dashboard/types/dashboard.types"
import { useRouter, useSearchParams } from "next/navigation"
import { useDbUser } from "@/contexts/UserContext"
import {
    tutorialDashboardOccupancy,
    tutorialDashboardStats,
    tutorialRecentActivity,
} from "@/lib/tutorial-mock-data"

const EMPTY_STATS: DashboardStats = { receita: 0, receitaChange: 0, reservas: 0, quadras: 0, ativos: 0 }

const OCCUPANCY_PERIOD_LABELS: Record<OccupancyPeriod, string> = {
    day: " para hoje",
    week: " na semana",
    month: " no mês",
}

const OCCUPANCY_EMPTY_MESSAGES: Record<OccupancyPeriod, string> = {
    day: "Nenhum dado de ocupação disponível para hoje.",
    week: "Nenhum dado de ocupação disponível para esta semana.",
    month: "Nenhum dado de ocupação disponível para este mês.",
}

function DashboardPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { dbUser, isLoading: isLoadingUser } = useDbUser()
    const { selectedArena, selectedArenaDetails, isLoadingArenas } = useArena()
    const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS)
    const [occupancyData, setOccupancyData] = useState<OccupancyRow[]>([])
    const [occupancyPeriod, setOccupancyPeriod] = useState<OccupancyPeriod>('day')
    const [loadedArena, setLoadedArena] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isOccupancyLoading, setIsOccupancyLoading] = useState(false)
    const hasLoadedOnceRef = useRef(false)
    const latestRequest = useRef(0)
    const occupancyPeriodRef = useRef(occupancyPeriod)
    occupancyPeriodRef.current = occupancyPeriod
    const isTutorial = searchParams.get('tutorial') === '1'
    const displayStats = isTutorial ? tutorialDashboardStats : stats
    const displayOccupancyData = isTutorial ? tutorialDashboardOccupancy : occupancyData

    const clearDashboard = useCallback(() => {
        latestRequest.current++
        setLoadedArena('')
        setStats(EMPTY_STATS)
        setOccupancyData([])
    }, [])

    useEffect(() => {
        if (isTutorial) {
            setIsLoading(false)
            return
        }
        if (isLoadingUser) return
        if (dbUser?.platform_access_level === 'platform_admin') {
            router.replace('/dashboard/admin/platform')
            return
        }
        if (isLoadingArenas) return
        if (selectedArenaDetails?.role === 'Caixa' && !selectedArenaDetails.resources.includes('dashboard') && selectedArenaDetails.resources.includes('stations') && selectedArenaDetails.assignedStationId) {
            // Caixa com estação atribuída: vai direto para a estação
            router.replace(`/dashboard/arenas/${selectedArena}/stations/${selectedArenaDetails.assignedStationId}`)
        } else if (selectedArenaDetails?.role === 'Caixa' && !selectedArenaDetails.resources.includes('dashboard') && selectedArenaDetails.resources.includes('stations') && !selectedArenaDetails.assignedStationId) {
            // Caixa sem estação atribuída: vai para a lista de estações
            router.replace(`/dashboard/arenas/${selectedArena}/stations`)
        }
    }, [dbUser, isLoadingArenas, isLoadingUser, isTutorial, router, selectedArena, selectedArenaDetails])

    useEffect(() => {
        if (isLoadingUser || isLoadingArenas) return
        if (isTutorial || !dbUser || !selectedArena) {
            setIsLoading(false)
            return
        }
        if (dbUser?.platform_access_level === 'platform_admin') {
            setIsLoading(false)
            return
        }
        if (!selectedArenaDetails?.resources.includes('dashboard')) {
            clearDashboard()
            setIsLoading(false)
            return
        }

        let current = true
        async function loadStats() {
            setIsLoading(true)
            const request = ++latestRequest.current
            try {
                const res = await getDashboardDataAction(selectedArena ?? 'all', occupancyPeriodRef.current)
                if (!current || request !== latestRequest.current) return
                if (res.success) {
                    setLoadedArena(selectedArena)
                    setStats(res.stats!)
                    setOccupancyData(res.occupancy!)
                } else clearDashboard()
            } catch {
                if (current && request === latestRequest.current) clearDashboard()
            } finally {
                if (current) {
                    hasLoadedOnceRef.current = true
                    setIsLoading(false)
                }
            }
        }

        loadStats()
        return () => { current = false }
    }, [dbUser, selectedArena, selectedArenaDetails, isLoadingArenas, isLoadingUser, isTutorial, clearDashboard])

    useEffect(() => {
        if (isTutorial) return
        if (!hasLoadedOnceRef.current) return
        if (isLoadingUser || isLoadingArenas) return
        if (dbUser?.platform_access_level === 'platform_admin') return
        if (!selectedArenaDetails?.resources.includes('dashboard')) return

        let current = true
        async function loadOccupancy() {
            setIsOccupancyLoading(true)
            const request = ++latestRequest.current
            try {
                const res = await getDashboardDataAction(selectedArena ?? 'all', occupancyPeriod)
                if (!current || request !== latestRequest.current) return
                if (res.success) {
                    setLoadedArena(selectedArena)
                    setStats(res.stats!)
                    setOccupancyData(res.occupancy!)
                } else clearDashboard()
            } catch {
                if (current && request === latestRequest.current) clearDashboard()
            } finally {
                if (current) setIsOccupancyLoading(false)
            }
        }

        loadOccupancy()
        return () => { current = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [occupancyPeriod, selectedArena, clearDashboard])

    if (!isTutorial && (isLoading || isLoadingUser || isLoadingArenas)) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
                <Skeleton className="h-[400px] w-full" />
            </div>
        )
    }

    if (!selectedArenaDetails?.resources.includes('dashboard')) {
        return <p className="p-6 text-muted-foreground">Selecione um recurso disponível no menu da sua arena.</p>
    }
    if (!isTutorial && loadedArena !== selectedArena) return <p>Indicadores indisponíveis.</p>
    const canSee = (resource: string) => selectedArenaDetails.resources.includes(resource)
    const cards = [
        {
            title: "Receita Total",
            visible: canSee('finance.overview'),
            value: `R$ ${displayStats.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            icon: TrendingUp,
            description: `${displayStats.receitaChange >= 0 ? '+' : ''}${displayStats.receitaChange.toFixed(1)}% em relação ao mês passado`,
            color: displayStats.receitaChange >= 0 ? "text-emerald-500" : "text-red-500",
        },
        {
            title: "Reservas",
            visible: canSeeBookings(selectedArenaDetails.resources),
            value: displayStats.reservas.toString(),
            icon: CalendarIcon,
            description: "Reservas confirmadas hoje",
            color: "text-blue-500",
        },
        {
            title: "Quadras Ativas",
            visible: canSee('spaces'),
            value: displayStats.quadras.toString(),
            icon: MapIcon,
            description: "Prontas para uso",
            color: "text-orange-500",
        },
        {
            title: "Atletas Ativos",
            visible: canSee('athletes') && canSeeBookings(selectedArenaDetails.resources),
            value: displayStats.ativos.toString(),
            icon: Users,
            description: "Jogando este mês",
            color: "text-purple-500",
        },
    ]

    return (
        <div className="space-y-6" data-tutorial="dashboard-content">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground">Bem-vindo de volta! Aqui está um resumo da sua arena.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {cards.filter(card => card.visible).map((card) => (
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
                {canSee('spaces') && canSeeBookings(selectedArenaDetails.resources) && <Card className="col-span-4">
                    <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                        <CardTitle>Ocupação dos espaços{OCCUPANCY_PERIOD_LABELS[occupancyPeriod]}</CardTitle>
                        {!isTutorial && (
                            <Tabs value={occupancyPeriod} onValueChange={(value) => setOccupancyPeriod(value as OccupancyPeriod)}>
                                <TabsList>
                                    <TabsTrigger value="day">Dia</TabsTrigger>
                                    <TabsTrigger value="week">Semana</TabsTrigger>
                                    <TabsTrigger value="month">Mês</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        )}
                    </CardHeader>
                    <CardContent className={`pl-2 transition-opacity ${isOccupancyLoading ? 'opacity-50' : ''}`}>
                        <OccupancyChart data={displayOccupancyData} emptyMessage={OCCUPANCY_EMPTY_MESSAGES[occupancyPeriod]} />
                    </CardContent>
                </Card>}

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Atividade Recente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {(isTutorial ? tutorialRecentActivity : [
                                { title: 'Nenhuma atividade recente', description: 'As últimas ações aparecerão aqui.', time: '' },
                            ]).map((activity) => (
                                <div className="flex items-center" key={`${activity.title}-${activity.description}`}>
                                    <div className="bg-muted p-2 rounded-full mr-4">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">{activity.title}</p>
                                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                                        {activity.time && <p className="text-xs text-muted-foreground">{activity.time}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default function DashboardPage() {
    return (
        <Suspense fallback={null}>
            <DashboardPageContent />
        </Suspense>
    )
}
