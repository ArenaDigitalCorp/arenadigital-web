"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
    Calendar, Search, CheckCircle2, Loader2, ChevronDown, Users,
    CalendarDays, Clock, MapPin, TrendingUp, AlertCircle, Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { arenaDataTable } from "@/lib/arena-data-table"
import { toast } from "sonner"
import { confirmarPagamentoAvulsoAction } from "@/modules/bookings/actions/bookingActions"
import { ConfirmarPagamentoDialog } from "@/modules/bookings/components/ConfirmarPagamentoDialog"
import {
    GerenciarRateioAvulsoModal,
    type RateioReservaInfo,
} from "@/modules/bookings/components/rateio/GerenciarRateioAvulsoModal"
import { restanteCobranca } from "@/modules/bookings/lib/booking-rateio"
import {
    matchesAvulsoSearch,
    resumoAvulsos,
    type AvulsoReservaItem,
} from "@/modules/finance/lib/avulsos-list"

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

interface Props {
    arenaId: string
    initialItems: AvulsoReservaItem[]
    modosPagamento: { id: string; nome: string }[]
    /** Abre o rateio desta reserva ao carregar (link "Gerenciar em Avulsos" do calendário). */
    initialBookingId?: string | null
}

function StatCard({ icon: Icon, label, value, sub, color }: {
    icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
    return (
        <Card className="border-none shadow-sm bg-white p-5 flex items-center gap-4">
            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0", color)}>
                <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
                <p className="text-[10px] font-black uppercase text-arena-navy-800/40 tracking-wider">{label}</p>
                <p className="text-2xl font-black text-arena-navy-800">{value}</p>
                {sub && <p className="text-[11px] text-arena-navy-800/40 font-medium">{sub}</p>}
            </div>
        </Card>
    )
}

function toRateioInfo(item: AvulsoReservaItem): RateioReservaInfo {
    return {
        id: item.id,
        responsavel: item.atleta?.nome_perfil ?? item.athlete_name,
        espaco: item.court?.name ?? null,
        start_time: item.start_time,
        end_time: item.end_time,
    }
}

export function AvulsasPageClient({ arenaId, initialItems, modosPagamento, initialBookingId = null }: Props) {
    const router = useRouter()
    const items = initialItems
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<"todos" | "pendente" | "pago" | "cancelado">("pendente")
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [confirmDialog, setConfirmDialog] = useState<AvulsoReservaItem | null>(null)
    const [rateioTarget, setRateioTarget] = useState<RateioReservaInfo | null>(null)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (!initialBookingId) return
        const item = initialItems.find((i) => i.id === initialBookingId)
        if (!item) return
        setRateioTarget(toRateioInfo(item))
        setStatusFilter(item.status)
        // Só na chegada pelo link; mudanças posteriores de initialItems não reabrem.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialBookingId])

    const filtered = useMemo(
        () =>
            items.filter(
                (item) =>
                    matchesAvulsoSearch(item, search) &&
                    (statusFilter === "todos" || item.status === statusFilter)
            ),
        [items, search, statusFilter]
    )

    const resumo = resumoAvulsos(items)

    const toggleExpanded = (id: string) =>
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })

    const handleConfirmarPagamento = async (valor: number) => {
        if (!confirmDialog) return
        const item = confirmDialog
        setLoadingId(item.id)
        try {
            const res = await confirmarPagamentoAvulsoAction(arenaId, item.id, valor)
            if (res.success) {
                toast.success("Pagamento confirmado!")
                setConfirmDialog(null)
                router.refresh()
            } else {
                toast.error(res.error ?? "Erro ao confirmar pagamento")
            }
        } finally {
            setLoadingId(null)
        }
    }

    const formatDataHora = (iso: string) =>
        format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

    const statusBadge = (item: AvulsoReservaItem) => {
        if (item.status === "pago") {
            return <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px] uppercase">Pago</Badge>
        }
        if (item.status === "cancelado") {
            return <Badge className="bg-gray-100 text-gray-500 border-none font-bold text-[10px] uppercase">Cancelado</Badge>
        }
        if (item.rateio && item.valor_pago > 0) {
            return <Badge className="bg-amber-100 text-amber-700 border-none font-bold text-[10px] uppercase">Parcial</Badge>
        }
        return <Badge className="bg-orange-100 text-orange-700 border-none font-bold text-[10px] uppercase">Pendente</Badge>
    }

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">Cobranças Avulsas</h1>
                <p className="text-arena-navy-800/60 font-medium">
                    Acompanhe as reservas avulsas de todos os espaços da arena, com o rateio de cada uma.
                </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    icon={AlertCircle}
                    label="Reservas pendentes"
                    value={String(resumo.pendentes)}
                    sub={`${formatCurrency(resumo.aReceber)} a receber`}
                    color={resumo.pendentes > 0 ? "bg-orange-500" : "bg-slate-400"}
                />
                <StatCard
                    icon={TrendingUp}
                    label="Reservas pagas"
                    value={String(resumo.pagas)}
                    sub="reservas avulsas quitadas"
                    color="bg-emerald-500"
                />
                <StatCard
                    icon={Wallet}
                    label="Total recebido"
                    value={formatCurrency(resumo.recebido)}
                    sub="inclui pagamentos parciais de rateio"
                    color="bg-arena-button"
                />
            </div>

            {/* Table */}
            <Card className="border-none shadow-sm bg-white p-6 space-y-5">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        {(["pendente", "pago", "cancelado", "todos"] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setStatusFilter(f)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors capitalize",
                                    statusFilter === f
                                        ? "bg-arena-navy-800 text-white"
                                        : "bg-[#F1F5F9] text-arena-navy-800/60 hover:bg-arena-navy-800/10"
                                )}
                            >
                                {f === "pendente" ? "Pendentes" : f === "pago" ? "Pagas" : f === "cancelado" ? "Canceladas" : "Todas"}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-[280px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/30" />
                        <Input
                            placeholder="Buscar pessoa ou espaço..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 border-arena-navy-800/10"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className={arenaDataTable.table}>
                        <thead>
                            <tr className={arenaDataTable.theadRow}>
                                {[
                                    "Responsável",
                                    "Espaço",
                                    "Data / Horário",
                                    "Valor",
                                    "Status",
                                    "Ações",
                                ].map((h, i, arr) => (
                                    <th
                                        key={h}
                                        className={i === arr.length - 1 ? arenaDataTable.thRight : arenaDataTable.th}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className={arenaDataTable.emptyCell}>
                                        Nenhuma cobrança avulsa encontrada.
                                    </td>
                                </tr>
                            )}
                            {filtered.map(item => {
                                const nome = item.atleta?.nome_perfil ?? item.athlete_name
                                const courtName = item.court?.name ?? "—"
                                const isPendente = item.status === "pendente"
                                const isConfirming = loadingId === item.id
                                const isExpanded = expanded.has(item.id)
                                const quitadas = item.cobrancas.filter(c => c.status === "quitado").length

                                return (
                                    <Fragment key={item.id}>
                                        <tr className={arenaDataTable.tbodyRow}>
                                            {/* Responsável */}
                                            <td className={arenaDataTable.tdBold}>
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0",
                                                        item.rateio ? "bg-arena-button/10" : "bg-orange-100"
                                                    )}>
                                                        {item.rateio
                                                            ? <Users className="h-4 w-4 text-arena-button" />
                                                            : <Calendar className="h-4 w-4 text-orange-600" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-arena-navy-800 text-sm">{nome}</p>
                                                        {item.rateio ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleExpanded(item.id)}
                                                                aria-expanded={isExpanded}
                                                                className="flex items-center gap-1 text-[11px] font-bold text-arena-button"
                                                            >
                                                                Rateio · {item.cobrancas.length} pessoa{item.cobrancas.length !== 1 ? "s" : ""}
                                                                <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                                                            </button>
                                                        ) : item.atleta?.telefone ? (
                                                            <p className="text-[11px] text-arena-navy-800/40">{item.atleta.telefone}</p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Espaço */}
                                            <td className={arenaDataTable.td}>
                                                <div className="flex items-center gap-1.5 text-sm font-medium text-arena-navy-800">
                                                    <MapPin className="h-3.5 w-3.5 text-arena-navy-800/30 flex-shrink-0" />
                                                    {courtName}
                                                </div>
                                                {item.sports?.name && (
                                                    <p className="text-[11px] text-arena-navy-800/40 mt-0.5">{item.sports.name}</p>
                                                )}
                                            </td>

                                            {/* Data / Horário */}
                                            <td className={cn(arenaDataTable.td, "align-top")}>
                                                <div className="flex items-center gap-1.5 text-sm font-bold text-arena-navy-800">
                                                    <CalendarDays className="h-3.5 w-3.5 text-arena-navy-800/30 flex-shrink-0" />
                                                    {format(parseISO(item.start_time), "dd/MM/yyyy", { locale: ptBR })}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px] text-arena-navy-800/50 mt-0.5">
                                                    <Clock className="h-3 w-3" />
                                                    {format(parseISO(item.start_time), "HH:mm", { locale: ptBR })}
                                                </div>
                                            </td>

                                            {/* Valor */}
                                            <td className={cn(arenaDataTable.td, "align-top whitespace-nowrap")}>
                                                <p className="text-base font-black text-arena-button">
                                                    {formatCurrency(item.valor_total)}
                                                </p>
                                                {item.rateio && item.status !== "cancelado" && (
                                                    <p className="text-[11px] text-arena-navy-800/40">
                                                        {formatCurrency(item.valor_pago)} pago · {quitadas}/{item.cobrancas.length} quitaram
                                                    </p>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className={arenaDataTable.td}>
                                                {statusBadge(item)}
                                            </td>

                                            {/* Ações */}
                                            <td className={arenaDataTable.tdRight}>
                                                <div className="flex items-center justify-end gap-2">
                                                    {item.rateio ? (
                                                        <Button
                                                            size="sm"
                                                            variant={isPendente ? "default" : "outline"}
                                                            onClick={() => setRateioTarget(toRateioInfo(item))}
                                                            className={cn(
                                                                "h-8 px-3 rounded-lg text-xs font-bold gap-1.5",
                                                                isPendente && "bg-arena-button hover:bg-arena-button-hover text-white"
                                                            )}
                                                        >
                                                            <Users className="h-3.5 w-3.5" />
                                                            {isPendente ? "Gerenciar rateio" : "Ver rateio"}
                                                        </Button>
                                                    ) : isPendente ? (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setRateioTarget(toRateioInfo(item))}
                                                                className="h-8 px-3 rounded-lg text-xs font-bold"
                                                            >
                                                                Ratear
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => setConfirmDialog(item)}
                                                                disabled={isConfirming}
                                                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-1.5 h-8 px-3 rounded-lg text-xs"
                                                            >
                                                                {isConfirming
                                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    : <CheckCircle2 className="h-3.5 w-3.5" />
                                                                }
                                                                Confirmar
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-arena-navy-800/30 font-medium">—</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {item.rateio && isExpanded && (
                                            <tr className="bg-slate-50/60">
                                                <td colSpan={6} className="px-4 py-3">
                                                    {item.cobrancas.length === 0 ? (
                                                        <p className="text-xs font-medium text-arena-navy-800/50">
                                                            Nenhuma pessoa no rateio ainda.
                                                        </p>
                                                    ) : (
                                                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                            {item.cobrancas.map((c) => {
                                                                const restante = restanteCobranca(c)
                                                                return (
                                                                    <li
                                                                        key={c.id}
                                                                        className="flex items-center justify-between gap-2 rounded-xl border border-arena-navy-800/8 bg-white px-3 py-2"
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <p className="truncate text-sm font-semibold text-arena-navy-800">
                                                                                {c.nome}
                                                                                {!c.atleta_id && (
                                                                                    <span className="ml-1 text-[10px] font-medium text-arena-navy-800/40">sem cadastro</span>
                                                                                )}
                                                                            </p>
                                                                            <p className="text-[11px] font-medium text-arena-navy-800/50">
                                                                                {formatCurrency(c.valor_devido)}
                                                                                {c.valor_pago > 0 && restante > 0 && ` · pago ${formatCurrency(c.valor_pago)}`}
                                                                            </p>
                                                                        </div>
                                                                        <span className={cn(
                                                                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                                                            c.status === "quitado"
                                                                                ? "bg-emerald-100 text-emerald-700"
                                                                                : c.status === "parcial"
                                                                                    ? "bg-amber-100 text-amber-700"
                                                                                    : "bg-orange-100 text-orange-700"
                                                                        )}>
                                                                            {c.status === "quitado" ? "Pago" : c.status === "parcial" ? "Parcial" : "Pendente"}
                                                                        </span>
                                                                    </li>
                                                                )
                                                            })}
                                                        </ul>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <ConfirmarPagamentoDialog
                isOpen={!!confirmDialog}
                onClose={() => setConfirmDialog(null)}
                onConfirm={handleConfirmarPagamento}
                atletaNome={confirmDialog?.atleta?.nome_perfil ?? confirmDialog?.athlete_name ?? ""}
                mesDevido={confirmDialog ? formatDataHora(confirmDialog.start_time) : ""}
                valorPadrao={confirmDialog?.valor_total ?? 0}
                isLoading={loadingId !== null}
                tipo="avulso"
            />

            <GerenciarRateioAvulsoModal
                key={rateioTarget?.id ?? "fechado"}
                open={!!rateioTarget}
                onClose={() => setRateioTarget(null)}
                onChanged={() => router.refresh()}
                arenaId={arenaId}
                reserva={rateioTarget}
                modosPagamento={modosPagamento}
            />
        </div>
    )
}
