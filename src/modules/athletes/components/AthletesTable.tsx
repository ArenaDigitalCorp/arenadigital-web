"use client"

import { formatCpf, formatPhone } from '@/lib/brasil-document'
import { Loader2, ChevronLeft, ChevronRight, Eye, ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { paginationPages } from "@/modules/athletes/lib/pagination-pages"
import { ATHLETES_PAGE_SIZES, type AthletePageSize, type AthleteSort, type AthleteSortColumn } from "@/modules/athletes/types/list-page.types"
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
    profilesAvailable?: boolean
    error?: string
    onRetry: () => void
    page: number
    pageSize: AthletePageSize
    total: number
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: AthletePageSize) => void
    sort: AthleteSort
    onSortChange: (sort: AthleteSort) => void
}

type Coluna = AthleteSortColumn

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
    disabled = false,
}: {
    coluna: Coluna
    ordem: AthleteSort
    onOrdenar: (coluna: Coluna) => void
    children: React.ReactNode
    disabled?: boolean
}) {
    const ativo = ordem.column === coluna
    const Icone = !ativo ? ChevronsUpDown : ordem.direction === "asc" ? ArrowUp : ArrowDown
    return (
        <button
            type="button"
            disabled={disabled}
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
export function AthletesTable({
    athletes, isLoading, arenaId, perfis, error, onRetry,
    page, pageSize, total, onPageChange, onPageSizeChange, sort, onSortChange, profilesAvailable = true,
}: Props) {
    const router = useRouter()
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const alternar = (column: Coluna) => onSortChange({
        column,
        direction: sort.column === column && sort.direction === "asc" ? "desc" : "asc",
    })

    return (
        <div>
            <div className="overflow-x-auto">
                <table className={arenaDataTable.table} aria-busy={isLoading}>
                    <thead>
                        <tr className={arenaDataTable.theadRow}>
                            <th className={arenaDataTable.th}>
                                <Ordenavel coluna="name" ordem={sort} onOrdenar={alternar}>
                                    Nome
                                </Ordenavel>
                            </th>
                            <th className={arenaDataTable.th}>CPF</th>
                            <th className={arenaDataTable.th}>E-mail</th>
                            <th className={arenaDataTable.th}>Telefone</th>
                            <th className={arenaDataTable.th}>
                                <Ordenavel coluna="sport" ordem={sort} onOrdenar={alternar}>
                                    Esporte
                                </Ordenavel>
                            </th>
                            <th className={arenaDataTable.th}>
                                <Ordenavel coluna="perfil" ordem={sort} onOrdenar={alternar} disabled={!profilesAvailable}>
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
                        ) : error ? (
                            <tr>
                                <td colSpan={7} className={arenaDataTable.emptyCell}>
                                    <div role="alert" className="flex flex-col items-center gap-3">
                                        <p>{error}</p>
                                        <Button type="button" variant="outline" onClick={onRetry}>Tentar novamente</Button>
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
                            athletes.map((athlete) => (
                                <tr key={athlete.id} className={arenaDataTable.tbodyRow}>
                                    <td className={arenaDataTable.tdBold}>{athlete.name}</td>
                                    <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                        {formatCpf(athlete.cpf) || "---"}
                                    </td>
                                    <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                        {athlete.email || "---"}
                                    </td>
                                    <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                        {formatPhone(athlete.telefone) || "---"}
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
                                                        aria-label={`Ver detalhes de ${athlete.name}`}
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

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p aria-live="polite" className="text-xs text-arena-navy-800/60">
                        {isLoading ? "Carregando página..." : error ? "Página indisponível" :
                            `Exibindo ${total === 0 ? 0 : (page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`}
                    </p>
                    <label className="flex items-center gap-2 text-xs text-arena-navy-800/60">
                        Por página
                        <select
                            aria-label="Atletas por página"
                            value={pageSize}
                            onChange={event => onPageSizeChange(Number(event.target.value) as AthletePageSize)}
                            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-arena-navy-800 focus-visible:outline-teal-600"
                        >
                            {ATHLETES_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
                        </select>
                    </label>
                </div>
                {!error && total > 0 && (
                    <nav aria-label="Paginação dos atletas" className="flex flex-wrap items-center gap-1">
                        <Button type="button" variant="outline" size="icon" aria-label="Página anterior"
                            className="h-8 w-8 bg-white" disabled={isLoading || page <= 1}
                            onClick={() => onPageChange(page - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {paginationPages(page, totalPages).map((value, index) => value === 'ellipsis' ? (
                            <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-slate-400">…</span>
                        ) : (
                            <Button key={value} type="button" variant="outline" size="sm"
                                aria-label={`Página ${value}`} aria-current={value === page ? 'page' : undefined}
                                disabled={isLoading} onClick={() => onPageChange(value)}
                                className={cn("h-8 min-w-8 px-2 text-xs", value === page
                                    ? "border-transparent bg-arena-navy-800 text-white hover:bg-arena-navy-800/90 hover:text-white"
                                    : "bg-white")}>
                                {value}
                            </Button>
                        ))}
                        <Button type="button" variant="outline" size="icon" aria-label="Próxima página"
                            className="h-8 w-8 bg-white" disabled={isLoading || page >= totalPages}
                            onClick={() => onPageChange(page + 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </nav>
                )}
            </div>
        </div>
    )
}
