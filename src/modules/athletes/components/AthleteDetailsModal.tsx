"use client"

import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Phone, Mail, CreditCard, Calendar, Trophy, CalendarDays, Instagram, TrendingUp } from "lucide-react"
import { getAthleteDetailsAction, type AthleteDetailData } from "../actions/athleteDetailsActions"

interface AthleteDetailsModalProps {
    arenaId: string
    athleteId: string | null
    isOpen: boolean
    onClose: () => void
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "---"
    return new Date(dateStr).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })
}

function formatDateShort(dateStr: string | null): string {
    if (!dateStr) return "---"
    return new Date(dateStr).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    })
}

function TipoChip({ tipo }: { tipo: string }) {
    const map: Record<string, { label: string; color: string }> = {
        crédito: { label: "Crédito", color: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
        resgate: { label: "Resgate", color: "bg-orange-50 text-orange-700 border border-orange-200" },
        vencimento: { label: "Vencimento", color: "bg-red-50 text-red-700 border border-red-200" },
    }
    const style = map[tipo] ?? { label: tipo, color: "bg-gray-100 text-gray-600" }
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${style.color}`}>
            {style.label}
        </span>
    )
}

export function AthleteDetailsModal({ arenaId, athleteId, isOpen, onClose }: AthleteDetailsModalProps) {
    const [data, setData] = useState<AthleteDetailData | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!isOpen || !athleteId) return
        setData(null)
        setIsLoading(true)
        getAthleteDetailsAction(arenaId, athleteId).then((res) => {
            if (res.success) setData(res.data)
        }).finally(() => setIsLoading(false))
    }, [isOpen, athleteId, arenaId])

    const initials = data?.nome_perfil
        ? data.nome_perfil.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
        : "?"

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[680px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl max-h-[92vh] flex flex-col">
                {/* Header fixo */}
                <div className="bg-gradient-to-br from-arena-navy-800 to-[#003D5C] p-6 flex-shrink-0">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-white text-xl font-bold">Detalhes do Atleta</DialogTitle>
                    </DialogHeader>

                    {isLoading ? (
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-2xl bg-white/10 animate-pulse" />
                            <div className="space-y-2">
                                <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
                                <div className="h-3 w-28 bg-white/10 rounded animate-pulse" />
                            </div>
                        </div>
                    ) : data ? (
                        <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div className="relative">
                                {data.foto_url ? (
                                    <img
                                        src={data.foto_url}
                                        alt={data.nome_perfil}
                                        className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/20"
                                    />
                                ) : (
                                    <div className="h-16 w-16 rounded-2xl bg-arena-button flex items-center justify-center text-white font-black text-xl ring-2 ring-white/20">
                                        {initials}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h2 className="text-white font-bold text-xl leading-tight">{data.nome_perfil}</h2>
                                {data.membro_desde && (
                                    <p className="text-white/60 text-xs mt-1 flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Membro desde {formatDate(data.membro_desde)}
                                    </p>
                                )}
                                {data.instagram && (
                                    <p className="text-white/50 text-xs flex items-center gap-1 mt-0.5">
                                        <Instagram className="h-3 w-3" />
                                        @{data.instagram}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Corpo scrollável */}
                <div className="overflow-y-auto flex-1 bg-gray-50">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-arena-button" />
                            <p className="text-sm text-gray-400 font-medium">Carregando informações...</p>
                        </div>
                    ) : data ? (
                        <div className="p-6 space-y-6">

                            {/* Informações de contato */}
                            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
                                <h3 className="text-sm font-bold text-arena-navy-800/50 uppercase tracking-widest">Contato</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <InfoRow icon={<Mail className="h-4 w-4 text-arena-button" />} label="E-mail" value={data.email} />
                                    <InfoRow icon={<Phone className="h-4 w-4 text-arena-button" />} label="Telefone" value={data.telefone} />
                                    <InfoRow icon={<CreditCard className="h-4 w-4 text-arena-button" />} label="CPF" value={data.cpf} />
                                </div>
                            </div>

                            {/* Cards de métricas */}
                            <div className="grid grid-cols-3 gap-3">
                                <MetricCard
                                    icon={<Trophy className="h-5 w-5 text-arena-button" />}
                                    label="Saldo"
                                    value={`$ ${data.saldo.toFixed(2)}`}
                                    highlight
                                />
                                <MetricCard
                                    icon={<CalendarDays className="h-5 w-5 text-arena-navy-800" />}
                                    label="Reservas (mês)"
                                    value={String(data.reservas_este_mes)}
                                />
                                <MetricCard
                                    icon={<TrendingUp className="h-5 w-5 text-arena-navy-800" />}
                                    label="Total reservas"
                                    value={String(data.total_reservas)}
                                />
                            </div>

                            {/* Esportes */}
                            {data.esportes.length > 0 && (
                                <div className="bg-white rounded-2xl p-5 shadow-sm">
                                    <h3 className="text-sm font-bold text-arena-navy-800/50 uppercase tracking-widest mb-3">Esportes</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {data.esportes.map((e, i) => (
                                            <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                                                <span className="font-semibold text-arena-navy-800 text-sm">{e.nome}</span>
                                                {e.nivel && (
                                                    <span className="text-xs text-arena-button font-bold bg-arena-button/10 px-2 py-0.5 rounded-full">
                                                        {e.nivel}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Histórico de Fidelidade */}
                            <div className="bg-white rounded-2xl p-5 shadow-sm">
                                <h3 className="text-sm font-bold text-arena-navy-800/50 uppercase tracking-widest mb-4">
                                    Histórico de Fidelidade
                                </h3>
                                {data.historico_fidelidade.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-4">Nenhuma transação registrada.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {data.historico_fidelidade.map((h) => (
                                            <div
                                                key={h.id}
                                                className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <TipoChip tipo={h.tipo} />
                                                    <div>
                                                        <p className="text-sm font-medium text-arena-navy-800">
                                                            {h.descricao || "Sem descrição"}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            {formatDateShort(h.data_registro)}
                                                            {h.data_vencimento && (
                                                                <> · Vence {formatDateShort(h.data_vencimento)}</>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`font-bold text-sm ${h.tipo === "crédito" ? "text-emerald-600" : "text-red-500"}`}>
                                                    {h.tipo === "crédito" ? "+" : "-"}$ {h.valor.toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-16 text-gray-400 text-sm">
                            Não foi possível carregar os dados do atleta.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-arena-button/10 flex items-center justify-center flex-shrink-0">
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                <p className="text-sm font-semibold text-arena-navy-800">{value || "---"}</p>
            </div>
        </div>
    )
}

function MetricCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
    return (
        <div className={`rounded-2xl p-4 shadow-sm flex flex-col gap-2 ${highlight ? "bg-arena-button" : "bg-white"}`}>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${highlight ? "bg-white/20" : "bg-gray-50"}`}>
                {icon}
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${highlight ? "text-white/70" : "text-gray-400"}`}>
                {label}
            </p>
            <p className={`text-xl font-black ${highlight ? "text-white" : "text-arena-navy-800"}`}>
                {value}
            </p>
        </div>
    )
}
