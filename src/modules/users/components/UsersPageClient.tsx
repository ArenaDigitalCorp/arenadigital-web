"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AccessProfile } from "@/modules/access/types";
import { Users, Search, Plus, MoreVertical, Edit, UserMinus } from "lucide-react";
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
import { createArenaUserAction, updateArenaUserAction, deleteArenaUserAction } from "@/modules/users/actions/userActions";
import { cn } from "@/lib/utils";
import { arenaDataTable } from "@/lib/arena-data-table";

type SelectedUser = {
    arenaUserId: string;
    id: string;
    name: string;
    email: string;
    role: string;
    profileName: string;
    profileId: string;
    editable: boolean;
    stationId: string | null;
    status: string;
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
    profileId: string;
    stationId?: string | null;
    senha?: string;
    status: string;
};

interface Props {
    arenaId: string;
    arenaName: string;
    initialUsers: SelectedUser[];
    stations: StationOption[];
    profiles: AccessProfile[];
    isOwner?: boolean;
    readOnly?: boolean;
}

export function UsersPageClient({ arenaId, arenaName, initialUsers: users, stations, profiles, isOwner, readOnly }: Props) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<SelectedUser | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSaveUser = async (userData: UserFormData) => {
        let res;
        if (selectedUser) {
            res = await updateArenaUserAction(arenaId, selectedUser.arenaUserId, selectedUser.id, userData);
        } else {
            res = await createArenaUserAction(arenaId, userData);
        }
        if (res.success) {
            const reusedCredentials = !selectedUser && res.user?.usesExistingCredentials;
            toast.success(
                selectedUser
                    ? "Usuário atualizado com sucesso!"
                    : reusedCredentials
                        ? "Usuário vinculado. Ele deve entrar com a senha que já possui."
                        : "Usuário cadastrado com sucesso!"
            );
            setIsModalOpen(false);
            router.refresh();
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
                toast.success("Acesso removido desta arena.");
                router.refresh();
                setIsDeleteModalOpen(false);
                setUserToDelete(null);
            } else {
                toast.error(res.error || "Erro ao remover acesso");
            }
        } catch {
            toast.error("Erro ao remover acesso");
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
                <div className="flex flex-wrap gap-2">{isOwner && <Button variant="outline" asChild><Link href={`/dashboard/settings/profiles/${arenaId}`}>Perfis e permissões</Link></Button>}
                <Button disabled={readOnly || !profiles.length} onClick={() => { setSelectedUser(null); setIsModalOpen(true); }} className="bg-arena-button hover:bg-arena-button-hover">
                    <Plus className="mr-2 h-4 w-4" />
                    Cadastrar Usuário
                </Button></div>
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
                        <Table className={arenaDataTable.table}>
                            <TableHeader>
                                <TableRow className={arenaDataTable.theadRow}>
                                    <TableHead className={cn(arenaDataTable.th, "w-[300px]")}>Nome</TableHead>
                                    <TableHead className={arenaDataTable.th}>E-mail</TableHead>
                                    <TableHead className={arenaDataTable.th}>Perfil</TableHead>
                                    <TableHead className={arenaDataTable.th}>Status</TableHead>
                                    <TableHead className={arenaDataTable.thRight}>Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className={arenaDataTable.emptyCell}>
                                            Nenhum usuário encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow key={user.id} className={arenaDataTable.tbodyRow}>
                                            <TableCell className={arenaDataTable.tdBold}>{user.name}</TableCell>
                                            <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{user.email}</TableCell>
                                            <TableCell className={arenaDataTable.td}>
                                                <Badge variant="outline" className="font-normal text-muted-foreground border-slate-700">
                                                    {user.profileName}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={arenaDataTable.td}>
                                                <Badge
                                                    variant="secondary"
                                                    className={user.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'}
                                                >
                                                    {user.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={arenaDataTable.tdRight}>
                                                <div className="flex justify-end">
                                                {user.editable && <DropdownMenu>
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
                                                            <UserMinus className="h-4 w-4 mr-2" />
                                                            Remover acesso
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <UserFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={selectedUser}
                profiles={profiles}
                stations={stations}
                onSave={handleSaveUser}
            />

            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent className="sm:max-w-[425px] bg-white border-slate-200 p-6 rounded-3xl shadow-xl">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-arena-navy-800 text-2xl font-semibold">Remover acesso</DialogTitle>
                    </DialogHeader>
                    <div className="text-slate-600 mb-8 whitespace-pre-wrap">
                        {userToDelete?.name} perderá o acesso a esta arena. Os outros vínculos e a conta da pessoa serão preservados.
                    </div>
                    <div className="flex justify-end gap-3 font-semibold">
                        <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={isDeleting} className="bg-white border-arena-navy-800 text-arena-navy-800 hover:bg-slate-50 px-8 rounded-lg">
                            Fechar
                        </Button>
                        <Button onClick={confirmDeleteUser} disabled={isDeleting} className="bg-arena-button hover:bg-arena-button-hover text-white px-8 rounded-lg border-0">
                            Remover acesso
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
