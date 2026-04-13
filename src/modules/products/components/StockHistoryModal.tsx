"use client"

import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowUpCircle, ArrowDownCircle, History, Package } from "lucide-react"
import { getStockMovementsByProductAction } from "@/modules/products/actions/stockActions"
import type { StockMovement, Product } from "@/modules/products/types/product.types"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface StockHistoryModalProps {
    product: Product
    open: boolean
    onOpenChange: (open: boolean) => void
}

const referenceTypeLabels: Record<string, string> = {
    stock_entry: "Entrada manual",
    order_item: "Saída por comanda",
    cancellation: "Estorno (cancelamento)",
}

export function StockHistoryModal({
    product,
    open,
    onOpenChange,
}: StockHistoryModalProps) {
    const [movements, setMovements] = useState<StockMovement[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (open && product) {
            loadMovements()
        }
    }, [open, product])

    const loadMovements = async () => {
        setIsLoading(true)
        try {
            const res = await getStockMovementsByProductAction(product.id)
            setMovements(res.data as StockMovement[])
        } catch (error) {
            console.error("Error loading movements:", error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl max-h-[85vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#002B40] to-[#003d5c] p-6 text-white">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                                <History className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black text-white">
                                    Movimentações de Estoque
                                </DialogTitle>
                                <DialogDescription className="text-white/60 mt-1">
                                    {product.name} — Saldo atual:{" "}
                                    <span className={cn(
                                        "font-bold",
                                        product.stock_quantity > 0 ? "text-emerald-300" : "text-red-300"
                                    )}>
                                        {product.stock_quantity} un.
                                    </span>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[55vh] custom-scrollbar">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-[#FF6B00]" />
                        </div>
                    ) : movements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="p-4 bg-[#002B40]/5 rounded-full mb-4">
                                <Package className="h-8 w-8 text-[#002B40]/20" />
                            </div>
                            <p className="text-[#002B40]/40 font-medium">
                                Nenhuma movimentação registrada.
                            </p>
                            <p className="text-[#002B40]/25 text-sm mt-1">
                                Faça o primeiro lançamento de entrada.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {movements.map((movement) => (
                                <div
                                    key={movement.id}
                                    className={cn(
                                        "flex items-start gap-4 p-4 rounded-xl border transition-all",
                                        movement.type === 'entrada'
                                            ? "bg-emerald-50/50 border-emerald-100 hover:border-emerald-200"
                                            : "bg-red-50/50 border-red-100 hover:border-red-200"
                                    )}
                                >
                                    {/* Icon */}
                                    <div className={cn(
                                        "p-2 rounded-lg shrink-0 mt-0.5",
                                        movement.type === 'entrada'
                                            ? "bg-emerald-100 text-emerald-600"
                                            : "bg-red-100 text-red-600"
                                    )}>
                                        {movement.type === 'entrada' ? (
                                            <ArrowUpCircle className="h-4 w-4" />
                                        ) : (
                                            <ArrowDownCircle className="h-4 w-4" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[10px] font-black uppercase tracking-wider border-0 px-2",
                                                    movement.type === 'entrada'
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-red-100 text-red-700"
                                                )}
                                            >
                                                {movement.type === 'entrada' ? 'Entrada' : 'Saída'}
                                            </Badge>
                                            {movement.reference_type && (
                                                <span className="text-[10px] text-[#002B40]/30 font-medium">
                                                    {referenceTypeLabels[movement.reference_type] || movement.reference_type}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className={cn(
                                                    "text-lg font-black",
                                                    movement.type === 'entrada' ? "text-emerald-600" : "text-red-600"
                                                )}>
                                                    {movement.type === 'entrada' ? '+' : '-'}{movement.quantity}
                                                </span>
                                                <span className="text-[#002B40]/30 text-xs ml-1">un.</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-[#002B40]/40">Saldo após</div>
                                                <div className="text-sm font-bold text-[#002B40]">
                                                    {movement.balance_after} un.
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-2 text-[11px] text-[#002B40]/30">
                                            <span>
                                                {format(new Date(movement.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                            </span>
                                            {movement.user && (
                                                <span className="font-medium">
                                                    por {movement.user.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
