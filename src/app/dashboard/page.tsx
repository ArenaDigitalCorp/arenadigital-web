"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart,
    Users,
    Map as MapIcon,
    Calendar as CalendarIcon,
    TrendingUp,
    Clock
} from "lucide-react";
import { useEffect, useState } from "react";
import { useUserSync } from "@/hooks/useUserSync";
import { DashboardService } from "@/modules/dashboard/services/dashboardService";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
    const { dbUser, isLoading: userLoading } = useUserSync();
    const [stats, setStats] = useState({ receita: 0, receitaChange: 0, reservas: 0, quadras: 0, ativos: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            if (dbUser) {
                const data = await DashboardService.getOverviewStats(dbUser.id);
                setStats(data);
                setIsLoading(false);
            } else if (!userLoading) {
                setIsLoading(false);
            }
        }
        loadStats();
    }, [dbUser, userLoading]);

    if (isLoading || userLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                    ))}
                </div>
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
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
            description: "Reservas confirmadas",
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
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground">
                    Bem-vindo de volta! Aqui está um resumo da sua arena.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {cards.map((card) => (
                    <Card key={card.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {card.title}
                            </CardTitle>
                            <card.icon className={`h-4 w-4 ${card.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{card.value}</div>
                            <p className="text-xs text-muted-foreground">
                                {card.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Visão Geral</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/30">
                            <div className="text-center space-y-2">
                                <BarChart className="h-10 w-10 text-muted-foreground mx-auto opacity-20" />
                                <p className="text-sm text-muted-foreground">Gráfico de desempenho será exibido aqui conforme os dados forem acumulados.</p>
                            </div>
                        </div>
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
                                    <p className="text-sm font-medium leading-none">
                                        Nenhuma atividade recente
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        As últimas ações aparecerão aqui.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
