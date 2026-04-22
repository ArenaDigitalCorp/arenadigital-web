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
            <Table>
                <TableHeader className="bg-gray-50/50">
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[#002B40] font-semibold">Nome</TableHead>
                        <TableHead className="text-[#002B40] font-semibold">CPF</TableHead>
                        <TableHead className="text-[#002B40] font-semibold">E-mail</TableHead>
                        <TableHead className="text-[#002B40] font-semibold">Telefone</TableHead>
                        <TableHead className="text-[#002B40] font-semibold">Esporte</TableHead>
                        <TableHead className="text-[#002B40] font-semibold w-14 text-center">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-[#FF6B00]" />
                                    Buscando atletas...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : athletes.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                Nenhum atleta encontrado.
                            </TableCell>
                        </TableRow>
                    ) : (
                        athletes.map((athlete) => (
                            <TableRow key={athlete.id} className="group transition-colors">
                                <TableCell className="font-medium text-[#002B40]">{athlete.name}</TableCell>
                                <TableCell className="text-muted-foreground">{athlete.cpf || "---"}</TableCell>
                                <TableCell className="text-muted-foreground">{athlete.email || "---"}</TableCell>
                                <TableCell className="text-muted-foreground">{athlete.telefone || "---"}</TableCell>
                                <TableCell>
                                    <span className="inline-flex items-center rounded-full bg-[#002B40]/5 px-2.5 py-0.5 text-xs font-medium text-[#002B40]">
                                        {athlete.sport}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    <button
                                        onClick={() => {
                                            if (arenaId) router.push(`/dashboard/athletes/${arenaId}/${athlete.id}`)
                                        }}
                                        title="Ver detalhes"
                                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#002B40]/40 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 transition-all active:scale-95"
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
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-[#002B40] text-white hover:bg-[#002B40]/90 hover:text-white border-transparent">
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
