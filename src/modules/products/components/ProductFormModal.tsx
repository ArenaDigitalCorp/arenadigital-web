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
import { isCatalogService, normalizeCatalogStatus, type Product } from "@/modules/products/types/product.types"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

const productFormSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    item_type: z.enum(["Alimentação", "Bebida", "Vestimenta", "Acessório"]),
    station_type_id: z.string().min(1, "Selecione o tipo de estação"),
    price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
        message: "Preço deve ser um número válido e positivo",
    }),
    status: z.enum(["Ativo", "Inativo"]),
})

const SERVICE_ITEM_TYPES = [
    "Aluguel",
    "Saúde e bem-estar",
    "Educação e evolução técnica",
    "Entretenimento",
    "Conveniência",
    "Outro",
] as const

const serviceFormSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    item_type: z.enum(SERVICE_ITEM_TYPES),
    price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
        message: "Preço deve ser um número válido e positivo",
    }),
    status: z.enum(["Ativo", "Inativo"]),
})

type ProductFormValues = z.infer<typeof productFormSchema>
type ServiceFormValues = z.infer<typeof serviceFormSchema>

const PRODUCT_ITEM_TYPES = ["Alimentação", "Bebida", "Vestimenta", "Acessório"] as const

function coerceProductItemType(raw: string | null | undefined): ProductFormValues["item_type"] {
    const t = (raw ?? "").trim()
    if ((PRODUCT_ITEM_TYPES as readonly string[]).includes(t)) {
        return t as ProductFormValues["item_type"]
    }
    return "Alimentação"
}

function coerceServiceItemType(raw: string | null | undefined): (typeof SERVICE_ITEM_TYPES)[number] {
    if (raw && (SERVICE_ITEM_TYPES as readonly string[]).includes(raw)) {
        return raw as (typeof SERVICE_ITEM_TYPES)[number]
    }
    if (raw === "Aula") return "Educação e evolução técnica"
    if (raw === "Taxa") return "Conveniência"
    if (raw === "Serviço") return "Outro"
    return "Aluguel"
}

function coerceProductCatalogStatus(product: Product | null | undefined): "Ativo" | "Inativo" {
    if (!product) return "Inativo"
    return normalizeCatalogStatus(product.status)
}

type StationTypeOption = { id: string; name: string }

const dialogContentClass =
    "max-w-[calc(100%-2rem)] gap-0 rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-xl sm:max-w-[560px] sm:p-7 [&_[data-slot=dialog-close]]:text-[#0D3B45] [&_[data-slot=dialog-close]]:opacity-100"

const dialogTitleClass = "text-xl font-bold text-[#0D3B45] sm:text-2xl"

const dialogDescriptionClass = "text-sm leading-relaxed text-slate-600"

const formLabelClass = "text-sm font-medium text-arena-navy-800"

/** Labels do formulário de serviço (Figma: tom teal). */
const serviceLabelClass = "text-sm font-medium text-[#2A8F96]"

const serviceInputClass =
    "h-11 rounded-lg bg-white border-slate-300 text-slate-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#20B2AA]"

const serviceSelectTriggerClass =
    "h-11 w-full rounded-lg bg-white border-slate-300 text-sm text-arena-navy-800 shadow-none focus-visible:ring-1 focus-visible:ring-[#20B2AA]"

const inputFieldClass =
    "h-10 bg-white border-slate-300 text-slate-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400"

const selectTriggerClass =
    "h-10 w-full bg-white border-slate-300 text-sm text-arena-navy-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-400"

const selectContentClass = "rounded-xl border border-slate-200 bg-white text-slate-800 shadow-lg"

const selectItemClass =
    "cursor-pointer hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900"

const footerButtonOutlineClass =
    "h-11 flex-1 rounded-lg border-[#0D3B45] bg-white px-6 font-semibold text-[#0D3B45] shadow-none hover:bg-slate-50 sm:flex-initial sm:min-w-[120px]"

const footerButtonPrimaryClass =
    "h-11 flex-1 rounded-lg border-0 bg-arena-button px-6 font-semibold text-white shadow-none hover:bg-arena-button-hover sm:flex-initial sm:min-w-[120px]"

export interface ProductFormModalProps {
    arenaId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    product?: Product | null
    onSuccess: () => void
    /** Tipos de estação (carregados na página); usados no cadastro/edição de produto. */
    stationTypes: StationTypeOption[]
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

const EMPTY_PRODUCT_FORM: ProductFormValues = {
    name: "",
    item_type: "Alimentação",
    station_type_id: "",
    price: "",
    status: "Inativo",
}

const EMPTY_SERVICE_FORM: ServiceFormValues = {
    name: "",
    item_type: "Aluguel",
    price: "",
    status: "Ativo",
}

/** Supabase embed costuma vir como objeto; em alguns casos pode vir como array. */
function resolveStationTypeId(p: Product): string {
    const direct = p.station_type_id
    if (typeof direct === "string" && direct.length > 0) return direct

    const st = p.station_type as unknown
    if (st && typeof st === "object" && !Array.isArray(st)) {
        const id = (st as { id?: unknown }).id
        if (typeof id === "string" && id.length > 0) return id
    }
    if (Array.isArray(st) && st.length > 0) {
        const first = st[0] as { id?: unknown }
        if (first && typeof first.id === "string" && first.id.length > 0) return first.id
    }
    return ""
}

function productToFormValues(p: Product): ProductFormValues {
    return {
        name: p.name || "",
        item_type: coerceProductItemType(p.item_type),
        station_type_id: resolveStationTypeId(p),
        price: p.price != null ? String(p.price) : "",
        status: coerceProductCatalogStatus(p),
    }
}

function productToServiceFormValues(p: Product): ServiceFormValues {
    return {
        name: p.name || "",
        item_type: coerceServiceItemType(p.item_type),
        price: p.price != null ? String(p.price) : "",
        status: normalizeCatalogStatus(p.status),
    }
}

function ProductFormInner({
    arenaId,
    product,
    onSuccess,
    onOpenChange,
    kind,
    stationTypes,
}: {
    arenaId: string
    product: Product | null | undefined
    onSuccess: () => void
    onOpenChange: (open: boolean) => void
    kind: "product" | "service"
    stationTypes: StationTypeOption[]
}) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const productForm = useForm<ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        defaultValues:
            kind === "product" && product ? productToFormValues(product) : EMPTY_PRODUCT_FORM,
    })

    const serviceForm = useForm<ServiceFormValues>({
        resolver: zodResolver(serviceFormSchema),
        defaultValues:
            kind === "service" && product ? productToServiceFormValues(product) : EMPTY_SERVICE_FORM,
    })

    useEffect(() => {
        if (kind !== "service") return
        if (!product) {
            serviceForm.reset(EMPTY_SERVICE_FORM)
            return
        }
        serviceForm.reset(productToServiceFormValues(product))
        // eslint-disable-next-line react-hooks/exhaustive-deps -- alinhar ao produto/kind
    }, [kind, product, product?.id])

    useEffect(() => {
        if (kind !== "product") return

        if (!product) {
            productForm.reset(EMPTY_PRODUCT_FORM)
            return
        }

        productForm.reset(productToFormValues(product))
        // eslint-disable-next-line react-hooks/exhaustive-deps -- alinhar ao produto/kind; defaultValues já cobrem o primeiro paint
    }, [kind, product, product?.id])
    async function submitProduct(data: ProductFormValues) {
        const selectedType = stationTypes.find((t) => t.id === data.station_type_id)
        if (!selectedType) {
            toast.error("Selecione um tipo de estação válido.")
            return
        }
        if (product) {
            const res = await updateProductAction(arenaId, product.id, {
                name: data.name,
                item_type: data.item_type,
                station_id: null,
                station_type_id: data.station_type_id,
                price: Number(data.price),
                status: data.status,
            })
            if (!res.success) throw new Error(res.error)
            toast.success("Produto atualizado com sucesso!")
        } else {
            const res = await createProductAction(arenaId, {
                arena_id: arenaId,
                name: data.name,
                item_type: data.item_type,
                station_id: null,
                station_type_id: data.station_type_id,
                price: Number(data.price),
                catalog_kind: "product",
                status: data.status,
            })
            if (!res.success) throw new Error(res.error)
            toast.success("Produto criado com sucesso!")
        }
    }

    async function submitService(data: ServiceFormValues) {
        const baseInput = {
            arena_id: arenaId,
            name: data.name,
            item_type: data.item_type,
            station_id: null,
            station_type_id: null,
            price: Number(data.price),
            catalog_kind: "service" as const,
            status: data.status,
            stock_quantity: 0,
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
                <form onSubmit={onSubmitService} className="flex flex-col gap-6">
                    <FormField
                        control={serviceForm.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel className={serviceLabelClass}>Nome</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Informe o nome do serviço"
                                        className={serviceInputClass}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={serviceForm.control}
                        name="item_type"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel className={serviceLabelClass}>Tipo</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className={serviceSelectTriggerClass}>
                                            <SelectValue placeholder="Selecione o tipo" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className={selectContentClass}>
                                        {SERVICE_ITEM_TYPES.map((t) => (
                                            <SelectItem key={t} value={t} className={selectItemClass}>
                                                {t}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={serviceForm.control}
                        name="price"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel className={serviceLabelClass}>Valor</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        placeholder="R$ 00,00"
                                        className={serviceInputClass}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={serviceForm.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel className={serviceLabelClass}>Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className={serviceSelectTriggerClass}>
                                            <SelectValue placeholder="Selecione o status" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className={selectContentClass}>
                                        <SelectItem value="Ativo" className={selectItemClass}>
                                            Ativo
                                        </SelectItem>
                                        <SelectItem value="Inativo" className={selectItemClass}>
                                            Inativo
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex w-full flex-row gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            className={footerButtonOutlineClass}
                            disabled={isSubmitting}
                            onClick={() => onOpenChange(false)}
                        >
                            Fechar
                        </Button>
                        <Button
                            type="submit"
                            className={footerButtonPrimaryClass}
                            disabled={isSubmitting}
                        >
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
            <form onSubmit={onSubmitProduct} className="flex flex-col gap-5">
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
                    name="station_type_id"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className={formLabelClass}>Tipo de estação</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger
                                        className={selectTriggerClass}
                                        disabled={stationTypes.length === 0}
                                    >
                                        <SelectValue placeholder="Selecione o tipo de estação..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className={selectContentClass}>
                                    {stationTypes.map((t) => (
                                        <SelectItem key={t.id} value={t.id} className={selectItemClass}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
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

                <FormField
                    control={productForm.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className={formLabelClass}>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className={selectTriggerClass}>
                                        <SelectValue placeholder="Selecione o status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className={selectContentClass}>
                                    <SelectItem value="Ativo" className={selectItemClass}>
                                        Ativo
                                    </SelectItem>
                                    <SelectItem value="Inativo" className={selectItemClass}>
                                        Inativo
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {stationTypes.length === 0 && (
                    <p className="text-sm leading-relaxed text-amber-800">
                        Não há tipos de estação cadastrados no sistema. Cadastre tipos em Estações antes de incluir
                        produtos no catálogo.
                    </p>
                )}

                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        className={footerButtonOutlineClass}
                        disabled={isSubmitting}
                        onClick={() => onOpenChange(false)}
                    >
                        Fechar
                    </Button>
                    <Button
                        type="submit"
                        className={footerButtonPrimaryClass}
                        disabled={isSubmitting || stationTypes.length === 0}
                    >
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
    stationTypes,
    catalogKind = "product",
}: ProductFormModalProps) {
    const kind = effectiveCatalogKind(product ?? null, catalogKind)

    const title =
        kind === "service"
            ? product
                ? "Editar serviço"
                : "Cadastrar novo serviço"
            : product
              ? "Editar produto"
              : "Novo produto"

    const productDescription =
        "Informe nome, tipo de item, tipo de estação, valor e status de catálogo (Ativo ou Inativo), independente do estoque. O estoque é atualizado apenas por lançamentos de entrada."

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={dialogContentClass}>
                <DialogHeader
                    className={kind === "product" ? "mb-4 space-y-2 text-left" : "mb-2 space-y-0 text-left"}
                >
                    <DialogTitle className={dialogTitleClass}>{title}</DialogTitle>
                    {kind === "product" && (
                        <DialogDescription className={dialogDescriptionClass}>{productDescription}</DialogDescription>
                    )}
                </DialogHeader>
                {open && (
                    <ProductFormInner
                        key={`${kind}-${product?.id ?? "new"}`}
                        arenaId={arenaId}
                        product={product}
                        onSuccess={onSuccess}
                        onOpenChange={onOpenChange}
                        kind={kind}
                        stationTypes={stationTypes}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
