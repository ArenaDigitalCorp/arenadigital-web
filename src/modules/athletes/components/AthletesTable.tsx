"use client"

import { Loader2, ChevronLeft, ChevronRight, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { arenaDataTable } from "@/lib/arena-data-table"

export interface Athlete {
    id: string
    name: string
    cpf: string | null
    telefone: string | null
    email: string | null
    sport: string
}

interface Props {
    athletes: Athlete[]
    isLoading: boolean
    arenaId: string | null
}

/** Mesma marcação da aba Cadastros em Arena (tabela nativa + `arenaDataTable`). */
export function AthletesTable({ athletes, isLoading, arenaId }: Props) {
    const router = useRouter()
    return (
        <div>
            <div className="overflow-x-auto">
                <table className={arenaDataTable.table}>
                    <thead>
                        <tr className={arenaDataTable.theadRow}>
                            <th className={arenaDataTable.th}>Nome</th>
                            <th className={arenaDataTable.th}>CPF</th>
                            <th className={arenaDataTable.th}>E-mail</th>
                            <th className={arenaDataTable.th}>Telefone</th>
                            <th className={arenaDataTable.th}>Esporte</th>
                            <th className={arenaDataTable.thRight}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className={arenaDataTable.emptyCell}>
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin text-arena-button" />
                                        Buscando atletas...
                                    </div>
                                </td>
                            </tr>
                        ) : athletes.length === 0 ? (
                            <tr>
                                <td colSpan={6} className={arenaDataTable.emptyCell}>
                                    Nenhum atleta encontrado.
                                </td>
                            </tr>
                        ) : (
                            athletes.map((athlete) => (
                                <tr key={athlete.id} className={arenaDataTable.tbodyRow}>
                                    <td className={arenaDataTable.tdBold}>{athlete.name}</td>
                                    <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                        {athlete.cpf || "---"}
                                    </td>
                                    <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                        {athlete.email || "---"}
                                    </td>
                                    <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                        {athlete.telefone || "---"}
                                    </td>
                                    <td className={arenaDataTable.td}>
                                        <span className="inline-flex items-center rounded-full bg-arena-navy-800/5 px-2.5 py-0.5 text-xs font-medium text-arena-navy-800">
                                            {athlete.sport}
                                        </span>
                                    </td>
                                    <td className={arenaDataTable.tdRight}>
                                        <div className="flex items-center justify-end gap-2">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            if (arenaId) {
                                                                router.push(
                                                                    `/dashboard/athletes/${arenaId}/${athlete.id}`
                                                                )
                                                            }
                                                        }}
                                                        className="h-8 w-8 text-teal-600/60 bg-teal-50 hover:bg-teal-100 hover:text-teal-600"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Ver detalhes</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {!isLoading && athletes.length > 0 && (
                <div className="flex items-center justify-center gap-2 border-t border-slate-100 p-4">
                    <Button variant="outline" size="icon" className="h-9 w-9 bg-white" disabled>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 border-transparent bg-arena-navy-800 p-0 text-white hover:bg-arena-navy-800/90 hover:text-white"
                    >
                        01
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 bg-white" disabled>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    )
}
