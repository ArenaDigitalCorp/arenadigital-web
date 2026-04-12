"use client"

import React, { createContext, useContext, useState, useEffect } from "react";
import { useDbUser } from "@/contexts/UserContext";
import { supabase } from "@/shared/database/supabaseClient";

interface Arena {
    id: string;
    name: string;
}

interface ArenaContextType {
    selectedArena: string;
    setSelectedArena: (id: string) => void;
    arenas: Arena[];
    isLoadingArenas: boolean;
}

const ArenaContext = createContext<ArenaContextType | undefined>(undefined);

export function ArenaProvider({ children }: { children: React.ReactNode }) {
    const [selectedArena, setSelectedArena] = useState<string>("");
    const [arenas, setArenas] = useState<Arena[]>([]);
    const [isLoadingArenas, setIsLoadingArenas] = useState(true);
    const { dbUser } = useDbUser();

    useEffect(() => {
        async function fetchArenas() {
            if (!dbUser) {
                setIsLoadingArenas(false);
                return;
            }
            setIsLoadingArenas(true);
            const { data, error } = await supabase
                .from('arenas')
                .select('id, name')
                .eq('owner_id', dbUser.id)
                .order('name');

            if (!error && data && data.length > 0) {
                setArenas(data);
                setSelectedArena(data[0].id);
            }
            setIsLoadingArenas(false);
        }
        fetchArenas();
    }, [dbUser]);

    return (
        <ArenaContext.Provider value={{ selectedArena, setSelectedArena, arenas, isLoadingArenas }}>
            {children}
        </ArenaContext.Provider>
    );
}

export function useArena() {
    const context = useContext(ArenaContext);
    if (context === undefined) {
        throw new Error("useArena must be used within an ArenaProvider");
    }
    return context;
}
