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
import { getArenaStationsForCatalogAction } from "@/modules/stations/actions/stationActions"
import { isCatalogService, type Product } from "@/modules/products/types/product.types"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

const productFormSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    item_type: z.enum(["Alimentação", "Bebida", "Vestimenta", "Acessório"]),
    station_id: z.string().min(1, "Selecione uma estação"),
    price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
        message: "Preço deve ser um número válido e positivo",
    }),
})

const serviceFormSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    item_type: z.enum(["Aluguel", "Aula", "Taxa", "Outro", "Serviço"]),
    price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
        message: "Preço deve ser um número válido e positivo",
    }),
    status: z.enum(["Em estoque", "Em falta"]),
    station_id: z.string().min(1, "Selecione uma estação"),
})

type ProductFormValues = z.infer<typeof productFormSchema>
type ServiceFormValues = z.infer<typeof serviceFormSchema>

const SERVICE_ITEM_TYPES = ["Aluguel", "Aula", "Taxa", "Outro", "Serviço"] as const

function coerceServiceItemType(raw: string | null | undefined): (typeof SERVICE_ITEM_TYPES)[number] {
    if (raw && (SERVICE_ITEM_TYPES as readonly string[]).includes(raw)) {
        return raw as (typeof SERVICE_ITEM_TYPES)[number]
    }
    return "Aluguel"
}

function coerceServiceStatus(raw: string | null | undefined): "Em estoque" | "Em falta" {
    return raw === "Em falta" ? "Em falta" : "Em estoque"
}

type ArenaCatalogStation = {
    id: string
    name: string
    station_type_id: string | null
    station_type: { id: string; name: string } | null
}

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
    const [arenaStations, setArenaStations] = useState<ArenaCatalogStation[]>([])
    const [stationsLoaded, setStationsLoaded] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const productForm = useForm<ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        defaultValues: {
            name: "",
            item_type: "Alimentação",
            station_id: "",
            price: "",
        },
    })

    const serviceForm = useForm<ServiceFormValues>({
        resolver: zodResolver(serviceFormSchema),
        defaultValues: {
            name: "",
            item_type: "Aluguel",
            price: "",
            status: "Em estoque",
            station_id: "",
        },
    })

    useEffect(() => {
        if (kind === "product") {
            productForm.reset({
                name: product?.name || "",
                item_type:
                    (product?.item_type as ProductFormValues["item_type"]) || "Alimentação",
                station_id: product?.station_id || "",
                price: product?.price?.toString() || "",
            })
        } else {
            serviceForm.reset({
                name: product?.name || "",
                item_type: coerceServiceItemType(product?.item_type),
                price: product?.price?.toString() || "",
                status: coerceServiceStatus(product?.status),
                station_id: product?.station_id || "",
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when product/kind identity changes only
    }, [product, kind])

    useEffect(() => {
        setStationsLoaded(false)
        getArenaStationsForCatalogAction(arenaId)
            .then((res) => {
                if (res.success) setArenaStations((res.data as ArenaCatalogStation[]) ?? [])
                else setArenaStations([])
            })
            .catch((error) => {
                console.error("Failed to load arena stations", error)
                setArenaStations([])
                toast.error("Erro ao carregar estações da arena")
            })
            .finally(() => setStationsLoaded(true))
    }, [arenaId])

    async function submitProduct(data: ProductFormValues) {
        const selected = arenaStations.find((s) => s.id === data.station_id)
        if (!selected?.station_type_id) {
            toast.error("Estação inválida ou sem tipo configurado.")
            return
        }
        if (product) {
            const res = await updateProductAction(arenaId, product.id, {
                name: data.name,
                item_type: data.item_type,
                station_id: data.station_id,
                station_type_id: selected.station_type_id,
                price: Number(data.price),
            })
            if (!res.success) throw new Error(res.error)
            toast.success("Produto atualizado com sucesso!")
        } else {
            const res = await createProductAction(arenaId, {
                arena_id: arenaId,
                name: data.name,
                item_type: data.item_type,
                station_id: data.station_id,
                station_type_id: selected.station_type_id,
                price: Number(data.price),
                catalog_kind: "product",
                status: "Em falta",
            })
            if (!res.success) throw new Error(res.error)
            toast.success("Produto criado com sucesso!")
        }
    }

    async function submitService(data: ServiceFormValues) {
        const selected = arenaStations.find((s) => s.id === data.station_id)
        if (!selected?.station_type_id) {
            toast.error("Estação inválida ou sem tipo configurado.")
            return
        }
        const baseInput = {
            arena_id: arenaId,
            name: data.name,
            item_type: data.item_type,
            station_id: data.station_id,
            station_type_id: selected.station_type_id,
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
                                        {SERVICE_ITEM_TYPES.filter((t) => t !== "Serviço" || field.value === "Serviço").map(
                                            (t) => (
                                                <SelectItem key={t} value={t} className={selectItemClass}>
                                                    {t === "Serviço" ? "Serviço (legado)" : t}
                                                </SelectItem>
                                            )
                                        )}
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
                                        <SelectItem value="Em estoque" className={selectItemClass}>
                                            Ativo
                                        </SelectItem>
                                        <SelectItem value="Em falta" className={selectItemClass}>
                                            Inativo
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={serviceForm.control}
                        name="station_id"
                        render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel className={serviceLabelClass}>Estação</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger
                                            className={serviceSelectTriggerClass}
                                            disabled={!stationsLoaded || arenaStations.length === 0}
                                        >
                                            <SelectValue placeholder="Selecione a estação" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className={selectContentClass}>
                                        {arenaStations.map((s) => (
                                            <SelectItem key={s.id} value={s.id} className={selectItemClass}>
                                                {s.name}
                                                {s.station_type?.name ? ` · ${s.station_type.name}` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {stationsLoaded && arenaStations.length === 0 && (
                        <p className="text-sm leading-relaxed text-amber-800">
                            Não há estações com tipo configurado nesta arena. Cadastre uma estação em Estações antes de
                            incluir serviços no catálogo.
                        </p>
                    )}

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
                            disabled={isSubmitting || !stationsLoaded || arenaStations.length === 0}
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
                    name="station_id"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className={formLabelClass}>Estação</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger
                                        className={selectTriggerClass}
                                        disabled={!stationsLoaded || arenaStations.length === 0}
                                    >
                                        <SelectValue placeholder="Selecione uma estação..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className={selectContentClass}>
                                    {arenaStations.map((s) => (
                                        <SelectItem key={s.id} value={s.id} className={selectItemClass}>
                                            {s.name}
                                            {s.station_type?.name ? ` · ${s.station_type.name}` : ""}
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

                {stationsLoaded && arenaStations.length === 0 && (
                    <p className="text-sm leading-relaxed text-amber-800">
                        Não há estações com tipo configurado nesta arena. Cadastre uma estação em Estações antes de
                        incluir produtos no catálogo.
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
                        disabled={isSubmitting || !stationsLoaded || arenaStations.length === 0}
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
        "Informe nome, tipo de item, estação e preço. O estoque é atualizado apenas por lançamentos de entrada."

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
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
