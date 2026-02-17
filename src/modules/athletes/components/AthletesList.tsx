import { useEffect, useState, useCallback } from "react"
import {
    Search,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Loader2
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { AthleteService } from "@/modules/athletes/services/athleteService"

interface Athlete {
    id: string
    name: string
    cpf: string | null
    telefone: string | null
    sport: string
}

interface AthletesListProps {
    arenaId: string | null
}

export function AthletesList({ arenaId }: AthletesListProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [athletes, setAthletes] = useState<Athlete[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const loadAthletes = useCallback(async () => {
        if (!arenaId) return

        try {
            setIsLoading(true)
            const data = await AthleteService.getAthletesByArena(arenaId, searchTerm)
            setAthletes(data)
        } catch (error) {
            console.error("Error loading athletes:", error)
        } finally {
            setIsLoading(false)
        }
    }, [arenaId, searchTerm])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadAthletes()
        }, 300)

        return () => clearTimeout(timer)
    }, [loadAthletes])

    if (!arenaId) {
        return (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
                Carregando dados da arena...
            </div>
        )
    }

    return (
        <Card className="border-none shadow-sm">
            <CardContent className="p-0">
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-[#002B40]">Atletas vinculados</h2>
                    </div>

                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por atleta"
                            className="pl-10 h-11"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="rounded-md border border-gray-100 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-[#002B40] font-semibold">Nome</TableHead>
                                    <TableHead className="text-[#002B40] font-semibold">CPF</TableHead>
                                    <TableHead className="text-[#002B40] font-semibold">Esporte</TableHead>
                                    <TableHead className="text-right text-[#002B40] font-semibold">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-6 w-6 animate-spin text-[#FF6B00]" />
                                                Buscando atletas...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : athletes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                            Nenhum atleta encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    athletes.map((athlete) => (
                                        <TableRow key={athlete.id} className="group transition-colors">
                                            <TableCell className="font-medium text-[#002B40]">{athlete.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{athlete.cpf || "---"}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center rounded-full bg-[#002B40]/5 px-2.5 py-0.5 text-xs font-medium text-[#002B40]">
                                                    {athlete.sport}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#FF6B00] hover:text-[#E66000] hover:bg-[#FF6B00]/10">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {athletes.length > 0 && (
                        <div className="flex items-center justify-center gap-2 pt-4 border-t border-gray-50">
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
            </CardContent>
        </Card>
    )
}
