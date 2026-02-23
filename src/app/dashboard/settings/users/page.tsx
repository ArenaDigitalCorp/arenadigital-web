"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArenaService } from "@/modules/arenas/services/arenaService";
import { useUserSync } from "@/hooks/useUserSync";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function UsersIndexPage() {
    const router = useRouter();
    const { dbUser, isLoading: userLoading } = useUserSync();
    const [arenas, setArenas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadArenas() {
            if (dbUser) {
                try {
                    const data = await ArenaService.getArenasByOwner(dbUser.id);
                    setArenas(data);

                    // Auto-redirecionamento se houver apenas uma arena
                    if (data.length === 1) {
                        router.replace(`/dashboard/settings/users/${data[0].id}`);
                    }
                } catch (error) {
                    console.error("Error loading arenas:", error);
                    toast.error("Erro ao carregar arenas. Verifique se as migrações foram aplicadas.");
                } finally {
                    setIsLoading(false);
                }
            } else if (!userLoading) {
                setIsLoading(false);
            }
        }

        loadArenas();
    }, [dbUser, userLoading]);

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
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Usuários</h2>
                <p className="text-muted-foreground">
                    Selecione uma arena para gerenciar seus usuários.
                </p>
            </div>

            {arenas.length === 0 ? (
                <Card className="col-span-full py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <MapPin className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="mb-2">Nenhuma arena encontrada</CardTitle>
                        <p className="text-muted-foreground max-w-sm mb-6">
                            Para cadastrar usuários, você precisa primeiro ter uma arena cadastrada.
                        </p>
                        <Link href="/dashboard/arenas">
                            <Button>Ir para Arenas</Button>
                        </Link>
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
                                    <Link href={`/dashboard/settings/users/${arena.id}`} className="w-full">
                                        <Button className="w-full bg-[#FF6B00] hover:bg-[#E66000] text-white">
                                            <Users className="w-4 h-4 mr-2" />
                                            Gerenciar Usuários
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
