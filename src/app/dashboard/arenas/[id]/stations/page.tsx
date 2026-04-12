"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Eye, MoreVertical } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StationService } from "@/modules/stations/services/stationService";
import { OrderService } from "@/modules/stations/services/orderService";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export default function StationsPage() {
    const params = useParams();
    const id = params.id as string;
    const [stations, setStations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"estacoes">("estacoes");

    useEffect(() => {
        async function loadStations() {
            if (id) {
                try {
                    const data = await StationService.getStationsByArena(id);

                    const stationIds = data.map((s: { id: string }) => s.id);
                    const metricsByStation = await OrderService.getStationMetricsBatch(stationIds);
                    const stationsWithMetrics = data.map((station: { id: string }) => ({
                        ...station,
                        metrics: metricsByStation[station.id] ?? {
                            pending: 0,
                            closedToday: 0,
                            openedToday: 0,
                        },
                    }));

                    setStations(stationsWithMetrics);
                } catch (error) {
                    console.error("Error loading stations:", error);
                    toast.error("Erro ao carregar estações.");
                } finally {
                    setIsLoading(false);
                }
            }
        }

        loadStations();
    }, [id]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-black text-[#002B40] tracking-tight">Estações</h1>
                    <p className="text-[#002B40]/60 font-medium text-sm">Gerencie suas estações, caixas, comandas e itens.</p>
                </div>
                <Link href={`/dashboard/arenas/${id}/stations/new`}>
                    <Button className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-orange-500/20">
                        Cadastrar Estação +
                    </Button>
                </Link>
            </div>

            {/* Tabs */}
            <div className="flex items-center border-b border-[#002B40]/10 gap-8">
                <button
                    onClick={() => setActiveTab("estacoes")}
                    className={cn(
                        "pb-4 font-bold text-sm transition-all relative",
                        activeTab === "estacoes" ? "text-[#002B40]" : "text-[#002B40]/40"
                    )}
                >
                    Estações
                    {activeTab === "estacoes" && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#20B2AA]" />
                    )}
                </button>
            </div>

            {stations.length === 0 ? (
                <Card className="bg-white/50 border-dashed border-2 py-20 flex flex-col items-center justify-center">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                        <Plus className="h-8 w-8 text-[#002B40]/20" />
                    </div>
                    <p className="text-[#002B40]/40 font-medium text-lg">Nenhuma estação cadastrada aqui.</p>
                    <Link href={`/dashboard/arenas/${id}/stations/new`} className="mt-4">
                        <Button variant="outline" className="text-[#002B40]/60 border-[#002B40]/10">
                            Cadastrar Primeira Estação
                        </Button>
                    </Link>
                </Card>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {stations.map((station) => (
                        <Card key={station.id} className="overflow-hidden border-none shadow-lg rounded-xl group relative">
                            {/* Card Image */}
                            <div className="aspect-[16/9] relative bg-muted">
                                <Image
                                    src={
                                        station.image_url ||
                                        (station.station_type?.name === 'Bar' ? "/bg_img_bar.png" :
                                            station.station_type?.name === 'Loja' ? "/bg_img_lojaesporte.png" :
                                                "/placeholder-station.jpg")
                                    }
                                    alt={station.name}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            </div>

                            {/* Card Content with Gradient */}
                            <CardContent className="p-0">
                                <div className="bg-gradient-to-br from-[#FFD043] to-[#FFB01F] p-4 relative">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-extrabold text-[#002B40] text-sm uppercase tracking-tight">
                                            {station.name}
                                        </h4>
                                        <Link href={`/dashboard/arenas/${id}/stations/${station.id}/edit`}>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-[#002B40]/40 hover:bg-black/5">
                                                <MoreVertical className="h-3 w-3" />
                                            </Button>
                                        </Link>
                                    </div>

                                    {/* Metrics/Stats */}
                                    <div className="space-y-0.5 mb-2">
                                        <div className="flex items-center gap-1.5 font-black text-[#002B40] text-xl">
                                            Comandas pendentes: {station.metrics?.pending || 0}
                                        </div>
                                        <div className="text-[10px] font-bold text-[#002B40]/60 uppercase tracking-tighter italic">
                                            Total fechadas: {station.metrics?.closedToday || 0}
                                        </div>
                                        <div className="text-[10px] font-bold text-[#002B40]/60 uppercase tracking-tighter italic">
                                            Total abertas: {station.metrics?.openedToday || 0}
                                        </div>
                                    </div>

                                    {/* Footer Content */}
                                    <div className="flex items-end justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[#002B40] text-[10px] font-black opacity-40 uppercase tracking-tighter">
                                                hoje
                                            </span>
                                        </div>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Link
                                                        href={`/dashboard/arenas/${id}/stations/${station.id}`}
                                                        className="text-[#002B40]/40 hover:text-[#002B40] transition-colors"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Ver Detalhes</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
