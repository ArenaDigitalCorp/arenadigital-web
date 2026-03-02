"use client"

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Plus, ArrowRight, Eye } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useUserSync } from "@/hooks/useUserSync";
import { ArenaService } from "@/modules/arenas/services/arenaService";
import { FinanceService } from "@/modules/finance/services/financeService";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { TransactionForm } from "@/modules/finance/components/TransactionForm";

export default function FinanceDashboard({ params }: { params: Promise<{ arenaId: string }> }) {
    const { dbUser } = useUserSync();
    const resolvedParams = React.use(params);
    const [arena, setArena] = useState<any>(null);
    const [totals, setTotals] = useState({ entradas: 0, saidas: 0, saldo: 0 });
    const [recentEntradas, setRecentEntradas] = useState<any[]>([]);
    const [recentSaidas, setRecentSaidas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddingEntry, setIsAddingEntry] = useState(false);
    const [isAddingExpense, setIsAddingExpense] = useState(false);

    const loadData = async () => {
        if (!dbUser || !resolvedParams.arenaId) return;
        try {
            setArena({ id: resolvedParams.arenaId });
            const [totalsData, allEntradas, allSaidas] = await Promise.all([
                FinanceService.getTotals(resolvedParams.arenaId),
                FinanceService.getTransactions(resolvedParams.arenaId, 'entrada'),
                FinanceService.getTransactions(resolvedParams.arenaId, 'saída')
            ]);
            setTotals(totalsData);
            setRecentEntradas(allEntradas.slice(0, 4));
            setRecentSaidas(allSaidas.slice(0, 4));
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [dbUser, resolvedParams.arenaId]);

    if (isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-10 w-64" />
                <div className="grid gap-6 md:grid-cols-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
                </div>
            </div>
        );
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-[#002B40] tracking-tight">Financeiro</h1>
                <p className="text-[#002B40]/60 font-medium">Controle suas entradas e saídas em um só lugar.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Left Column: Totals */}
                <div className="space-y-6">
                    <Card className="bg-gradient-to-r from-[#FF7A00] to-[#FFB800] border-none shadow-xl rounded-2xl overflow-hidden text-white relative h-[180px] flex items-center p-8">
                        <div className="space-y-1 relative z-10">
                            <p className="text-white/80 font-bold text-sm">Saldo Atual</p>
                            <h2 className="text-5xl font-black">{formatCurrency(totals.saldo)}</h2>
                            <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Lucro líquido mensal</p>
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-8 border-none shadow-lg rounded-2xl bg-white">
                            <p className="text-[#002B40]/40 font-bold text-xs uppercase tracking-widest mb-1">Entradas do Mês</p>
                            <h3 className="text-3xl font-black text-[#20B2AA] mb-1">{formatCurrency(totals.entradas)}</h3>
                            <p className="text-red-500 font-bold text-xs">-5% vs mês anterior</p>
                        </Card>
                        <Card className="p-8 border-none shadow-lg rounded-2xl bg-white">
                            <p className="text-[#002B40]/40 font-bold text-xs uppercase tracking-widest mb-1">Despesas do Mês</p>
                            <h3 className="text-3xl font-black text-[#FF6B00] mb-1">{formatCurrency(totals.saidas)}</h3>
                            <p className="text-red-500 font-bold text-xs">-5% vs mês anterior</p>
                        </Card>
                    </div>
                </div>

                {/* Right Column: Chart */}
                <Card className="p-8 border-none shadow-lg rounded-2xl bg-white flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#FF6B00]/10 p-2 rounded-lg">
                                <BarChart3 className="h-5 w-5 text-[#FF6B00]" />
                            </div>
                            <h3 className="text-xl font-bold text-[#002B40]">Comparativo</h3>
                        </div>
                        <select className="bg-white border rounded-lg px-3 py-2 text-sm text-[#002B40]/60 focus:outline-none">
                            <option>Última semana</option>
                        </select>
                    </div>

                    <div className="flex-1 flex items-end gap-3 justify-between px-4 pb-2">
                        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, i) => (
                            <div key={day} className="flex flex-col items-center gap-4 flex-1">
                                <div
                                    className={cn(
                                        "w-full rounded-full transition-all duration-1000",
                                        i === 2 ? "bg-[#FF6B00]" : "bg-[#002B40]/5"
                                    )}
                                    style={{ height: `${[40, 70, 85, 95, 60, 75, 55][i]}%` }}
                                >
                                    {i === 2 && (
                                        <div className="bg-white shadow-lg text-[#002B40] font-black text-[10px] px-2 py-1 rounded-md -top-8 relative text-center">8.5</div>
                                    )}
                                </div>
                                <span className="text-[#002B40]/40 font-bold text-[10px]">{day}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Incomes */}
                <Card className="p-8 border-none shadow-lg rounded-2xl bg-white">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-[#002B40]">Últimas Entradas</h3>
                        <Button onClick={() => setIsAddingEntry(true)} variant="ghost" className="text-[#002B40]/60 hover:text-[#002B40] gap-2 font-bold text-sm">
                            Nova entrada <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="space-y-4">
                        {recentEntradas.map(t => (
                            <div key={t.id} className="bg-[#FFF8F1] p-4 rounded-xl flex items-center justify-between">
                                <div>
                                    <p className="text-[#002B40] font-bold text-sm">{t.category} - {t.description}</p>
                                    <p className="text-[#002B40]/40 text-xs font-medium">{new Date(t.launch_date).toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[#20B2AA] font-black text-sm">+ {formatCurrency(t.total_value)}</p>
                                    <span className="bg-[#FFC145]/20 text-[#002B40]/60 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{t.category}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Link href={`/dashboard/finance/${resolvedParams.arenaId}/entradas`} className="mt-8 text-center block text-[#002B40]/40 hover:text-[#002B40] text-sm font-bold underline">
                        Ver tudo
                    </Link>
                </Card>

                {/* Recent Expenses */}
                <Card className="p-8 border-none shadow-lg rounded-2xl bg-white">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-[#002B40]">Últimas Saídas</h3>
                        <Button onClick={() => setIsAddingExpense(true)} variant="ghost" className="text-[#002B40]/60 hover:text-[#002B40] gap-2 font-bold text-sm">
                            Nova saída <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="space-y-4">
                        {recentSaidas.map(t => (
                            <div key={t.id} className="bg-[#FFF8F1] p-4 rounded-xl flex items-center justify-between">
                                <div>
                                    <p className="text-[#002B40] font-bold text-sm">{t.category} - {t.description}</p>
                                    <p className="text-[#002B40]/40 text-xs font-medium">{new Date(t.launch_date).toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[#FF6B00] font-black text-sm">- {formatCurrency(t.total_value)}</p>
                                    <span className="bg-[#FFC145]/20 text-[#002B40]/60 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{t.category}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Link href={`/dashboard/finance/${resolvedParams.arenaId}/saidas`} className="mt-8 text-center block text-[#002B40]/40 hover:text-[#002B40] text-sm font-bold underline">
                        Ver tudo
                    </Link>
                </Card>
            </div>

            {/* Modals */}
            <Dialog open={isAddingEntry} onOpenChange={setIsAddingEntry}>
                <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-[#002B40]">Nova entrada</DialogTitle>
                    </DialogHeader>
                    {arena && dbUser && (
                        <TransactionForm
                            arenaId={arena.id}
                            registeredBy={dbUser.id}
                            type="entrada"
                            onSuccess={() => { setIsAddingEntry(false); loadData(); }}
                            onCancel={() => setIsAddingEntry(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
                <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-[#002B40]">Nova saída</DialogTitle>
                    </DialogHeader>
                    {arena && dbUser && (
                        <TransactionForm
                            arenaId={arena.id}
                            registeredBy={dbUser.id}
                            type="saída"
                            onSuccess={() => { setIsAddingExpense(false); loadData(); }}
                            onCancel={() => setIsAddingExpense(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
