"use client"

import { useMemo, useState } from "react"
import { Minus, Plus, Search, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type BookingServiceLineLocal = {
    productId: string
    quantity: number
    unitPrice: number
    name: string
}

export type CatalogServiceOption = {
    id: string
    name: string
    price: number
    /** Quando informado, exibe “N em estoque” e limita quantidade ao estoque. */
    stockQuantity?: number
}

interface BookingServicesSectionProps {
    catalogServices: CatalogServiceOption[]
    lines: BookingServiceLineLocal[]
    onLinesChange: (next: BookingServiceLineLocal[]) => void
    disabled?: boolean
    className?: string
    /** Sem título/descrição externos (ex.: dentro do painel do modal de reserva). */
    compact?: boolean
}

function fmtBrl(n: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
}

function QtyStepper({
    value,
    min,
    max,
    disabled,
    onChange,
}: {
    value: number
    min: number
    max: number
    disabled?: boolean
    onChange: (next: number) => void
}) {
    return (
        <div className="flex h-10 shrink-0 items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <button
                type="button"
                disabled={disabled || value <= min}
                onClick={() => onChange(value - 1)}
                className="flex w-10 items-center justify-center text-arena-navy-800 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-35"
                aria-label="Diminuir quantidade"
            >
                <Minus className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <span className="flex min-w-[2.5rem] items-center justify-center border-x border-slate-200 text-sm font-black tabular-nums text-arena-navy-800">
                {value}
            </span>
            <button
                type="button"
                disabled={disabled || value >= max}
                onClick={() => onChange(value + 1)}
                className="flex w-10 items-center justify-center text-arena-navy-800 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-35"
                aria-label="Aumentar quantidade"
            >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
        </div>
    )
}

function CompactCatalogPanel({
    catalogServices,
    lines,
    onLinesChange,
    disabled = false,
}: Pick<BookingServicesSectionProps, "catalogServices" | "lines" | "onLinesChange" | "disabled">) {
    const [query, setQuery] = useState("")

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return catalogServices
        return catalogServices.filter((s) => s.name.toLowerCase().includes(q))
    }, [catalogServices, query])

    const qtyFor = (id: string) => lines.find((l) => l.productId === id)?.quantity ?? 0

    const maxQtyFor = (p: CatalogServiceOption) => {
        if (typeof p.stockQuantity === "number" && p.stockQuantity >= 0) {
            return p.stockQuantity
        }
        return 999
    }

    const setQtyFor = (p: CatalogServiceOption, nextQty: number) => {
        const cap = maxQtyFor(p)
        const q = Math.max(0, Math.min(Math.floor(nextQty), cap))
        if (q === 0) {
            onLinesChange(lines.filter((l) => l.productId !== p.id))
            return
        }
        const existing = lines.find((l) => l.productId === p.id)
        if (existing) {
            onLinesChange(lines.map((l) => (l.productId === p.id ? { ...l, quantity: q } : l)))
        } else {
            onLinesChange([
                ...lines,
                {
                    productId: p.id,
                    quantity: q,
                    unitPrice: p.price,
                    name: p.name,
                },
            ])
        }
    }

    if (catalogServices.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-arena-navy-800/50">
                Nenhum serviço cadastrado no catálogo desta arena.
            </div>
        )
    }

    return (
        <div className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-100 p-4">
            <h3 className="text-sm font-bold text-arena-navy-800">Itens do pedido</h3>
            <div className="relative">
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por item"
                    disabled={disabled}
                    className="h-11 rounded-lg border-slate-200 bg-white pr-10 text-sm font-medium text-arena-navy-800 placeholder:text-arena-navy-800/35"
                />
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-navy-800/30" />
            </div>
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
                {filtered.length === 0 ? (
                    <li className="rounded-lg bg-white/80 px-3 py-4 text-center text-xs text-arena-navy-800/45">
                        Nenhum item encontrado.
                    </li>
                ) : (
                    filtered.map((p) => {
                        const qty = qtyFor(p.id)
                        const maxQ = maxQtyFor(p)
                        const stock = p.stockQuantity
                        const showStock = typeof stock === "number" && stock >= 0
                        return (
                            <li
                                key={p.id}
                                className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-3 shadow-sm"
                            >
                                <div className="min-w-0 flex-1 space-y-0.5">
                                    <p className="text-sm font-bold leading-tight text-arena-navy-800">{p.name}</p>
                                    <p className="text-xs font-semibold text-arena-navy-800/50">{fmtBrl(p.price)}</p>
                                    {showStock && (
                                        <p
                                            className={cn(
                                                "text-xs font-bold",
                                                stock > 0 ? "text-emerald-600" : "text-red-600"
                                            )}
                                        >
                                            {stock} em estoque
                                        </p>
                                    )}
                                </div>
                                <QtyStepper
                                    value={qty}
                                    min={0}
                                    max={maxQ}
                                    disabled={disabled}
                                    onChange={(v) => setQtyFor(p, v)}
                                />
                            </li>
                        )
                    })
                )}
            </ul>
        </div>
    )
}

export function BookingServicesSection({
    catalogServices,
    lines,
    onLinesChange,
    disabled = false,
    className,
    compact = false,
}: BookingServicesSectionProps) {
    const [pickId, setPickId] = useState<string>("")

    const availableToAdd = useMemo(() => {
        return catalogServices.filter((s) => !lines.some((l) => l.productId === s.id))
    }, [catalogServices, lines])

    const addSelected = () => {
        if (!pickId || disabled) return
        const p = catalogServices.find((x) => x.id === pickId)
        if (!p) return
        onLinesChange([
            ...lines,
            {
                productId: p.id,
                quantity: 1,
                unitPrice: p.price,
                name: p.name,
            },
        ])
        setPickId("")
    }

    const updateQty = (productId: string, qty: number) => {
        const q = Math.max(1, Math.floor(qty) || 1)
        onLinesChange(lines.map((l) => (l.productId === productId ? { ...l, quantity: q } : l)))
    }

    const removeLine = (productId: string) => {
        onLinesChange(lines.filter((l) => l.productId !== productId))
    }

    if (compact) {
        return (
            <div className={cn(className)}>
                <CompactCatalogPanel
                    catalogServices={catalogServices}
                    lines={lines}
                    onLinesChange={onLinesChange}
                    disabled={disabled}
                />
            </div>
        )
    }

    return (
        <div className={cn("space-y-3", className)}>
            <Label className="text-xs font-bold uppercase tracking-wider text-arena-navy-800/40">
                Serviços adicionais
            </Label>
            <p className="text-[11px] font-medium leading-snug text-arena-navy-800/50">
                Inclua cobranças do catálogo (ex.: aluguel de equipamento). O total da reserva soma locação + serviços.
            </p>

            {lines.length > 0 && (
                <ul className="space-y-2 rounded-xl border border-arena-navy-800/10 bg-slate-50/80 p-3">
                    {lines.map((l) => (
                        <li
                            key={l.productId}
                            className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm"
                        >
                            <span className="min-w-0 flex-1 text-sm font-bold text-arena-navy-800">{l.name}</span>
                            <span className="text-xs font-semibold text-arena-navy-800/50">{fmtBrl(l.unitPrice)} un.</span>
                            <div className="flex items-center gap-1.5">
                                <Input
                                    type="number"
                                    min={1}
                                    value={l.quantity}
                                    disabled={disabled}
                                    onChange={(e) => updateQty(l.productId, Number(e.target.value))}
                                    className="h-9 w-14 border-arena-navy-800/10 text-center text-sm font-bold text-arena-navy-800"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={disabled}
                                    className="h-9 w-9 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                                    onClick={() => removeLine(l.productId)}
                                    aria-label={`Remover ${l.name}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {availableToAdd.length > 0 ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select value={pickId} onValueChange={setPickId} disabled={disabled}>
                        <SelectTrigger className="h-12 flex-1 rounded-xl border-arena-navy-800/10 font-semibold text-arena-navy-800 focus:border-arena-button focus:ring-arena-button">
                            <SelectValue placeholder="Selecione um serviço…" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-arena-navy-800/10 p-2">
                            {availableToAdd.map((s) => (
                                <SelectItem
                                    key={s.id}
                                    value={s.id}
                                    className="rounded-xl py-2.5 font-semibold text-arena-navy-800"
                                >
                                    {s.name} — {fmtBrl(s.price)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={disabled || !pickId}
                        onClick={addSelected}
                        className="h-12 shrink-0 border-arena-navy-800/20 font-semibold text-arena-navy-800 hover:bg-slate-50 sm:px-6"
                    >
                        <Plus className="mr-1.5 h-4 w-4" />
                        Incluir
                    </Button>
                </div>
            ) : catalogServices.length === 0 ? (
                <p className="rounded-xl border border-dashed border-arena-navy-800/15 bg-slate-50 px-3 py-2 text-xs text-arena-navy-800/50">
                    Nenhum serviço cadastrado no catálogo desta arena.
                </p>
            ) : lines.length > 0 ? null : (
                <p className="text-xs text-arena-navy-800/40">Todos os serviços disponíveis já foram incluídos.</p>
            )}
        </div>
    )
}

export function sumBookingServiceLines(lines: BookingServiceLineLocal[]): number {
    return lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0)
}
