"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    ArrowLeft, Wallet, CalendarDays, Trophy, RefreshCw,
    ShoppingCart, Receipt, CheckCircle2, XCircle, Clock,
    Activity, ChevronRight, Loader2, Star, X,
    ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getAthleteDetailsAction, type AthleteDetailData } from "@/modules/athletes/actions/athleteDetailsActions"

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                {action && <div className="text-sm font-medium text-arena-button hover:text-arena-button-hover cursor-pointer">{action}</div>}
            </div>
            <div className="p-6">
                {children}
            </div>
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

    if (reservas.length === 0) return <p className="text-gray-400 text-sm text-center py-4">Nenhuma reserva encontrada.</p>

    const thCls = "pb-3 font-bold cursor-pointer select-none hover:text-arena-button transition-colors whitespace-nowrap"

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left relative min-w-[600px]">
                <thead className="text-[11px] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100 sticky top-0 bg-white z-10">
                    <tr>
                        <th className="pb-3 font-bold w-10 pl-2">#</th>
                        <th className={thCls} onClick={() => handleSort('date')}>
                            Data <SortIcon field="date" active={sortField === 'date'} dir={sortDir} />
                        </th>
                        {showTime && (
                            <th className={thCls} onClick={() => handleSort('time')}>
                                Horário <SortIcon field="time" active={sortField === 'time'} dir={sortDir} />
                            </th>
                        )}
                        <th className={thCls} onClick={() => handleSort('sport')}>
                            Esporte <SortIcon field="sport" active={sortField === 'sport'} dir={sortDir} />
                        </th>
                        <th className={thCls} onClick={() => handleSort('court')}>
                            Quadra <SortIcon field="court" active={sortField === 'court'} dir={sortDir} />
                        </th>
                        <th className={`${thCls} text-right pr-2`} onClick={() => handleSort('duration')}>
                            Duração <SortIcon field="duration" active={sortField === 'duration'} dir={sortDir} />
                        </th>
                        {showTime && (
                            <th className={`${thCls} pr-2`} onClick={() => handleSort('status')}>
                                Status <SortIcon field="status" active={sortField === 'status'} dir={sortDir} />
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {items.map((r, index) => (
                        <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="py-4 text-gray-400 font-medium pl-2">{index + 1}</td>
                            <td className="py-4 text-gray-900 whitespace-nowrap">{fmt(r.start_time)}</td>
                            {showTime && (
                                <td className="py-4 text-gray-900 whitespace-nowrap font-medium">
                                    {new Date(r.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </td>
                            )}
                            <td className="py-4 text-gray-900 whitespace-nowrap">
                                <span className="flex items-center gap-2">
                                    <Activity className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                    {r.sport_name || "—"}
                                </span>
                            </td>
                            <td className="py-4 text-gray-900 whitespace-nowrap">{r.court_name || "—"}</td>
                            <td className="py-4 text-gray-900 text-right pr-2 whitespace-nowrap">{duration(r.start_time, r.end_time)}</td>
                            {showTime && (
                                <td className="py-4 pr-2 whitespace-nowrap">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${STATUS_CLASS[r.status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
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
    if (rotativos.length === 0) return <p className="text-gray-400 text-sm text-center py-4">Nenhum rotativo encontrado.</p>

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left relative min-w-[600px]">
                <thead className="text-[11px] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100 sticky top-0 bg-white z-10">
                    <tr>
                        <th className="pb-3 font-bold w-10 pl-2">#</th>
                        <th className="pb-3 font-bold">Data</th>
                        <th className="pb-3 font-bold">Esporte</th>
                        <th className="pb-3 font-bold">Horário</th>
                        <th className="pb-3 font-bold text-right pr-2">Pago</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {items.map((r, index) => (
                        <tr key={r.id}>
                            <td className="py-4 text-gray-400 font-medium pl-2">{index + 1}</td>
                            <td className="py-4 text-gray-900 whitespace-nowrap">{fmt(r.data)}</td>
                            <td className="py-4 text-gray-900 whitespace-nowrap">{r.sport_name || "Esporte"}</td>
                            <td className="py-4 text-gray-900 whitespace-nowrap">{r.hora_inicio?.slice(0,5)} - {r.hora_fim?.slice(0,5)}</td>
                            <td className="py-4 text-gray-900 text-right font-medium pr-2 whitespace-nowrap">
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
    if (comandas.length === 0) return <p className="text-gray-400 text-sm text-center py-4">Nenhuma comanda vinculada.</p>

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left relative min-w-[600px]">
                <thead className="text-[11px] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100 sticky top-0 bg-white z-10">
                    <tr>
                        <th className="pb-3 font-bold w-10 pl-2">#</th>
                        <th className="pb-3 font-bold">Pedido #</th>
                        <th className="pb-3 font-bold">Data</th>
                        <th className="pb-3 font-bold">Status</th>
                        <th className="pb-3 font-bold text-right pr-2">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {items.map((c, index) => (
                        <tr key={c.id}>
                            <td className="py-4 text-gray-400 font-medium pl-2">{index + 1}</td>
                            <td className="py-4 text-gray-900 font-medium whitespace-nowrap">#{String(c.order_number).padStart(4, '0')}</td>
                            <td className="py-4 text-gray-900 whitespace-nowrap">{fmt(c.created_at)}</td>
                            <td className="py-4 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${c.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {c.status}
                                </span>
                            </td>
                            <td className="py-4 text-gray-900 text-right font-medium pr-2 whitespace-nowrap">{fmtCurrency(c.total_value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function PagamentosTable({ pagamentos, limit }: { pagamentos: any[], limit?: number }) {
    const items = limit ? pagamentos.slice(0, limit) : pagamentos
    if (pagamentos.length === 0) return <p className="text-gray-400 text-sm text-center py-4">Nenhum pagamento registrado.</p>

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left relative min-w-[600px]">
                <thead className="text-[11px] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100 sticky top-0 bg-white z-10">
                    <tr>
                        <th className="pb-3 font-bold w-10 pl-2">#</th>
                        <th className="pb-3 font-bold">Data</th>
                        <th className="pb-3 font-bold">Descrição</th>
                        <th className="pb-3 font-bold">Método</th>
                        <th className="pb-3 font-bold text-right pr-2">Valor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {items.map((p, index) => (
                        <tr key={p.id}>
                            <td className="py-4 text-gray-400 font-medium pl-2">{index + 1}</td>
                            <td className="py-4 text-gray-900 whitespace-nowrap">{fmt(p.registration_date)}</td>
                            <td className="py-4 text-gray-900 whitespace-nowrap">{p.description || p.category || "Entrada"}</td>
                            <td className="py-4 text-gray-500 whitespace-nowrap">{p.modo_pagamento || "---"}</td>
                            <td className="py-4 text-emerald-600 text-right font-semibold pr-2 whitespace-nowrap">+{fmtCurrency(p.total_value)}</td>
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
        <div className="min-h-screen bg-arena-app-surface">
            <div className="max-w-6xl mx-auto">
                
                {/* ── HEADER ── */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-gray-900">{data.nome_perfil}</h1>
                        <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
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
                <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 flex items-center gap-10 mb-6">
                    <div className="flex-shrink-0">
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

                {/* ── TWO COLUMNS LAYOUT ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* LEFT COLUMN (2/3) */}
                    <div className="lg:col-span-2">
                        
                        <SectionCard 
                            title="Histórico de Reservas (Jogos)" 
                            action={data.reservas.length > 0 ? <button onClick={() => setActiveModal('reservas')}>Ver Todos</button> : null}
                        >
                            <ReservasTable reservas={data.reservas} limit={5} />
                        </SectionCard>

                        <SectionCard 
                            title="Histórico de Rotativos"
                            action={data.rotativos.length > 0 ? <button onClick={() => setActiveModal('rotativos')}>Ver Todos</button> : null}
                        >
                            <RotativosTable rotativos={data.rotativos} limit={5} />
                        </SectionCard>

                        <SectionCard 
                            title="Comandas"
                            action={data.comandas.length > 0 ? <button onClick={() => setActiveModal('comandas')}>Ver Todos</button> : null}
                        >
                            <ComandasTable comandas={data.comandas} limit={5} />
                        </SectionCard>

                        <SectionCard 
                            title="Financeiro (Entradas)"
                            action={data.pagamentos.length > 0 ? <button onClick={() => setActiveModal('pagamentos')}>Ver Todos</button> : null}
                        >
                            <PagamentosTable pagamentos={data.pagamentos} limit={5} />
                        </SectionCard>

                    </div>

                    {/* RIGHT COLUMN (1/3) */}
                    <div className="space-y-6">
                        
                        <SectionCard title="Esportes">
                            {data.esportes.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">Nenhum esporte vinculado.</p>
                            ) : (
                                <div className="space-y-5">
                                    {data.esportes.map((e, i) => {
                                        const widthMap = ['w-full', 'w-[75%]', 'w-[50%]', 'w-[25%]'];
                                        const widthClass = widthMap[i % widthMap.length];
                                        const isPrimary = i === 0;

                                        return (
                                            <div key={i}>
                                                <div className="flex justify-between items-end mb-2">
                                                    <span className="text-sm font-medium text-gray-900">{e.nome}</span>
                                                    <span className="text-xs text-gray-500 font-medium">{e.nivel || "N/A"}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div className={`h-2 rounded-full ${isPrimary ? 'bg-arena-button' : 'bg-arena-navy-800'} ${widthClass}`}></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    
                                    <div className="mt-8 pt-5 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                                        <div className="bg-orange-100 p-1.5 rounded-full">
                                            <Star className="h-4 w-4 text-arena-button fill-arena-button"/>
                                        </div>
                                        <span>Atleta frequente na arena.</span>
                                    </div>
                                </div>
                            )}
                        </SectionCard>

                        <SectionCard title="Extrato Fidelidade">
                            {data.historico_fidelidade.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">Sem histórico de fidelidade.</p>
                            ) : (
                                <div className="space-y-0 divide-y divide-gray-50">
                                    {data.historico_fidelidade.map((h) => (
                                        <div key={h.id} className="py-3 flex justify-between items-center">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{h.descricao || h.tipo}</p>
                                                <p className="text-[11px] text-gray-400">{fmt(h.data_registro)}</p>
                                            </div>
                                            <span className={`font-semibold text-sm ${h.tipo === 'crédito' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {h.tipo === 'crédito' ? '+' : '-'}${h.valor.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>
                        
                    </div>
                </div>

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
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
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
