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
import { createProductAction, updateProductAction } from "@/modules/products/actions/stockActions"
import { getStationTypesAction } from "@/modules/stations/actions/stationActions"
import { isCatalogService, type Product } from "@/modules/products/types/product.types"
import type { StationType } from "@/modules/stations/types/station.types"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

const productFormSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    item_type: z.enum(["Alimentação", "Bebida", "Vestimenta", "Acessório"]),
    station_type_id: z.string().min(1, "Selecione um tipo de estação"),
    price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
        message: "Preço deve ser um número válido e positivo",
    }),
})

const serviceFormSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    station_type_id: z.string().min(1, "Selecione um tipo de estação"),
    price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
        message: "Preço deve ser um número válido e positivo",
    }),
})

type ProductFormValues = z.infer<typeof productFormSchema>
type ServiceFormValues = z.infer<typeof serviceFormSchema>

const dialogContentClass =
    "max-w-[calc(100%-2rem)] gap-0 rounded-3xl border border-slate-200 bg-white p-6 text-slate-800 shadow-xl sm:max-w-[500px]"

const dialogTitleClass = "text-arena-navy-800 text-2xl font-semibold"

const dialogDescriptionClass = "text-sm leading-relaxed text-slate-600"

const formLabelClass = "text-sm font-medium text-arena-navy-800"

const inputFieldClass =
    "h-10 bg-white border-slate-300 text-slate-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400"

const selectTriggerClass =
    "h-10 w-full bg-white border-slate-300 text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-400"

const selectContentClass = "rounded-xl border border-slate-200 bg-white text-slate-800 shadow-lg"

const selectItemClass =
    "cursor-pointer hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900"

const footerButtonOutlineClass =
    "bg-white border-arena-navy-800 px-8 font-semibold text-arena-navy-800 shadow-none hover:bg-slate-50 rounded-lg"

const footerButtonPrimaryClass =
    "border-0 bg-arena-button px-8 font-semibold text-white shadow-none hover:bg-arena-button-hover rounded-lg"

export interface ProductFormModalProps {
    arenaId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    product?: Product | null
    onSuccess: () => void
    /** Modo ao criar novo registro (sem `product`). Com edição, o tipo vem do próprio registro. */
    catalogKind?: "product" | "service"
}

function effectiveCatalogKind(
    product: Product | null | undefined,
    catalogKind: "product" | "service"
): "product" | "service" {
    if (product) return isCatalogService(product) ? "service" : "product"
    return catalogKind
}

function ProductFormInner({
    arenaId,
    product,
    onSuccess,
    onOpenChange,
    kind,
}: {
    arenaId: string
    product: Product | null | undefined
    onSuccess: () => void
    onOpenChange: (open: boolean) => void
    kind: "product" | "service"
}) {
    const [stationTypes, setStationTypes] = useState<StationType[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    const productForm = useForm<ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        defaultValues: {
            name: "",
            item_type: "Alimentação",
            station_type_id: "",
            price: "",
        },
    })

    const serviceForm = useForm<ServiceFormValues>({
        resolver: zodResolver(serviceFormSchema),
        defaultValues: {
            name: "",
            station_type_id: "",
            price: "",
        },
    })

    useEffect(() => {
        if (kind === "product") {
            productForm.reset({
                name: product?.name || "",
                item_type:
                    (product?.item_type as ProductFormValues["item_type"]) || "Alimentação",
                station_type_id: product?.station_type_id || "",
                price: product?.price?.toString() || "",
            })
        } else {
            serviceForm.reset({
                name: product?.name || "",
                station_type_id: product?.station_type_id || "",
                price: product?.price?.toString() || "",
            })
        }
    }, [product, kind])

    useEffect(() => {
        getStationTypesAction(arenaId)
            .then((res) => {
                if (res.success) setStationTypes(res.data as StationType[])
            })
            .catch((error) => {
                console.error("Failed to load station types", error)
                toast.error("Erro ao carregar tipos de estação")
            })
    }, [arenaId])

    async function submitProduct(data: ProductFormValues) {
        const baseInput = {
            arena_id: arenaId,
            name: data.name,
            item_type: data.item_type,
            station_type_id: data.station_type_id,
            price: Number(data.price),
            catalog_kind: "product" as const,
        }
        if (product) {
            const res = await updateProductAction(arenaId, product.id, baseInput)
            if (!res.success) throw new Error(res.error)
            toast.success("Produto atualizado com sucesso!")
        } else {
            const res = await createProductAction(arenaId, baseInput)
            if (!res.success) throw new Error(res.error)
            toast.success("Produto criado com sucesso!")
        }
    }

    async function submitService(data: ServiceFormValues) {
        const baseInput = {
            arena_id: arenaId,
            name: data.name,
            item_type: "Serviço",
            station_type_id: data.station_type_id,
            price: Number(data.price),
            catalog_kind: "service" as const,
        }
        if (product) {
            const res = await updateProductAction(arenaId, product.id, baseInput)
            if (!res.success) throw new Error(res.error)
            toast.success("Serviço atualizado com sucesso!")
        } else {
            const res = await createProductAction(arenaId, baseInput)
            if (!res.success) throw new Error(res.error)
            toast.success("Serviço cadastrado com sucesso!")
        }
    }

    const onSubmitProduct = productForm.handleSubmit(async (data) => {
        setIsSubmitting(true)
        try {
            await submitProduct(data)
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            console.error("Error saving product:", error)
            const msg = error instanceof Error ? error.message : "Erro desconhecido"
            toast.error(`Erro ao salvar produto: ${msg}`)
        } finally {
            setIsSubmitting(false)
        }
    })

    const onSubmitService = serviceForm.handleSubmit(async (data) => {
        setIsSubmitting(true)
        try {
            await submitService(data)
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            console.error("Error saving service:", error)
            const msg = error instanceof Error ? error.message : "Erro desconhecido"
            toast.error(`Erro ao salvar serviço: ${msg}`)
        } finally {
            setIsSubmitting(false)
        }
    })

    if (kind === "service") {
        return (
            <Form {...serviceForm}>
                <form onSubmit={onSubmitService} className="space-y-5">
                    <FormField
                        control={serviceForm.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className="space-y-1.5">
                                <FormLabel className={formLabelClass}>Nome do serviço</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Ex.: Aluguel de raquete"
                                        className={inputFieldClass}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                            control={serviceForm.control}
                            name="price"
                            render={({ field }) => (
                                <FormItem className="space-y-1.5">
                                    <FormLabel className={formLabelClass}>Valor (R$)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            className={inputFieldClass}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={serviceForm.control}
                            name="station_type_id"
                            render={({ field }) => (
                                <FormItem className="space-y-1.5">
                                    <FormLabel className={formLabelClass}>Tipo de estação</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className={selectTriggerClass}>
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className={selectContentClass}>
                                            {stationTypes.map((type) => (
                                                <SelectItem
                                                    key={type.id}
                                                    value={type.id}
                                                    className={selectItemClass}
                                                >
                                                    {type.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <p className="text-sm leading-relaxed text-slate-600">
                        Serviços aparecem na comanda como itens cobráveis e não controlam estoque.
                    </p>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            className={footerButtonOutlineClass}
                            disabled={isSubmitting}
                            onClick={() => onOpenChange(false)}
                        >
                            Fechar
                        </Button>
                        <Button type="submit" className={footerButtonPrimaryClass} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : product ? (
                                "Salvar"
                            ) : (
                                "Cadastrar"
                            )}
                        </Button>
                    </div>
                </form>
            </Form>
        )
    }

    return (
        <Form {...productForm}>
            <form onSubmit={onSubmitProduct} className="space-y-5">
                <FormField
                    control={productForm.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className={formLabelClass}>Nome</FormLabel>
                            <FormControl>
                                <Input placeholder="Nome do produto" className={inputFieldClass} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        control={productForm.control}
                        name="item_type"
                        render={({ field }) => (
                            <FormItem className="space-y-1.5">
                                <FormLabel className={formLabelClass}>Tipo de item</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className={selectTriggerClass}>
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className={selectContentClass}>
                                        <SelectItem value="Alimentação" className={selectItemClass}>
                                            Alimentação
                                        </SelectItem>
                                        <SelectItem value="Bebida" className={selectItemClass}>
                                            Bebida
                                        </SelectItem>
                                        <SelectItem value="Vestimenta" className={selectItemClass}>
                                            Vestimenta
                                        </SelectItem>
                                        <SelectItem value="Acessório" className={selectItemClass}>
                                            Acessório
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={productForm.control}
                        name="price"
                        render={({ field }) => (
                            <FormItem className="space-y-1.5">
                                <FormLabel className={formLabelClass}>Valor (R$)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        className={inputFieldClass}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={productForm.control}
                    name="station_type_id"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className={formLabelClass}>Tipo de estação</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className={selectTriggerClass}>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className={selectContentClass}>
                                    {stationTypes.map((type) => (
                                        <SelectItem
                                            key={type.id}
                                            value={type.id}
                                            className={selectItemClass}
                                        >
                                            {type.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end gap-3 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        className={footerButtonOutlineClass}
                        disabled={isSubmitting}
                        onClick={() => onOpenChange(false)}
                    >
                        Fechar
                    </Button>
                    <Button type="submit" className={footerButtonPrimaryClass} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : product ? (
                            "Salvar"
                        ) : (
                            "Cadastrar"
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    )
}

export function ProductFormModal({
    arenaId,
    open,
    onOpenChange,
    product,
    onSuccess,
    catalogKind = "product",
}: ProductFormModalProps) {
    const kind = effectiveCatalogKind(product ?? null, catalogKind)

    const title =
        kind === "service"
            ? product
                ? "Editar serviço"
                : "Cadastrar serviço"
            : product
              ? "Editar produto"
              : "Cadastrar produto"

    const description =
        kind === "service"
            ? "Defina o nome, o valor e em qual tipo de estação este serviço pode ser cobrado (ex.: aluguel de equipamento)."
            : "Preencha os detalhes do produto abaixo."

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={dialogContentClass}>
                <DialogHeader className="mb-4 space-y-2 text-left">
                    <DialogTitle className={dialogTitleClass}>{title}</DialogTitle>
                    <DialogDescription className={dialogDescriptionClass}>{description}</DialogDescription>
                </DialogHeader>
                {open && (
                    <ProductFormInner
                        key={`${kind}-${product?.id ?? "new"}`}
                        arenaId={arenaId}
                        product={product}
                        onSuccess={onSuccess}
                        onOpenChange={onOpenChange}
                        kind={kind}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
