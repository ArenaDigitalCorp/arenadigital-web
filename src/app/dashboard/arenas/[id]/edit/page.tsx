"use client"

import { useUserSync } from "@/hooks/useUserSync";
import { ArenaForm } from "@/modules/arenas/components/ArenaForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { ArenaService } from "@/modules/arenas/services/arenaService";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export default function EditArenaPage() {
    const params = useParams();
    const id = params.id as string;
    const { dbUser, isLoading: userLoading } = useUserSync();
    const [arena, setArena] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadArena() {
            try {
                const data = await ArenaService.getArenaById(id);
                setArena(data);
            } catch (error) {
                toast.error("Erro ao carregar dados da arena.");
            } finally {
                setIsLoading(false);
            }
        }

        if (id) loadArena();
    }, [id]);

    if (userLoading || isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-[250px]" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    if (!arena) return <div>Arena não encontrada.</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Editar Arena</h2>
                <p className="text-muted-foreground">
                    Atualize as informações da sua arena.
                </p>
            </div>

            <ArenaForm ownerId={dbUser?.id} initialData={arena} />
        </div>
    );
}
