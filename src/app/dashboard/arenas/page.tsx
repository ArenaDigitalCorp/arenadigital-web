"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, MapPin, MoreVertical, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArenaService } from "@/modules/arenas/services/arenaService";
import { useUserSync } from "@/hooks/useUserSync";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function ArenasPage() {
    const { dbUser, isLoading: userLoading } = useUserSync();
    const [arenas, setArenas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadArenas() {
            if (dbUser) {
                try {
                    const data = await ArenaService.getArenasByOwner(dbUser.id);
                    setArenas(data);
                } catch (error) {
                    toast.error("Erro ao carregar arenas.");
                } finally {
                    setIsLoading(false);
                }
            } else if (!userLoading) {
                setIsLoading(false);
            }
        }

        loadArenas();
    }, [dbUser, userLoading]);

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir esta arena? Todas as quadras associadas também serão excluídas.")) {
            try {
                await ArenaService.deleteArena(id);
                setArenas(arenas.filter(a => a.id !== id));
                toast.success("Arena excluída com sucesso!");
            } catch (error) {
                toast.error("Erro ao excluir arena.");
            }
        }
    }

    if (isLoading || userLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-[200px]" />
                    <Skeleton className="h-10 w-[150px]" />
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-[200px] w-full" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Minhas Arenas</h2>
            </div>

            {arenas.length === 0 ? (
                <Card className="col-span-full py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <MapPin className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="mb-2">Nenhuma arena cadastrada</CardTitle>
                        <p className="text-muted-foreground max-w-sm mb-6">
                            Você ainda não cadastrou nenhuma arena. Entre em contato com o suporte para configurar sua primeira arena.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {arenas.map((arena) => (
                        <Card key={arena.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3 border-b bg-muted/30">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="truncate">{arena.name}</CardTitle>
                                    <Badge variant={(arena.status === 'active' || arena.status === 'ativo') ? 'default' : 'secondary'}>
                                        {(arena.status === 'active' || arena.status === 'ativo') ? 'Ativo' :
                                            (arena.status === 'inactive' || arena.status === 'inativo') ? 'Inativo' :
                                                'Manutenção'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="flex items-center text-sm text-muted-foreground">
                                    <MapPin className="mr-2 h-4 w-4" />
                                    <span className="truncate">{arena.address?.street || 'Endereço não informado'}</span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {arena.sports?.map((sport: any) => (
                                        <Badge key={sport.id || sport} variant="outline" className="text-[10px]">
                                            {sport.name || sport}
                                        </Badge>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t">
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/dashboard/arenas/${arena.id}`}>
                                            Gerenciar Quadras
                                        </Link>
                                    </Button>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" asChild title="Editar Arena">
                                            <Link href={`/dashboard/arenas/${arena.id}/edit`}>
                                                <Edit className="h-4 w-4" />
                                            </Link>
                                        </Button>
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
