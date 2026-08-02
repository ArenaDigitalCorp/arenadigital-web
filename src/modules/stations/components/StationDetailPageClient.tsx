"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, Search, Plus, Eye, Filter, Calendar } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { OpenComandaModal } from "@/modules/stations/components/OpenComandaModal"
import { AthleteRegistrationModal } from "@/modules/athletes/components/AthleteRegistrationModal"
import { LaunchItemModal } from "@/modules/stations/components/LaunchItemModal"
import { getOrdersByStationAction } from "@/modules/stations/actions/stationActions"
import type { StationOrder, StationOrdersFilters } from "@/modules/stations/types/station.types"

interface Props {
    arenaId: string
    stationId: string
    initialStation: any
    initialOrders: any[]
    initialTotal: number
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const SEARCH_DEBOUNCE_MS = 400

export function StationDetailPageClient({ arenaId, stationId, initialStation, initialOrders, initialTotal }: Props) {
    const router = useRouter()
    const [orders, setOrders] = useState<StationOrder[]>(initialOrders as StationOrder[])
    const [total, setTotal] = useState(initialTotal)
    const [isLoading, setIsLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<"open" | "pending" | "closed" | "todos">("open")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [isOpenComandaModalOpen, setIsOpenComandaModalOpen] = useState(false)
    const [isLaunchItemModalOpen, setIsLaunchItemModalOpen] = useState(false)
    const [isRegisterCustomerModalOpen, setIsRegisterCustomerModalOpen] = useState(false)
    const [selectedOrderForLaunch, setSelectedOrderForLaunch] = useState<StationOrder | null>(null)

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim())
            setPage(1)
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(handle)
    }, [searchTerm])

    const filters = useMemo<StationOrdersFilters>(() => ({
        page,
        pageSize,
        status: statusFilter,
        search: debouncedSearch || undefined,
        dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
        dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
    }), [page, pageSize, statusFilter, debouncedSearch, dateFrom, dateTo])

    const fetchOrders = useCallback(async (currentFilters: StationOrdersFilters) => {
        setIsLoading(true)
        try {
            const res = await getOrdersByStationAction(arenaId, stationId, currentFilters)
            if (res.success) {
                setOrders(res.data as StationOrder[])
                setTotal(res.total)
            }
        } finally {
            setIsLoading(false)
        }
    }, [arenaId, stationId])

    const isFirstLoad = useRef(true)
    useEffect(() => {
        // a primeira página já vem do servidor com os filtros default
        if (isFirstLoad.current) {
            isFirstLoad.current = false
            return
        }
        fetchOrders(filters)
    }, [filters, fetchOrders])

    const refreshOrders = useCallback(async () => {
        await fetchOrders(filters)
    }, [fetchOrders, filters])

    const handleLaunchItem = (order: StationOrder) => {
        setSelectedOrderForLaunch(order)
        setIsLaunchItemModalOpen(true)
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-arena-navy-800/60 font-bold text-sm hover:text-arena-navy-800 transition-colors w-fit"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Voltar
                </button>
                <h1 className="text-4xl font-black text-arena-navy-800 tracking-tight">{initialStation?.name || "Estação"}</h1>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/20" />
                    <Input
                        placeholder="Buscar por cliente"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 bg-white border-arena-navy-800/10 rounded-xl"
                    />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center bg-white border border-arena-navy-800/10 rounded-xl px-3 h-11 gap-2">
                        <Calendar className="h-4 w-4 text-arena-navy-800/20" />
                        <span className="text-xs font-bold text-arena-navy-800/40 uppercase">De</span>
                        <input
                            type="date"
                            value={dateFrom}
                            max={dateTo || undefined}
                            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                            className="bg-transparent text-sm font-bold text-arena-navy-800/60 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-arena-navy-800/40 uppercase">Até</span>
                        <input
                            type="date"
                            value={dateTo}
                            min={dateFrom || undefined}
                            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                            className="bg-transparent text-sm font-bold text-arena-navy-800/60 focus:outline-none"
                        />
                    </div>
                    <div className="flex items-center bg-white border border-arena-navy-800/10 rounded-xl px-3 h-11">
                        <Filter className="h-4 w-4 text-arena-navy-800/20 mr-2" />
                        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1) }}>
                            <SelectTrigger className="border-none shadow-none focus:ring-0 h-full p-0 font-bold text-arena-navy-800/60">
                                <SelectValue placeholder="Todos os status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os status</SelectItem>
                                <SelectItem value="open">Abertas</SelectItem>
                                <SelectItem value="pending">Pendentes</SelectItem>
                                <SelectItem value="closed">Fechadas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        onClick={() => setIsOpenComandaModalOpen(true)}
                        className="bg-arena-navy-800 hover:bg-arena-navy-900 text-white font-bold h-11 px-6 rounded-xl"
                    >
                        Abrir comanda
                    </Button>
                </div>
            </div>

            <OpenComandaModal
                isOpen={isOpenComandaModalOpen}
                onClose={() => setIsOpenComandaModalOpen(false)}
                arenaId={arenaId}
                stationId={stationId}
                stationTypeId={initialStation?.station_type_id}
                onSuccess={refreshOrders}
                onRegisterNewCustomer={() => {
                    setIsOpenComandaModalOpen(false)
                    setIsRegisterCustomerModalOpen(true)
                }}
            />

            <LaunchItemModal
                isOpen={isLaunchItemModalOpen}
                onClose={() => { setIsLaunchItemModalOpen(false); setSelectedOrderForLaunch(null) }}
                arenaId={arenaId}
                stationId={stationId}
                stationTypeId={initialStation?.station_type_id}
                order={selectedOrderForLaunch}
                onSuccess={refreshOrders}
            />

            <AthleteRegistrationModal
                open={isRegisterCustomerModalOpen}
                onOpenChange={(open) => {
                    setIsRegisterCustomerModalOpen(open)
                    if (!open) setIsOpenComandaModalOpen(true)
                }}
                arenaId={arenaId}
                onSuccess={() => { setIsRegisterCustomerModalOpen(false); setIsOpenComandaModalOpen(true) }}
            />

            {orders.length === 0 ? (
                <div className={cn("py-20 flex flex-col items-center justify-center text-center", isLoading && "opacity-60")}>
                    <div className="bg-arena-navy-800/5 p-4 rounded-full mb-4">
                        <Plus className="h-8 w-8 text-arena-navy-800/20" />
                    </div>
                    <p className="text-arena-navy-800/40 font-medium text-lg">
                        {isLoading ? "Carregando comandas..." : "Nenhuma comanda encontrada."}
                    </p>
                </div>
            ) : (
                <div className={cn(
                    "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 transition-opacity",
                    isLoading && "opacity-60 pointer-events-none"
                )}>
                    {orders.map((order) => (
                        <Card
                            key={order.id}
                            onClick={() => router.push(`/dashboard/arenas/${arenaId}/stations/${stationId}/orders/${order.id}`)}
                            className={cn(
                                "border-none shadow-sm rounded-2xl overflow-hidden transition-all hover:scale-[1.02] cursor-pointer",
                                order.status === 'open' && "bg-gradient-to-br from-[#FFB01F] to-[#FFD043]",
                                order.status === 'pending' && "bg-gradient-to-br from-[#F9C846] to-[#FDE4A5] border border-amber-300",
                                order.status !== 'open' && order.status !== 'pending' && "bg-[#C4CCD0]"
                            )}
                        >
                            <CardContent className="p-4 relative min-h-[140px] flex flex-col justify-between">
                                <div className="absolute top-4 right-4 text-arena-navy-800/40">
                                    <Eye className="h-4 w-4" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-arena-navy-800/40 uppercase">
                                        Comanda nº #{order.order_number.toString().padStart(3, '0')}
                                    </span>
                                    {order.status === 'pending' && (
                                        <span className="ml-2 text-[9px] font-black text-amber-700 bg-white/60 px-1.5 py-0.5 rounded uppercase">
                                            Pendente
                                        </span>
                                    )}
                                    <div className="text-2xl font-black text-arena-navy-800 mt-1">
                                        R$ {order.total_value.toFixed(2).replace('.', ',')}
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <div className="text-[11px] font-bold text-arena-navy-800/80">
                                        Cliente: {order.atleta?.nome_perfil || order.customer_name || "N/A"}
                                    </div>
                                    <div className="text-[11px] font-bold text-arena-navy-800/40">
                                        Itens: {order.station_order_items?.length || 0}
                                    </div>
                                </div>
                                {(order.status === 'open' || order.status === 'pending') && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleLaunchItem(order) }}
                                        className="mt-2 text-[10px] font-black text-white bg-arena-navy-800/20 hover:bg-arena-navy-800/30 py-1.5 px-3 rounded-lg w-fit transition-colors"
                                    >
                                        Lançar item +
                                    </button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {total > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <p className="text-xs font-bold text-arena-navy-800/40">
                        Exibindo {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total} comanda{total !== 1 ? "s" : ""}
                    </p>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-white border border-arena-navy-800/10 rounded-xl px-3 h-9">
                            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                                <SelectTrigger className="border-none shadow-none focus:ring-0 h-full p-0 text-xs font-bold text-arena-navy-800/60">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAGE_SIZE_OPTIONS.map((size) => (
                                        <SelectItem key={size} value={String(size)}>{size} por página</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-xl border-arena-navy-800/10"
                                disabled={page === 1 || isLoading}
                                onClick={() => setPage(page - 1)}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs font-bold text-arena-navy-800/60 px-2">
                                {page} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-xl border-arena-navy-800/10"
                                disabled={page >= totalPages || isLoading}
                                onClick={() => setPage(page + 1)}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
