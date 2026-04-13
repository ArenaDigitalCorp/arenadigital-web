"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { createStockEntryAction } from "@/modules/products/actions/stockActions"
import type { Product } from "@/modules/products/types/product.types"
import { useState } from "react"
import { Loader2, Package, CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

const stockEntrySchema = z.object({
    entry_date: z.string().min(1, "Informe a data de entrada"),
    quantity: z.string()
        .min(1, "Informe a quantidade")
        .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
            message: "Quantidade deve ser um número maior que zero",
        }),
    supplier: z.string().min(2, "Fornecedor deve ter pelo menos 2 caracteres"),
    description: z.string().optional(),
    invoice_number: z.string().optional(),
})

type StockEntryValues = z.infer<typeof stockEntrySchema>

interface StockEntryModalProps {
    arenaId: string
    product: Product
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function StockEntryModal({
    arenaId,
    product,
    open,
    onOpenChange,
    onSuccess,
}: StockEntryModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<StockEntryValues>({
        resolver: zodResolver(stockEntrySchema),
        defaultValues: {
            entry_date: format(new Date(), "yyyy-MM-dd"),
            quantity: "",
            supplier: "",
            description: "",
            invoice_number: "",
        },
    })

    async function onSubmit(data: StockEntryValues) {
        setIsSubmitting(true)
        try {
            const res = await createStockEntryAction({
                product_id: product.id,
                arena_id: arenaId,
                quantity: Number(data.quantity),
                entry_date: data.entry_date,
                supplier: data.supplier,
                description: data.description || undefined,
                invoice_number: data.invoice_number || undefined,
            })
            if (!res.success) throw new Error(res.error)

            toast.success(`Entrada de ${data.quantity} unidade(s) registrada com sucesso!`)
            form.reset({
                entry_date: format(new Date(), "yyyy-MM-dd"),
                quantity: "",
                supplier: "",
                description: "",
                invoice_number: "",
            })
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error creating stock entry:", error)
            toast.error(`Erro ao registrar entrada: ${error.message || "Erro desconhecido"}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                <Package className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black text-white">
                                    Lançar Entrada de Estoque
                                </DialogTitle>
                                <DialogDescription className="text-emerald-100 mt-1">
                                    {product.name} — Saldo atual: <span className="font-bold text-white">{product.stock_quantity} un.</span>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="entry_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[#002B40] font-bold text-xs uppercase tracking-wider">Data de Entrada</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                className="h-11 border-[#002B40]/10 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[#002B40] font-bold text-xs uppercase tracking-wider">Quantidade</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min="1"
                                                placeholder="0"
                                                {...field}
                                                className="h-11 border-[#002B40]/10 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl text-lg font-bold text-center"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="supplier"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[#002B40] font-bold text-xs uppercase tracking-wider">Fornecedor</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Nome do fornecedor"
                                            {...field}
                                            className="h-11 border-[#002B40]/10 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="invoice_number"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[#002B40] font-bold text-xs uppercase tracking-wider">
                                        Nota Fiscal <span className="text-[#002B40]/30 font-normal normal-case">(opcional)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Número da nota fiscal"
                                            {...field}
                                            className="h-11 border-[#002B40]/10 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[#002B40] font-bold text-xs uppercase tracking-wider">
                                        Descrição <span className="text-[#002B40]/30 font-normal normal-case">(opcional)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Observações sobre esta entrada..."
                                            rows={2}
                                            {...field}
                                            className="border-[#002B40]/10 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl resize-none"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-4 border-t border-gray-100 flex flex-row items-center justify-between gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="flex-1 font-bold h-12 rounded-xl text-[#002B40]/60 border-[#002B40]/10"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-emerald-500/20"
                            >
                                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Registrar Entrada"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
