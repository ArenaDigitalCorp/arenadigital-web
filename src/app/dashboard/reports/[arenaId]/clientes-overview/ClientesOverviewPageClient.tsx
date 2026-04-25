"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { MessageCircle, Eye, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BarCategory, AthleteOverviewItem } from "@/modules/reports/actions/clientesOverviewActions"

interface Props {
    arenaId: string
    initialCategories: BarCategory[]
}

type SortKey = 'nome' | 'cpf' | 'data_nascimento' | 'esportes' | 'total_reservas' | 'aniversario'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 10

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    try { return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR }) } catch { return '—' }
}

function formatCpf(cpf: string | null): string {
    if (!cpf) return '—'
    const d = cpf.replace(/\D/g, '')
    if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
    return cpf
}

function handleWhatsApp(phone: string | null, name: string) {
    if (!phone) return
    const clean = phone.replace(/\D/g, '')
    const final = clean.length <= 11 ? `55${clean}` : clean
    const msg = `Olá ${name}! Temos novidades na Arena e gostaríamos de te convidar para uma visita. Podemos ajudar com algo?`
    window.open(`https://wa.me/${final}?text=${encodeURIComponent(msg)}`, '_blank')
}

// Animated bar component
function FunnelBar({
    category,
    maxCount,
    isSelected,
    index,
    onClick,
}: {
    category: BarCategory
    maxCount: number
    isSelected: boolean
    index: number
    onClick: () => void
}) {
    const [width, setWidth] = useState(0)
    const pct = maxCount > 0 ? Math.max((category.count / maxCount) * 100, 8) : 8

    useEffect(() => {
        const timer = setTimeout(() => setWidth(pct), 80 + index * 120)
        return () => clearTimeout(timer)
    }, [pct, index])

    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left group transition-all duration-200",
                isSelected && "scale-[1.01]"
            )}
        >
            <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-semibold text-[#002B40]/70 w-40 shrink-0 truncate">
                    {category.label}
                </span>
                <span
                    className="text-xs font-black"
                    style={{ color: category.color }}
                >
                    {category.count}
                </span>
            </div>
            <div className="relative h-10 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                <div
                    className={cn(
                        "absolute inset-y-0 left-0 rounded-full flex items-center justify-end pr-3 transition-all duration-700 ease-out",
                        isSelected && "brightness-90"
                    )}
                    style={{
                        width: `${width}%`,
                        backgroundColor: category.color,
                        opacity: isSelected ? 1 : 0.75,
                    }}
                >
                    <span className="text-white text-xs font-black drop-shadow">
                        {category.count}
                    </span>
                </div>
                {isSelected && (
                    <div
                        className="absolute inset-0 rounded-full border-2 pointer-events-none"
                        style={{ borderColor: category.color }}
                    />
                )}
            </div>
        </button>
    )
}

// Sortable column header
function SortableHeader({
    label,
    field,
    sortKey,
    sortDir,
    onSort,
    className,
}: {
    label: string
    field: SortKey
    sortKey: SortKey
    sortDir: SortDir
    onSort: (f: SortKey) => void
    className?: string
}) {
    const active = sortKey === field
    return (
        <th
            className={cn(
                "px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none",
                "text-[#002B40]/50 hover:text-[#FF6B00] transition-colors",
                active && "text-[#FF6B00]",
                className
            )}
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-1">
                {label}
                <span className="flex flex-col">
                    <ChevronUp className={cn("h-2.5 w-2.5 -mb-0.5", active && sortDir === 'asc' ? "text-[#FF6B00]" : "text-[#002B40]/20")} />
                    <ChevronDown className={cn("h-2.5 w-2.5", active && sortDir === 'desc' ? "text-[#FF6B00]" : "text-[#002B40]/20")} />
                </span>
            </div>
        </th>
    )
}

export function ClientesOverviewPageClient({ arenaId, initialCategories }: Props) {
    const router = useRouter()
    const [selectedId, setSelectedId] = useState<string | null>(
        initialCategories[0]?.id ?? null
    )
    const [sortKey, setSortKey] = useState<SortKey>('nome')
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    const isBirthdayCategory = selectedId === 'aniversariantes'
    const [page, setPage] = useState(1)

    const maxCount = useMemo(
        () => Math.max(...initialCategories.map(c => c.count), 1),
        [initialCategories]
    )

    const selected = useMemo(
        () => initialCategories.find(c => c.id === selectedId) ?? null,
        [selectedId, initialCategories]
    )

    const sorted = useMemo(() => {
        if (!selected) return []
        return [...selected.athletes].sort((a, b) => {
            let va: string | number = ''
            let vb: string | number = ''
            if (sortKey === 'nome') { va = a.nome; vb = b.nome }
            else if (sortKey === 'cpf') { va = a.cpf ?? ''; vb = b.cpf ?? '' }
            else if (sortKey === 'data_nascimento') { va = a.data_nascimento ?? ''; vb = b.data_nascimento ?? '' }
            else if (sortKey === 'esportes') { va = a.esportes.join(', '); vb = b.esportes.join(', ') }
            else if (sortKey === 'total_reservas') { va = a.total_reservas; vb = b.total_reservas }
            else if (sortKey === 'aniversario') {
                va = a.dias_ate_aniversario ?? 999
                vb = b.dias_ate_aniversario ?? 999
            }
            if (va < vb) return sortDir === 'asc' ? -1 : 1
            if (va > vb) return sortDir === 'asc' ? 1 : -1
            return 0
        })
    }, [selected, sortKey, sortDir])

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
    const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    function handleSort(field: SortKey) {
        if (sortKey === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortKey(field); setSortDir('asc') }
        setPage(1)
    }

    function handleSelectCategory(id: string) {
        setSelectedId(id)
        setPage(1)
        if (id === 'aniversariantes') {
            setSortKey('aniversario')
            setSortDir('asc')
        } else if (sortKey === 'aniversario') {
            setSortKey('nome')
            setSortDir('asc')
        }
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-black text-[#002B40]">Clientes — Overview</h1>
                <p className="text-sm text-[#002B40]/60 mt-1">
                    Selecione uma barra para visualizar os clientes de cada grupo.
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* LEFT: Funnel bars */}
                <div className="w-full lg:w-[360px] shrink-0">
                    <div className="bg-white rounded-2xl shadow-sm border border-[#002B40]/5 p-6">
                        <h2 className="text-sm font-bold text-[#002B40]/60 uppercase tracking-wider mb-5">
                            Funil de clientes
                        </h2>
                        <p className="text-xs text-[#002B40]/40 mb-6">
                            Clique em uma barra para ver os clientes desse grupo.
                        </p>

                        <div className="space-y-5">
                            {initialCategories.map((cat, i) => (
                                <FunnelBar
                                    key={cat.id}
                                    category={cat}
                                    maxCount={maxCount}
                                    isSelected={selectedId === cat.id}
                                    index={i}
                                    onClick={() => handleSelectCategory(cat.id)}
                                />
                            ))}
                        </div>

                        {/* Total */}
                        <div className="mt-6 pt-4 border-t border-[#002B40]/5 flex items-center justify-between">
                            <span className="text-xs text-[#002B40]/40 font-medium">Total de atletas</span>
                            <span className="text-sm font-black text-[#002B40]">
                                {/* unique count */}
                                {new Set(initialCategories.flatMap(c => c.athletes.map(a => a.id))).size}
                            </span>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Detail grid */}
                <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-2xl shadow-sm border border-[#002B40]/5 overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[#002B40]/5 flex items-center gap-3">
                            {selected && (
                                <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: selected.color }}
                                />
                            )}
                            <div>
                                <h2 className="text-sm font-bold text-[#002B40]">
                                    {selected?.label ?? 'Selecione um grupo'}
                                </h2>
                                {selected && (
                                    <p className="text-xs text-[#002B40]/40 mt-0.5">
                                        {selected.description}
                                    </p>
                                )}
                            </div>
                            {selected && (
                                <Badge className="ml-auto shrink-0 bg-[#F1F5F9] text-[#002B40] hover:bg-[#F1F5F9] font-bold">
                                    {selected.count} atleta{selected.count !== 1 ? 's' : ''}
                                </Badge>
                            )}
                        </div>

                        {/* Table */}
                        {!selected || sorted.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-[#002B40]/30">
                                <Users className="h-10 w-10 mb-3" />
                                <p className="text-sm font-medium">
                                    {!selected ? 'Selecione um grupo à esquerda' : 'Nenhum atleta neste grupo'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-[#F8FAFC]">
                                            <tr>
                                                <SortableHeader label="Nome" field="nome" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                                                <SortableHeader label="CPF" field="cpf" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                                                <SortableHeader label="Nascimento" field="data_nascimento" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                                                {isBirthdayCategory && (
                                                    <SortableHeader label="Aniversário" field="aniversario" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                                                )}
                                                <SortableHeader label="Esportes" field="esportes" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                                                <SortableHeader label="Reservas" field="total_reservas" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                                                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[#002B40]/50">
                                                    Ações
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#002B40]/5">
                                            {paginated.map((athlete) => (
                                                <AthleteRow
                                                    key={athlete.id}
                                                    athlete={athlete}
                                                    arenaId={arenaId}
                                                    showBirthdayColumn={isBirthdayCategory}
                                                    onNavigate={(path) => router.push(path)}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <div className="px-4 py-3 border-t border-[#002B40]/5 flex items-center justify-between">
                                    <span className="text-xs text-[#002B40]/40">
                                        {sorted.length === 0 ? '0 resultados' :
                                            `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} de ${sorted.length}`}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                                            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                                                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...')
                                                acc.push(p)
                                                return acc
                                            }, [])
                                            .map((p, i) =>
                                                p === '...' ? (
                                                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-[#002B40]/30">…</span>
                                                ) : (
                                                    <Button
                                                        key={p}
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn(
                                                            "h-7 w-7 text-xs font-bold",
                                                            page === p
                                                                ? "bg-[#FF6B00] text-white hover:bg-[#E66000]"
                                                                : "text-[#002B40]/60 hover:bg-[#002B40]/5"
                                                        )}
                                                        onClick={() => setPage(p as number)}
                                                    >
                                                        {p}
                                                    </Button>
                                                )
                                            )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function AthleteRow({
    athlete,
    arenaId,
    showBirthdayColumn,
    onNavigate,
}: {
    athlete: AthleteOverviewItem
    arenaId: string
    showBirthdayColumn?: boolean
    onNavigate: (path: string) => void
}) {
    const isToday = showBirthdayColumn && athlete.dias_ate_aniversario === 0

    return (
        <tr className={cn(
            "transition-colors",
            isToday
                ? "bg-amber-50 hover:bg-amber-100/60"
                : "hover:bg-[#F8FAFC]"
        )}>
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    {isToday && (
                        <span className="text-base" title="Aniversário hoje!">🎂</span>
                    )}
                    <span className={cn(
                        "text-sm text-[#002B40]",
                        isToday ? "font-black" : "font-semibold"
                    )}>
                        {athlete.nome}
                    </span>
                    {isToday && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-white uppercase tracking-wide">
                            Hoje!
                        </span>
                    )}
                </div>
            </td>
            <td className="px-4 py-3">
                <span className={cn("text-sm font-mono", isToday ? "text-[#002B40] font-bold" : "text-[#002B40]/60")}>
                    {formatCpf(athlete.cpf)}
                </span>
            </td>
            <td className="px-4 py-3">
                <span className={cn("text-sm", isToday ? "text-[#002B40] font-bold" : "text-[#002B40]/60")}>
                    {formatDate(athlete.data_nascimento)}
                </span>
            </td>
            {showBirthdayColumn && (
                <td className="px-4 py-3">
                    {athlete.dias_ate_aniversario === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-amber-400 text-white">
                            🎂 Hoje
                        </span>
                    ) : (
                        <span className="text-sm font-semibold text-amber-600">
                            em {athlete.dias_ate_aniversario} dia{athlete.dias_ate_aniversario !== 1 ? 's' : ''}
                        </span>
                    )}
                </td>
            )}
            <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                    {athlete.esportes.length > 0
                        ? athlete.esportes.map(e => (
                            <span
                                key={e}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF7ED] text-[#C2410C]"
                            >
                                {e}
                            </span>
                        ))
                        : <span className="text-xs text-[#002B40]/30">—</span>
                    }
                </div>
            </td>
            <td className="px-4 py-3 text-right">
                <span className={cn("text-sm", isToday ? "font-black text-[#002B40]" : "font-bold text-[#002B40]")}>
                    {athlete.total_reservas}
                </span>
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#002B40]/40 hover:text-[#002B40] hover:bg-[#002B40]/5"
                        title="Ver perfil do atleta"
                        onClick={() => onNavigate(`/dashboard/athletes/${arenaId}/${athlete.id}`)}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#25D366]/70 hover:text-[#25D366] hover:bg-[#25D366]/10"
                        title="Enviar mensagem no WhatsApp"
                        onClick={() => handleWhatsApp(athlete.telefone, athlete.nome)}
                        disabled={!athlete.telefone}
                    >
                        <MessageCircle className="h-4 w-4" />
                    </Button>
                </div>
            </td>
        </tr>
    )
}
