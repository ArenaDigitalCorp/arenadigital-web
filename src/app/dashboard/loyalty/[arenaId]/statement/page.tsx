"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, Loader2, Calendar, ChevronLeft, ChevronRight, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getStatementAction } from "@/modules/loyalty/actions/loyaltyActions"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

export default function FidelityStatementPage({ params }: { params: Promise<{ arenaId: string }> }) {
    const unwrappedParams = use(params)
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [transactions, setTransactions] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalResults, setTotalResults] = useState(0)
    const pageSize = 15

    const loadStatement = useCallback(async () => {
        try {
            setIsLoading(true)
            const result = await getStatementAction(unwrappedParams.arenaId, page, pageSize, {
                athleteName: search,
                startDate: startDate ? new Date(startDate + 'T00:00:00').toISOString() : undefined,
                endDate: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined
            })
            if (result.success && 'data' in result) {
                setTransactions(result.data as any[])
                setTotalPages(result.totalPages as number || 1)
                setTotalResults(result.total as number || 0)
            } else if (!result.success) {
                console.error("Failed to load statement:", (result as any).error)
            }
        } catch (error) {
            console.error("Error loading statement:", error)
        } finally {
            setIsLoading(false)
        }
    }, [page, search, startDate, endDate])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadStatement()
        }, 500)
        return () => clearTimeout(timer)
    }, [loadStatement])

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
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
                        <h1 className="text-2xl font-black text-[#002B40]">Extrato de Fidelidade</h1>
                        <p className="text-sm text-muted-foreground font-medium">
                            Histórico completo de movimentações da arena.
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                        placeholder="Buscar atleta pelo nome..."
                        className="pl-12 h-14 border-none shadow-sm bg-white rounded-2xl focus-visible:ring-[#FF6B00]"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setPage(1)
                        }}
                    />
                </div>
                <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
                    <Input
                        type="date"
                        className="pl-12 h-14 border-none shadow-sm bg-white rounded-2xl focus-visible:ring-[#FF6B00] block w-full"
                        value={startDate}
                        onChange={(e) => {
                            setStartDate(e.target.value)
                            setPage(1)
                        }}
                    />
                </div>
                <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
                    <Input
                        type="date"
                        className="pl-12 h-14 border-none shadow-sm bg-white rounded-2xl focus-visible:ring-[#FF6B00] block w-full"
                        value={endDate}
                        onChange={(e) => {
                            setEndDate(e.target.value)
                            setPage(1)
                        }}
                    />
                </div>
            </div>

            {/* List */}
            <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest whitespace-nowrap">Data</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest whitespace-nowrap">Tipo</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest whitespace-nowrap">Atleta</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest whitespace-nowrap">Valor</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest whitespace-nowrap">Validade</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest whitespace-nowrap">Criado por</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest whitespace-nowrap">Descrição</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isLoading && transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-20 text-center">
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <Loader2 className="h-10 w-10 animate-spin text-[#FF6B00]" />
                                                <p className="text-gray-400 font-medium">Carregando extrato...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-20 text-center text-muted-foreground">
                                            <Filter className="h-12 w-12 mx-auto mb-4 opacity-10" />
                                            <p className="font-medium">Nenhuma transação encontrada.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-gray-50/50 transition-all group">
                                            <td className="px-8 py-5 whitespace-nowrap">
                                                <p className="text-sm font-bold text-[#002B40]">
                                                    {format(new Date(tx.data_registro), "dd/MM/yyyy", { locale: ptBR })}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-bold">
                                                    {format(new Date(tx.data_registro), "HH:mm")}
                                                </p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <Badge className={cn(
                                                    "border-none text-[10px] font-black uppercase tracking-tight px-3 py-1",
                                                    tx.tipo === 'crédito' ? "bg-emerald-50 text-emerald-600" :
                                                        tx.tipo === 'resgate' ? "bg-rose-50 text-rose-600" : "bg-gray-100 text-gray-500"
                                                )}>
                                                    {tx.tipo}
                                                </Badge>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-[#002B40] font-black text-[10px]">
                                                        {tx.atleta?.nome_perfil?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <p className="font-bold text-[#002B40] text-sm truncate max-w-[150px]">
                                                        {tx.atleta?.nome_perfil}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={cn(
                                                    "font-black text-sm",
                                                    tx.tipo === 'crédito' ? "text-emerald-500" : "text-rose-500"
                                                )}>
                                                    {tx.tipo === 'crédito' ? '+' : '-'} $ {Number(tx.valor).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 whitespace-nowrap">
                                                {tx.data_vencimento ? (
                                                    <p className="text-sm font-medium text-gray-500">
                                                        {format(new Date(tx.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                                                    </p>
                                                ) : (
                                                    <span className="text-xs text-gray-300 font-medium">-</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5 whitespace-nowrap">
                                                <p className="text-sm font-medium text-gray-600">
                                                    {tx.criador?.name || "Sistema"}
                                                </p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-sm text-gray-500 font-medium truncate max-w-[200px]" title={tx.descricao}>
                                                    {tx.descricao || "Sem observação"}
                                                </p>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <p className="text-sm text-gray-400 font-medium">
                        Mostrando <span className="text-[#002B40] font-bold">{transactions.length}</span> de <span className="text-[#002B40] font-bold">{totalResults}</span> movimentações
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
