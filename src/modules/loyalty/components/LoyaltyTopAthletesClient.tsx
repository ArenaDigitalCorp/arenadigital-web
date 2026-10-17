"use client"

import { formatPhone } from '@/lib/brasil-document'
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, Loader2, User, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

import { useLoyaltyPage } from "../lib/use-loyalty-page"
import type { AthleteBalance, PaginatedResult } from "../types/loyalty.types"

export function LoyaltyTopAthletesClient({ arenaId, userId, initialData }: { arenaId: string; userId: string; initialData: PaginatedResult<AthleteBalance> }) {
    const router = useRouter()
    const pageSize = 10
    const { query, setQuery, data, isLoading, error, blocked, retry } = useLoyaltyPage<AthleteBalance>({
        kind: 'ranking', arenaId, userId, page: 1, search: '',
    }, initialData)
    const { page, search } = query
    const setPage = (update: (page: number) => number) => setQuery(q => ({ ...q, page: update(q.page) }))
    const athletes = data?.data ?? []
    const totalPages = data?.totalPages || 1
    const totalResults = data?.total ?? 0

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
                    <ArrowLeft className="h-5 w-5 text-arena-navy-800" />
                </Button>
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-arena-navy-800">Top Atletas - Saldo total</h1>
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
                    className="pl-12 h-14 border-none shadow-sm bg-white rounded-2xl text-lg focus-visible:ring-arena-button"
                    value={search}
                    onChange={(e) => {
                        const value = e.target.value
                            setQuery(q => ({ ...q, search: value, page: 1 }))
                    }}
                />
            </div>

            {/* List */}
            <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-100" aria-busy={isLoading}>
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-arena-button" />
                                <p className="text-gray-400 font-medium">Carregando lista de atletas...</p>
                            </div>
                        ) : error ? (
                            <div className="py-12 text-center">
                                <p role="alert">{error}</p>
                                <Button variant="outline" className="mt-3" onClick={() => blocked ? window.location.reload() : retry()}>Tentar novamente</Button>
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
                                            <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center text-arena-navy-800 font-black text-sm">
                                                {athlete.name.charAt(0).toUpperCase()}
                                            </div>

                                            <div className="space-y-0.5">
                                                <p className="font-bold text-arena-navy-800 text-lg group-hover:text-arena-button transition-colors">
                                                    {athlete.name}
                                                </p>
                                                <p className="text-xs text-gray-400 font-bold uppercase tracking-tight">
                                                    {formatPhone(athlete.phone) || "Sem telefone"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Saldo total</p>
                                            <div className="flex items-center gap-1.5 justify-end">
                                                <span className="text-arena-button font-black text-xl">$ {athlete.balance.toFixed(2)}</span>
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
                        Mostrando <span className="text-arena-navy-800 font-bold">{athletes.length}</span> de <span className="text-arena-navy-800 font-bold">{totalResults}</span> atletas
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="h-10 border-none shadow-sm bg-white rounded-xl font-bold gap-1 active:scale-95 transition-all text-arena-navy-800"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                        </Button>
                        <div className="h-10 px-4 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-arena-navy-800 text-sm">
                            {page} / {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="h-10 border-none shadow-sm bg-white rounded-xl font-bold gap-1 active:scale-95 transition-all text-arena-navy-800"
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
