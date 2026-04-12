"use client"

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Plus } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useUserSync } from "@/hooks/useUserSync";
import { FinanceService, type ArenaFinanceDailyRow } from "@/modules/finance/services/financeService";
import { format } from "date-fns";
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
    const [monthlyComparison, setMonthlyComparison] = useState({
        entradas: { current: 0, diff: 0 },
        saidas: { current: 0, diff: 0 }
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isAddingEntry, setIsAddingEntry] = useState(false);
    const [isAddingExpense, setIsAddingExpense] = useState(false);
    const [viewType, setViewType] = useState<'saldo' | 'entrada' | 'saída'>('entrada');
    const [period, setPeriod] = useState<'7d' | '30d'>('7d');
    const [chartData, setChartData] = useState<{ label: string; value: number; percentage: number; isCurrentDay?: boolean }[]>([]);
    const [chartSeries, setChartSeries] = useState<ArenaFinanceDailyRow[]>([]);

    const processChartData = useCallback(
        (series: ArenaFinanceDailyRow[], periodType: '7d' | '30d', type: 'saldo' | 'entrada' | 'saída') => {
            const now = new Date();
            const daysCount = periodType === '7d' ? 7 : 30;
            const byDay = new Map(
                series.map((r) => [r.bucket_date.length >= 10 ? r.bucket_date.slice(0, 10) : r.bucket_date, r])
            );

            const lastXDays = Array.from({ length: daysCount }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                d.setDate(d.getDate() - (daysCount - 1 - i));
                return d;
            });

            const result = lastXDays.map((dateObj) => {
                const key = format(dateObj, 'yyyy-MM-dd');
                const row = byDay.get(key);
                let value = 0;
                if (row) {
                    if (type === 'saldo') value = row.entradas - row.saidas;
                    else if (type === 'entrada') value = row.entradas;
                    else value = row.saidas;
                }

                const dateStr = dateObj.toLocaleDateString();
                const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                return {
                    label:
                        daysCount === 7
                            ? weekdays[dateObj.getDay()]
                            : `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`,
                    value,
                    isCurrentDay: dateStr === now.toLocaleDateString(),
                };
            });

            const maxValue = Math.max(...result.map((d) => Math.abs(d.value)), 1);
            setChartData(
                result.map((d) => ({
                    ...d,
                    percentage: (Math.abs(d.value) / maxValue) * 100,
                }))
            );
        },
        []
    );

    const loadData = useCallback(async () => {
        if (!dbUser?.id || !resolvedParams.arenaId) return;
        setIsLoading(true);
        try {
            setArena({ id: resolvedParams.arenaId });

            const now = new Date();
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const start = new Date(end);
            start.setDate(start.getDate() - 29);
            const startStr = format(start, 'yyyy-MM-dd');
            const endStr = format(end, 'yyyy-MM-dd');

            const [summary, recentIn, recentOut, series] = await Promise.all([
                FinanceService.getArenaFinanceSummary(resolvedParams.arenaId),
                FinanceService.getRecentTransactions(resolvedParams.arenaId, 'entrada', 4),
                FinanceService.getRecentTransactions(resolvedParams.arenaId, 'saída', 4),
                FinanceService.getArenaFinanceDailyTotals(resolvedParams.arenaId, startStr, endStr),
            ]);

            setTotals({
                entradas: summary.lifetime_entradas,
                saidas: summary.lifetime_saidas,
                saldo: summary.lifetime_entradas - summary.lifetime_saidas,
            });

            const calcDiff = (curr: number, prev: number) => {
                if (prev === 0) return curr === 0 ? 0 : 100;
                return ((curr - prev) / prev) * 100;
            };

            setMonthlyComparison({
                entradas: {
                    current: summary.current_month_entradas,
                    diff: calcDiff(summary.current_month_entradas, summary.prev_month_entradas),
                },
                saidas: {
                    current: summary.current_month_saidas,
                    diff: calcDiff(summary.current_month_saidas, summary.prev_month_saidas),
                },
            });

            setRecentEntradas(recentIn);
            setRecentSaidas(recentOut);
            setChartSeries(series);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [dbUser?.id, resolvedParams.arenaId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (isLoading) return;
        processChartData(chartSeries, period, viewType);
    }, [period, viewType, chartSeries, processChartData, isLoading]);

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

            <div className="grid gap-6 lg:grid-cols-2 items-stretch">
                {/* Left Column: Totals */}
                <div className="flex flex-col gap-6">
                    <Card className="bg-gradient-to-r from-[#FF7A00] to-[#FFB800] border-none shadow-xl rounded-2xl overflow-hidden text-white relative flex-1 flex items-center p-8 min-h-[180px]">
                        <div className="space-y-1 relative z-10">
                            <p className="text-white/80 font-bold text-sm">Saldo Atual</p>
                            <h2 className="text-5xl font-black">{formatCurrency(totals.saldo)}</h2>
                            <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Lucro líquido total acumulado</p>
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                        <Card className="p-8 border-none shadow-lg rounded-2xl bg-white flex flex-col justify-between h-full">
                            <div>
                                <p className="text-[#002B40]/40 font-bold text-xs uppercase tracking-widest mb-1">Entradas do Mês</p>
                                <h3 className="text-3xl font-black text-[#20B2AA] mb-1">{formatCurrency(monthlyComparison.entradas.current)}</h3>
                            </div>
                            <p className={cn(
                                "font-bold text-xs",
                                monthlyComparison.entradas.diff >= 0 ? "text-[#20B2AA]" : "text-red-500"
                            )}>
                                {monthlyComparison.entradas.diff >= 0 ? '+' : ''}
                                {monthlyComparison.entradas.diff.toFixed(0)}% vs mês anterior
                            </p>
                        </Card>
                        <Card className="p-8 border-none shadow-lg rounded-2xl bg-white flex flex-col justify-between h-full">
                            <div>
                                <p className="text-[#002B40]/40 font-bold text-xs uppercase tracking-widest mb-1">Despesas do Mês</p>
                                <h3 className="text-3xl font-black text-[#FF6B00] mb-1">{formatCurrency(monthlyComparison.saidas.current)}</h3>
                            </div>
                            <p className={cn(
                                "font-bold text-xs",
                                monthlyComparison.saidas.diff <= 0 ? "text-[#20B2AA]" : "text-red-500"
                            )}>
                                {monthlyComparison.saidas.diff >= 0 ? '+' : ''}
                                {monthlyComparison.saidas.diff.toFixed(0)}% vs mês anterior
                            </p>
                        </Card>
                    </div>
                </div>

                {/* Right Column: Chart */}
                <Card className="p-8 border-none shadow-lg rounded-2xl bg-white flex flex-col h-full min-h-[420px]">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#FF6B00]/10 p-2 rounded-lg">
                                <BarChart3 className="h-5 w-5 text-[#FF6B00]" />
                            </div>
                            <h3 className="text-xl font-bold text-[#002B40]">Comparativo</h3>
                        </div>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as any)}
                            className="bg-white border border-[#002B40]/10 rounded-lg px-3 py-2 text-sm text-[#002B40]/60 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 transition-all font-bold"
                        >
                            <option value="7d">Última semana</option>
                            <option value="30d">Últimos 30 dias</option>
                        </select>
                    </div>

                    <div className="flex gap-8 flex-1">
                        {/* Sidebar Filters */}
                        <div className="flex flex-col gap-3 w-48">
                            <p className="text-[#002B40]/40 font-bold text-[10px] uppercase tracking-widest mb-1">Selecione a visualização desejada:</p>
                            {[
                                { id: 'saldo', label: 'Saldo total' },
                                { id: 'entrada', label: 'Entradas' },
                                { id: 'saída', label: 'Saídas' }
                            ].map((filter) => (
                                <button
                                    key={filter.id}
                                    onClick={() => setViewType(filter.id as any)}
                                    className={cn(
                                        "flex items-center justify-between p-4 rounded-xl border transition-all duration-300 group",
                                        viewType === filter.id
                                            ? "bg-[#FFF5EF] border-[#FF6B00]/20"
                                            : "bg-white border-[#002B40]/5 hover:border-[#002B40]/10"
                                    )}
                                >
                                    <span className={cn(
                                        "text-sm font-bold transition-colors",
                                        viewType === filter.id ? "text-[#002B40]" : "text-[#002B40]/40 group-hover:text-[#002B40]/60"
                                    )}>
                                        {filter.label}
                                    </span>
                                    <div className={cn(
                                        "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                                        viewType === filter.id ? "border-[#FF6B00]" : "border-[#002B40]/10"
                                    )}>
                                        {viewType === filter.id && <div className="h-2.5 w-2.5 rounded-full bg-[#FF6B00]" />}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Chart Area */}
                        <div className="flex-1 overflow-x-auto custom-scrollbar pt-12 pb-2">
                            <div className={cn(
                                "relative flex items-end gap-2 px-4 h-64",
                                period === '30d' ? "min-w-[800px]" : "min-w-0 flex-1"
                            )}>
                                {/* Grid Lines (Illustration) */}
                                <div className="absolute inset-x-0 bottom-2 top-0 flex flex-col justify-between pointer-events-none opacity-[0.03]">
                                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(n => (
                                        <div key={n} className="w-full border-t border-[#002B40] flex items-center">
                                            <span className="text-[10px] font-bold pr-2 -translate-y-1/2">{n}</span>
                                        </div>
                                    ))}
                                </div>

                                {chartData.map((d, i) => (
                                    <div key={i} className="flex flex-col items-center gap-4 flex-1 h-full justify-end group/bar relative">
                                        <div
                                            className={cn(
                                                "w-full rounded-full transition-all duration-700 relative flex items-end justify-center",
                                                d.isCurrentDay || (d.percentage === 100 && d.value !== 0)
                                                    ? "bg-gradient-to-t from-[#FF6B00] to-[#FF9E58]"
                                                    : (viewType === 'saldo' && d.value < 0 ? "bg-gradient-to-t from-[#475569] to-[#94a3b8]" : "bg-[#002B40]/5 group-hover/bar:bg-[#002B40]/10")
                                            )}
                                            style={{ height: `${Math.max(d.percentage, 5)}%` }}
                                        >
                                            {/* Tooltip on Hover */}
                                            <div className="absolute -top-10 bg-[#002B40] text-white text-[10px] font-black px-2 py-1 rounded-md opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-20 pointer-events-none">
                                                {formatCurrency(d.value)}
                                            </div>

                                            {/* Static highlight for current/max if desired */}
                                            {(d.isCurrentDay || (d.percentage === 100 && d.value !== 0)) && (
                                                <div className="absolute -top-10 bg-white border border-[#002B40]/5 shadow-xl text-[#002B40] font-black text-[10px] px-2 py-1.5 rounded-lg z-10 transition-transform group-hover/bar:scale-110">
                                                    {formatCurrency(d.value).replace('R$', '').trim()}
                                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-b border-r border-[#002B40]/5 rotate-45" />
                                                </div>
                                            )}
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-bold transition-colors whitespace-nowrap",
                                            d.isCurrentDay ? "text-[#FF6B00]" : "text-[#002B40]/40"
                                        )}>
                                            {d.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
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
                                    <p className="text-[#002B40]/40 text-xs font-medium">{new Date(t.launch_date).toLocaleDateString('pt-BR')}</p>
                                    {t.atleta?.nome_perfil && (
                                        <span className="inline-flex items-center gap-1 mt-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">
                                            👤 {t.atleta.nome_perfil}
                                        </span>
                                    )}
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
                                    <p className="text-[#002B40]/40 text-xs font-medium">{new Date(t.launch_date).toLocaleDateString('pt-BR')}</p>
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
