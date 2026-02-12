"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Search, MoreHorizontal, Edit, Trash, ArrowLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ProductService, Product } from "@/modules/products/services/productService"
import { ArenaService } from "@/modules/arenas/services/arenaService"
import { ProductFormModal } from "@/modules/products/components/ProductFormModal"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export default function ArenaProductsPage() {
    const params = useParams()
    const router = useRouter()
    const arenaId = params.id as string

    const [arena, setArena] = useState<any>(null)
    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)

    // Load arena and products
    useEffect(() => {
        if (!arenaId) return

        async function loadData() {
            try {
                setIsLoading(true)

                // Fetch Arena Details
                const arenaData = await ArenaService.getArenaById(arenaId)
                setArena(arenaData)

                // Fetch Products
                const productsData = await ProductService.getProductsByArena(arenaId)
                setProducts(productsData)
            } catch (error) {
                console.error("Failed to load data", error)
                toast.error("Erro ao carregar dados")
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [arenaId])

    const handleCreate = () => {
        setEditingProduct(null)
        setIsModalOpen(true)
    }

    const handleEdit = (product: Product) => {
        setEditingProduct(product)
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este produto?")) return

        try {
            await ProductService.deleteProduct(id)
            setProducts(products.filter(p => p.id !== id))
            toast.success("Produto excluído com sucesso")
        } catch (error) {
            console.error("Failed to delete product", error)
            toast.error("Erro ao excluir produto")
        }
    }

    const handleSuccess = () => {
        // Reload products
        ProductService.getProductsByArena(arenaId).then(setProducts)
    }

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.item_type.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6 container mx-auto py-6">
            <div className="flex flex-col gap-4">
                <Button
                    variant="ghost"
                    className="w-fit -ml-4 text-muted-foreground hover:text-foreground"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para Arenas
                </Button>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Produtos</h2>
                        <p className="text-muted-foreground">
                            {arena ? `Gerenciando produtos da arena: ${arena.name}` : 'Carregando...'}
                        </p>
                    </div>

                    <Button onClick={handleCreate} className="bg-[#FF6B00] hover:bg-[#E66000] text-white">
                        <Plus className="mr-2 h-4 w-4" />
                        Cadastrar Produto
                    </Button>
                </div>
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
                            <TableHead>Status</TableHead>
                            <TableHead>Criado em</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    Carregando...
                                </TableCell>
                            </TableRow>
                        ) : filteredProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    Nenhum produto encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProducts.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{product.item_type}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {product.station_type?.name || 'N/A'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL'
                                        }).format(product.price)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={product.status === 'Em estoque' ? 'default' : 'destructive'}
                                            className={product.status === 'Em estoque' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                                        >
                                            {product.status}
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
                                                <DropdownMenuItem onClick={() => handleEdit(product)}>
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
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <ProductFormModal
                arenaId={arenaId}
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                product={editingProduct}
                onSuccess={handleSuccess}
            />
        </div>
    )
}
