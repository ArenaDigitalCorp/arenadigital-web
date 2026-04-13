"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Edit, Trash2, Phone, Mail } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { deleteArenaAction } from "@/modules/arenas/actions/arenaActions";
import type { Arena } from "@/modules/arenas/types/arena.types";

interface Props {
    initialArenas: Arena[];
}

function statusLabel(status: string) {
    if (status === 'active' || status === 'ativo') return 'Ativo';
    if (status === 'inactive' || status === 'inativo') return 'Inativo';
    return 'Manutenção';
}

function isActive(status: string) {
    return status === 'active' || status === 'ativo';
}

export function ArenasSettingsClient({ initialArenas }: Props) {
    const [arenas, setArenas] = useState<Arena[]>(initialArenas);

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta arena? Todas as quadras associadas também serão excluídas.")) return;
        const res = await deleteArenaAction(id);
        if (res.success) {
            setArenas(prev => prev.filter(a => a.id !== id));
            toast.success("Arena excluída com sucesso!");
        } else {
            toast.error(res.error ?? "Erro ao excluir arena.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Configurações de Arena</h2>
                    <p className="text-muted-foreground">Edite as informações das suas arenas cadastradas.</p>
                </div>
            </div>

            {arenas.length === 0 ? (
                <Card className="col-span-full py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <MapPin className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="mb-2">Nenhuma arena cadastrada</CardTitle>
                        <p className="text-muted-foreground max-w-sm mb-6">Você ainda não cadastrou nenhuma arena.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {arenas.map((arena) => (
                        <Card key={arena.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{arena.name}</CardTitle>
                                <Badge variant={isActive(arena.status) ? 'default' : 'secondary'}>
                                    {statusLabel(arena.status)}
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <MapPin className="mr-2 h-4 w-4" />
                                        <span className="truncate">
                                            {typeof arena.address === 'string'
                                                ? arena.address
                                                : (arena.address as any)?.street || 'Endereço não informado'}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Phone className="mr-2 h-4 w-4" />
                                        <span>{arena.phone || 'Telefone não informado'}</span>
                                    </div>
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Mail className="mr-2 h-4 w-4" />
                                        <span className="truncate">{arena.email || 'E-mail não informado'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Link href={`/dashboard/arenas/${arena.id}/edit`} className="flex-1">
                                        <Button variant="outline" className="w-full flex items-center justify-center gap-2 font-bold">
                                            <Edit className="h-4 w-4" />
                                            Editar Arena
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDelete(arena.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
