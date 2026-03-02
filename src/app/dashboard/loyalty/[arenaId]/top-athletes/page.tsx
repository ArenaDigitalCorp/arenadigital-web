"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, Loader2, User, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { getAthletesWithBalanceAction } from "@/modules/loyalty/actions/loyaltyActions"
import { cn } from "@/lib/utils"

export default function TopAthletesPage({ params }: { params: { arenaId: string } }) {
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [athletes, setAthletes] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalResults, setTotalResults] = useState(0)
    const pageSize = 10

    const loadAthletes = useCallback(async () => {
        try {
            setIsLoading(true)
            const result = await getAthletesWithBalanceAction(params.arenaId, page, pageSize, search)
            if (result.success && 'data' in result) {
                setAthletes(result.data as any[])
                setTotalPages(result.totalPages as number || 1)
                setTotalResults(result.total as number || 0)
            } else if (!result.success) {
                console.error("Failed to load athletes:", (result as any).error)
            }
        } catch (error) {
            console.error("Error loading athletes:", error)
        } finally {
            setIsLoading(false)
        }
    }, [page, search])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadAthletes()
        }, 500)
        return () => clearTimeout(timer)
    }, [loadAthletes])

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="h-10 w-10 rounded-full hover:bg-gray-100"
                >
                    <ArrowLeft className="h-5 w-5 text-[#002B40]" />
                </Button>
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-[#002B40]">Top Atletas - Saldo total</h1>
                    <p className="text-sm text-muted-foreground font-medium">
                        Visualize todos os atletas com moedas acumuladas.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                    placeholder="Buscar atleta por nome..."
                    className="pl-12 h-14 border-none shadow-sm bg-white rounded-2xl text-lg focus-visible:ring-[#FF6B00]"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value)
                        setPage(1)
                    }}
                />
            </div>

            {/* List */}
            <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                        {isLoading && athletes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-[#FF6B00]" />
                                <p className="text-gray-400 font-medium">Carregando lista de atletas...</p>
                            </div>
                        ) : athletes.length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground">
                                <User className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p className="font-medium">Nenhum atleta encontrado com saldo.</p>
                            </div>
                        ) : (
                            athletes.map((athlete, index) => {
                                const rank = (page - 1) * pageSize + index + 1
                                return (
                                    <div
                                        key={athlete.id_atleta}
                                        className="flex items-center justify-between px-8 py-5 hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-6">
                                            {/* Rank */}
                                            <div className="w-8 flex justify-center">
                                                {rank === 1 && <span className="text-2xl">🥇</span>}
                                                {rank === 2 && <span className="text-2xl">🥈</span>}
                                                {rank === 3 && <span className="text-2xl">🥉</span>}
                                                {rank > 3 && <span className="text-gray-300 font-black text-lg">#{rank}</span>}
                                            </div>

                                            {/* Avatar placeholder */}
                                            <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center text-[#002B40] font-black text-sm">
                                                {athlete.name.charAt(0).toUpperCase()}
                                            </div>

                                            <div className="space-y-0.5">
                                                <p className="font-bold text-[#002B40] text-lg group-hover:text-[#FF6B00] transition-colors">
                                                    {athlete.name}
                                                </p>
                                                <p className="text-xs text-gray-400 font-bold uppercase tracking-tight">
                                                    {athlete.phone || "Sem telefone"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Saldo total</p>
                                            <div className="flex items-center gap-1.5 justify-end">
                                                <span className="text-[#FF6B00] font-black text-xl">$ {athlete.balance.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <p className="text-sm text-gray-400 font-medium">
                        Mostrando <span className="text-[#002B40] font-bold">{athletes.length}</span> de <span className="text-[#002B40] font-bold">{totalResults}</span> atletas
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="h-10 border-none shadow-sm bg-white rounded-xl font-bold gap-1 active:scale-95 transition-all text-[#002B40]"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                        </Button>
                        <div className="h-10 px-4 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-[#002B40] text-sm">
                            {page} / {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="h-10 border-none shadow-sm bg-white rounded-xl font-bold gap-1 active:scale-95 transition-all text-[#002B40]"
                        >
                            Próximo
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
