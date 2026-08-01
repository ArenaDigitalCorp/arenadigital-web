"use client"

import { useMemo, useRef, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowRight, Loader2, TrendingUp } from "lucide-react"
import { bulkAdjustPricesAction } from "@/modules/products/actions/priceActions"
import {
    computeAdjustedPrice,
    normalizeCatalogStatus,
    type PriceAdjustmentType,
    type PriceRoundingMode,
    type Product,
    type ProductCategory,
    type ProductCategoryKind,
} from "@/modules/products/types/product.types"
import { cn } from "@/lib/utils"

interface BulkPriceAdjustModalProps {
    arenaId: string
    kind: ProductCategoryKind
    open: boolean
    onOpenChange: (open: boolean) => void
    categories: ProductCategory[]
    products: Product[]
    onSuccess: () => void
}

const ROUNDING_OPTIONS: Array<{ value: PriceRoundingMode; label: string }> = [
    { value: "exact", label: "Sem arredondamento (2 casas)" },
    { value: "end00", label: "Terminação ,00" },
    { value: "end50", label: "Terminação ,50" },
    { value: "end90", label: "Terminação ,90" },
]

const selectTriggerClass =
    "h-10 w-full rounded-lg bg-white border-slate-300 text-sm text-arena-navy-800 shadow-none focus-visible:ring-1 focus-visible:ring-[#20B2AA]"

const inputClass =
    "h-10 rounded-lg bg-white border-slate-300 text-slate-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#20B2AA]"

const labelClass = "text-sm font-medium text-arena-navy-800"

function formatBRL(n: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
}

export function BulkPriceAdjustModal({
    arenaId,
    kind,
    open,
    onOpenChange,
    categories,
    products,
    onSuccess,
}: BulkPriceAdjustModalProps) {
    const [step, setStep] = useState<"config" | "preview">("config")
    const [categoryId, setCategoryId] = useState("")
    const [adjustmentType, setAdjustmentType] = useState<PriceAdjustmentType>("percent")
    const [amountInput, setAmountInput] = useState("")
    const [rounding, setRounding] = useState<PriceRoundingMode>("exact")
    const [includeInactive, setIncludeInactive] = useState(false)
    const [reason, setReason] = useState("")
    const [isApplying, setIsApplying] = useState(false)
    const batchOperation = useRef<{ id: string; payload: string } | null>(null)

    const kindCategories = useMemo(
        () => categories.filter((c) => c.kind === kind && c.active),
        [categories, kind]
    )

    const amount = Number(amountInput.replace(",", "."))

    const targetProducts = useMemo(() => {
        if (!categoryId) return []
        return products.filter((p) => {
            if (p.category_id !== categoryId) return false
            if (includeInactive) return true
            return normalizeCatalogStatus(p.status) === "Ativo"
        })
    }, [products, categoryId, includeInactive])

    const preview = useMemo(() => {
        if (!Number.isFinite(amount) || amount === 0) return []
        return targetProducts.map((p) => ({
            id: p.id,
            name: p.name,
            oldPrice: p.price,
            newPrice: computeAdjustedPrice(p.price, adjustmentType, amount, rounding),
        }))
    }, [targetProducts, adjustmentType, amount, rounding])

    const changedCount = preview.filter((p) => p.newPrice !== p.oldPrice).length

    const resetAndClose = (open: boolean) => {
        onOpenChange(open)
        if (!open) {
            batchOperation.current = null
            setStep("config")
            setCategoryId("")
            setAdjustmentType("percent")
            setAmountInput("")
            setRounding("exact")
            setIncludeInactive(false)
            setReason("")
        }
    }

    const goToPreview = () => {
        if (!categoryId) {
            toast.error("Selecione uma categoria")
            return
        }
        if (!Number.isFinite(amount) || amount === 0) {
            toast.error("Informe um valor de reajuste diferente de zero")
            return
        }
        if (adjustmentType === "percent" && amount <= -100) {
            toast.error("Reajuste percentual deve ser maior que -100%")
            return
        }
        if (targetProducts.length === 0) {
            toast.error("Nenhum item encontrado nesta categoria com os filtros escolhidos")
            return
        }
        setStep("preview")
    }

    const applyAdjustment = async () => {
        setIsApplying(true)
        try {
            const payload = JSON.stringify({
                arenaId,
                categoryId,
                adjustmentType,
                amount,
                rounding,
                includeInactive,
                reason: reason.trim() || null,
            })
            if (batchOperation.current?.payload !== payload) {
                batchOperation.current = { id: crypto.randomUUID(), payload }
            }
            const res = await bulkAdjustPricesAction(arenaId, {
                batch_id: batchOperation.current.id,
                category_id: categoryId,
                adjustment_type: adjustmentType,
                amount,
                rounding,
                include_inactive: includeInactive,
                reason: reason || undefined,
            })
            if (!res.success || !res.data) throw new Error(res.error ?? "Erro ao aplicar reajuste")
            toast.success(
                `Reajuste aplicado em ${res.data.adjustedCount} ite${res.data.adjustedCount === 1 ? "m" : "ns"}`
            )
            onSuccess()
            resetAndClose(false)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao aplicar reajuste")
        } finally {
            setIsApplying(false)
        }
    }

    const categoryName = kindCategories.find((c) => c.id === categoryId)?.name ?? ""

    return (
        <Dialog open={open} onOpenChange={(o) => !isApplying && resetAndClose(o)}>
            <DialogContent className="max-w-[calc(100%-2rem)] gap-0 rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-xl sm:max-w-[620px] sm:p-7 [&_[data-slot=dialog-close]]:text-[#0D3B45] [&_[data-slot=dialog-close]]:opacity-100">
                <DialogHeader className="mb-4 space-y-2 text-left">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-[#0D3B45] sm:text-2xl">
                        <TrendingUp className="h-5 w-5 text-[#20B2AA]" />
                        Reajustar preços em massa
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed text-slate-600">
                        {step === "config"
                            ? "Escolha a categoria e o reajuste. Você verá um resumo com todos os novos preços antes de confirmar."
                            : `Confira os novos preços de ${categoryName} antes de aplicar. Nada é alterado até você confirmar.`}
                    </DialogDescription>
                </DialogHeader>

                {step === "config" ? (
                    <div className="flex flex-col gap-5">
                        <div className="space-y-1.5">
                            <Label className={labelClass}>Categoria</Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger className={selectTriggerClass}>
                                    <SelectValue placeholder="Selecione a categoria..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {kindCategories.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {kindCategories.length === 0 && (
                                <p className="text-xs text-amber-700">
                                    Nenhuma categoria ativa cadastrada. Crie categorias em &quot;Gerenciar categorias&quot;.
                                </p>
                            )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label className={labelClass}>Tipo de reajuste</Label>
                                <Select
                                    value={adjustmentType}
                                    onValueChange={(v) => setAdjustmentType(v as PriceAdjustmentType)}
                                >
                                    <SelectTrigger className={selectTriggerClass}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percent">Percentual (%)</SelectItem>
                                        <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className={labelClass}>
                                    {adjustmentType === "percent" ? "Percentual (ex.: 10 ou -5)" : "Valor (ex.: 1,00 ou -0,50)"}
                                </Label>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder={adjustmentType === "percent" ? "10" : "1,00"}
                                    className={inputClass}
                                    value={amountInput}
                                    onChange={(e) => setAmountInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className={labelClass}>Arredondamento</Label>
                            <Select value={rounding} onValueChange={(v) => setRounding(v as PriceRoundingMode)}>
                                <SelectTrigger className={selectTriggerClass}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROUNDING_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className={labelClass}>Motivo (opcional)</Label>
                            <Input
                                placeholder="Ex.: reajuste de fornecedor"
                                className={inputClass}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        <label className="flex cursor-pointer items-center gap-2 text-sm text-arena-navy-800">
                            <Checkbox
                                checked={includeInactive}
                                onCheckedChange={(checked) => setIncludeInactive(checked === true)}
                            />
                            Incluir itens inativos
                        </label>

                        <div className="flex flex-row gap-3 pt-1">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 flex-1 rounded-lg border-[#0D3B45] bg-white font-semibold text-[#0D3B45] shadow-none hover:bg-slate-50"
                                onClick={() => resetAndClose(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                className="h-11 flex-1 rounded-lg bg-arena-button font-semibold text-white shadow-none hover:bg-arena-button-hover"
                                onClick={goToPreview}
                            >
                                Ver resumo
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-arena-navy-800">
                            <span className="font-semibold">{categoryName}</span>
                            {" — "}
                            {adjustmentType === "percent"
                                ? `${amount > 0 ? "+" : ""}${amount}%`
                                : `${amount > 0 ? "+" : ""}${formatBRL(amount)}`}
                            {" · "}
                            {ROUNDING_OPTIONS.find((o) => o.value === rounding)?.label}
                            {" · "}
                            <span className="font-semibold">{changedCount}</span> de {preview.length}{" "}
                            {preview.length === 1 ? "item" : "itens"} com preço alterado
                        </div>

                        <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-slate-200">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-50">
                                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                        <th className="px-4 py-2.5">Item</th>
                                        <th className="px-4 py-2.5 text-right">Preço atual</th>
                                        <th className="px-4 py-2.5 text-right">Novo preço</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map((p) => {
                                        const changed = p.newPrice !== p.oldPrice
                                        return (
                                            <tr key={p.id} className="border-t border-slate-100">
                                                <td className="px-4 py-2.5 font-medium text-arena-navy-800">{p.name}</td>
                                                <td className="px-4 py-2.5 text-right text-arena-navy-800/60">
                                                    {formatBRL(p.oldPrice)}
                                                </td>
                                                <td
                                                    className={cn(
                                                        "px-4 py-2.5 text-right font-bold",
                                                        !changed
                                                            ? "text-arena-navy-800/40"
                                                            : p.newPrice > p.oldPrice
                                                              ? "text-emerald-600"
                                                              : "text-red-600"
                                                    )}
                                                >
                                                    {formatBRL(p.newPrice)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-row gap-3 pt-1">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 flex-1 rounded-lg border-[#0D3B45] bg-white font-semibold text-[#0D3B45] shadow-none hover:bg-slate-50"
                                disabled={isApplying}
                                onClick={() => setStep("config")}
                            >
                                Voltar
                            </Button>
                            <Button
                                type="button"
                                className="h-11 flex-1 rounded-lg bg-arena-button font-semibold text-white shadow-none hover:bg-arena-button-hover"
                                disabled={isApplying || changedCount === 0}
                                onClick={applyAdjustment}
                            >
                                {isApplying ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    `Aplicar em ${changedCount} ite${changedCount === 1 ? "m" : "ns"}`
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
