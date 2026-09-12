"use client"

import { useMemo, useState } from "react"
import { Loader2, ChevronLeft, ChevronRight, Eye, ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { arenaDataTable } from "@/lib/arena-data-table"
import {
    PERFIL_BADGE,
    PERFIL_LABEL,
    type PerfilAtleta,
} from "@/modules/athletes/types/perfil.types"

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
    /** Perfil por atleta. Vazio enquanto carrega — a coluna mostra "—". */
    perfis: Record<string, PerfilAtleta>
}

type Coluna = "name" | "sport" | "perfil"
type Direcao = "asc" | "desc"

/**
 * Cabeçalho clicável; a seta diz por onde está ordenado e em que sentido.
 * Fica fora do componente de propósito: definida dentro, seria um componente
 * novo a cada render, e o React remontaria o cabeçalho inteiro.
 */
function Ordenavel({
    coluna,
    ordem,
    onOrdenar,
    children,
}: {
    coluna: Coluna
    ordem: { coluna: Coluna; direcao: Direcao }
    onOrdenar: (coluna: Coluna) => void
    children: React.ReactNode
}) {
    const ativo = ordem.coluna === coluna
    const Icone = !ativo ? ChevronsUpDown : ordem.direcao === "asc" ? ArrowUp : ArrowDown
    return (
        <button
            type="button"
            onClick={() => onOrdenar(coluna)}
            className={cn(
                "inline-flex items-center gap-1 transition-colors hover:text-arena-navy-800",
                ativo && "text-arena-navy-800"
            )}
        >
            {children}
            <Icone className={cn("h-3 w-3", ativo ? "opacity-100" : "opacity-40")} />
        </button>
    )
}

/** Mesma marcação da aba Cadastros em Arena (tabela nativa + `arenaDataTable`). */
export function AthletesTable({ athletes, isLoading, arenaId, perfis }: Props) {
    const router = useRouter()
    const [ordem, setOrdem] = useState<{ coluna: Coluna; direcao: Direcao }>({
        coluna: "name",
        direcao: "asc",
    })

    const alternar = (coluna: Coluna) =>
        setOrdem((atual) =>
            atual.coluna === coluna
                ? { coluna, direcao: atual.direcao === "asc" ? "desc" : "asc" }
                : { coluna, direcao: "asc" }
        )

    const ordenados = useMemo(() => {
        const valor = (a: Athlete) =>
            ordem.coluna === "perfil"
                ? PERFIL_LABEL[perfis[a.id] ?? "padrao"]
                : ordem.coluna === "sport"
                  ? a.sport
                  : a.name
        return [...athletes].sort((a, b) => {
            const cmp = valor(a).localeCompare(valor(b), "pt-BR", { sensitivity: "base" })
            return ordem.direcao === "asc" ? cmp : -cmp
        })
    }, [athletes, ordem, perfis])

    return (
        <div>
            <div className="overflow-x-auto">
                <table className={arenaDataTable.table}>
                    <thead>
                        <tr className={arenaDataTable.theadRow}>
                            <th className={arenaDataTable.th}>
                                <Ordenavel coluna="name" ordem={ordem} onOrdenar={alternar}>
                                    Nome
                                </Ordenavel>
                            </th>
                            <th className={arenaDataTable.th}>CPF</th>
                            <th className={arenaDataTable.th}>E-mail</th>
                            <th className={arenaDataTable.th}>Telefone</th>
                            <th className={arenaDataTable.th}>
                                <Ordenavel coluna="sport" ordem={ordem} onOrdenar={alternar}>
                                    Esporte
                                </Ordenavel>
                            </th>
                            <th className={arenaDataTable.th}>
                                <Ordenavel coluna="perfil" ordem={ordem} onOrdenar={alternar}>
                                    Perfil
                                </Ordenavel>
                            </th>
                            <th className={arenaDataTable.thRight}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={7} className={arenaDataTable.emptyCell}>
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin text-arena-button" />
                                        Buscando atletas...
                                    </div>
                                </td>
                            </tr>
                        ) : athletes.length === 0 ? (
                            <tr>
                                <td colSpan={7} className={arenaDataTable.emptyCell}>
                                    Nenhum atleta encontrado.
                                </td>
                            </tr>
                        ) : (
                            ordenados.map((athlete) => (
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
                                    <td className={arenaDataTable.td}>
                                        {perfis[athlete.id] ? (
                                            <span
                                                className={cn(
                                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                                    PERFIL_BADGE[perfis[athlete.id]]
                                                )}
                                            >
                                                {PERFIL_LABEL[perfis[athlete.id]]}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-arena-navy-800/30">—</span>
                                        )}
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
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <p className="text-xs text-arena-navy-800/40">
                        Exibindo 1–{athletes.length} de {athletes.length}
                    </p>
                    <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-white" disabled>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 border-transparent bg-arena-navy-800 p-0 text-xs text-white hover:bg-arena-navy-800/90 hover:text-white"
                    >
                        01
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-white" disabled>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
