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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { ProductService, Product } from "@/modules/products/services/productService"
import { StationService, StationType } from "@/modules/stations/services/stationService"
import { useEffect, useState } from "react"

const productFormSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    item_type: z.enum(['Alimentação', 'Bebida', 'Vestimenta', 'Acessório']),
    status: z.enum(['Em estoque', 'Em falta']),
    station_type_id: z.string().min(1, "Selecione um tipo de estação"),
    price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
        message: "Preço deve ser um número válido e positivo",
    }),
})

type ProductFormValues = z.infer<typeof productFormSchema>

interface ProductFormModalProps {
    arenaId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    product?: Product | null
    onSuccess: () => void
}

export function ProductFormModal({
    arenaId,
    open,
    onOpenChange,
    product,
    onSuccess
}: ProductFormModalProps) {
    const [stationTypes, setStationTypes] = useState<StationType[]>([])

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        defaultValues: {
            name: "",
            item_type: "Alimentação",
            status: "Em estoque",
            station_type_id: "",
            price: "",
        },
    })

    // Reset form when product changes or modal opens
    useEffect(() => {
        if (open) {
            form.reset({
                name: product?.name || "",
                item_type: product?.item_type || "Alimentação",
                status: product?.status || "Em estoque",
                station_type_id: product?.station_type_id || "",
                price: product?.price?.toString() || "",
            })
        }
    }, [product, open, form])

    // Load station types
    useEffect(() => {
        if (open) {
            StationService.getStationTypes()
                .then(setStationTypes)
                .catch(error => {
                    console.error("Failed to load station types", error)
                    toast.error("Erro ao carregar tipos de estação")
                })
        }
    }, [open])

    async function onSubmit(data: ProductFormValues) {
        if (!arenaId) {
            toast.error("Erro interno: Arena não identificada.")
            return
        }

        try {
            const input = {
                arena_id: arenaId,
                name: data.name,
                item_type: data.item_type,
                status: data.status,
                station_type_id: data.station_type_id,
                price: Number(data.price)
            }

            if (product) {
                await ProductService.updateProduct(product.id, input)
                toast.success("Produto atualizado com sucesso!")
            } else {
                await ProductService.createProduct(input)
                toast.success("Produto criado com sucesso!")
            }

            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error saving product:", error)
            toast.error(`Erro ao salvar produto: ${error.message || error.error_description || "Erro desconhecido"}`)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{product ? "Editar Produto" : "Cadastrar Produto"}</DialogTitle>
                    <DialogDescription>
                        Preencha os detalhes do produto abaixo.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Nome do produto" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="item_type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Item</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Alimentação">Alimentação</SelectItem>
                                                <SelectItem value="Bebida">Bebida</SelectItem>
                                                <SelectItem value="Vestimenta">Vestimenta</SelectItem>
                                                <SelectItem value="Acessório">Acessório</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor (R$)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="station_type_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Estação</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {stationTypes.map((type) => (
                                                    <SelectItem key={type.id} value={type.id}>
                                                        {type.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Em estoque">Em estoque</SelectItem>
                                                <SelectItem value="Em falta">Em falta</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="button" variant="outline" className="mr-2" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="bg-[#FF6B00] hover:bg-[#E66000] text-white">
                                {product ? "Salvar Alterações" : "Cadastrar"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
