"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Eye, MoreVertical } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"

interface Props {
    arenaId: string
    initialStations: any[]
}

export function StationsPageClient({ arenaId, initialStations }: Props) {
    const [stations] = useState<any[]>(initialStations)

    return (
        <TooltipProvider>
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">Estações</h1>
                        <p className="text-arena-navy-800/60 font-medium text-sm">Gerencie suas estações, caixas, comandas e itens.</p>
                    </div>
                    <Link href={`/dashboard/arenas/${arenaId}/stations/new`}>
                        <Button className="bg-arena-button hover:bg-arena-button-hover text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-orange-500/20">
                            Cadastrar Estação +
                        </Button>
                    </Link>
                </div>

                <div className="flex items-center border-b border-arena-navy-800/10 gap-8">
                    <span className="pb-4 font-bold text-sm text-arena-navy-800 relative">
                        Estações
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#20B2AA]" />
                    </span>
                </div>

                {stations.length === 0 ? (
                    <Card className="bg-white/50 border-dashed border-2 py-20 flex flex-col items-center justify-center">
                        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                            <Plus className="h-8 w-8 text-arena-navy-800/20" />
                        </div>
                        <p className="text-arena-navy-800/40 font-medium text-lg">Nenhuma estação cadastrada aqui.</p>
                        <Link href={`/dashboard/arenas/${arenaId}/stations/new`} className="mt-4">
                            <Button variant="outline" className="text-arena-navy-800/60 border-arena-navy-800/10">
                                Cadastrar Primeira Estação
                            </Button>
                        </Link>
                    </Card>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {stations.map((station) => (
                            <Card key={station.id} className="overflow-hidden border-none shadow-lg rounded-xl group relative">
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
                                <CardContent className="p-0">
                                    <div className="bg-gradient-to-br from-[#FFD043] to-[#FFB01F] p-4 relative">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-extrabold text-arena-navy-800 text-sm uppercase tracking-tight">{station.name}</h4>
                                            <Link href={`/dashboard/arenas/${arenaId}/stations/${station.id}/edit`}>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-arena-navy-800/40 hover:bg-black/5">
                                                    <MoreVertical className="h-3 w-3" />
                                                </Button>
                                            </Link>
                                        </div>

                                        <div className="space-y-0.5 mb-2">
                                            <div className="flex items-center gap-1.5 font-black text-arena-navy-800 text-xl">
                                                Comandas pendentes: {station.metrics?.pending || 0}
                                            </div>
                                            <div className="text-[10px] font-bold text-arena-navy-800/60 uppercase tracking-tighter italic">
                                                Total fechadas: {station.metrics?.closedToday || 0}
                                            </div>
                                            <div className="text-[10px] font-bold text-arena-navy-800/60 uppercase tracking-tighter italic">
                                                Total abertas: {station.metrics?.openedToday || 0}
                                            </div>
                                        </div>

                                        <div className="flex items-end justify-between">
                                            <span className="text-arena-navy-800 text-[10px] font-black opacity-40 uppercase tracking-tighter">hoje</span>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Link
                                                        href={`/dashboard/arenas/${arenaId}/stations/${station.id}`}
                                                        className="text-arena-navy-800/40 hover:text-arena-navy-800 transition-colors"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Ver Detalhes</p></TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </TooltipProvider>
    )
}
