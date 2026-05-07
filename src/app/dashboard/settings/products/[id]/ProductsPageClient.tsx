"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Search, MoreHorizontal, Edit, Trash, PackagePlus, History, Filter, Eye } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { DashboardTabs } from "@/components/dashboard/DashboardTabs"
import { toast } from "sonner"
import { getProductsByArenaAction, deleteProductAction } from "@/modules/products/actions/stockActions"
import { isCatalogService, type Product } from "@/modules/products/types/product.types"
import { ProductFormModal } from "@/modules/products/components/ProductFormModal"
import { StockEntryModal } from "@/modules/products/components/StockEntryModal"
import { StockHistoryModal } from "@/modules/products/components/StockHistoryModal"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { arenaDataTable } from "@/lib/arena-data-table"
import { ConfirmActionDialog } from "@/components/dashboard/ConfirmActionDialog"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

const searchInputClass =
    "h-10 w-full rounded-md border-slate-300 pl-3 pr-10 text-sm text-arena-navy-800 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#20B2AA] sm:max-w-[280px] sm:w-[280px]"

const statusSelectTriggerClass =
    "h-10 w-fit min-w-[180px] border-slate-300 text-sm text-arena-navy-800 shadow-none focus-visible:ring-1 focus-visible:ring-[#20B2AA] data-[placeholder]:text-arena-navy-800/60"

type CatalogStatusFilter = "all" | "Em estoque" | "Em falta"

function getStockStatus(qty: number) {
    return qty <= 0 ? "Em falta" : "Em estoque"
}

function getListStatusLabel(p: Product): "Em estoque" | "Em falta" {
    if (isCatalogService(p)) {
        if (p.status === "Em estoque" || p.status === "Em falta") return p.status
        return getStockStatus(p.stock_quantity) as "Em estoque" | "Em falta"
    }
    return getStockStatus(p.stock_quantity) as "Em estoque" | "Em falta"
}

const primaryCtaClass =
    "h-10 shrink-0 rounded-md bg-arena-button px-4 text-sm font-bold text-white shadow-none hover:bg-arena-button-hover"

const detailLabelClass =
    "text-[11px] font-semibold uppercase tracking-wide text-slate-500"

function formatBRL(n: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
}

interface Props {
    arenaId: string
    arenaName: string
    initialProducts: Product[]
}

function CatalogListToolbar({
    searchValue,
    onSearchChange,
    searchPlaceholder,
    statusFilter,
    onStatusFilterChange,
    ctaLabel,
    onCta,
}: {
    searchValue: string
    onSearchChange: (v: string) => void
    searchPlaceholder: string
    statusFilter: CatalogStatusFilter
    onStatusFilterChange: (v: CatalogStatusFilter) => void
    ctaLabel: string
    onCta: () => void
}) {
    return (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-[280px]">
                <Input
                    placeholder={searchPlaceholder}
                    className={searchInputClass}
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 border-0 text-arena-navy-800 shadow-none hover:bg-slate-100"
                    aria-label="Filtros"
                >
                    <Filter className="h-4 w-4" />
                </Button>
                <Select
                    value={statusFilter}
                    onValueChange={(v) => onStatusFilterChange(v as CatalogStatusFilter)}
                >
                    <SelectTrigger className={statusSelectTriggerClass}>
                        <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="Em estoque">Em estoque</SelectItem>
                        <SelectItem value="Em falta">Em falta</SelectItem>
                    </SelectContent>
                </Select>
                <Button type="button" onClick={onCta} className={primaryCtaClass}>
                    <Plus className="mr-2 h-4 w-4" />
                    {ctaLabel}
                </Button>
            </div>
        </div>
    )
}

export function ProductsPageClient({ arenaId, arenaName, initialProducts }: Props) {
    const [products, setProducts] = useState<Product[]>(initialProducts)
    const [searchProducts, setSearchProducts] = useState("")
    const [searchServices, setSearchServices] = useState("")
    const [productStatusFilter, setProductStatusFilter] = useState<CatalogStatusFilter>("all")
    const [serviceStatusFilter, setServiceStatusFilter] = useState<CatalogStatusFilter>("all")
    const [activeTab, setActiveTab] = useState<"products" | "services">("products")

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalCatalogKind, setModalCatalogKind] = useState<"product" | "service">("product")
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)

    const [stockEntryProduct, setStockEntryProduct] = useState<Product | null>(null)
    const [isStockEntryOpen, setIsStockEntryOpen] = useState(false)
    const [stockHistoryProduct, setStockHistoryProduct] = useState<Product | null>(null)
    const [isStockHistoryOpen, setIsStockHistoryOpen] = useState(false)

    const [productPendingDelete, setProductPendingDelete] = useState<Product | null>(null)
    const [isDeletingCatalog, setIsDeletingCatalog] = useState(false)
    const [detailProduct, setDetailProduct] = useState<Product | null>(null)

    const refreshProducts = () => {
        getProductsByArenaAction(arenaId).then((res) => setProducts(res.data ?? []))
    }

    const stockProducts = useMemo(
        () => products.filter((p) => !isCatalogService(p)),
        [products]
    )
    const serviceProducts = useMemo(
        () => products.filter((p) => isCatalogService(p)),
        [products]
    )

    const openCreate = (kind: "product" | "service") => {
        setEditingProduct(null)
        setModalCatalogKind(kind)
        setIsModalOpen(true)
    }

    const openEdit = (p: Product) => {
        setEditingProduct(p)
        setModalCatalogKind(isCatalogService(p) ? "service" : "product")
        setIsModalOpen(true)
    }

    const handleModalOpenChange = (open: boolean) => {
        setIsModalOpen(open)
        if (!open) setEditingProduct(null)
    }

    const confirmDeleteCatalog = async () => {
        if (!productPendingDelete) return
        const p = productPendingDelete
        setIsDeletingCatalog(true)
        try {
            await deleteProductAction(arenaId, p.id)
            setProducts((prev) => prev.filter((x) => x.id !== p.id))
            toast.success(isCatalogService(p) ? "Serviço excluído com sucesso" : "Produto excluído com sucesso")
            setProductPendingDelete(null)
        } catch {
            toast.error("Erro ao excluir")
        } finally {
            setIsDeletingCatalog(false)
        }
    }

    const filteredStock = useMemo(() => {
        return stockProducts.filter((p) => {
            const matchesSearch =
                p.name.toLowerCase().includes(searchProducts.toLowerCase()) ||
                p.item_type.toLowerCase().includes(searchProducts.toLowerCase())
            if (!matchesSearch) return false
            if (productStatusFilter === "all") return true
            return getListStatusLabel(p) === productStatusFilter
        })
    }, [stockProducts, searchProducts, productStatusFilter])

    const filteredServices = useMemo(() => {
        return serviceProducts.filter((p) => {
            if (!p.name.toLowerCase().includes(searchServices.toLowerCase())) return false
            if (serviceStatusFilter === "all") return true
            return getListStatusLabel(p) === serviceStatusFilter
        })
    }, [serviceProducts, searchServices, serviceStatusFilter])

    const actionsTriggerClass =
        "h-8 w-8 text-arena-navy-800/60 bg-[#F1F5F9] hover:bg-[#E2E8F0] hover:text-arena-navy-800"

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black tracking-tight text-arena-navy-800">Catálogo</h1>
                <p className="text-sm font-medium text-arena-navy-800/60">
                    {arenaName ? (
                        <>
                            Arena <span className="font-semibold text-arena-navy-800">{arenaName}</span>
                            {" — "}
                        </>
                    ) : null}
                    Produtos com estoque e serviços cobráveis (ex.: aluguel de equipamento).
                </p>
            </div>

            <DashboardTabs
                value={activeTab}
                onChange={setActiveTab}
                tabs={[
                    { label: "Produtos", value: "products" },
                    { label: "Serviços", value: "services" },
                ]}
            />

            <Card className="rounded-lg border border-slate-100 bg-white px-6 py-6 shadow-sm">
                {activeTab === "products" && (
                    <>
                        <CatalogListToolbar
                            searchValue={searchProducts}
                            onSearchChange={setSearchProducts}
                            searchPlaceholder="Buscar produtos..."
                            statusFilter={productStatusFilter}
                            onStatusFilterChange={setProductStatusFilter}
                            ctaLabel="Cadastrar produto"
                            onCta={() => openCreate("product")}
                        />

                        <div className="overflow-x-auto">
                            <table className={arenaDataTable.table}>
                                <thead>
                                    <tr className={arenaDataTable.theadRow}>
                                        <th className={arenaDataTable.th}>Nome</th>
                                        <th className={arenaDataTable.th}>Tipo de item</th>
                                        <th className={arenaDataTable.th}>Tipo de estação</th>
                                        <th className={arenaDataTable.th}>Valor</th>
                                        <th className={arenaDataTable.th}>Estoque</th>
                                        <th className={arenaDataTable.th}>Status</th>
                                        <th className={arenaDataTable.th}>Criado em</th>
                                        <th className={arenaDataTable.thRight}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStock.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className={arenaDataTable.emptyCell}>
                                                Nenhum produto encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStock.map((product) => {
                                            const stockStatus = getStockStatus(product.stock_quantity)
                                            return (
                                                <tr key={product.id} className={arenaDataTable.tbodyRow}>
                                                    <td className={arenaDataTable.tdBold}>{product.name}</td>
                                                    <td className={arenaDataTable.td}>{product.item_type}</td>
                                                    <td className={arenaDataTable.td}>
                                                        <Badge variant="outline">
                                                            {product.station_type?.name || "N/A"}
                                                        </Badge>
                                                    </td>
                                                    <td className={arenaDataTable.td}>
                                                        {new Intl.NumberFormat("pt-BR", {
                                                            style: "currency",
                                                            currency: "BRL",
                                                        }).format(product.price)}
                                                    </td>
                                                    <td className={arenaDataTable.td}>
                                                        <span
                                                            className={cn(
                                                                "text-lg font-bold",
                                                                product.stock_quantity > 0
                                                                    ? "text-emerald-600"
                                                                    : "text-red-500"
                                                            )}
                                                        >
                                                            {product.stock_quantity}
                                                        </span>
                                                        <span className="ml-1 text-xs text-arena-navy-800/50">un.</span>
                                                    </td>
                                                    <td className={arenaDataTable.td}>
                                                        <Badge
                                                            variant={
                                                                stockStatus === "Em estoque" ? "default" : "destructive"
                                                            }
                                                            className={
                                                                stockStatus === "Em estoque"
                                                                    ? "bg-emerald-500 hover:bg-emerald-600"
                                                                    : ""
                                                            }
                                                        >
                                                            {stockStatus}
                                                        </Badge>
                                                    </td>
                                                    <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                                        {format(new Date(product.created_at), "dd/MM/yyyy HH:mm", {
                                                            locale: ptBR,
                                                        })}
                                                    </td>
                                                    <td className={arenaDataTable.tdRight}>
                                                        <div className="flex items-center justify-end gap-2">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className={actionsTriggerClass}
                                                                    >
                                                                        <span className="sr-only">Abrir menu</span>
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                                    <DropdownMenuItem
                                                                        onClick={() => {
                                                                            setStockEntryProduct(product)
                                                                            setIsStockEntryOpen(true)
                                                                        }}
                                                                    >
                                                                        <PackagePlus className="mr-2 h-4 w-4 text-emerald-500" />
                                                                        Lançar entrada
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        onClick={() => {
                                                                            setStockHistoryProduct(product)
                                                                            setIsStockHistoryOpen(true)
                                                                        }}
                                                                    >
                                                                        <History className="mr-2 h-4 w-4 text-blue-500" />
                                                                        Ver movimentações
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem onClick={() => setDetailProduct(product)}>
                                                                        <Eye className="mr-2 h-4 w-4 text-slate-600" />
                                                                        Ver detalhes
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => openEdit(product)}>
                                                                        <Edit className="mr-2 h-4 w-4" />
                                                                        Editar
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        onClick={() => setProductPendingDelete(product)}
                                                                        className="text-red-600 focus:text-red-600"
                                                                    >
                                                                        <Trash className="mr-2 h-4 w-4" />
                                                                        Excluir
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeTab === "services" && (
                    <>
                        <CatalogListToolbar
                            searchValue={searchServices}
                            onSearchChange={setSearchServices}
                            searchPlaceholder="Buscar serviços..."
                            statusFilter={serviceStatusFilter}
                            onStatusFilterChange={setServiceStatusFilter}
                            ctaLabel="Cadastrar serviço"
                            onCta={() => openCreate("service")}
                        />

                        <div className="overflow-x-auto">
                            <table className={arenaDataTable.table}>
                                <thead>
                                    <tr className={arenaDataTable.theadRow}>
                                        <th className={arenaDataTable.th}>Nome</th>
                                        <th className={arenaDataTable.th}>Tipo de estação</th>
                                        <th className={arenaDataTable.th}>Valor</th>
                                        <th className={arenaDataTable.th}>Criado em</th>
                                        <th className={arenaDataTable.thRight}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredServices.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className={arenaDataTable.emptyCell}>
                                                Nenhum serviço cadastrado. Use &quot;Cadastrar serviço&quot; para incluir
                                                cobranças como aluguel de raquete.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredServices.map((product) => (
                                            <tr key={product.id} className={arenaDataTable.tbodyRow}>
                                                <td className={arenaDataTable.tdBold}>{product.name}</td>
                                                <td className={arenaDataTable.td}>
                                                    <Badge variant="outline">
                                                        {product.station_type?.name || "N/A"}
                                                    </Badge>
                                                </td>
                                                <td className={arenaDataTable.td}>
                                                    {new Intl.NumberFormat("pt-BR", {
                                                        style: "currency",
                                                        currency: "BRL",
                                                    }).format(product.price)}
                                                </td>
                                                <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                                    {format(new Date(product.created_at), "dd/MM/yyyy HH:mm", {
                                                        locale: ptBR,
                                                    })}
                                                </td>
                                                <td className={arenaDataTable.tdRight}>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className={actionsTriggerClass}
                                                                >
                                                                    <span className="sr-only">Abrir menu</span>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                                <DropdownMenuItem onClick={() => setDetailProduct(product)}>
                                                                    <Eye className="mr-2 h-4 w-4 text-slate-600" />
                                                                    Ver detalhes
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => openEdit(product)}>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => setProductPendingDelete(product)}
                                                                    className="text-red-600 focus:text-red-600"
                                                                >
                                                                    <Trash className="mr-2 h-4 w-4" />
                                                                    Excluir
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </Card>

            <Dialog
                open={!!detailProduct}
                onOpenChange={(open) => {
                    if (!open) setDetailProduct(null)
                }}
            >
                <DialogContent
                    showCloseButton
                    className="max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:max-w-lg sm:p-7 [&_[data-slot=dialog-close]]:text-[#0D3B45] [&_[data-slot=dialog-close]]:opacity-100"
                >
                    {detailProduct && (
                        <>
                            <DialogHeader className="text-left">
                                <DialogTitle className="text-xl font-bold text-[#0D3B45]">
                                    {isCatalogService(detailProduct)
                                        ? "Detalhes do serviço"
                                        : "Detalhes do produto"}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="mt-4 space-y-4">
                                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                                    <div className="space-y-1">
                                        <p className={detailLabelClass}>Nome</p>
                                        <p className="text-base font-semibold text-arena-navy-800">
                                            {detailProduct.name}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className={detailLabelClass}>Status</p>
                                        {getListStatusLabel(detailProduct) === "Em estoque" ? (
                                            <Badge className="bg-emerald-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-600">
                                                Ativo
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-red-700">
                                                Em falta
                                            </Badge>
                                        )}
                                    </div>
                                    {!isCatalogService(detailProduct) ? (
                                        <>
                                            <div className="space-y-1">
                                                <p className={detailLabelClass}>Tipo de item</p>
                                                <p className="text-base font-semibold text-arena-navy-800">
                                                    {detailProduct.item_type}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className={detailLabelClass}>Estação</p>
                                                <p className="text-base font-semibold text-arena-navy-800">
                                                    {detailProduct.station_type?.name ?? "—"}
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="space-y-1 sm:col-span-2">
                                            <p className={detailLabelClass}>Estação</p>
                                            <p className="text-base font-semibold text-arena-navy-800">
                                                {detailProduct.station_type?.name ?? "—"}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <hr className="border-slate-200" />
                                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                                    <div className="space-y-1">
                                        <p className={detailLabelClass}>Valor</p>
                                        <p className="text-2xl font-bold text-[#0D3B45]">
                                            {formatBRL(detailProduct.price)}
                                        </p>
                                    </div>
                                    {!isCatalogService(detailProduct) && (
                                        <div className="space-y-1">
                                            <p className={detailLabelClass}>Estoque</p>
                                            <p
                                                className={cn(
                                                    "text-2xl font-bold",
                                                    detailProduct.stock_quantity > 0
                                                        ? "text-emerald-600"
                                                        : "text-red-500"
                                                )}
                                            >
                                                {detailProduct.stock_quantity}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-11 flex-1 rounded-lg border-[#0D3B45] text-[#0D3B45]"
                                    onClick={() => setDetailProduct(null)}
                                >
                                    Fechar
                                </Button>
                                <Button
                                    type="button"
                                    className="h-11 flex-1 rounded-lg bg-arena-button text-white hover:bg-arena-button-hover"
                                    onClick={() => {
                                        const p = detailProduct
                                        setDetailProduct(null)
                                        openEdit(p)
                                    }}
                                >
                                    Editar
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={!!productPendingDelete}
                onOpenChange={(open) => {
                    if (!open && !isDeletingCatalog) setProductPendingDelete(null)
                }}
                title={
                    productPendingDelete && isCatalogService(productPendingDelete)
                        ? "Excluir serviço"
                        : "Excluir produto"
                }
                description="Tem certeza que deseja excluir este item? A exclusão é permanente e todos os seus dados serão removidos. Essa ação não pode ser desfeita."
                confirmLabel="Excluir"
                loadingLabel="Excluindo..."
                loading={isDeletingCatalog}
                onConfirm={confirmDeleteCatalog}
            />

            <ProductFormModal
                arenaId={arenaId}
                open={isModalOpen}
                onOpenChange={handleModalOpenChange}
                product={editingProduct}
                catalogKind={modalCatalogKind}
                onSuccess={refreshProducts}
            />

            {stockEntryProduct && (
                <StockEntryModal
                    arenaId={arenaId}
                    product={stockEntryProduct}
                    open={isStockEntryOpen}
                    onOpenChange={setIsStockEntryOpen}
                    onSuccess={refreshProducts}
                />
            )}

            {stockHistoryProduct && (
                <StockHistoryModal
                    product={stockHistoryProduct}
                    open={isStockHistoryOpen}
                    onOpenChange={setIsStockHistoryOpen}
                />
            )}
        </div>
    )
}
