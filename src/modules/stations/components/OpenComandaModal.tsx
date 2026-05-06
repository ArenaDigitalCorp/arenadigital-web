"use client"

import { useEffect, useState, useRef, useCallback } from "react"
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
import { createOrderWithItemsAction, getCustomersByArenaAction } from "@/modules/stations/actions/orderActions"
import { getProductsByArenaAction } from "@/modules/products/actions/stockActions"
import { getAthletesByArenaAction } from "@/modules/athletes/actions/athleteActions"
import type { Product } from "@/modules/products/types/product.types"
import { Plus, Minus, Search, Check, X, Loader2, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { cn, normalizeString } from "@/lib/utils"

const openComandaSchema = z.object({
    quantity: z.string().min(1, "Informe a quantidade"),
})

type OpenComandaValues = z.infer<typeof openComandaSchema>

interface SelectedItem {
    product: Product
    quantity: number
}

interface OpenComandaModalProps {
    isOpen: boolean
    onClose: () => void
    arenaId: string
    stationId: string
    stationTypeId?: string
    onSuccess: () => void
    onRegisterNewCustomer: () => void
}

export function OpenComandaModal({
    isOpen,
    onClose,
    arenaId,
    stationId,
    stationTypeId,
    onSuccess,
    onRegisterNewCustomer
}: OpenComandaModalProps) {
    const [customerSearch, setCustomerSearch] = useState("")
    const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
    const [isSearchingCustomers, setIsSearchingCustomers] = useState(false)


    const [allProducts, setAllProducts] = useState<Product[]>([])
    const [productSearch, setProductSearch] = useState("")
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
    const [isSearchingProducts, setIsSearchingProducts] = useState(false)

    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        loadProducts()
    }, [arenaId])

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

    const customerSearchTimeout = useRef<NodeJS.Timeout | null>(null)

    const form = useForm<OpenComandaValues>({
        resolver: zodResolver(openComandaSchema),
        defaultValues: {
            quantity: "1",
        },
    })

    const handleCustomerSearch = (value: string) => {
        setCustomerSearch(value)
        if (selectedCustomer) setSelectedCustomer(null)

        if (customerSearchTimeout.current) clearTimeout(customerSearchTimeout.current)

        if (value.length < 2) {
            setFilteredCustomers([])
            return
        }

        setIsSearchingCustomers(true)
        customerSearchTimeout.current = setTimeout(async () => {
            try {
                const [customersRes, athletesData] = await Promise.all([
                    getCustomersByArenaAction(arenaId),
                    getAthletesByArenaAction(arenaId) // Fetch all for frontend filtering
                ])

                const normalizedValue = normalizeString(value)

                const combined = [
                    ...(customersRes.data ?? [])
                        .filter((c: any) => normalizeString(c.name).includes(normalizedValue))
                        .map((c: any) => ({ id: `customer:${c.id}`, name: c.name, origin: 'station' })),
                    ...(athletesData.data ?? [])
                        .filter((a: any) => normalizeString(a.name).includes(normalizedValue))
                        .map((a: any) => ({ id: `athlete:${a.id}`, name: a.name, origin: 'athlete' }))
                ]

                setFilteredCustomers(combined)
            } catch (error) {
                console.error("Customer search error:", error)
            } finally {
                setIsSearchingCustomers(false)
            }
        }, 500)
    }

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

    async function onSubmit(data: OpenComandaValues) {
        if (!selectedCustomer) {
            toast.error("Selecione um cliente")
            return
        }
        if (selectedItems.length === 0) {
            toast.error("Adicione pelo menos um item")
            return
        }

        setIsSubmitting(true)
        try {
            const totalPrice = selectedItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0)
            const isAthlete = selectedCustomer.id.startsWith('athlete:')
            const actualId = selectedCustomer.id.split(':')[1]

            const orderRes = await createOrderWithItemsAction(
                arenaId,
                {
                    station_id: stationId,
                    atleta_id: isAthlete ? actualId : undefined,
                    customer_id: !isAthlete ? actualId : undefined,
                    status: 'open',
                    total_value: totalPrice
                },
                selectedItems.map(item => ({
                    product_id: item.product.id,
                    quantity: item.quantity,
                    unit_price: item.product.price,
                    total_price: item.product.price * item.quantity
                }))
            )
            if (!orderRes.success) throw new Error(orderRes.error)

            toast.success("Comanda aberta com sucesso!")
            onSuccess()
            handleClose()
        } catch (error) {
            console.error("Error opening comanda:", error)
            toast.error("Erro ao abrir comanda.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        form.reset()
        setCustomerSearch("")
        setSelectedCustomer(null)
        setFilteredCustomers([])
        setProductSearch("")
        setSelectedItems([])
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
                <DialogHeader className="p-6 pb-0 flex-shrink-0">
                    <DialogTitle className="text-2xl font-black text-arena-navy-800">
                        Abrir nova comanda
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Cliente Search */}
                        <div className="space-y-2 relative">
                            <Label className="text-arena-navy-800 font-bold">Cliente</Label>
                            {!selectedCustomer ? (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/20" />
                                    <Input
                                        placeholder="Selecione um cliente vinculado ou insira um novo"
                                        value={customerSearch}
                                        onChange={(e) => handleCustomerSearch(e.target.value)}
                                        className="pl-10 h-12 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl"
                                    />
                                    {isSearchingCustomers && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-arena-button" />
                                    )}

                                    {(filteredCustomers.length > 0 || customerSearch.length >= 2) && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-arena-navy-800/10 rounded-xl shadow-lg max-h-48 overflow-auto">
                                            {filteredCustomers.map((customer) => (
                                                <button
                                                    key={customer.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCustomer(customer)
                                                        setCustomerSearch(customer.name)
                                                        setFilteredCustomers([])
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-[#FFF5EF] transition-colors flex items-center justify-between border-b border-arena-navy-800/5 last:border-0"
                                                >
                                                    <span className="font-semibold text-arena-navy-800 text-sm">{customer.name}</span>
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => onRegisterNewCustomer()}
                                                className="w-full text-left px-4 py-3 hover:bg-[#FFF5EF] transition-colors flex items-center gap-2 text-arena-button font-bold text-sm"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Cadastrar novo +
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-3 bg-[#FFF5EF] border border-[#FFE4D3] rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-arena-button/10 flex items-center justify-center">
                                            <Check className="h-4 w-4 text-arena-button" />
                                        </div>
                                        <span className="font-semibold text-arena-navy-800 text-sm">{selectedCustomer.name}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        type="button"
                                        onClick={() => setSelectedCustomer(null)}
                                        className="hover:bg-red-50 text-red-500"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Multi-Item Section */}
                        <div className="space-y-4">
                            <div className="relative">
                                <Label className="text-arena-navy-800 font-bold">Itens do pedido</Label>
                                <div className="relative mt-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/20" />
                                    <Input
                                        placeholder="Filtrar por nome do item..."
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        className="pl-10 h-11 border-arena-navy-800/10 focus:ring-arena-button focus:border-arena-button rounded-xl"
                                    />
                                    {isSearchingProducts && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-arena-button" />
                                    )}
                                </div>
                            </div>

                            {/* Product List by Category */}
                            <div className="space-y-6 max-h-[300px] overflow-auto pr-2 custom-scrollbar">
                                {Object.entries(groupedProducts).length === 0 ? (
                                    <div className="text-center py-8 text-arena-navy-800/40 text-sm">
                                        Nenhum produto encontrado.
                                    </div>
                                ) : (
                                    Object.entries(groupedProducts).map(([category, products]) => (
                                        <div key={category} className="space-y-3">
                                            <h3 className="text-xs font-black text-arena-navy-800/30 uppercase tracking-widest pl-1">{category}</h3>
                                            <div className="space-y-2">
                                                {products.map((product) => {
                                                    const quantity = getItemQuantity(product.id)
                                                    return (
                                                        <div key={product.id} className="flex items-center justify-between p-3 bg-white border border-arena-navy-800/5 rounded-xl hover:border-arena-button/20 transition-all group">
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-arena-navy-800 text-sm group-hover:text-arena-button transition-colors">{product.name}</span>
                                                                <span className="text-xs text-arena-navy-800/40 font-medium">R$ {product.price.toFixed(2)}</span>
                                                                <span className={cn(
                                                                    "text-[10px] font-bold mt-0.5",
                                                                    product.stock_quantity > 0 ? "text-emerald-500" : "text-red-500"
                                                                )}>
                                                                    {product.stock_quantity > 0 ? `${product.stock_quantity} em estoque` : 'Sem estoque'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 bg-arena-soft p-1 rounded-lg border border-arena-navy-800/5">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    type="button"
                                                                    onClick={() => updateItemQuantity(product, -1)}
                                                                    disabled={quantity === 0}
                                                                    className="h-8 w-8 rounded-md text-arena-navy-800/40 hover:text-red-500 hover:bg-red-50 disabled:opacity-20"
                                                                >
                                                                    <Minus className="h-3 w-3" />
                                                                </Button>
                                                                <span className={cn(
                                                                    "text-sm font-black min-w-[20px] text-center transition-colors",
                                                                    quantity > 0 ? "text-arena-button" : "text-arena-navy-800/20"
                                                                )}>
                                                                    {quantity}
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    type="button"
                                                                    onClick={() => updateItemQuantity(product, 1)}
                                                                    disabled={product.stock_quantity <= 0 || quantity >= product.stock_quantity}
                                                                    className="h-8 w-8 rounded-md text-arena-navy-800/40 hover:text-emerald-500 hover:bg-emerald-50 disabled:opacity-20"
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
                                <div className="pt-4 mt-4 border-t border-arena-navy-800/5 space-y-3">
                                    <div className="flex items-center justify-between text-xs font-bold text-arena-navy-800/40">
                                        <span>Resumo do pedido</span>
                                        <span>{selectedItems.length} {selectedItems.length === 1 ? 'item' : 'itens'}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {selectedItems.slice(0, 3).map((item, index) => (
                                            <div key={index} className="flex items-center justify-between text-sm">
                                                <span className="text-arena-navy-800/60"><span className="font-bold text-arena-button">{item.quantity}x</span> {item.product.name}</span>
                                                <span className="font-bold text-arena-navy-800">R$ {(item.product.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                        {selectedItems.length > 3 && (
                                            <div className="text-xs text-arena-navy-800/30 font-medium italic">
                                                + {selectedItems.length - 3} outros itens...
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-dashed border-arena-navy-800/10">
                                        <span className="text-sm font-black text-arena-navy-800">Total</span>
                                        <span className="text-lg font-black text-arena-button">
                                            R$ {selectedItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        </div>

                        <DialogFooter className="flex-shrink-0 p-6 pt-4 border-t border-gray-100 flex flex-row items-center justify-between gap-3 bg-white w-full">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                                className="flex-1 font-bold h-12 rounded-xl text-arena-navy-800/60 border-arena-navy-800/10"
                            >
                                Fechar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-arena-button hover:bg-arena-button-hover text-white font-bold h-12 rounded-xl shadow-lg shadow-arena-button/20"
                            >
                                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Abrir"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
