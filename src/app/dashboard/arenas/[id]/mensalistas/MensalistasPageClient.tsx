"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
    Users, Search, CheckCircle2, XCircle, Loader2,
    CalendarDays, Clock, MapPin, TrendingUp, BadgeCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
    confirmarMesMensalistaAction,
    cancelPlanoMensalistaAction,
} from "@/modules/bookings/actions/mensalistaActions"
import { ConfirmarPagamentoDialog } from "@/modules/bookings/components/ConfirmarPagamentoDialog"
import type { PlanoMensalistaComDetalhes } from "@/modules/bookings/types/booking.types"

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

interface Props {
    arenaId: string
    initialPlanos: PlanoMensalistaComDetalhes[]
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

export function MensalistasPageClient({ arenaId, initialPlanos }: Props) {
    const router = useRouter()
    const [planos, setPlanos] = useState(initialPlanos)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<"todos" | "ativo" | "cancelado">("ativo")
    const [isPending, startTransition] = useTransition()
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [confirmDialog, setConfirmDialog] = useState<{ plano: PlanoMensalistaComDetalhes } | null>(null)

    const filtered = planos.filter(p => {
        const matchSearch =
            p.atleta?.nome_perfil.toLowerCase().includes(search.toLowerCase()) ||
            (p.court as any)?.name?.toLowerCase().includes(search.toLowerCase())
        const matchStatus = statusFilter === "todos" || p.status === statusFilter
        return matchSearch && matchStatus
    })

    const ativos = planos.filter(p => p.status === "ativo")
    const totalMensal = ativos.reduce((acc, p) => acc + p.valor_mensal, 0)
    const comPendencia = ativos.filter(p => p.proximo_mes_reservado).length

    const handleConfirmar = (plano: PlanoMensalistaComDetalhes) => {
        if (!plano.proximo_mes_reservado) return
        setConfirmDialog({ plano })
    }

    const handleConfirmarPagamento = async (valor: number) => {
        if (!confirmDialog) return
        const { plano } = confirmDialog
        setLoadingId(`confirm-${plano.id}`)
        try {
            const res = await confirmarMesMensalistaAction(arenaId, plano.id, valor)
            if (res.success) {
                toast.success("Pagamento confirmado e próximo mês gerado!")
                setConfirmDialog(null)
                router.refresh()
            } else {
                toast.error(res.error ?? "Erro ao confirmar pagamento")
            }
        } finally {
            setLoadingId(null)
        }
    }

    const handleCancelar = (plano: PlanoMensalistaComDetalhes) => {
        const nome = plano.atleta?.nome_perfil ?? plano.athlete_name
        if (!confirm(`Cancelar o plano de ${nome}? As reservas futuras pendentes serão canceladas.`)) return
        setLoadingId(`cancel-${plano.id}`)
        startTransition(async () => {
            const res = await cancelPlanoMensalistaAction(arenaId, plano.id)
            if (res.success) {
                toast.success("Plano cancelado.")
                router.refresh()
            } else {
                toast.error(res.error ?? "Erro ao cancelar plano")
            }
            setLoadingId(null)
        })
    }

    const formatMesAno = (iso: string | null) => {
        if (!iso) return "—"
        return format(parseISO(iso), "MMM/yyyy", { locale: ptBR })
    }

    const formatDataInicio = (date: string) => {
        return format(parseISO(date), "dd/MM/yyyy")
    }

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">Mensalistas</h1>
                <p className="text-arena-navy-800/60 font-medium">
                    Gerencie todos os planos mensais de todos os espaços da arena.
                </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    icon={Users}
                    label="Mensalistas ativos"
                    value={String(ativos.length)}
                    color="bg-amber-500"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Receita mensal prevista"
                    value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalMensal)}
                    sub="soma dos planos ativos"
                    color="bg-emerald-500"
                />
                <StatCard
                    icon={BadgeCheck}
                    label="Aguardando confirmação"
                    value={String(comPendencia)}
                    sub="pagamentos do próximo mês"
                    color={comPendencia > 0 ? "bg-arena-button" : "bg-slate-400"}
                />
            </div>

            {/* Table */}
            <Card className="border-none shadow-sm bg-white p-6 space-y-5">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        {(["ativo", "cancelado", "todos"] as const).map(f => (
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
                                {f === "ativo" ? "Ativos" : f === "cancelado" ? "Cancelados" : "Todos"}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-[280px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/30" />
                        <Input
                            placeholder="Buscar responsável ou espaço..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 border-arena-navy-800/10"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-arena-navy-800/5">
                                {[
                                    "Responsável",
                                    "Espaço",
                                    "Dia / Horário",
                                    "Início",
                                    "Valor mensal",
                                    "Próx. vencimento",
                                    "Status",
                                    "Ações",
                                ].map(h => (
                                    <th key={h} className="py-4 pr-4 font-bold text-[10px] uppercase tracking-wider text-arena-navy-800/40 whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-arena-navy-800/30 font-medium">
                                        Nenhum mensalista encontrado.
                                    </td>
                                </tr>
                            )}
                            {filtered.map(plano => {
                                const nome = plano.atleta?.nome_perfil ?? plano.athlete_name
                                const courtName = (plano.court as any)?.name ?? "—"
                                const dia = DIAS_SEMANA[plano.dia_semana]
                                const horario = `${plano.horario_inicio.slice(0, 5)} – ${plano.horario_fim.slice(0, 5)}`
                                const isAtivo = plano.status === "ativo"
                                const hasPendente = isAtivo && !!plano.proximo_mes_reservado
                                const isConfirming = loadingId === `confirm-${plano.id}`
                                const isCancelling = loadingId === `cancel-${plano.id}`

                                return (
                                    <tr key={plano.id} className="border-b border-arena-navy-800/5 hover:bg-arena-soft transition-colors">
                                        {/* Responsável */}
                                        <td className="py-4 pr-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                    <Users className="h-4 w-4 text-amber-600" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-arena-navy-800 text-sm">{nome}</p>
                                                    {plano.atleta?.telefone && (
                                                        <p className="text-[11px] text-arena-navy-800/40">{plano.atleta.telefone}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Espaço */}
                                        <td className="py-4 pr-4">
                                            <div className="flex items-center gap-1.5 text-sm font-medium text-arena-navy-800">
                                                <MapPin className="h-3.5 w-3.5 text-arena-navy-800/30 flex-shrink-0" />
                                                {courtName}
                                            </div>
                                            {plano.sports?.name && (
                                                <p className="text-[11px] text-arena-navy-800/40 mt-0.5">{plano.sports.name}</p>
                                            )}
                                        </td>

                                        {/* Dia / Horário */}
                                        <td className="py-4 pr-4">
                                            <div className="flex items-center gap-1.5 text-sm font-bold text-arena-navy-800">
                                                <CalendarDays className="h-3.5 w-3.5 text-arena-navy-800/30 flex-shrink-0" />
                                                {dia}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] text-arena-navy-800/50 mt-0.5">
                                                <Clock className="h-3 w-3" />
                                                {horario}
                                            </div>
                                            <p className="text-[11px] text-arena-navy-800/40 mt-0.5">
                                                {plano.sessoes_por_mes}x/mês
                                            </p>
                                        </td>

                                        {/* Início */}
                                        <td className="py-4 pr-4 text-sm text-arena-navy-800/70 font-medium whitespace-nowrap">
                                            {formatDataInicio(plano.data_inicio)}
                                        </td>

                                        {/* Valor mensal */}
                                        <td className="py-4 pr-4">
                                            <p className="text-base font-black text-arena-button">
                                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(plano.valor_mensal)}
                                            </p>
                                            <p className="text-[11px] text-arena-navy-800/40">
                                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
                                                    .format(plano.valor_mensal / plano.sessoes_por_mes)}/sessão
                                            </p>
                                        </td>

                                        {/* Próx. vencimento */}
                                        <td className="py-4 pr-4 whitespace-nowrap">
                                            {hasPendente ? (
                                                <Badge className="bg-amber-100 text-amber-700 border-none font-bold capitalize">
                                                    {formatMesAno(plano.proximo_mes_reservado)}
                                                </Badge>
                                            ) : isAtivo ? (
                                                <span className="text-xs text-emerald-600 font-bold">Em dia</span>
                                            ) : (
                                                <span className="text-xs text-arena-navy-800/30">—</span>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="py-4 pr-4">
                                            <Badge className={cn(
                                                "font-bold text-[10px] uppercase border-none",
                                                isAtivo
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-gray-100 text-gray-500"
                                            )}>
                                                {isAtivo ? "Ativo" : "Cancelado"}
                                            </Badge>
                                        </td>

                                        {/* Ações */}
                                        <td className="py-4">
                                            <div className="flex items-center gap-2">
                                                {isAtivo && hasPendente && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleConfirmar(plano)}
                                                        disabled={isPending}
                                                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-1.5 h-8 px-3 rounded-lg text-xs"
                                                    >
                                                        {isConfirming
                                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            : <CheckCircle2 className="h-3.5 w-3.5" />
                                                        }
                                                        Confirmar
                                                    </Button>
                                                )}
                                                {isAtivo && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleCancelar(plano)}
                                                        disabled={isPending}
                                                        className="text-red-500 hover:bg-red-50 hover:text-red-600 font-bold gap-1.5 h-8 px-3 rounded-lg text-xs"
                                                    >
                                                        {isCancelling
                                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            : <XCircle className="h-3.5 w-3.5" />
                                                        }
                                                        Cancelar
                                                    </Button>
                                                )}
                                                {!isAtivo && (
                                                    <span className="text-xs text-arena-navy-800/30 font-medium">—</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
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
                atletaNome={confirmDialog?.plano.atleta?.nome_perfil ?? confirmDialog?.plano.athlete_name ?? ""}
                mesDevido={formatMesAno(confirmDialog?.plano.proximo_mes_reservado ?? null)}
                valorPadrao={confirmDialog?.plano.valor_mensal ?? 0}
                isLoading={loadingId !== null}
            />
        </div>
    )
}
