"use client"

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { getTransactionsAction } from "@/modules/finance/actions/financeActions";
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
import { cn } from "@/lib/utils";
import { arenaDataTable } from "@/lib/arena-data-table";
import { toast } from "sonner";
import { formatLaunchDate } from "@/lib/format";

interface Props {
    arenaId: string;
    type: 'entrada' | 'saída';
}

const LABELS = {
    entrada: { title: 'Entradas' },
    saída: { title: 'Saídas' },
} as const;

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function TransactionsPageClient({ arenaId, type }: Props) {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

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

    if (isLoading) return <Skeleton className="h-[400px] w-full" />;

    return (
        <div className="space-y-8 pb-10">
            <Link href={`/dashboard/finance/${arenaId}`} className="flex items-center gap-2 text-arena-navy-800/60 hover:text-arena-navy-800 font-bold text-sm">
                <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>

            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">{labels.title}</h1>
                <p className="text-sm text-arena-navy-800/60">
                    Histórico somente leitura. Novos lançamentos são feitos na aba{' '}
                    <Link href={`/dashboard/finance/${arenaId}/caixa`} className="font-bold text-arena-button hover:underline">
                        Caixa
                    </Link>.
                </p>
            </div>

            <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                <div className="p-6 border-b border-arena-navy-800/5 flex justify-end gap-3 items-center">
                    <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-arena-navy-800/5">
                        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(prev => subMonths(prev, 1))} className="h-9 w-9 text-arena-navy-800/60 hover:text-arena-navy-800 hover:bg-white hover:shadow-sm rounded-lg">
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="px-6 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-arena-button" />
                            <span className="text-sm font-black text-arena-navy-800 uppercase tracking-wider min-w-[150px] text-center">
                                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                            </span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="h-9 w-9 text-arena-navy-800/60 hover:text-arena-navy-800 hover:bg-white hover:shadow-sm rounded-lg">
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="bg-arena-navy-800/5 rounded-xl px-5 py-2.5 text-xs font-black text-arena-navy-800/40 uppercase tracking-widest border border-arena-navy-800/5">
                        {format(startOfMonth(currentDate), 'dd/MM/yyyy')} - {format(endOfMonth(currentDate), 'dd/MM/yyyy')}
                    </div>
                </div>

                <Table className={arenaDataTable.table}>
                    <TableHeader>
                        <TableRow className={arenaDataTable.theadRow}>
                            <TableHead className={arenaDataTable.th}>Descrição</TableHead>
                            <TableHead className={arenaDataTable.th}>Tipo</TableHead>
                            <TableHead className={arenaDataTable.th}>Quantidade</TableHead>
                            <TableHead className={arenaDataTable.th}>Valor unitário</TableHead>
                            <TableHead className={arenaDataTable.th}>Desconto</TableHead>
                            <TableHead className={cn(arenaDataTable.th, "text-arena-button")}>Valor total</TableHead>
                            <TableHead className={arenaDataTable.th}>Data de lançamento</TableHead>
                            <TableHead className={arenaDataTable.th}>Modo pagamento</TableHead>
                            {type === 'entrada' && <TableHead className={arenaDataTable.th}>Atleta</TableHead>}
                            <TableHead className={arenaDataTable.th}>Registrado por</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((t) => (
                            <TableRow key={t.id} className={arenaDataTable.tbodyRow}>
                                <TableCell className={arenaDataTable.tdBold}>{t.description}</TableCell>
                                <TableCell className={arenaDataTable.td}>
                                    <span className="bg-[#FFC145]/20 text-arena-navy-800/60 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{t.category}</span>
                                </TableCell>
                                <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{String(t.quantity).padStart(2, '0')}</TableCell>
                                <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{formatCurrency(t.unit_value)}</TableCell>
                                <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{formatCurrency(t.discount)}</TableCell>
                                <TableCell className={cn(arenaDataTable.td, "text-arena-button font-black")}>{formatCurrency(t.total_value)}</TableCell>
                                <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{formatLaunchDate(t.launch_date)}</TableCell>
                                <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                    {t.modo_pagamento?.nome
                                        ? <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded">{t.modo_pagamento.nome}</span>
                                        : <span className="text-arena-navy-800/30">—</span>}
                                </TableCell>
                                {type === 'entrada' && (
                                    <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                                        {t.atleta?.nome_perfil
                                            ? <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">{t.atleta.nome_perfil}</span>
                                            : <span className="text-arena-navy-800/30">—</span>}
                                    </TableCell>
                                )}
                                <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{t.registered_by?.name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
