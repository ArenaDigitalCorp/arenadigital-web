"use client"

import { Loader2, ChevronLeft, ChevronRight, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
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

export function AthletesTable({ athletes, isLoading, arenaId }: Props) {
    const router = useRouter()
    return (
        <div className="rounded-md border border-gray-100 overflow-hidden">
            <Table className={arenaDataTable.table}>
                <TableHeader>
                    <TableRow className={cn(arenaDataTable.theadRow, "hover:bg-transparent")}>
                        <TableHead className={arenaDataTable.th}>Nome</TableHead>
                        <TableHead className={arenaDataTable.th}>CPF</TableHead>
                        <TableHead className={arenaDataTable.th}>E-mail</TableHead>
                        <TableHead className={arenaDataTable.th}>Telefone</TableHead>
                        <TableHead className={arenaDataTable.th}>Esporte</TableHead>
                        <TableHead className={cn(arenaDataTable.th, "text-center w-14")}>Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={6} className={arenaDataTable.emptyCell}>
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-arena-button" />
                                    Buscando atletas...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : athletes.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className={arenaDataTable.emptyCell}>
                                Nenhum atleta encontrado.
                            </TableCell>
                        </TableRow>
                    ) : (
                        athletes.map((athlete) => (
                            <TableRow key={athlete.id} className={arenaDataTable.tbodyRow}>
                                <TableCell className={arenaDataTable.tdBold}>{athlete.name}</TableCell>
                                <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{athlete.cpf || "---"}</TableCell>
                                <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{athlete.email || "---"}</TableCell>
                                <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{athlete.telefone || "---"}</TableCell>
                                <TableCell className={arenaDataTable.td}>
                                    <span className="inline-flex items-center rounded-full bg-arena-navy-800/5 px-2.5 py-0.5 text-xs font-medium text-arena-navy-800">
                                        {athlete.sport}
                                    </span>
                                </TableCell>
                                <TableCell className={cn(arenaDataTable.td, "text-center")}>
                                    <button
                                        onClick={() => {
                                            if (arenaId) router.push(`/dashboard/athletes/${arenaId}/${athlete.id}`)
                                        }}
                                        title="Ver detalhes"
                                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-arena-navy-800/40 hover:text-arena-button hover:bg-arena-button/10 transition-all active:scale-95"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {athletes.length > 0 && (
                <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-50">
                    <Button variant="outline" size="icon" className="h-9 w-9 bg-white" disabled>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-arena-navy-800 text-white hover:bg-arena-navy-800/90 hover:text-white border-transparent">
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
