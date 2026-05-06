"use client"

import { Plus, History, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import React, { useState, useCallback } from "react"
import {
    updateCurrencyName,
    getLatestCreditsAction,
    getLatestRedemptionsAction,
} from "@/modules/loyalty/actions/loyaltyActions"
import { toast } from "sonner"
import type { LoyaltyTransaction as FidelityTransaction } from "@/modules/loyalty/types/loyalty.types"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { NewSendModal } from "@/modules/loyalty/components/NewSendModal"
import { NewRedemptionModal } from "@/modules/loyalty/components/NewRedemptionModal"
import Link from "next/link"

interface Props {
    arenaId: string
    initialCurrencyName: string
    initialCredits: FidelityTransaction[]
    initialRedemptions: FidelityTransaction[]
    initialTopAthletes: { name: string; balance: number }[]
}

export function LoyaltyDashboardClient({ arenaId, initialCurrencyName, initialCredits, initialRedemptions, initialTopAthletes }: Props) {
    const [currencyName, setCurrencyName] = useState(initialCurrencyName)
    const [isSaving, setIsSaving] = useState(false)
    const [recentCredits, setRecentCredits] = useState<FidelityTransaction[]>(initialCredits)
    const [isLoadingCredits, setIsLoadingCredits] = useState(false)
    const [recentRedemptions, setRecentRedemptions] = useState<FidelityTransaction[]>(initialRedemptions)
    const [isLoadingRedemptions, setIsLoadingRedemptions] = useState(false)
    const [topAthletes] = useState(initialTopAthletes)

    const [isNewSendOpen, setIsNewSendOpen] = useState(false)
    const [isNewRedemptionOpen, setIsNewRedemptionOpen] = useState(false)

    const loadRecentCredits = useCallback(async () => {
        try {
            setIsLoadingCredits(true)
            const result = await getLatestCreditsAction(arenaId)
            if (result.success && result.data) {
                setRecentCredits(result.data as FidelityTransaction[])
            }
        } catch (error) {
            console.error("Error loading credits:", error)
        } finally {
            setIsLoadingCredits(false)
        }
    }, [arenaId])

    const loadRecentRedemptions = useCallback(async () => {
        try {
            setIsLoadingRedemptions(true)
            const result = await getLatestRedemptionsAction(arenaId)
            if (result.success && result.data) {
                setRecentRedemptions(result.data as FidelityTransaction[])
            }
        } catch (error) {
            console.error("Error loading redemptions:", error)
        } finally {
            setIsLoadingRedemptions(false)
        }
    }, [arenaId])

    const handleSave = async () => {
        if (!currencyName.trim()) {
            toast.error("Informe um nome para a moeda")
            return
        }
        try {
            setIsSaving(true)
            const result = await updateCurrencyName(arenaId, currencyName)
            if (result.success) {
                toast.success("Nome da moeda atualizado com sucesso!")
            } else {
                toast.error(result.error || "Erro ao atualizar")
            }
        } catch {
            toast.error("Erro inesperado ao salvar")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-arena-navy-800">Programa de Fidelidade</h1>
                    <p className="text-muted-foreground">
                        Faça a gestão da sua moeda de fidelidade.
                    </p>
                </div>
                <Link href={`/dashboard/loyalty/${arenaId}/statement`}>
                    <Button
                        variant="outline"
                        className="border-arena-button text-arena-button hover:bg-arena-button hover:text-white gap-2 px-6 py-6 h-auto text-base rounded-lg font-semibold transition-all"
                    >
                        Ver extrato
                        <History className="h-5 w-5" />
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Últimos Envios */}
                <Card className="border-none shadow-sm overflow-hidden text-balance">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <CardTitle className="text-xl font-bold text-arena-navy-800">Últimos envios</CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsNewSendOpen(true)}
                            className="gap-1 border-arena-navy-800/10 text-arena-navy-800 hover:bg-arena-navy-800 hover:text-white"
                        >
                            <Plus className="h-4 w-4" />
                            Novo envio
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoadingCredits ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-arena-button" />
                            </div>
                        ) : recentCredits.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                                Nenhum envio recente encontrado.
                            </div>
                        ) : (
                            recentCredits.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between p-4 bg-[#FFF5EF] rounded-xl border border-[#FFE4D3]/50">
                                    <div className="space-y-1 text-left">
                                        <p className="font-semibold text-arena-navy-800">
                                            Cliente: {tx.atleta?.nome_perfil || "Desconhecido"}
                                        </p>
                                        {tx.descricao && (
                                            <p className="text-sm text-arena-navy-800/70 font-medium">{tx.descricao}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground font-medium">
                                            {format(new Date(tx.data_registro), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </p>
                                    </div>
                                    <span className="font-bold text-arena-button text-lg">
                                        + $ {Number(tx.valor).toFixed(2)}
                                    </span>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Últimos Resgates */}
                <Card className="border-none shadow-sm overflow-hidden text-balance">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <CardTitle className="text-xl font-bold text-arena-navy-800">Últimos resgates</CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsNewRedemptionOpen(true)}
                            className="gap-1 border-arena-navy-800/10 text-arena-navy-800 hover:bg-arena-navy-800 hover:text-white"
                        >
                            <Plus className="h-4 w-4" />
                            Novo resgate
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoadingRedemptions ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-arena-button" />
                            </div>
                        ) : recentRedemptions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                                Nenhum resgate recente encontrado.
                            </div>
                        ) : (
                            recentRedemptions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between p-4 bg-[#FFF5EF] rounded-xl border border-[#FFE4D3]/50">
                                    <div className="space-y-1 text-left">
                                        <p className="font-semibold text-arena-navy-800">
                                            Cliente: {tx.atleta?.nome_perfil || "Desconhecido"}
                                        </p>
                                        {tx.descricao && (
                                            <p className="text-sm text-arena-navy-800/70 font-medium">{tx.descricao}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground font-medium">
                                            {format(new Date(tx.data_registro), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </p>
                                    </div>
                                    <span className={`font-bold text-lg ${tx.tipo === 'vencimento' ? 'text-gray-500' : 'text-red-500'}`}>
                                        - $ {Number(tx.valor).toFixed(2)}
                                    </span>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Top Atletas */}
                <Card className="border-none shadow-sm overflow-hidden text-balance">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-bold text-arena-navy-800">Top atletas com mais moedas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-0 p-0">
                        {topAthletes.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nenhum atleta com saldo no momento.
                            </div>
                        ) : (
                            topAthletes.map((athlete, index) => {
                                const position = index + 1;
                                return (
                                    <div key={index} className="flex items-center justify-between px-6 py-4 border-b border-arena-navy-800/5 last:border-0 hover:bg-arena-app-surface transition-colors">
                                        <div className="flex items-center gap-3">
                                            {position === 1 && <span className="text-xl">🥇</span>}
                                            {position === 2 && <span className="text-xl">🥈</span>}
                                            {position === 3 && <span className="text-xl">🥉</span>}
                                            {position > 3 && <span className="w-6 text-center text-muted-foreground font-bold">{position}</span>}
                                            <p className="font-medium text-arena-navy-800">{athlete.name}</p>
                                        </div>
                                        <span className="font-bold text-arena-button">$ {athlete.balance.toFixed(2)}</span>
                                    </div>
                                );
                            })
                        )}
                        <div className="p-4 text-center">
                            <Link href={`/dashboard/loyalty/${arenaId}/top-athletes`}>
                                <Button variant="link" className="text-arena-button font-semibold hover:no-underline">
                                    Ver tudo
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Configurações da Moeda */}
                <Card className="border-none shadow-sm overflow-hidden flex flex-col text-balance text-left items-stretch">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-bold text-arena-navy-800">Configurações da moeda</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Configure o nome e a validade da sua moeda e personalize do seu jeito.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-arena-navy-800/70 flex items-center justify-start">Nome</label>
                            <Input
                                placeholder="Informe o nome da sua moeda"
                                value={currencyName}
                                onChange={(e) => setCurrencyName(e.target.value)}
                                disabled={isSaving}
                                className="h-12 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-lg"
                            />
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full bg-arena-button hover:bg-arena-button-hover text-white h-14 text-lg font-bold rounded-xl shadow-lg shadow-arena-button/20 transition-all active:scale-95 gap-2"
                        >
                            {isSaving ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Save className="h-5 w-5" />
                            )}
                            Salvar
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <NewSendModal
                arenaId={arenaId}
                isOpen={isNewSendOpen}
                onClose={() => setIsNewSendOpen(false)}
                onSuccess={loadRecentCredits}
            />
            <NewRedemptionModal
                arenaId={arenaId}
                isOpen={isNewRedemptionOpen}
                onClose={() => setIsNewRedemptionOpen(false)}
                onSuccess={loadRecentRedemptions}
            />
        </div>
    )
}
