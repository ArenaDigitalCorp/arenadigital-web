"use client"

import { useUserSync } from "@/hooks/useUserSync";
import { ArenaForm } from "@/modules/arenas/components/ArenaForm";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewArenaPage() {
    const { dbUser, isLoading } = useUserSync();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-[250px]" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Nova Arena</h2>
                <p className="text-muted-foreground">
                    Preencha os dados abaixo para cadastrar sua nova arena.
                </p>
            </div>

            <ArenaForm ownerId={dbUser?.id} />
        </div>
    );
}
