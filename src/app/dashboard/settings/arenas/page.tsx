"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Edit, Trash2, Phone, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArenaService } from "@/modules/arenas/services/arenaService";
import { useUserSync } from "@/hooks/useUserSync";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function SettingsArenasPage() {
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
                <Skeleton className="h-10 w-[200px]" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-[200px] w-full" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Configurações de Arena</h2>
                    <p className="text-muted-foreground">
                        Edite as informações das suas arenas cadastradas.
                    </p>
                </div>
            </div>

            {arenas.length === 0 ? (
                <Card className="col-span-full py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <MapPin className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="mb-2">Nenhuma arena cadastrada</CardTitle>
                        <p className="text-muted-foreground max-w-sm mb-6">
                            Você ainda não cadastrou nenhuma arena.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {arenas.map((arena) => (
                        <Card key={arena.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {arena.name}
                                </CardTitle>
                                <Badge variant={(arena.status === 'active' || arena.status === 'ativo') ? 'default' : 'secondary'}>
                                    {(arena.status === 'active' || arena.status === 'ativo') ? 'Ativo' :
                                        (arena.status === 'inactive' || arena.status === 'inativo') ? 'Inativo' :
                                            'Manutenção'}
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <MapPin className="mr-2 h-4 w-4" />
                                        <span className="truncate">
                                            {typeof arena.address === 'string'
                                                ? arena.address
                                                : arena.address?.street || 'Endereço não informado'}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Phone className="mr-2 h-4 w-4" />
                                        <span>{arena.phone || 'Telefone não informado'}</span>
                                    </div>
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Mail className="mr-2 h-4 w-4" />
                                        <span className="truncate">{arena.email || 'E-mail não informado'}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Link href={`/dashboard/arenas/${arena.id}/edit`} className="flex-1">
                                        <Button variant="outline" className="w-full flex items-center justify-center gap-2 font-bold">
                                            <Edit className="h-4 w-4" />
                                            Editar Arena
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDelete(arena.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
