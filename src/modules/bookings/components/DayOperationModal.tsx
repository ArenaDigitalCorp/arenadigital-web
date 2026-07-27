"use client"

import { DayOperationBoard, type OperationCourt } from "@/modules/bookings/components/DayOperationBoard";

interface DayOperationModalProps {
    isOpen: boolean;
    onClose: () => void;
    arenaId: string;
    /** Mantido por compatibilidade com as chamadas existentes. */
    arenaName?: string;
    courts: OperationCourt[];
}

/**
 * Overlay com a operação do dia. A visão em si vive em `DayOperationBoard`,
 * compartilhada com a aba "Operação" da tela de Espaços.
 */
export function DayOperationModal({ isOpen, onClose, arenaId, courts }: DayOperationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-[95vw] h-[92vh] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <DayOperationBoard
                    arenaId={arenaId}
                    courts={courts}
                    variant="modal"
                    onClose={onClose}
                />
            </div>
        </div>
    );
}
