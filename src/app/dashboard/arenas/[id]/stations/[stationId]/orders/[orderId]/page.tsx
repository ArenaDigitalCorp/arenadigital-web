"use client"

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StationOrder } from "@/modules/stations/types/station.types";
import { getOrderByIdAction, updateOrderAction } from "@/modules/stations/actions/orderActions";
import { restoreStockForOrderAction } from "@/modules/products/actions/stockActions";
import { Skeleton } from "@/components/ui/skeleton";
import { LaunchItemModal } from "@/modules/stations/components/LaunchItemModal";
import { RegisterPaymentModal } from "@/modules/stations/components/RegisterPaymentModal";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

export default function OrderDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const arenaId = params.id as string;
    const stationId = params.stationId as string;
    const orderId = params.orderId as string;

    const [order, setOrder] = useState<StationOrder | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    const loadOrderData = async () => {
        setIsLoading(true);
        try {
            const res = await getOrderByIdAction(arenaId, orderId);
            setOrder(res.data as StationOrder | null);
        } catch (error) {
            console.error("Error loading order details:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (orderId) loadOrderData();
    }, [orderId]);

    const handleCancelOrder = async () => {
        if (!order) return;
        if (!window.confirm("Tem certeza que deseja cancelar esta comanda? Essa ação não pode ser desfeita e os itens retornarão ao estoque.")) return;

        setIsCancelling(true);
        try {
            await updateOrderAction(arenaId, order.id, { status: 'cancelled' });
            await restoreStockForOrderAction(order.id, arenaId);
            toast.success("Comanda cancelada com sucesso!");
            loadOrderData();
        } catch (error) {
            console.error("Error cancelling order:", error);
            toast.error("Erro ao cancelar comanda.");
        } finally {
            setIsCancelling(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto p-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <p className="text-[#002B40]/40 font-medium text-lg">Comanda não encontrada.</p>
                <Button variant="ghost" onClick={() => router.back()} className="mt-4">
                    Voltar
                </Button>
            </div>
        );
    }

    const totalPaid = order.station_payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
    const balance = order.total_value - totalPaid;

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-[#002B40]/60 font-bold text-sm hover:text-[#002B40] transition-colors w-fit"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Voltar
                </button>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-black text-[#002B40] tracking-tight">
                                Comanda nº #{order.order_number.toString().padStart(3, '0')}
                            </h1>
                            {order.status === 'closed' && (
                                <span className="bg-[#E6F8F7] text-[#20B2AA] px-3 py-1 rounded-full text-xs font-black uppercase">
                                    Fechada
                                </span>
                            )}
                            {order.status === 'cancelled' && (
                                <span className="bg-red-50 text-red-500 px-3 py-1 rounded-full text-xs font-black uppercase border border-red-200">
                                    Cancelada
                                </span>
                            )}
                        </div>
                        <p className="text-[#002B40]/60 font-medium">
                            Cliente: {order.atleta?.nome_perfil || order.station_customer?.name || order.customer_name || "N/A"}
                        </p>
                    </div>
                    <div className={cn(
                        "p-4 rounded-xl flex items-center gap-4 shadow-lg",
                        balance > 0
                            ? "bg-gradient-to-r from-[#FFB01F] to-[#FFD043] shadow-orange-200/50"
                            : "bg-[#E6F8F7] shadow-[#20B2AA]/10"
                    )}>
                        <span className="text-[#002B40]/60 font-bold uppercase text-xs">Saldo:</span>
                        <span className="text-2xl font-black text-[#002B40]">
                            R$ {balance.toFixed(2).replace('.', ',')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Items Table Section */}
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-black text-[#002B40]">Itens pedidos</h2>
                        {order.status === 'open' && (
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={handleCancelOrder}
                                    variant="outline"
                                    disabled={isCancelling}
                                    className="text-red-500 border-red-100 hover:bg-red-50 hover:text-red-600 rounded-xl"
                                >
                                    {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar comanda"}
                                </Button>
                                <Button
                                    onClick={() => setIsLaunchModalOpen(true)}
                                    className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold rounded-xl"
                                >
                                    Lançar item
                                </Button>
                                <Button
                                    onClick={() => setIsPaymentModalOpen(true)}
                                    className="bg-[#002B40] hover:bg-[#001D2B] text-white font-bold rounded-xl"
                                >
                                    Registrar pagamento
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b border-[#002B40]/5">
                                <tr>
                                    <th className="py-4 text-xs font-bold text-[#002B40]/40 uppercase">Horário do lançamento</th>
                                    <th className="py-4 text-xs font-bold text-[#002B40]/40 uppercase">Descrição</th>
                                    <th className="py-4 text-xs font-bold text-[#002B40]/40 uppercase">Quantidade</th>
                                    <th className="py-4 text-xs font-bold text-[#002B40]/40 uppercase text-right">Valor unitário</th>
                                    <th className="py-4 text-xs font-bold text-[#002B40]/40 uppercase text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#002B40]/5">
                                {order.station_order_items?.map((item) => (
                                    <tr key={item.id} className="group">
                                        <td className="py-4 text-sm font-medium text-[#002B40]/60">
                                            {format(new Date(item.created_at), "HH:mm:ss")}
                                        </td>
                                        <td className="py-4 text-sm font-bold text-[#002B40]">
                                            {item.product?.name}
                                        </td>
                                        <td className="py-4 text-sm font-medium text-[#002B40]/60">
                                            {item.quantity}
                                        </td>
                                        <td className="py-4 text-sm font-medium text-[#002B40]/60 text-right">
                                            R$ {item.unit_price.toFixed(2).replace('.', ',')}
                                        </td>
                                        <td className="py-4 text-sm font-bold text-[#002B40] text-right">
                                            R$ {item.total_price.toFixed(2).replace('.', ',')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={4} className="pt-8 text-right font-bold text-[#002B40]/60">Total:</td>
                                    <td className="pt-8 text-right">
                                        <span className="bg-[#FFF5EF] text-[#FF6B00] px-4 py-2 rounded-lg font-black text-sm">
                                            R$ {order.total_value.toFixed(2).replace('.', ',')}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Payments Table Section */}
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-8">
                    <h2 className="text-xl font-black text-[#002B40] mb-8">Pagamentos</h2>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b border-[#002B40]/5">
                                <tr>
                                    <th className="py-4 text-xs font-bold text-[#002B40]/40 uppercase">Horário do pagamento</th>
                                    <th className="py-4 text-xs font-bold text-[#002B40]/40 uppercase">Forma de pagamento</th>
                                    <th className="py-4 text-xs font-bold text-[#002B40]/40 uppercase">Observação</th>
                                    <th className="py-4 text-xs font-bold text-[#002B40]/40 uppercase">Pago por</th>
                                    <th className="py-4 text-xs font-bold text-[#002B40]/40 uppercase text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#002B40]/5">
                                {order.station_payments && order.station_payments.length > 0 ? (
                                    order.station_payments.map((payment) => (
                                        <tr key={payment.id}>
                                            <td className="py-4 text-sm font-medium text-[#002B40]/60">
                                                {format(new Date(payment.created_at), "HH:mm:ss")}
                                            </td>
                                            <td className="py-4 text-sm font-bold text-[#002B40]">
                                                {payment.payment_method}
                                            </td>
                                            <td className="py-4 text-sm font-medium text-[#002B40]/60">
                                                {payment.observation || "--"}
                                            </td>
                                            <td className="py-4 text-sm font-medium text-[#002B40]/60">
                                                {payment.paid_by_name || "--"}
                                            </td>
                                            <td className="py-4 text-sm font-bold text-[#002B40] text-right">
                                                R$ {payment.amount.toFixed(2).replace('.', ',')}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-[#002B40]/20 font-medium">
                                            Nenhum pagamento registrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={4} className="pt-8 text-right font-bold text-[#002B40]/60">Total pago:</td>
                                    <td className="pt-8 text-right">
                                        <span className="bg-[#E6F8F7] text-[#20B2AA] px-4 py-2 rounded-lg font-black text-sm">
                                            R$ {totalPaid.toFixed(2).replace('.', ',')}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <LaunchItemModal
                isOpen={isLaunchModalOpen}
                onClose={() => setIsLaunchModalOpen(false)}
                arenaId={arenaId}
                order={order}
                onSuccess={loadOrderData}
            />

            <RegisterPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                order={order}
                onSuccess={loadOrderData}
            />
        </div>
    );
}
