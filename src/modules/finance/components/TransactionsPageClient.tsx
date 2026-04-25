"use client"

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, ChevronLeft, ChevronRight, Edit, Trash2, Calendar } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { getTransactionsAction, deleteTransactionAction } from "@/modules/finance/actions/financeActions";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { startOfMonth, endOfMonth, format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { TransactionForm, TransactionData } from "@/modules/finance/components/TransactionForm";
import { toast } from "sonner";

interface Props {
    arenaId: string;
    type: 'entrada' | 'saída';
}

const LABELS = {
    entrada: { title: 'Entradas', button: 'Nova entrada', createModal: 'Nova entrada', editModal: 'Editar entrada' },
    saída:   { title: 'Saídas',   button: 'Nova saída',   createModal: 'Nova saída',   editModal: 'Editar saída'   },
} as const;

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function TransactionsPageClient({ arenaId, type }: Props) {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<TransactionData | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const labels = LABELS[type];

    const loadData = useCallback(async () => {
        if (!arenaId) return;
        setIsLoading(true);
        try {
            const start = startOfMonth(currentDate);
            const end = endOfMonth(currentDate);
            const res = await getTransactionsAction(arenaId, type, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
            setTransactions(res.data ?? []);
        } catch {
            toast.error("Erro ao carregar lançamentos.");
        } finally {
            setIsLoading(false);
        }
    }, [arenaId, currentDate, type]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleOpenEdit = (t: any) => {
        setEditingTransaction({
            id: t.id,
            type: t.type,
            category: t.category,
            description: t.description,
            quantity: t.quantity,
            unit_value: t.unit_value,
            discount: t.discount,
            total_value: t.total_value,
            launch_date: t.launch_date,
            registration_date: t.registration_date,
            atleta_id: t.atleta_id,
            atleta: t.atleta,
            modo_pagamento_id: t.modo_pagamento_id,
            modo_pagamento: t.modo_pagamento,
        });
        setIsFormOpen(true);
    };

    const handleFormSuccess = () => {
        setIsFormOpen(false);
        setEditingTransaction(null);
        loadData();
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            await deleteTransactionAction(arenaId, deletingId);
            setTransactions(transactions.filter(t => t.id !== deletingId));
            toast.success("Lançamento excluído!");
        } catch {
            toast.error("Erro ao excluir lançamento.");
        } finally {
            setDeletingId(null);
        }
    };

    if (isLoading) return <Skeleton className="h-[400px] w-full" />;

    return (
        <div className="space-y-8 pb-10">
            <Link href={`/dashboard/finance/${arenaId}`} className="flex items-center gap-2 text-[#002B40]/60 hover:text-[#002B40] font-bold text-sm">
                <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>

            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-black text-[#002B40] tracking-tight">{labels.title}</h1>
                <Button onClick={() => { setEditingTransaction(null); setIsFormOpen(true); }} className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold h-12 px-6 rounded-xl shadow-lg">
                    {labels.button} <Plus className="ml-2 h-5 w-5" />
                </Button>
            </div>

            <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                <div className="p-6 border-b border-[#002B40]/5 flex justify-end gap-3 items-center">
                    <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-[#002B40]/5">
                        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(prev => subMonths(prev, 1))} className="h-9 w-9 text-[#002B40]/60 hover:text-[#002B40] hover:bg-white hover:shadow-sm rounded-lg">
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="px-6 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-[#FF6B00]" />
                            <span className="text-sm font-black text-[#002B40] uppercase tracking-wider min-w-[150px] text-center">
                                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                            </span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="h-9 w-9 text-[#002B40]/60 hover:text-[#002B40] hover:bg-white hover:shadow-sm rounded-lg">
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="bg-[#002B40]/5 rounded-xl px-5 py-2.5 text-xs font-black text-[#002B40]/40 uppercase tracking-widest border border-[#002B40]/5">
                        {format(startOfMonth(currentDate), 'dd/MM/yyyy')} - {format(endOfMonth(currentDate), 'dd/MM/yyyy')}
                    </div>
                </div>

                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="text-[#002B40]/40 font-bold uppercase text-xs">Descrição</TableHead>
                            <TableHead className="text-[#002B40]/40 font-bold uppercase text-xs">Tipo</TableHead>
                            <TableHead className="text-[#002B40]/40 font-bold uppercase text-xs">Quantidade</TableHead>
                            <TableHead className="text-[#002B40]/40 font-bold uppercase text-xs">Valor unitário</TableHead>
                            <TableHead className="text-[#002B40]/40 font-bold uppercase text-xs">Desconto</TableHead>
                            <TableHead className="text-[#002B40]/40 font-bold uppercase text-xs text-[#FF6B00]">Valor total</TableHead>
                            <TableHead className="text-[#002B40]/40 font-bold uppercase text-xs">Data de lançamento</TableHead>
                            <TableHead className="text-[#002B40]/40 font-bold uppercase text-xs">Modo pagamento</TableHead>
                            {type === 'entrada' && <TableHead className="text-[#002B40]/40 font-bold uppercase text-xs">Atleta</TableHead>}
                            <TableHead className="text-[#002B40]/40 font-bold uppercase text-xs">Registrado por</TableHead>
                            <TableHead className="w-24"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((t) => (
                            <TableRow key={t.id} className="hover:bg-gray-50/50">
                                <TableCell className="font-bold text-[#002B40]">{t.description}</TableCell>
                                <TableCell>
                                    <span className="bg-[#FFC145]/20 text-[#002B40]/60 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{t.category}</span>
                                </TableCell>
                                <TableCell className="text-[#002B40]/60 font-medium">{String(t.quantity).padStart(2, '0')}</TableCell>
                                <TableCell className="text-[#002B40]/60 font-medium">{formatCurrency(t.unit_value)}</TableCell>
                                <TableCell className="text-[#002B40]/60 font-medium">{formatCurrency(t.discount)}</TableCell>
                                <TableCell className="text-[#FF6B00] font-black">{formatCurrency(t.total_value)}</TableCell>
                                <TableCell className="text-[#002B40]/60 font-medium">{new Date(t.launch_date).toLocaleDateString('pt-BR')}</TableCell>
                                <TableCell className="text-[#002B40]/60 font-medium">
                                    {t.modo_pagamento?.nome
                                        ? <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded">{t.modo_pagamento.nome}</span>
                                        : <span className="text-[#002B40]/30">—</span>}
                                </TableCell>
                                {type === 'entrada' && (
                                    <TableCell className="text-[#002B40]/60 font-medium">
                                        {t.atleta?.nome_perfil
                                            ? <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">{t.atleta.nome_perfil}</span>
                                            : <span className="text-[#002B40]/30">—</span>}
                                    </TableCell>
                                )}
                                <TableCell className="text-[#002B40]/60 font-medium">{t.registered_by?.name}</TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(t)} className="h-8 w-8 bg-[#FFC145]/10 text-[#002B40]/60 hover:bg-[#FFC145]/30 hover:text-[#002B40]">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setDeletingId(t.id)} className="h-8 w-8 bg-red-50 text-red-500 hover:bg-red-100">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            {/* Create / Edit modal */}
            <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsFormOpen(false); setEditingTransaction(null); } }}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-[#002B40]">
                            {editingTransaction ? labels.editModal : labels.createModal}
                        </DialogTitle>
                    </DialogHeader>
                    <TransactionForm
                        arenaId={arenaId}
                        registeredBy=""
                        type={type}
                        transaction={editingTransaction ?? undefined}
                        onSuccess={handleFormSuccess}
                        onCancel={() => { setIsFormOpen(false); setEditingTransaction(null); }}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete confirmation modal */}
            <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-[#002B40]">Excluir lançamento?</DialogTitle>
                        <DialogDescription className="text-[#002B40]/60">
                            Esta ação não pode ser desfeita. O lançamento será removido permanentemente.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-3 sm:justify-end">
                        <Button variant="outline" onClick={() => setDeletingId(null)} className="border-[#002B40]/20">Cancelar</Button>
                        <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold">Excluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
