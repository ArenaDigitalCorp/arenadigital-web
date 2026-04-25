"use client"

import { useState, useCallback } from "react";
import { Users, Search, Plus, MoreVertical, Edit, Trash2, Crown, UserCog, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserFormModal } from "@/modules/users/components/UserFormModal";
import { getArenaUsersAction, createArenaUserAction, updateArenaUserAction, deleteArenaUserAction } from "@/modules/users/actions/userActions";

type SelectedUser = {
    arenaUserId: string;
    id: string;
    name: string;
    email: string;
    role: string;
    stationId: string | null;
    status: string;
    clerkUserId: string;
};

type StationOption = {
    id: string;
    name: string;
};

type UserFormData = {
    email: string;
    login?: string;
    name: string;
    password?: string;
    role: string;
    stationId?: string | null;
    senha?: string;
    status: string;
};

interface Props {
    arenaId: string;
    arenaName: string;
    initialUsers: SelectedUser[];
    stations: StationOption[];
}

export function UsersPageClient({ arenaId, arenaName, initialUsers, stations }: Props) {
    const [users, setUsers] = useState<SelectedUser[]>(initialUsers);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<SelectedUser | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const refreshUsers = useCallback(async () => {
        const res = await getArenaUsersAction(arenaId);
        if (res.success) setUsers(res.data ?? []);
    }, [arenaId]);

    const handleSaveUser = async (userData: UserFormData) => {
        let res;
        if (selectedUser) {
            res = await updateArenaUserAction(arenaId, selectedUser.arenaUserId, selectedUser.id, userData);
        } else {
            res = await createArenaUserAction(arenaId, userData);
        }
        if (res.success) {
            toast.success(selectedUser ? "Usuário atualizado com sucesso!" : "Usuário cadastrado com sucesso!");
            setIsModalOpen(false);
            refreshUsers();
        } else {
            toast.error(res.error || "Erro ao salvar usuário");
        }
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);
        try {
            const res = await deleteArenaUserAction(arenaId, userToDelete.arenaUserId, userToDelete.id);
            if (res.success) {
                toast.success("Usuário excluído com sucesso!");
                setUsers(prev => prev.filter(u => u.arenaUserId !== userToDelete.arenaUserId));
                setIsDeleteModalOpen(false);
                setUserToDelete(null);
            } else {
                toast.error(res.error || "Erro ao excluir usuário");
            }
        } catch {
            toast.error("Erro ao excluir usuário");
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredUsers = users.filter((u) =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="h-8 w-8 text-primary" />
                        Usuários
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Gerencie os usuários e permissões da arena <span className="font-semibold">{arenaName}</span>
                    </p>
                </div>
                <Button onClick={() => { setSelectedUser(null); setIsModalOpen(true); }} className="bg-[#FF6B00] hover:bg-[#E66000]">
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
                                                        <DropdownMenuItem onClick={() => { setSelectedUser(user); setIsModalOpen(true); }} className="text-white hover:bg-white/10 cursor-pointer">
                                                            <Edit className="h-4 w-4 mr-2" />
                                                            Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => { setUserToDelete(user); setIsDeleteModalOpen(true); }} className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer focus:text-rose-400 focus:bg-rose-500/10">
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

            <div className="space-y-4">
                <div>
                    <h3 className="text-base font-semibold">Conheça os perfis</h3>
                    <p className="text-sm text-muted-foreground">Entenda as permissões de cada tipo de usuário</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="border-border">
                        <CardContent className="p-5 flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[#FF6B00]/10">
                                    <Crown className="h-5 w-5 text-[#FF6B00]" />
                                </div>
                                <span className="font-semibold text-sm">Administrador</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Perfil que possui acesso a todas as ferramentas da plataforma.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-border">
                        <CardContent className="p-5 flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/10">
                                    <UserCog className="h-5 w-5 text-blue-500" />
                                </div>
                                <span className="font-semibold text-sm">Usuário Comum</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Possui acesso a todas as ferramentas da plataforma, porém não pode cadastrar novos usuários.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-border">
                        <CardContent className="p-5 flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-500/10">
                                    <Store className="h-5 w-5 text-emerald-500" />
                                </div>
                                <span className="font-semibold text-sm">Caixa</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Usuário que irá ter acesso somente à área de estações cadastradas.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <UserFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={selectedUser}
                stations={stations}
                onSave={handleSaveUser}
            />

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
                        <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={isDeleting} className="bg-white border-[#002B40] text-[#002B40] hover:bg-slate-50 px-8 rounded-lg">
                            Fechar
                        </Button>
                        <Button onClick={confirmDeleteUser} disabled={isDeleting} className="bg-[#FF6B00] hover:bg-[#E66000] text-white px-8 rounded-lg border-0">
                            Excluir
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
