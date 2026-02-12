import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Dumbbell } from "lucide-react";
import Link from "next/link";
import { StationService } from "@/modules/stations/services/stationService";

interface StationsPageProps {
    params: Promise<{
        id: string; // Arena ID
    }>;
}

export default async function StationsPage({ params }: StationsPageProps) {
    const { id } = await params;
    const stations = await StationService.getStationsByArena(id);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Estações</h2>
                    <p className="text-muted-foreground">
                        Gerencie as estações da sua arena.
                    </p>
                </div>
                <Link href={`/dashboard/arenas/${id}/stations/new`}>
                    <Button className="bg-[#FF6B00] hover:bg-[#E66000] text-white">
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Estação
                    </Button>
                </Link>
            </div>

            {stations && stations.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {stations.map((station) => (
                        <Card key={station.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {station.name}
                                </CardTitle>
                                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground mb-2">
                                    {station.status === 'ativo' ? (
                                        <span className="text-emerald-500 font-medium">Ativo</span>
                                    ) : (
                                        <span className="text-red-500 font-medium">{station.status}</span>
                                    )}
                                    <span className="text-muted-foreground">•</span>
                                    <span className="font-medium">{station.station_type?.name || 'Sem tipo'}</span>
                                </div>
                                <Link href={`/dashboard/arenas/${id}/stations/${station.id}/edit`}>
                                    <Button variant="outline" size="sm" className="w-full">
                                        Editar
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed rounded-lg bg-muted/30">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                        <Dumbbell className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">Nenhuma estação cadastrada</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4 text-center max-w-sm">
                        Comece cadastrando as estações da sua arena. Cada estação pode ser considerada como um Caixa para um tipo de atividade, por exemplo: Estação BAR / Estação LOJA / etc.
                    </p>
                    <Link href={`/dashboard/arenas/${id}/stations/new`}>
                        <Button className="bg-[#FF6B00] hover:bg-[#E66000] text-white">
                            Cadastrar Primeira Estação
                        </Button>
                    </Link>
                </div>
            )
            }
        </div >
    );
}
