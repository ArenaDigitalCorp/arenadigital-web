"use client"

import { useArena } from "@/contexts/ArenaContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ArenaSelector({ isCollapsed }: { isCollapsed?: boolean }) {
    const { arenas, selectedArena, setSelectedArena, isLoadingArenas } = useArena();

    if (isLoadingArenas) {
        return (
            <Skeleton
                className={cn(
                    "h-10 rounded-md",
                    isCollapsed ? "mb-4 w-10 mx-auto shrink-0" : "mb-6 w-full px-3",
                )}
            />
        );
    }

    if (arenas.length === 0) {
        return null;
    }

    if (arenas.length === 1) {
        if (isCollapsed) {
            return (
                <div className="mb-4 flex w-full justify-center">
                    <div
                        title={arenas[0].name}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10 text-sm font-bold text-white/70"
                    >
                        {arenas[0].name.charAt(0).toUpperCase()}
                    </div>
                </div>
            );
        }
        return (
            <div className="mb-6 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm truncate">
                {arenas[0].name}
            </div>
        );
    }

    return (
        <div className={cn(isCollapsed ? "mb-4 flex w-full justify-center px-0" : "mb-6 px-0")}>
            {isCollapsed ? (
                <div
                    title={arenas.find(a => a.id === selectedArena)?.name ?? ""}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10 text-sm font-bold text-white/70"
                >
                    {(arenas.find(a => a.id === selectedArena)?.name ?? "A").charAt(0).toUpperCase()}
                </div>
            ) : (
                <Select value={selectedArena} onValueChange={setSelectedArena}>
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white focus:ring-white/20">
                        <SelectValue placeholder="Selecione uma arena" />
                    </SelectTrigger>
                    <SelectContent>
                        {arenas.map((arena) => (
                            <SelectItem key={arena.id} value={arena.id}>
                                {arena.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>
    );
}
