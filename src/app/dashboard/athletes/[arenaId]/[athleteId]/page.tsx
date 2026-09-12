"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    ArrowLeft, Wallet, CalendarDays, Trophy, RefreshCw,
    Activity, Loader2, X,
    ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { arenaDataTable } from "@/lib/arena-data-table"
import { getAthleteDetailsAction, type AthleteDetailData } from "@/modules/athletes/actions/athleteDetailsActions"
import { PerfilAtletaCard } from "@/modules/athletes/components/PerfilAtletaCard"

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmt(dateStr: string | null, opts?: Intl.DateTimeFormatOptions): string {
    if (!dateStr) return "---"
    return new Date(dateStr).toLocaleDateString("pt-BR", opts ?? { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(val: number) {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function duration(start: string, end: string): string {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000
    return `${Math.round(diff)} min`
}

// ─────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────
function MetricCard({ title, value, icon, valueColor = "text-gray-900" }: { title: string, value: string, icon: React.ReactNode, valueColor?: string }) {
    return (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-[104px]">
            <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-gray-500 tracking-wider uppercase">{title}</span>
                <div className="text-gray-400">
                    {icon}
                </div>
            </div>
            <div className={`text-2xl font-bold ${valueColor}`}>
                {value}
            </div>
        </div>
    )
}

function SectionCard({ title, action, children }: { title: string, action?: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="mb-6 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <h3 className="font-heading text-xl font-bold text-[#5F636E]">{title}</h3>
                {action && (
                    <div className="cursor-pointer text-sm font-medium text-arena-button hover:text-arena-button-hover">
                        {action}
                    </div>
                )}
            </div>
            <div className="px-6 py-6">{children}</div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Table Components for reuse
// ─────────────────────────────────────────────
type ReservasSortField = 'date' | 'time' | 'sport' | 'court' | 'duration' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_LABEL: Record<string, string> = {
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
    reservado: 'Ag. Confirmação',
}
const STATUS_CLASS: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
    reservado: 'bg-amber-100 text-amber-700',
}

function SortIcon({ field, active, dir }: { field: string; active: boolean; dir: SortDir }) {
    if (!active) return <ArrowUpDown className="inline ml-1 h-3 w-3 opacity-40" />
    return dir === 'asc'
        ? <ArrowUp className="inline ml-1 h-3 w-3 text-arena-button" />
        : <ArrowDown className="inline ml-1 h-3 w-3 text-arena-button" />
}

function ReservasTable({ reservas, limit, showTime }: { reservas: any[], limit?: number, showTime?: boolean }) {
    const [sortField, setSortField] = useState<ReservasSortField>('date')
    const [sortDir, setSortDir] = useState<SortDir>('desc')

    const handleSort = (field: ReservasSortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortField(field); setSortDir('asc') }
    }

    const sorted = [...reservas].sort((a, b) => {
        let va: any, vb: any
        if (sortField === 'date' || sortField === 'time') {
            va = new Date(a.start_time).getTime()
            vb = new Date(b.start_time).getTime()
        } else if (sortField === 'sport') {
            va = (a.sport_name ?? '').toLowerCase()
            vb = (b.sport_name ?? '').toLowerCase()
        } else if (sortField === 'court') {
            va = (a.court_name ?? '').toLowerCase()
            vb = (b.court_name ?? '').toLowerCase()
        } else if (sortField === 'duration') {
            va = new Date(a.end_time).getTime() - new Date(a.start_time).getTime()
            vb = new Date(b.end_time).getTime() - new Date(b.start_time).getTime()
        } else {
            va = (a.status ?? '').toLowerCase()
            vb = (b.status ?? '').toLowerCase()
        }
        if (va < vb) return sortDir === 'asc' ? -1 : 1
        if (va > vb) return sortDir === 'asc' ? 1 : -1
        return 0
    })

    const items = limit ? sorted.slice(0, limit) : sorted
    const colCount = showTime ? 7 : 5

    const thSort = (field: ReservasSortField) =>
        cn(arenaDataTable.th, "cursor-pointer select-none whitespace-nowrap hover:text-arena-button")

    if (reservas.length === 0) {
        return (
            <div className="overflow-x-auto">
                <table className={arenaDataTable.table}>
                    <tbody>
                        <tr>
                            <td colSpan={colCount} className={arenaDataTable.emptyCell}>
                                Nenhuma reserva encontrada.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className={cn(arenaDataTable.table, "min-w-[600px]")}>
                <thead>
                    <tr className={arenaDataTable.theadRow}>
                        <th className={cn(arenaDataTable.th, "w-10")}>#</th>
                        <th className={thSort('date')} onClick={() => handleSort('date')}>
                            Data <SortIcon field="date" active={sortField === 'date'} dir={sortDir} />
                        </th>
                        {showTime && (
                            <th className={thSort('time')} onClick={() => handleSort('time')}>
                                Horário <SortIcon field="time" active={sortField === 'time'} dir={sortDir} />
                            </th>
                        )}
                        <th className={thSort('sport')} onClick={() => handleSort('sport')}>
                            Esporte <SortIcon field="sport" active={sortField === 'sport'} dir={sortDir} />
                        </th>
                        <th className={thSort('court')} onClick={() => handleSort('court')}>
                            Quadra <SortIcon field="court" active={sortField === 'court'} dir={sortDir} />
                        </th>
                        <th
                            className={cn(arenaDataTable.thRight, "cursor-pointer select-none whitespace-nowrap hover:text-arena-button")}
                            onClick={() => handleSort('duration')}
                        >
                            Duração <SortIcon field="duration" active={sortField === 'duration'} dir={sortDir} />
                        </th>
                        {showTime && (
                            <th className={thSort('status')} onClick={() => handleSort('status')}>
                                Status <SortIcon field="status" active={sortField === 'status'} dir={sortDir} />
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {items.map((r, index) => (
                        <tr key={r.id} className={arenaDataTable.tbodyRow}>
                            <td className={cn(arenaDataTable.td, "text-arena-navy-800/40")}>{index + 1}</td>
                            <td className={arenaDataTable.tdBold}>{fmt(r.start_time)}</td>
                            {showTime && (
                                <td className={arenaDataTable.tdBold}>
                                    {new Date(r.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </td>
                            )}
                            <td className={arenaDataTable.td}>
                                <span className="flex items-center gap-2 whitespace-nowrap">
                                    <Activity className="h-3.5 w-3.5 shrink-0 text-arena-navy-800/30" />
                                    {r.sport_name || "—"}
                                </span>
                            </td>
                            <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{r.court_name || "—"}</td>
                            <td className={cn(arenaDataTable.tdRight, "text-sm font-medium text-arena-navy-800")}>{duration(r.start_time, r.end_time)}</td>
                            {showTime && (
                                <td className={arenaDataTable.td}>
                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_CLASS[r.status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                                        {STATUS_LABEL[r.status ?? ''] ?? r.status ?? '—'}
                                    </span>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function RotativosTable({ rotativos, limit }: { rotativos: any[], limit?: number }) {
    const items = limit ? rotativos.slice(0, limit) : rotativos

    if (rotativos.length === 0) {
        return (
            <div className="overflow-x-auto">
                <table className={arenaDataTable.table}>
                    <tbody>
                        <tr>
                            <td colSpan={5} className={arenaDataTable.emptyCell}>
                                Nenhum rotativo encontrado.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className={cn(arenaDataTable.table, "min-w-[600px]")}>
                <thead>
                    <tr className={arenaDataTable.theadRow}>
                        <th className={cn(arenaDataTable.th, "w-10")}>#</th>
                        <th className={arenaDataTable.th}>Data</th>
                        <th className={arenaDataTable.th}>Esporte</th>
                        <th className={arenaDataTable.th}>Horário</th>
                        <th className={arenaDataTable.thRight}>Pago</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((r, index) => (
                        <tr key={r.id} className={arenaDataTable.tbodyRow}>
                            <td className={cn(arenaDataTable.td, "text-arena-navy-800/40")}>{index + 1}</td>
                            <td className={arenaDataTable.tdBold}>{fmt(r.data)}</td>
                            <td className={arenaDataTable.td}>{r.sport_name || "Esporte"}</td>
                            <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                {r.hora_inicio?.slice(0, 5)} - {r.hora_fim?.slice(0, 5)}
                            </td>
                            <td className={cn(arenaDataTable.tdRight, "text-sm font-semibold text-arena-navy-800")}>
                                {r.valor_pago ? fmtCurrency(r.valor_pago) : "---"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function ComandasTable({ comandas, limit }: { comandas: any[], limit?: number }) {
    const items = limit ? comandas.slice(0, limit) : comandas

    if (comandas.length === 0) {
        return (
            <div className="overflow-x-auto">
                <table className={arenaDataTable.table}>
                    <tbody>
                        <tr>
                            <td colSpan={5} className={arenaDataTable.emptyCell}>
                                Nenhuma comanda vinculada.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className={cn(arenaDataTable.table, "min-w-[600px]")}>
                <thead>
                    <tr className={arenaDataTable.theadRow}>
                        <th className={cn(arenaDataTable.th, "w-10")}>#</th>
                        <th className={arenaDataTable.th}>Pedido #</th>
                        <th className={arenaDataTable.th}>Data</th>
                        <th className={arenaDataTable.th}>Status</th>
                        <th className={arenaDataTable.thRight}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((c, index) => (
                        <tr key={c.id} className={arenaDataTable.tbodyRow}>
                            <td className={cn(arenaDataTable.td, "text-arena-navy-800/40")}>{index + 1}</td>
                            <td className={arenaDataTable.tdBold}>#{String(c.order_number).padStart(4, "0")}</td>
                            <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{fmt(c.created_at)}</td>
                            <td className={arenaDataTable.td}>
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${c.status === "open" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                                    {c.status}
                                </span>
                            </td>
                            <td className={cn(arenaDataTable.tdRight, "text-sm font-semibold text-arena-navy-800")}>
                                {fmtCurrency(c.total_value)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function PagamentosTable({ pagamentos, limit }: { pagamentos: any[], limit?: number }) {
    const items = limit ? pagamentos.slice(0, limit) : pagamentos

    if (pagamentos.length === 0) {
        return (
            <div className="overflow-x-auto">
                <table className={arenaDataTable.table}>
                    <tbody>
                        <tr>
                            <td colSpan={5} className={arenaDataTable.emptyCell}>
                                Nenhum pagamento registrado.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className={cn(arenaDataTable.table, "min-w-[600px]")}>
                <thead>
                    <tr className={arenaDataTable.theadRow}>
                        <th className={cn(arenaDataTable.th, "w-10")}>#</th>
                        <th className={arenaDataTable.th}>Data</th>
                        <th className={arenaDataTable.th}>Descrição</th>
                        <th className={arenaDataTable.th}>Método</th>
                        <th className={arenaDataTable.thRight}>Valor</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((p, index) => (
                        <tr key={p.id} className={arenaDataTable.tbodyRow}>
                            <td className={cn(arenaDataTable.td, "text-arena-navy-800/40")}>{index + 1}</td>
                            <td className={arenaDataTable.tdBold}>{fmt(p.registration_date)}</td>
                            <td className={arenaDataTable.td}>{p.description || p.category || "Entrada"}</td>
                            <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{p.modo_pagamento || "---"}</td>
                            <td className={cn(arenaDataTable.tdRight, "text-sm font-semibold text-emerald-600")}>
                                +{fmtCurrency(p.total_value)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}


export default function AthleteDetailPage({
    params
}: {
    params: Promise<{ arenaId: string; athleteId: string }>
}) {
    const { arenaId, athleteId } = use(params)
    const router = useRouter()
    const [data, setData] = useState<AthleteDetailData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [activeModal, setActiveModal] = useState<'reservas' | 'rotativos' | 'comandas' | 'pagamentos' | null>(null)

    useEffect(() => {
        setIsLoading(true)
        getAthleteDetailsAction(arenaId, athleteId)
            .then((res) => {
                if (res.success) setData(res.data)
            })
            .finally(() => setIsLoading(false))
    }, [arenaId, athleteId])

    const initials = data?.nome_perfil
        ? data.nome_perfil.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
        : "?"

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-arena-app-surface">
                <Loader2 className="h-10 w-10 animate-spin text-arena-button" />
                <p className="text-gray-400 font-medium">Carregando perfil do atleta...</p>
            </div>
        )
    }

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-arena-app-surface p-8">
                <p className="text-red-500 font-semibold">Atleta não encontrado.</p>
                <Button variant="outline" onClick={() => router.back()}>Voltar</Button>
            </div>
        )
    }

    const totalSpent = data.total_pago_arena + data.total_gasto_comandas + data.valor_total_rotativos;

    return (
        <div className="min-h-screen w-full bg-arena-app-surface">
            <div className="w-full">
                
                {/* ── HEADER ── */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-gray-900">{data.nome_perfil}</h1>
                        <span className="inline-flex items-center rounded-full bg-[linear-gradient(90deg,#F97415_0%,#F9A91F_100%)] px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-[#F97415]/25">
                            Membro Ativo
                        </span>
                    </div>
                    <Button 
                        onClick={() => router.back()}
                        className="bg-arena-button hover:bg-arena-button-hover text-white font-semibold shadow-sm"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para Lista
                    </Button>
                </div>

                {/* ── PROFILE INFO CARD ── */}
                <div className="mb-6 flex items-center gap-10 rounded-lg border border-slate-100 bg-white p-8 shadow-sm">
                    <div className="shrink-0">
                        {data.foto_url ? (
                            <img
                                src={data.foto_url}
                                alt={data.nome_perfil}
                                className="h-28 w-28 rounded-full object-cover ring-4 ring-gray-50"
                            />
                        ) : (
                            <div className="h-28 w-28 rounded-full bg-arena-navy-800 flex items-center justify-center text-white font-black text-3xl ring-4 ring-gray-50">
                                {initials}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-y-6 gap-x-8 w-full">
                        <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">CPF</p>
                            <p className="font-medium text-gray-900">{data.cpf || "---"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">Email</p>
                            <p className="font-medium text-gray-900">{data.email || "---"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">Telefone</p>
                            <p className="font-medium text-gray-900">{data.telefone || "---"}</p>
                        </div>
                        {data.instagram && (
                            <div>
                                <p className="text-xs text-gray-500 font-medium mb-1">Instagram</p>
                                <p className="font-medium text-gray-900">@{data.instagram}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">Membro desde</p>
                            <p className="font-medium text-gray-900">{data.membro_desde ? fmt(data.membro_desde, { month: 'short', year: 'numeric' }) : "---"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">Data de Nascimento</p>
                            <p className="font-medium text-gray-900">
                                {data.data_nascimento ? fmt(data.data_nascimento, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : "-"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── METRICS ROW ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                    <MetricCard 
                        title="Total Gasto" 
                        value={fmtCurrency(totalSpent)} 
                        icon={<Wallet className="h-5 w-5" />} 
                    />
                    <MetricCard 
                        title="Saldo Fidelidade" 
                        value={`$ ${data.saldo.toFixed(2)}`} 
                        icon={<Trophy className="h-5 w-5" />} 
                        valueColor="text-arena-button"
                    />
                    <MetricCard 
                        title="Reservas no Mês" 
                        value={String(data.reservas_este_mes)} 
                        icon={<CalendarDays className="h-5 w-5" />} 
                    />
                    <MetricCard 
                        title="Rotativos Participados" 
                        value={String(data.total_rotativos)} 
                        icon={<RefreshCw className="h-5 w-5" />} 
                    />
                </div>

                {/* ── PERFIL NA ARENA ── */}
                <PerfilAtletaCard arenaId={arenaId} atletaId={athleteId} />

                {/* ── TABLE SECTIONS ── */}
                <SectionCard
                    title="Histórico de Reservas (Jogos)"
                    action={data.reservas.length > 0 ? <button type="button" onClick={() => setActiveModal('reservas')}>Ver Todos</button> : null}
                >
                    <ReservasTable reservas={data.reservas} limit={5} />
                </SectionCard>

                <SectionCard
                    title="Histórico de Rotativos"
                    action={data.rotativos.length > 0 ? <button type="button" onClick={() => setActiveModal('rotativos')}>Ver Todos</button> : null}
                >
                    <RotativosTable rotativos={data.rotativos} limit={5} />
                </SectionCard>

                <SectionCard
                    title="Comandas"
                    action={data.comandas.length > 0 ? <button type="button" onClick={() => setActiveModal('comandas')}>Ver Todos</button> : null}
                >
                    <ComandasTable comandas={data.comandas} limit={5} />
                </SectionCard>

                <SectionCard
                    title="Financeiro (Entradas)"
                    action={data.pagamentos.length > 0 ? <button type="button" onClick={() => setActiveModal('pagamentos')}>Ver Todos</button> : null}
                >
                    <PagamentosTable pagamentos={data.pagamentos} limit={5} />
                </SectionCard>

                {/* ── MODALS FOR "VER TODOS" ── */}
                <Dialog open={activeModal !== null} onOpenChange={(open) => !open && setActiveModal(null)}>
                    <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-full max-h-[90vh] flex flex-col p-0 overflow-hidden [&>button:last-child]:hidden">
                        <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-white z-20 flex flex-row items-center justify-between">
                            <DialogTitle className="text-xl">
                                {activeModal === 'reservas' && "Histórico Completo de Reservas"}
                                {activeModal === 'rotativos' && "Histórico Completo de Rotativos"}
                                {activeModal === 'comandas' && "Todas as Comandas"}
                                {activeModal === 'pagamentos' && "Histórico Completo do Financeiro"}
                            </DialogTitle>
                            <button onClick={() => setActiveModal(null)} className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors mt-0">
                                <X className="h-4 w-4" />
                            </button>
                        </DialogHeader>
                        
                        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                            <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                                {activeModal === 'reservas' && <ReservasTable reservas={data.reservas} showTime />}
                                {activeModal === 'rotativos' && <RotativosTable rotativos={data.rotativos} />}
                                {activeModal === 'comandas' && <ComandasTable comandas={data.comandas} />}
                                {activeModal === 'pagamentos' && <PagamentosTable pagamentos={data.pagamentos} />}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
                
            </div>
        </div>
    )
}
