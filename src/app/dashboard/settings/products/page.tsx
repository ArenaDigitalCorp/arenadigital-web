"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Package } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArenaService } from "@/modules/arenas/services/arenaService";
import { useUserSync } from "@/hooks/useUserSync";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function ProductsArenaSelectionPage() {
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
                    console.error("Error loading arenas:", error);
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

    if (isLoading || userLoading) {
        return (
            <div className="space-y-6 container mx-auto py-6">
                <Skeleton className="h-10 w-[200px]" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-[200px] w-full" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 container mx-auto py-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Produtos</h2>
                <p className="text-muted-foreground">
                    Selecione uma arena para gerenciar seu catálogo de produtos.
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
                            Para cadastrar produtos, você precisa primeiro ter uma arena cadastrada.
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
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center text-sm text-muted-foreground mb-4">
                                    <MapPin className="mr-2 h-4 w-4" />
                                    <span className="truncate">{arena.address?.street || 'Endereço não informado'}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Link href={`/dashboard/settings/products/${arena.id}`} className="w-full">
                                        <Button className="w-full bg-[#FF6B00] hover:bg-[#E66000] text-white">
                                            Gerenciar Produtos
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
