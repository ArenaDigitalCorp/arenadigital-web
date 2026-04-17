"use client"

import React, { createContext, useContext, useReducer, useState, useEffect, useCallback } from "react";
import { useDbUser } from "@/contexts/UserContext";

interface Arena {
    id: string;
    name: string;
    isOwner: boolean;
    role: 'Owner' | 'Gestor' | 'Atendente' | 'Caixa';
    assignedStationId: string | null;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Arena[] }
  | { status: 'error'; message: string }

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Arena[] }
  | { type: 'FETCH_ERROR'; message: string }

function reducer(_: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':   return { status: 'loading' }
    case 'FETCH_SUCCESS': return { status: 'success', data: action.payload }
    case 'FETCH_ERROR':   return { status: 'error', message: action.message }
  }
}

interface ArenaContextType {
    selectedArena: string;
    setSelectedArena: (id: string) => void;
    arenas: Arena[];
    selectedArenaDetails: Arena | null;
    isLoadingArenas: boolean;
    arenasError: string | null;
    retryArenas: () => void;
}

const ArenaContext = createContext<ArenaContextType | undefined>(undefined);

export function ArenaProvider({ children }: { children: React.ReactNode }) {
    const [selectedArena, setSelectedArena] = useState<string>("");
    const [state, dispatch] = useReducer(reducer, { status: 'idle' });
    const { dbUser } = useDbUser();

    const fetchArenas = useCallback(async () => {
        if (!dbUser) {
            dispatch({ type: 'FETCH_SUCCESS', payload: [] });
            setSelectedArena("");
            return;
        }

        dispatch({ type: 'FETCH_START' });
        try {
            const response = await fetch('/api/arenas', { credentials: 'same-origin' });
            if (!response.ok) throw new Error('Falha ao carregar arenas');
            const data: Arena[] = await response.json();
            dispatch({ type: 'FETCH_SUCCESS', payload: data });
            setSelectedArena((currentArenaId) => {
                if (currentArenaId && data.some((arena) => arena.id === currentArenaId)) {
                    return currentArenaId;
                }
                return data[0]?.id ?? "";
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao carregar arenas'
            dispatch({ type: 'FETCH_ERROR', message });
        }
    }, [dbUser]);

    useEffect(() => { fetchArenas() }, [fetchArenas]);

    const arenas = state.status === 'success' ? state.data : [];
    const isLoadingArenas = state.status === 'idle' || state.status === 'loading';
    const arenasError = state.status === 'error' ? state.message : null;
    const selectedArenaDetails = arenas.find((arena) => arena.id === selectedArena) ?? null;

    return (
        <ArenaContext.Provider value={{ selectedArena, setSelectedArena, arenas, selectedArenaDetails, isLoadingArenas, arenasError, retryArenas: fetchArenas }}>
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
