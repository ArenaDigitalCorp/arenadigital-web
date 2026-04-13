"use client"

import { useEffect, useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { StationOrder } from "../services/orderService"
import { addOrderItemsAction, updateOrderAction } from "@/modules/stations/actions/orderActions"
import { registerStockOutflowAction, getProductsByArenaAction } from "@/modules/products/actions/stockActions"
import type { Product } from "@/modules/products/services/productService"
import { Search, Check, X, Loader2, Plus, Minus, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { cn, normalizeString } from "@/lib/utils"

const launchItemSchema = z.object({
    quantity: z.string().min(1, "Informe a quantidade"),
})

type LaunchItemValues = z.infer<typeof launchItemSchema>

interface SelectedItem {
    product: Product
    quantity: number
}

interface LaunchItemModalProps {
    isOpen: boolean
    onClose: () => void
    arenaId: string
    stationTypeId?: string
    order: StationOrder | null
    onSuccess: () => void
}

export function LaunchItemModal({
    isOpen,
    onClose,
    arenaId,
    stationTypeId,
    order,
    onSuccess
}: LaunchItemModalProps) {
    const [allProducts, setAllProducts] = useState<Product[]>([])
    const [productSearch, setProductSearch] = useState("")
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
    const [isSearchingProducts, setIsSearchingProducts] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            loadProducts()
        }
    }, [isOpen, arenaId])

    const loadProducts = async () => {
        setIsSearchingProducts(true)
        try {
            const res = await getProductsByArenaAction(arenaId)
            setAllProducts(res.data || [])
        } catch (error) {
            console.error("Error loading products:", error)
        } finally {
            setIsSearchingProducts(false)
        }
    }

    const form = useForm<LaunchItemValues>({
        resolver: zodResolver(launchItemSchema),
        defaultValues: {
            quantity: "1",
        },
    })

    const filteredProducts = allProducts.filter(p =>
        (!stationTypeId || p.station_type_id === stationTypeId) &&
        normalizeString(p.name).includes(normalizeString(productSearch))
    )

    const groupedProducts = filteredProducts.reduce((acc, product) => {
        const type = product.item_type || 'Geral'
        if (!acc[type]) acc[type] = []
        acc[type].push(product)
        return acc
    }, {} as Record<string, Product[]>)

    const getItemQuantity = (productId: string) => {
        const item = selectedItems.find(i => i.product.id === productId)
        return item ? item.quantity : 0
    }

    const updateItemQuantity = (product: Product, delta: number) => {
        setSelectedItems(prev => {
            const existing = prev.find(i => i.product.id === product.id)
            if (existing) {
                const newQty = existing.quantity + delta
                
                // Block if trying to add more than stock
                if (delta > 0 && newQty > product.stock_quantity) {
                    toast.error(`Estoque máximo atingido (${product.stock_quantity} un.)`)
                    return prev;
                }

                if (newQty <= 0) {
                    return prev.filter(i => i.product.id !== product.id)
                }
                return prev.map(i => i.product.id === product.id ? { ...i, quantity: newQty } : i)
            }
            if (delta > 0) {
                if (delta > product.stock_quantity) {
                    toast.error(`Estoque insuficiente (${product.stock_quantity} un.)`)
                    return prev;
                }
                return [...prev, { product, quantity: delta }]
            }
            return prev
        })
    }

    const removeItem = (index: number) => {
        setSelectedItems(prev => prev.filter((_, i) => i !== index))
    }

    async function onSubmit(data: LaunchItemValues) {
        if (!order) return
        if (selectedItems.length === 0) {
            toast.error("Adicione pelo menos um item")
            return
        }

        setIsSubmitting(true)
        try {
            const itemsToLaunch = selectedItems.map(item => ({
                order_id: order.id,
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.product.price,
                total_price: item.product.price * item.quantity
            }))

            const launchTotalValue = itemsToLaunch.reduce((acc, item) => acc + item.total_price, 0)

            // Add all items in bulk and capture the created items
            const itemsRes = await addOrderItemsAction(arenaId, order.id, itemsToLaunch.map(({ order_id, ...item }) => item))
            if (!itemsRes.success) throw new Error(itemsRes.error)
            const createdItems = itemsRes.data

            // Register stock outflow
            for (let i = 0; i < selectedItems.length; i++) {
                const item = selectedItems[i]
                const createdItem = createdItems?.[i]
                await registerStockOutflowAction(
                    item.product.id,
                    item.quantity,
                    arenaId,
                    undefined,
                    createdItem?.id,
                    'order_item'
                )
            }

            // Update order total value
            await updateOrderAction(arenaId, order.id, {
                total_value: order.total_value + launchTotalValue
            })

            toast.success("Itens lançados com sucesso!")
            onSuccess()
            handleClose()
        } catch (error) {
            console.error("Error launching items:", error)
            toast.error("Erro ao lançar itens.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        form.reset()
        setProductSearch("")
        setSelectedItems([])
        onClose()
    }

    if (!order) return null

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-2xl font-black text-[#002B40]">
                        Lançar item na comanda #{order.order_number.toString().padStart(3, '0')}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="relative">
                                <Label className="text-[#002B40] font-bold">Itens para lançar</Label>
                                <div className="relative mt-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#002B40]/20" />
                                    <Input
                                        placeholder="Filtrar por nome do item..."
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        className="pl-10 h-11 border-[#002B40]/10 focus:ring-[#FF6B00] focus:border-[#FF6B00] rounded-xl"
                                    />
                                    {isSearchingProducts && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#FF6B00]" />
                                    )}
                                </div>
                            </div>

                            {/* Product List by Category */}
                            <div className="space-y-6 max-h-[300px] overflow-auto pr-2 custom-scrollbar">
                                {Object.entries(groupedProducts).length === 0 ? (
                                    <div className="text-center py-8 text-[#002B40]/40 text-sm">
                                        Nenhum produto encontrado.
                                    </div>
                                ) : (
                                    Object.entries(groupedProducts).map(([category, products]) => (
                                        <div key={category} className="space-y-3">
                                            <h3 className="text-xs font-black text-[#002B40]/30 uppercase tracking-widest pl-1">{category}</h3>
                                            <div className="space-y-2">
                                                {products.map((product) => {
                                                    const quantity = getItemQuantity(product.id)
                                                    return (
                                                        <div key={product.id} className="flex items-center justify-between p-3 bg-white border border-[#002B40]/5 rounded-xl hover:border-[#FF6B00]/20 transition-all group">
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-[#002B40] text-sm group-hover:text-[#FF6B00] transition-colors">{product.name}</span>
                                                                <span className="text-xs text-[#002B40]/40 font-medium">R$ {product.price.toFixed(2)}</span>
                                                                <span className={cn(
                                                                    "text-[10px] font-bold mt-0.5",
                                                                    product.stock_quantity > 0 ? "text-emerald-500" : "text-red-500"
                                                                )}>
                                                                    {product.stock_quantity > 0 ? `${product.stock_quantity} em estoque` : 'Sem estoque'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 bg-[#F8FAFC] p-1 rounded-lg border border-[#002B40]/5">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    type="button"
                                                                    onClick={() => updateItemQuantity(product, -1)}
                                                                    disabled={quantity === 0}
                                                                    className="h-8 w-8 rounded-md text-[#002B40]/40 hover:text-red-500 hover:bg-red-50 disabled:opacity-20"
                                                                >
                                                                    <Minus className="h-3 w-3" />
                                                                </Button>
                                                                <span className={cn(
                                                                    "text-sm font-black min-w-[20px] text-center transition-colors",
                                                                    quantity > 0 ? "text-[#FF6B00]" : "text-[#002B40]/20"
                                                                )}>
                                                                    {quantity}
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    type="button"
                                                                    onClick={() => updateItemQuantity(product, 1)}
                                                                    disabled={product.stock_quantity <= 0 || quantity >= product.stock_quantity}
                                                                    className="h-8 w-8 rounded-md text-[#002B40]/40 hover:text-emerald-500 hover:bg-emerald-50 disabled:opacity-20"
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Cart Summary */}
                            {selectedItems.length > 0 && (
                                <div className="pt-4 mt-4 border-t border-[#002B40]/5 space-y-3">
                                    <div className="flex items-center justify-between text-xs font-bold text-[#002B40]/40">
                                        <span>Resumo do lançamento</span>
                                        <span>{selectedItems.length} {selectedItems.length === 1 ? 'item' : 'itens'}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {selectedItems.slice(0, 3).map((item, index) => (
                                            <div key={index} className="flex items-center justify-between text-sm">
                                                <span className="text-[#002B40]/60"><span className="font-bold text-[#FF6B00]">{item.quantity}x</span> {item.product.name}</span>
                                                <span className="font-bold text-[#002B40]">R$ {(item.product.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                        {selectedItems.length > 3 && (
                                            <div className="text-xs text-[#002B40]/30 font-medium italic">
                                                + {selectedItems.length - 3} outros itens...
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-dashed border-[#002B40]/10">
                                        <span className="text-sm font-black text-[#002B40] uppercase tracking-wider">Total a Lançar</span>
                                        <span className="text-lg font-black text-[#FF6B00]">
                                            R$ {selectedItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="pt-6 border-t border-gray-100 flex flex-row items-center justify-between gap-3 bg-white w-full">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                                className="flex-1 font-bold h-12 rounded-xl text-[#002B40]/60 border-[#002B40]/10"
                            >
                                Fechar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold h-12 rounded-xl shadow-lg shadow-[#FF6B00]/20"
                            >
                                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Lançar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
