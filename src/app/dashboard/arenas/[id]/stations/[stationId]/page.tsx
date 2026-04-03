"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    ChevronLeft,
    Search,
    Plus,
    Eye,
    Filter,
    ChevronDown
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StationService } from "@/modules/stations/services/stationService";
import { OrderService, StationOrder } from "@/modules/stations/services/orderService";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { OpenComandaModal } from "@/modules/stations/components/OpenComandaModal";
import { RegisterCustomerModal } from "@/modules/stations/components/RegisterCustomerModal";
import { LaunchItemModal } from "@/modules/stations/components/LaunchItemModal";

export default function StationInternalPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const stationId = params.stationId as string;

    const [station, setStation] = useState<any>(null);
    const [orders, setOrders] = useState<StationOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("todos");

    const [isOpenComandaModalOpen, setIsOpenComandaModalOpen] = useState(false);
    const [isLaunchItemModalOpen, setIsLaunchItemModalOpen] = useState(false);
    const [isRegisterCustomerModalOpen, setIsRegisterCustomerModalOpen] = useState(false);
    const [selectedOrderForLaunch, setSelectedOrderForLaunch] = useState<StationOrder | null>(null);

    const loadData = async () => {
        if (stationId) {
            setIsLoading(true);
            try {
                const [stationData, ordersData] = await Promise.all([
                    StationService.getStationById(stationId),
                    OrderService.getOrdersByStation(stationId)
                ]);
                setStation(stationData);
                setOrders(ordersData);
            } catch (error) {
                console.error("Error loading station data:", error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        loadData();
    }, [stationId]);

    const handleLaunchItem = (order: StationOrder) => {
        setSelectedOrderForLaunch(order);
        setIsLaunchItemModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full" />)}
                </div>
            </div>
        );
    }

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.atleta?.nome_perfil?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.order_number.toString().includes(searchTerm);

        const matchesStatus = statusFilter === "todos" || order.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            {/* Back Button and Title */}
            <div className="flex flex-col gap-4">
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-[#002B40]/60 font-bold text-sm hover:text-[#002B40] transition-colors w-fit"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Voltar
                </button>
                <h1 className="text-4xl font-black text-[#002B40] tracking-tight">
                    {station?.name || "Estação"}
                </h1>
            </div>


            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#002B40]/20" />
                    <Input
                        placeholder="Buscar por cliente"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 bg-white border-[#002B40]/10 rounded-xl"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white border border-[#002B40]/10 rounded-xl px-3 h-11">
                        <Filter className="h-4 w-4 text-[#002B40]/20 mr-2" />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="border-none shadow-none focus:ring-0 h-full p-0 font-bold text-[#002B40]/60">
                                <SelectValue placeholder="Todos os status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os status</SelectItem>
                                <SelectItem value="open">Abertas</SelectItem>
                                <SelectItem value="closed">Fechadas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        onClick={() => setIsOpenComandaModalOpen(true)}
                        className="bg-[#002B40] hover:bg-[#001D2B] text-white font-bold h-11 px-6 rounded-xl"
                    >
                        Abrir comanda
                    </Button>
                </div>
            </div>

            {/* Modals */}
            <OpenComandaModal
                isOpen={isOpenComandaModalOpen}
                onClose={() => setIsOpenComandaModalOpen(false)}
                arenaId={id}
                stationId={stationId}
                stationTypeId={station?.station_type_id}
                onSuccess={loadData}
                onRegisterNewCustomer={() => {
                    setIsOpenComandaModalOpen(false);
                    setIsRegisterCustomerModalOpen(true);
                }}
            />

            <LaunchItemModal
                isOpen={isLaunchItemModalOpen}
                onClose={() => {
                    setIsLaunchItemModalOpen(false);
                    setSelectedOrderForLaunch(null);
                }}
                arenaId={id}
                stationTypeId={station?.station_type_id}
                order={selectedOrderForLaunch}
                onSuccess={loadData}
            />

            <RegisterCustomerModal
                isOpen={isRegisterCustomerModalOpen}
                onClose={() => setIsRegisterCustomerModalOpen(false)}
                arenaId={id}
                onSuccess={(newCustomer) => {
                    setIsRegisterCustomerModalOpen(false);
                    setIsOpenComandaModalOpen(true);
                }}
            />

            {/* Orders Grid */}
            {filteredOrders.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="bg-[#002B40]/5 p-4 rounded-full mb-4">
                        <Plus className="h-8 w-8 text-[#002B40]/20" />
                    </div>
                    <p className="text-[#002B40]/40 font-medium text-lg">Nenhuma comanda encontrada.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                    {filteredOrders.map((order) => (
                        <Card
                            key={order.id}
                            onClick={() => router.push(`/dashboard/arenas/${id}/stations/${stationId}/orders/${order.id}`)}
                            className={cn(
                                "border-none shadow-sm rounded-2xl overflow-hidden transition-all hover:scale-[1.02] cursor-pointer",
                                order.status === 'open' ? "bg-gradient-to-br from-[#FFB01F] to-[#FFD043]" : "bg-[#C4CCD0]"
                            )}
                        >
                            <CardContent className="p-4 relative min-h-[140px] flex flex-col justify-between">
                                <div className="absolute top-4 right-4 text-[#002B40]/40">
                                    <Eye className="h-4 w-4" />
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-[#002B40]/40 uppercase">
                                        Comanda nº #{order.order_number.toString().padStart(3, '0')}
                                    </span>
                                    <div className="text-2xl font-black text-[#002B40] mt-1">
                                        R$ {order.total_value.toFixed(2).replace('.', ',')}
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <div className="text-[11px] font-bold text-[#002B40]/80">
                                        Cliente: {order.atleta?.nome_perfil || order.customer_name || "N/A"}
                                    </div>
                                    <div className="text-[11px] font-bold text-[#002B40]/40">
                                        Itens: {order.station_order_items?.length || 0}
                                    </div>
                                </div>

                                {order.status === 'open' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleLaunchItem(order);
                                        }}
                                        className="mt-2 text-[10px] font-black text-white bg-[#002B40]/20 hover:bg-[#002B40]/30 py-1.5 px-3 rounded-lg w-fit transition-colors"
                                    >
                                        Lançar item +
                                    </button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
