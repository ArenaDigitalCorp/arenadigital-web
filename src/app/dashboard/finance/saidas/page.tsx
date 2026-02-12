"use client"

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, ChevronLeft, ChevronRight, Edit, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useUserSync } from "@/hooks/useUserSync";
import { ArenaService } from "@/modules/arenas/services/arenaService";
import { FinanceService } from "@/modules/finance/services/financeService";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { cn } from "@/lib/utils";
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
} from "@/components/ui/dialog";
import { TransactionForm } from "@/modules/finance/components/TransactionForm";
import { toast } from "sonner";

export default function SaidasPage() {
    const { dbUser } = useUserSync();
    const [arena, setArena] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    const loadData = async () => {
        if (!dbUser) return;
        try {
            const arenas = await ArenaService.getArenasByOwner(dbUser.id);
            if (arenas.length > 0) {
                setArena(arenas[0]);
                const data = await FinanceService.getTransactions(arenas[0].id, 'saída');
                setTransactions(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [dbUser]);

    const handleDelete = async (id: string) => {
        if (confirm("Deseja realmente excluir este lançamento?")) {
            try {
                await FinanceService.deleteTransaction(id);
                setTransactions(transactions.filter(t => t.id !== id));
                toast.success("Lançamento excluído!");
            } catch (error) {
                toast.error("Erro ao excluir lançamento.");
            }
        }
    };

    if (isLoading) return <Skeleton className="h-[400px] w-full" />;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="space-y-8 pb-10">
            <Link href="/dashboard/finance" className="flex items-center gap-2 text-[#002B40]/60 hover:text-[#002B40] font-bold text-sm">
                <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>

            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-black text-[#002B40] tracking-tight">Saídas</h1>
                <Button onClick={() => setIsAdding(true)} className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold h-12 px-6 rounded-xl shadow-lg">
                    Nova saída <Plus className="ml-2 h-5 w-5" />
                </Button>
            </div>

            <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                <div className="p-6 border-b border-[#002B40]/5 flex justify-end gap-3">
                    <div className="flex items-center border rounded-lg overflow-hidden">
                        <button className="p-2 border-r hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
                        <button className="p-2 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                    <div className="border rounded-lg px-4 py-2 text-sm font-bold text-[#002B40]/60">
                        00/00/0000 - 00/00/0000
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
                                <TableCell className="text-[#002B40]/60 font-medium">{new Date(t.launch_date).toLocaleDateString()}</TableCell>
                                <TableCell className="text-[#002B40]/60 font-medium">{t.registered_by?.name}</TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-[#FFC145]/10 text-[#002B40]/60 hover:bg-[#FFC145]/20">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="h-8 w-8 bg-red-50 text-red-500 hover:bg-red-100">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={isAdding} onOpenChange={setIsAdding}>
                <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-[#002B40]">Nova saída</DialogTitle>
                    </DialogHeader>
                    {arena && dbUser && (
                        <TransactionForm
                            arenaId={arena.id}
                            registeredBy={dbUser.id}
                            type="saída"
                            onSuccess={() => { setIsAdding(false); loadData(); }}
                            onCancel={() => setIsAdding(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
