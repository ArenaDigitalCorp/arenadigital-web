"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Plus, Search, MoreHorizontal, Edit, Trash, PackagePlus, History } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { getProductsByArenaAction, deleteProductAction } from "@/modules/products/actions/stockActions"
import type { Product } from "@/modules/products/types/product.types"
import { ProductFormModal } from "@/modules/products/components/ProductFormModal"
import { StockEntryModal } from "@/modules/products/components/StockEntryModal"
import { StockHistoryModal } from "@/modules/products/components/StockHistoryModal"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Props {
    arenaId: string
    arenaName: string
    initialProducts: Product[]
}

function getStockStatus(qty: number) {
    return qty <= 0 ? 'Em falta' : 'Em estoque'
}

export function ProductsPageClient({ arenaId, arenaName, initialProducts }: Props) {
    const [products, setProducts] = useState<Product[]>(initialProducts)
    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [stockEntryProduct, setStockEntryProduct] = useState<Product | null>(null)
    const [isStockEntryOpen, setIsStockEntryOpen] = useState(false)
    const [stockHistoryProduct, setStockHistoryProduct] = useState<Product | null>(null)
    const [isStockHistoryOpen, setIsStockHistoryOpen] = useState(false)

    const refreshProducts = () => {
        getProductsByArenaAction(arenaId).then(res => setProducts(res.data ?? []))
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este produto?")) return
        try {
            await deleteProductAction(arenaId, id)
            setProducts(prev => prev.filter(p => p.id !== id))
            toast.success("Produto excluído com sucesso")
        } catch {
            toast.error("Erro ao excluir produto")
        }
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.item_type.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Produtos</h2>
                    <p className="text-muted-foreground">
                        Gerenciando produtos da arena: <span className="font-semibold">{arenaName}</span>
                    </p>
                </div>
                <Button onClick={() => { setEditingProduct(null); setIsModalOpen(true) }} className="bg-[#FF6B00] hover:bg-[#E66000] text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Cadastrar Produto
                </Button>
            </div>

            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar produtos..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Tipo de Item</TableHead>
                            <TableHead>Tipo de Estação</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Estoque</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Criado em</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    Nenhum produto encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProducts.map((product) => {
                                const stockStatus = getStockStatus(product.stock_quantity)
                                return (
                                    <TableRow key={product.id}>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell>{product.item_type}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {product.station_type?.name || 'N/A'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`font-bold text-lg ${product.stock_quantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {product.stock_quantity}
                                            </span>
                                            <span className="text-muted-foreground text-xs ml-1">un.</span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={stockStatus === 'Em estoque' ? 'default' : 'destructive'}
                                                className={stockStatus === 'Em estoque' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                                            >
                                                {stockStatus}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {format(new Date(product.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Abrir menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => { setStockEntryProduct(product); setIsStockEntryOpen(true) }}>
                                                        <PackagePlus className="mr-2 h-4 w-4 text-emerald-500" />
                                                        Lançar Entrada
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => { setStockHistoryProduct(product); setIsStockHistoryOpen(true) }}>
                                                        <History className="mr-2 h-4 w-4 text-blue-500" />
                                                        Ver Movimentações
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => { setEditingProduct(product); setIsModalOpen(true) }}>
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleDelete(product.id)}
                                                        className="text-red-600 focus:text-red-600"
                                                    >
                                                        <Trash className="mr-2 h-4 w-4" />
                                                        Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <ProductFormModal
                arenaId={arenaId}
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                product={editingProduct}
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
