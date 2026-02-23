"use client"

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Users, Search, Plus, MoreVertical, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserSync } from "@/hooks/useUserSync";
import { ArenaService } from "@/modules/arenas/services/arenaService";
import { toast } from "sonner";
import { UserFormModal } from "@/modules/users/components/UserFormModal";
import { getArenaUsersAction, createArenaUserAction, updateArenaUserAction, deleteArenaUserAction } from "@/modules/users/actions/userActions";

type SelectedUser = {
    arenaUserId: string;
    id: string; // user table id
    name: string;
    email: string;
    role: string;
    status: string;
    clerkUserId: string;
};

export default function UsersCRUDPage() {
    const params = useParams();
    const router = useRouter();
    const arenaId = params.arenaId as string;
    const { dbUser, isLoading: authLoading } = useUserSync();

    const [arena, setArena] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Create/Edit Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

    // Delete Modal
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<SelectedUser | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [users, setUsers] = useState<SelectedUser[]>([]);

    const fetchUsers = useCallback(async () => {
        if (!arenaId) return;
        const res = await getArenaUsersAction(arenaId);
        if (res.success && res.data) {
            setUsers(res.data);
        } else {
            toast.error("Erro ao carregar usuários: " + res.error);
        }
    }, [arenaId]);

    useEffect(() => {
        async function fetchArena() {
            if (!arenaId) return;

            try {
                const fetchedArena = await ArenaService.getArenaById(arenaId);
                if (fetchedArena) {
                    setArena(fetchedArena);
                } else {
                    toast.error("Arena não encontrada");
                    router.push("/dashboard/settings/users");
                }
            } catch (error) {
                console.error("Error fetching arena:", error);
                toast.error("Erro ao carregar dados da arena");
            } finally {
                setIsLoading(false);
            }
        }

        fetchArena();
        fetchUsers();
    }, [arenaId, router, fetchUsers]);


    const handleAddUser = () => {
        setSelectedUser(null);
        setIsModalOpen(true);
    };

    const handleEditUser = (user: SelectedUser) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const handleOptionsDelete = (user: SelectedUser) => {
        setUserToDelete(user);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);
        try {
            const res = await deleteArenaUserAction(arenaId, userToDelete.arenaUserId, userToDelete.id);
            if (res.success) {
                toast.success("Usuário excluído com sucesso!");
                fetchUsers();
                setIsDeleteModalOpen(false);
                setUserToDelete(null);
            } else {
                toast.error(res.error || "Erro ao excluir usuário");
            }
        } catch (error) {
            toast.error("Erro ao excluir usuário");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSaveUser = async (userData: any) => {
        let res;
        if (selectedUser) {
            res = await updateArenaUserAction(arenaId, selectedUser.arenaUserId, selectedUser.id, userData);
        } else {
            res = await createArenaUserAction(arenaId, userData);
        }

        if (res.success) {
            toast.success(selectedUser ? "Usuário atualizado com sucesso!" : "Usuário cadastrado com sucesso!");
            setIsModalOpen(false);
            fetchUsers();
        } else {
            toast.error(res.error || "Erro ao salvar usuário");
        }
    };

    const filteredUsers = users.filter((user) =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading || authLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-[200px] mb-4" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="h-8 w-8 text-primary" />
                        Usuários
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Gerencie os usuários e permissões da arena {arena?.name ? <span className="font-semibold">{arena.name}</span> : ""}
                    </p>
                </div>

                <Button onClick={handleAddUser} className="bg-[#FF6B00] hover:bg-[#E66000]">
                    <Plus className="mr-2 h-4 w-4" />
                    Cadastrar Usuário
                </Button>
            </div>

            <Card className="border-border">
                <CardContent className="p-0">
                    <div className="p-4 border-b border-border flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nome ou e-mail..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[300px]">Nome</TableHead>
                                    <TableHead>E-mail</TableHead>
                                    <TableHead>Perfil</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Nenhum usuário encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="font-medium">{user.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{user.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal text-muted-foreground border-slate-700">
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className={user.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'}
                                                >
                                                    {user.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[160px] bg-[#001D2D] border-slate-700">
                                                        <DropdownMenuItem
                                                            onClick={() => handleEditUser(user)}
                                                            className="text-white hover:bg-white/10 cursor-pointer"
                                                        >
                                                            <Edit className="h-4 w-4 mr-2" />
                                                            Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleOptionsDelete(user)}
                                                            className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer focus:text-rose-400 focus:bg-rose-500/10"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
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
                </CardContent>
            </Card>

            {/* Modal de Cadastro / Edição */}
            <UserFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={selectedUser}
                onSave={handleSaveUser}
            />

            {/* Modal de Exclusão */}
            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent className="sm:max-w-[425px] bg-white border-slate-200 p-6 rounded-3xl shadow-xl">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-[#002B40] text-2xl font-semibold">Excluir usuário</DialogTitle>
                    </DialogHeader>

                    <div className="text-slate-600 mb-8 whitespace-pre-wrap">
                        Tem certeza que deseja excluir este usuário? A exclusão é{'\n'}
                        permanente e todos os seus dados serão removidos. Essa ação não{'\n'}
                        pode ser desfeita.
                    </div>

                    <div className="flex justify-end gap-3 font-semibold">
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteModalOpen(false)}
                            disabled={isDeleting}
                            className="bg-white border-[#002B40] text-[#002B40] hover:bg-slate-50 px-8 rounded-lg"
                        >
                            Fechar
                        </Button>
                        <Button
                            onClick={confirmDeleteUser}
                            disabled={isDeleting}
                            className="bg-[#FF6B00] hover:bg-[#E66000] text-white px-8 rounded-lg border-0"
                        >
                            Excluir
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
