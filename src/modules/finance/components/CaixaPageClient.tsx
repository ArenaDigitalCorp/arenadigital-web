"use client"

import { formatCpfCnpj, formatPhone } from '@/lib/brasil-document'
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { Lock, Plus, Edit, Trash2, History, Calendar, Filter, ChevronLeft, ChevronRight, X, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { arenaDataTable } from "@/lib/arena-data-table";
import { formatLaunchDate } from "@/lib/format";
import { ARENA_BRAND_HEX } from "@/constants/arena-brand-hex";
import {
    getCurrentCaixaSessionAction,
    getCaixaSessionsHistoryAction,
    getCaixaResponsaveisAction,
    getCaixaSessionDetailAction,
    getCaixaSessionPrintDataAction,
    openCaixaSessionAction,
    closeCaixaSessionAction,
} from "@/modules/finance/actions/caixaSessionActions";
import { deleteTransactionAction } from "@/modules/finance/actions/financeActions";
import { TransactionForm, TransactionData } from "@/modules/finance/components/TransactionForm";
import type { CaixaResponsavel, CaixaSession, CaixaSessionsHistoryFilters, Transaction } from "@/modules/finance/types/finance.types";
import {
    caixaTotaisPorModo,
    isLancamentoAutomatico,
    isModoDinheiro,
    origemDoLancamento,
    saldoEmDinheiro,
    type CaixaTotalPorModo,
} from "@/modules/finance/lib/caixa";

interface Props {
    arenaId: string;
}

const HISTORY_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatDateTime = (value: string) =>
    format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

function sessionTotals(transactions: Transaction[]) {
    const entradas = transactions.filter(t => t.type === 'entrada').reduce((acc, t) => acc + t.total_value, 0);
    const saidas = transactions.filter(t => t.type === 'saída').reduce((acc, t) => acc + t.total_value, 0);
    return { entradas, saidas };
}

export function CaixaPageClient({ arenaId }: Props) {
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<CaixaSession | null>(null);
    const [sessionTransactions, setSessionTransactions] = useState<Transaction[]>([]);

    const [history, setHistory] = useState<CaixaSession[]>([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(25);
    const [historyDate, setHistoryDate] = useState('');
    const [historyResponsavel, setHistoryResponsavel] = useState('');
    const [responsaveis, setResponsaveis] = useState<CaixaResponsavel[]>([]);

    const [openingBalance, setOpeningBalance] = useState('');
    const [openingNotes, setOpeningNotes] = useState('');
    const [isOpening, setIsOpening] = useState(false);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formType, setFormType] = useState<'entrada' | 'saída'>('entrada');
    const [editingTransaction, setEditingTransaction] = useState<TransactionData | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
    const [closingNotes, setClosingNotes] = useState('');
    const [isClosing, setIsClosing] = useState(false);
    const [closedSummary, setClosedSummary] = useState<{ session: CaixaSession; transactions: Transaction[] } | null>(null);

    const [historyDetail, setHistoryDetail] = useState<{ session: CaixaSession; transactions: Transaction[] } | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);

    const loadCurrent = useCallback(async () => {
        setIsLoading(true);
        try {
            const currentRes = await getCurrentCaixaSessionAction(arenaId);
            if (!currentRes.success) throw new Error(currentRes.error);
            setSession(currentRes.data);

            if (currentRes.data) {
                const detailRes = await getCaixaSessionDetailAction(arenaId, currentRes.data.id);
                if (!detailRes.success || !detailRes.data) throw new Error(detailRes.error);
                setSessionTransactions(detailRes.data.transactions);
            } else {
                setSessionTransactions([]);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao carregar o caixa.");
        } finally {
            setIsLoading(false);
        }
    }, [arenaId]);

    useEffect(() => { loadCurrent(); }, [loadCurrent]);

    useEffect(() => {
        getCaixaResponsaveisAction(arenaId).then((res) => {
            if (res.success) setResponsaveis(res.data);
        });
    }, [arenaId]);

    const historyFilters = useMemo<CaixaSessionsHistoryFilters>(() => ({
        page: historyPage,
        pageSize: historyPageSize,
        dateFrom: historyDate ? new Date(`${historyDate}T00:00:00`).toISOString() : undefined,
        dateTo: historyDate ? new Date(`${historyDate}T23:59:59.999`).toISOString() : undefined,
        openedBy: historyResponsavel || undefined,
    }), [historyPage, historyPageSize, historyDate, historyResponsavel]);

    const loadHistory = useCallback(async (filters: CaixaSessionsHistoryFilters) => {
        setIsHistoryLoading(true);
        try {
            const res = await getCaixaSessionsHistoryAction(arenaId, filters);
            if (!res.success) throw new Error(res.error);
            setHistory(res.data);
            setHistoryTotal(res.total);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao carregar o histórico de caixa.");
        } finally {
            setIsHistoryLoading(false);
        }
    }, [arenaId]);

    useEffect(() => { loadHistory(historyFilters); }, [historyFilters, loadHistory]);

    const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize));

    const handleOpenCaixa = async () => {
        setIsOpening(true);
        try {
            const result = await openCaixaSessionAction(arenaId, {
                opening_balance: openingBalance,
                opening_notes: openingNotes || null,
            });
            if (!result.success) throw new Error(result.error);
            toast.success("Caixa aberto com sucesso!");
            setOpeningBalance('');
            setOpeningNotes('');
            await loadCurrent();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao abrir o caixa.");
        } finally {
            setIsOpening(false);
        }
    };

    const handleOpenEdit = (t: Transaction) => {
        setEditingTransaction({
            id: t.id,
            type: t.type as 'entrada' | 'saída',
            category: t.category,
            description: t.description ?? '',
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
        setFormType(t.type as 'entrada' | 'saída');
        setIsFormOpen(true);
    };

    const handleFormSuccess = () => {
        setIsFormOpen(false);
        setEditingTransaction(null);
        loadCurrent();
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            const result = await deleteTransactionAction(arenaId, deletingId);
            if (!result.success) throw new Error(result.error);
            toast.success("Lançamento excluído!");
            await loadCurrent();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao excluir lançamento.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleCloseCaixa = async () => {
        if (!session) return;
        setIsClosing(true);
        try {
            const result = await closeCaixaSessionAction(arenaId, {
                session_id: session.id,
                closing_notes: closingNotes || null,
            });
            if (!result.success || !result.data) throw new Error(result.error);
            setClosedSummary({ session: result.data, transactions: sessionTransactions });
            setIsCloseConfirmOpen(false);
            setClosingNotes('');
            setSession(null);
            setSessionTransactions([]);
            toast.success("Caixa fechado com sucesso!");
            setHistoryPage(1);
            await loadHistory({ ...historyFilters, page: 1 });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao fechar o caixa.");
        } finally {
            setIsClosing(false);
        }
    };

    const handleOpenHistoryDetail = async (historySession: CaixaSession) => {
        try {
            const detailRes = await getCaixaSessionDetailAction(arenaId, historySession.id);
            if (!detailRes.success || !detailRes.data) throw new Error(detailRes.error);
            setHistoryDetail({ session: detailRes.data.session, transactions: detailRes.data.transactions });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao carregar o resumo do caixa.");
        }
    };

    const handlePrintCaixaSummary = async (sessionId: string) => {
        setIsPrinting(true);
        try {
            const res = await getCaixaSessionPrintDataAction(arenaId, sessionId);
            if (!res.success || !res.data) throw new Error(res.error);
            const { session: printSession, transactions: printTransactions, arena } = res.data;

            const printWindow = window.open('', '_blank', 'width=900,height=1000');
            if (!printWindow) {
                toast.error('Habilite pop-ups para imprimir.');
                return;
            }

            const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
            const dateTime = (v: string) => format(new Date(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

            const addressParts = [arena.street, arena.number ? `nº ${arena.number}` : null, arena.complement]
                .filter(Boolean)
                .join(', ');
            const cityLine = [arena.neighborhood, [arena.city, arena.stateUf].filter(Boolean).join('/')]
                .filter(Boolean)
                .join(' - ');

            const lancamentoRows = printTransactions
                .map((t) => `
        <tr>
          <td>${dateTime(t.created_at)}</td>
          <td>${t.description ?? ''}${origemDoLancamento(t.source_type) ? ` <span class="muted">[${origemDoLancamento(t.source_type)}]</span>` : ''}</td>
          <td>${t.category}</td>
          <td class="${t.type === 'entrada' ? 'entrada' : 'saida'}">${t.type}</td>
          <td>${t.modo_pagamento?.nome ?? '—'}</td>
          <td>${t.registered_by?.name ?? '—'}</td>
          <td class="val ${t.type === 'entrada' ? 'entrada' : 'saida'}">${t.type === 'entrada' ? '+' : '-'} ${money(t.total_value)}</td>
        </tr>`)
                .join('');

            const totaisPorModo = printSession.totais_por_modo ?? caixaTotaisPorModo(printTransactions);
            const totaisPorModoRows = totaisPorModo
                .map((total) => `
    <tr><td colspan="5">${total.nome}</td><td class="val entrada">+ ${money(total.entradas)}</td><td class="val saida">- ${money(total.saidas)}</td></tr>`)
                .join('');
            const saldoLabel = printSession.totais_por_modo ? 'Saldo em dinheiro (conferência da gaveta)' : 'Saldo final';

            printWindow.document.write(`
<html><head>
<title>Resumo de Caixa — ${arena.name ?? ''}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: ${ARENA_BRAND_HEX.navy800}; background: #fff; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .center { text-align: center; }
  .muted { color: #666; }
  .sep { border-top: 1px solid #ccc; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #eee; font-size: 11px; }
  th { text-transform: uppercase; font-size: 9px; letter-spacing: 0.03em; color: #888; border-bottom: 2px solid #ccc; }
  td.val { text-align: right; white-space: nowrap; font-weight: 700; }
  tr.milestone td { background: #f4f4f4; font-weight: 700; }
  .entrada { color: #0E9488; }
  .saida { color: ${ARENA_BRAND_HEX.button}; }
  .totals td { font-weight: 700; padding-top: 8px; border-bottom: none; }
  .negative { color: #B91C1C; }
  footer { margin-top: 18px; text-align: center; font-size: 9px; color: #888; }
</style>
</head><body>
  <h1>${arena.name ?? ''}</h1>
  ${addressParts ? `<p class="center muted">${addressParts}</p>` : ''}
  ${cityLine ? `<p class="center muted">${cityLine}</p>` : ''}
  ${arena.cpfCnpj ? `<p class="center muted">CPF/CNPJ: ${formatCpfCnpj(arena.cpfCnpj)}</p>` : ''}
  ${arena.phone ? `<p class="center muted">Tel: ${formatPhone(arena.phone)}</p>` : ''}
  <div class="sep"></div>
  <p class="center"><strong>RESUMO DE CAIXA</strong></p>
  <p class="center muted">Documento de conferência interna</p>
  <table>
    <thead>
      <tr><th>Hora</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Modo pagamento</th><th>Registrado por</th><th class="val">Valor</th></tr>
    </thead>
    <tbody>
      <tr class="milestone">
        <td>${dateTime(printSession.opened_at)}</td>
        <td colspan="5">Abertura de caixa — ${printSession.opened_by_user?.name ?? '—'}${printSession.opening_notes ? ` (${printSession.opening_notes})` : ''}</td>
        <td class="val">${money(printSession.opening_balance)}</td>
      </tr>
      ${lancamentoRows}
      <tr class="milestone">
        <td>${printSession.closed_at ? dateTime(printSession.closed_at) : '—'}</td>
        <td colspan="6">Fechamento de caixa — ${printSession.closed_by_user?.name ?? '—'}${printSession.closing_notes ? ` (${printSession.closing_notes})` : ''}</td>
      </tr>
    </tbody>
  </table>
  <table>
    <thead><tr><th colspan="5">Forma de pagamento</th><th class="val">Entradas</th><th class="val">Saídas</th></tr></thead>
    <tbody>${totaisPorModoRows}</tbody>
  </table>
  <table class="totals">
    <tr><td colspan="6">Total de entradas (todas as formas)</td><td class="val entrada">+ ${money(printSession.total_entradas ?? 0)}</td></tr>
    <tr><td colspan="6">Total de saídas (todas as formas)</td><td class="val saida">- ${money(printSession.total_saidas ?? 0)}</td></tr>
    <tr><td colspan="6">${saldoLabel}</td><td class="val ${(printSession.closing_balance ?? 0) < 0 ? 'negative' : ''}">${money(printSession.closing_balance ?? 0)}</td></tr>
  </table>
  <footer>Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss")}<br/>Arena Digital</footer>
  <script>window.onload=()=>{setTimeout(()=>window.print(),400)}</script>
</body></html>`);
            printWindow.document.close();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao gerar resumo para impressão.');
        } finally {
            setIsPrinting(false);
        }
    };

    if (isLoading) return <Skeleton className="h-[400px] w-full" />;

    const preview = sessionTotals(sessionTransactions);
    const previewPorModo = caixaTotaisPorModo(sessionTransactions);
    const previewBalance = session ? saldoEmDinheiro(session.opening_balance, previewPorModo) : 0;

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-arena-navy-800 tracking-tight">Caixa</h1>
                <p className="text-arena-navy-800/60 font-medium">
                    Controle de abertura, lançamentos e fechamento do caixa diário.
                </p>
            </div>

            {!session ? (
                <Card className="border-none shadow-lg rounded-2xl bg-white p-5 max-w-sm">
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="bg-arena-button/10 p-1.5 rounded-lg">
                            <Lock className="h-4 w-4 text-arena-button" />
                        </div>
                        <h2 className="text-base font-bold text-arena-navy-800">Abertura de Caixa</h2>
                    </div>
                    <p className="text-xs text-arena-navy-800/50 leading-relaxed mb-4">
                        Nenhum caixa aberto. Informe o saldo inicial em dinheiro para liberar os lançamentos de entrada e saída.
                    </p>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-arena-navy-800/70 uppercase tracking-wide">
                                Saldo inicial em dinheiro
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-arena-navy-800/30 pointer-events-none">
                                    R$
                                </span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={openingBalance}
                                    onChange={(e) => setOpeningBalance(e.target.value)}
                                    placeholder="0,00"
                                    className="h-10 pl-9 font-semibold"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-arena-navy-800/70 uppercase tracking-wide">
                                Observações <span className="text-arena-navy-800/35 font-normal normal-case">(opcional)</span>
                            </label>
                            <Textarea
                                value={openingNotes}
                                onChange={(e) => setOpeningNotes(e.target.value)}
                                rows={2}
                                className="text-sm resize-none"
                            />
                        </div>
                        <Button
                            onClick={handleOpenCaixa}
                            disabled={isOpening || openingBalance === ''}
                            className="w-full h-10 bg-arena-button hover:bg-arena-button-hover text-white font-bold"
                        >
                            {isOpening ? 'Abrindo...' : 'Abrir caixa'}
                        </Button>
                    </div>
                </Card>
            ) : (
                <>
                    <Card className="border-none shadow-xl rounded-2xl bg-white p-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap gap-6">
                                <div>
                                    <p className="text-arena-navy-800/40 font-bold text-[10px] uppercase tracking-widest">Aberto em</p>
                                    <p className="text-sm font-bold text-arena-navy-800">{formatDateTime(session.opened_at)}</p>
                                </div>
                                <div>
                                    <p className="text-arena-navy-800/40 font-bold text-[10px] uppercase tracking-widest">Aberto por</p>
                                    <p className="text-sm font-bold text-arena-navy-800">{session.opened_by_user?.name ?? '—'}</p>
                                </div>
                                <div>
                                    <p className="text-arena-navy-800/40 font-bold text-[10px] uppercase tracking-widest">Saldo inicial</p>
                                    <p className="text-sm font-bold text-arena-navy-800">{formatCurrency(session.opening_balance)}</p>
                                </div>
                                <div>
                                    <p className="text-arena-navy-800/40 font-bold text-[10px] uppercase tracking-widest">Saldo em dinheiro</p>
                                    <p className={cn("text-sm font-black", previewBalance < 0 ? "text-red-600" : "text-[#20B2AA]")}>
                                        {formatCurrency(previewBalance)}
                                    </p>
                                </div>
                            </div>
                            <Button
                                onClick={() => setIsCloseConfirmOpen(true)}
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50 font-bold"
                            >
                                Fechar caixa
                            </Button>
                        </div>
                    </Card>

                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-arena-navy-800">Lançamentos desta abertura</h3>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => { setEditingTransaction(null); setFormType('entrada'); setIsFormOpen(true); }}
                                className="bg-arena-button hover:bg-arena-button-hover text-white font-semibold"
                            >
                                Nova entrada <Plus className="ml-2 h-4 w-4" />
                            </Button>
                            <Button
                                onClick={() => { setEditingTransaction(null); setFormType('saída'); setIsFormOpen(true); }}
                                variant="outline"
                                className="border-arena-navy-800/20 text-arena-navy-800 font-semibold"
                            >
                                Nova saída <Plus className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                        <Table className={arenaDataTable.table}>
                            <TableHeader>
                                <TableRow className={arenaDataTable.theadRow}>
                                    <TableHead className={arenaDataTable.th}>Descrição</TableHead>
                                    <TableHead className={arenaDataTable.th}>Tipo</TableHead>
                                    <TableHead className={cn(arenaDataTable.th, "text-arena-button")}>Valor total</TableHead>
                                    <TableHead className={arenaDataTable.th}>Modo pagamento</TableHead>
                                    <TableHead className={arenaDataTable.th}>Data</TableHead>
                                    <TableHead className={arenaDataTable.th}>Registrado por</TableHead>
                                    <TableHead className={cn(arenaDataTable.thRight, "w-24")} />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessionTransactions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-sm text-arena-navy-800/40 py-8">
                                            Nenhum lançamento nesta abertura ainda.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {sessionTransactions.map((t) => (
                                    <TableRow key={t.id} className={arenaDataTable.tbodyRow}>
                                        <TableCell className={arenaDataTable.tdBold}>
                                            {t.description}
                                            <OrigemBadge sourceType={t.source_type} />
                                        </TableCell>
                                        <TableCell className={arenaDataTable.td}>
                                            <span className={cn(
                                                "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                                t.type === 'entrada' ? "bg-[#20B2AA]/10 text-[#20B2AA]" : "bg-arena-button/10 text-arena-button"
                                            )}>
                                                {t.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className={cn(arenaDataTable.td, "font-black", t.type === 'entrada' ? "text-[#20B2AA]" : "text-arena-button")}>
                                            {t.type === 'entrada' ? '+' : '-'} {formatCurrency(t.total_value)}
                                        </TableCell>
                                        <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{t.modo_pagamento?.nome ?? '—'}</TableCell>
                                        <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{formatLaunchDate(t.launch_date)}</TableCell>
                                        <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{t.registered_by?.name}</TableCell>
                                        <TableCell className={arenaDataTable.tdRight}>
                                            {isLancamentoAutomatico(t) ? (
                                                <span className="text-[10px] font-bold text-arena-navy-800/30 uppercase" title="Lançamento automático: altere ou estorne pela tela de origem">
                                                    Automático
                                                </span>
                                            ) : (
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(t)} className="h-8 w-8 bg-[#FFC145]/10 text-arena-navy-800/60 hover:bg-[#FFC145]/30 hover:text-arena-navy-800">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(t.id)} className="h-8 w-8 bg-red-50 text-red-500 hover:bg-red-100">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </>
            )}

            {(responsaveis.length > 0 || historyTotal > 0) && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <History className="h-5 w-5 text-arena-navy-800/40" />
                            <h3 className="text-xl font-bold text-arena-navy-800">Histórico de aberturas</h3>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center bg-white border border-arena-navy-800/10 rounded-xl px-3 h-11 gap-2">
                                <Calendar className="h-4 w-4 text-arena-navy-800/20" />
                                <input
                                    type="date"
                                    value={historyDate}
                                    onChange={(e) => { setHistoryDate(e.target.value); setHistoryPage(1); }}
                                    className="bg-transparent text-sm font-bold text-arena-navy-800/60 focus:outline-none"
                                />
                            </div>
                            <div className="flex items-center bg-white border border-arena-navy-800/10 rounded-xl px-3 h-11 min-w-[180px]">
                                <Filter className="h-4 w-4 text-arena-navy-800/20 mr-2 shrink-0" />
                                <Select
                                    value={historyResponsavel || "todos"}
                                    onValueChange={(v) => { setHistoryResponsavel(v === "todos" ? "" : v); setHistoryPage(1); }}
                                >
                                    <SelectTrigger className="border-none shadow-none focus:ring-0 h-full p-0 font-bold text-arena-navy-800/60">
                                        <SelectValue placeholder="Todos os responsáveis" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos os responsáveis</SelectItem>
                                        {responsaveis.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {(historyDate || historyResponsavel) && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 text-arena-navy-800/40 hover:text-arena-navy-800"
                                    onClick={() => { setHistoryDate(''); setHistoryResponsavel(''); setHistoryPage(1); }}
                                    aria-label="Limpar filtros"
                                    title="Limpar filtros"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                        <Table className={arenaDataTable.table}>
                            <TableHeader>
                                <TableRow className={arenaDataTable.theadRow}>
                                    <TableHead className={arenaDataTable.th}>Aberto em</TableHead>
                                    <TableHead className={arenaDataTable.th}>Fechado em</TableHead>
                                    <TableHead className={arenaDataTable.th}>Responsável</TableHead>
                                    <TableHead className={arenaDataTable.th}>Entradas</TableHead>
                                    <TableHead className={arenaDataTable.th}>Saídas</TableHead>
                                    <TableHead className={arenaDataTable.th}>Saldo final</TableHead>
                                    <TableHead className={cn(arenaDataTable.thRight, "w-24")} />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!isHistoryLoading && history.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-sm text-arena-navy-800/40 py-10">
                                            Nenhuma abertura encontrada para os filtros selecionados.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {history.map((h) => (
                                    <TableRow key={h.id} className={cn(arenaDataTable.tbodyRow, isHistoryLoading && "opacity-50")}>
                                        <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{formatDateTime(h.opened_at)}</TableCell>
                                        <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{h.closed_at ? formatDateTime(h.closed_at) : '—'}</TableCell>
                                        <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{h.opened_by_user?.name ?? '—'}</TableCell>
                                        <TableCell className={cn(arenaDataTable.td, "text-[#20B2AA] font-bold")}>{formatCurrency(h.total_entradas ?? 0)}</TableCell>
                                        <TableCell className={cn(arenaDataTable.td, "text-arena-button font-bold")}>{formatCurrency(h.total_saidas ?? 0)}</TableCell>
                                        <TableCell className={cn(arenaDataTable.td, "font-black", (h.closing_balance ?? 0) < 0 ? "text-red-600" : "text-arena-navy-800")}>
                                            {formatCurrency(h.closing_balance ?? 0)}
                                        </TableCell>
                                        <TableCell className={arenaDataTable.tdRight}>
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenHistoryDetail(h)} className="text-arena-navy-800/60 hover:text-arena-navy-800 font-bold">
                                                Ver detalhes
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>

                    {historyTotal > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <p className="text-xs font-bold text-arena-navy-800/40">
                                Exibindo {(historyPage - 1) * historyPageSize + 1}–{Math.min(historyPage * historyPageSize, historyTotal)} de {historyTotal} abertura{historyTotal !== 1 ? "s" : ""}
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-white border border-arena-navy-800/10 rounded-xl px-3 h-9">
                                    <Select
                                        value={String(historyPageSize)}
                                        onValueChange={(v) => { setHistoryPageSize(Number(v)); setHistoryPage(1); }}
                                    >
                                        <SelectTrigger className="border-none shadow-none focus:ring-0 h-full p-0 text-xs font-bold text-arena-navy-800/60">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {HISTORY_PAGE_SIZE_OPTIONS.map((size) => (
                                                <SelectItem key={size} value={String(size)}>{size} por página</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 rounded-xl border-arena-navy-800/10"
                                        disabled={historyPage === 1 || isHistoryLoading}
                                        onClick={() => setHistoryPage((p) => p - 1)}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-xs font-bold text-arena-navy-800/60 px-2">
                                        {historyPage} / {historyTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 rounded-xl border-arena-navy-800/10"
                                        disabled={historyPage >= historyTotalPages || isHistoryLoading}
                                        onClick={() => setHistoryPage((p) => p + 1)}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Create / Edit lançamento */}
            <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsFormOpen(false); setEditingTransaction(null); } }}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-arena-navy-800">
                            {editingTransaction ? 'Editar lançamento' : (formType === 'entrada' ? 'Nova entrada' : 'Nova saída')}
                        </DialogTitle>
                    </DialogHeader>
                    <TransactionForm
                        arenaId={arenaId}
                        registeredBy=""
                        type={formType}
                        transaction={editingTransaction ?? undefined}
                        onSuccess={handleFormSuccess}
                        onCancel={() => { setIsFormOpen(false); setEditingTransaction(null); }}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-arena-navy-800">Excluir lançamento?</DialogTitle>
                        <DialogDescription className="text-arena-navy-800/60">
                            Esta ação não pode ser desfeita. O lançamento será removido permanentemente.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-3 sm:justify-end">
                        <Button variant="outline" onClick={() => setDeletingId(null)} className="border-arena-navy-800/20">Cancelar</Button>
                        <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold">Excluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Fechamento: confirmação com resumo prévio */}
            <Dialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-arena-navy-800">Fechar caixa?</DialogTitle>
                        <DialogDescription className="text-arena-navy-800/60">
                            Confira o resumo antes de confirmar. Após o fechamento, os lançamentos desta abertura não poderão mais ser editados.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-arena-navy-800/60">Saldo inicial</span>
                            <span className="font-bold text-arena-navy-800">{formatCurrency(session?.opening_balance ?? 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-arena-navy-800/60">Entradas (todas as formas)</span>
                            <span className="font-bold text-[#20B2AA]">+ {formatCurrency(preview.entradas)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-arena-navy-800/60">Saídas (todas as formas)</span>
                            <span className="font-bold text-arena-button">- {formatCurrency(preview.saidas)}</span>
                        </div>
                        <TotaisPorModo totais={previewPorModo} />
                        <div className="flex justify-between text-base pt-2 border-t border-arena-navy-800/10">
                            <span className="font-bold text-arena-navy-800">Saldo em dinheiro na gaveta</span>
                            <span className={cn("font-black", previewBalance < 0 ? "text-red-600" : "text-arena-navy-800")}>
                                {formatCurrency(previewBalance)}
                            </span>
                        </div>
                        <div className="space-y-1.5 pt-2">
                            <label className="text-sm font-bold text-arena-navy-800">
                                Observações <span className="text-arena-navy-800/40 font-normal">(opcional)</span>
                            </label>
                            <Textarea value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} rows={2} />
                        </div>
                    </div>
                    <DialogFooter className="flex gap-3 sm:justify-end">
                        <Button variant="outline" onClick={() => setIsCloseConfirmOpen(false)} className="border-arena-navy-800/20">Cancelar</Button>
                        <Button onClick={handleCloseCaixa} disabled={isClosing} className="bg-red-600 hover:bg-red-700 text-white font-bold">
                            {isClosing ? 'Fechando...' : 'Confirmar fechamento'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Resumo final após fechamento */}
            <Dialog open={!!closedSummary} onOpenChange={(open) => { if (!open) setClosedSummary(null); }}>
                <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw] h-[80vh] max-h-[80vh] p-0 gap-0 flex flex-col overflow-hidden">
                    <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 shrink-0 px-6 pt-6 pb-4 border-b border-arena-navy-800/5">
                        <div>
                            <DialogTitle className="text-xl font-black text-arena-navy-800">Caixa fechado</DialogTitle>
                            <DialogDescription className="text-arena-navy-800/60">
                                {closedSummary && `Aberto ${formatDateTime(closedSummary.session.opened_at)}, fechado ${closedSummary.session.closed_at ? formatDateTime(closedSummary.session.closed_at) : ''}.`}
                            </DialogDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isPrinting || !closedSummary}
                            onClick={() => closedSummary && handlePrintCaixaSummary(closedSummary.session.id)}
                            className="border-arena-navy-800/20 text-arena-navy-800 font-bold gap-2 shrink-0"
                        >
                            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                            Imprimir
                        </Button>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                        {closedSummary && (
                            <CaixaSummaryDetail session={closedSummary.session} transactions={closedSummary.transactions} />
                        )}
                    </div>
                    <DialogFooter className="shrink-0 px-6 pb-6 pt-4 border-t border-arena-navy-800/5">
                        <Button onClick={() => setClosedSummary(null)} className="bg-arena-button hover:bg-arena-button-hover text-white font-bold w-full">
                            Fechar resumo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detalhe de uma sessão do histórico */}
            <Dialog open={!!historyDetail} onOpenChange={(open) => { if (!open) setHistoryDetail(null); }}>
                <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw] h-[80vh] max-h-[80vh] p-0 gap-0 flex flex-col overflow-hidden">
                    <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 shrink-0 px-6 pt-6 pb-4 border-b border-arena-navy-800/5">
                        <div>
                            <DialogTitle className="text-xl font-black text-arena-navy-800">Resumo da abertura</DialogTitle>
                            <DialogDescription className="text-arena-navy-800/60">
                                {historyDetail && `Aberto ${formatDateTime(historyDetail.session.opened_at)}${historyDetail.session.opened_by_user?.name ? ` por ${historyDetail.session.opened_by_user.name}` : ''}.`}
                            </DialogDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isPrinting || !historyDetail}
                            onClick={() => historyDetail && handlePrintCaixaSummary(historyDetail.session.id)}
                            className="border-arena-navy-800/20 text-arena-navy-800 font-bold gap-2 shrink-0"
                        >
                            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                            Imprimir
                        </Button>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                        {historyDetail && (
                            <CaixaSummaryDetail session={historyDetail.session} transactions={historyDetail.transactions} />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CaixaSummaryDetail({ session, transactions }: { session: CaixaSession; transactions: Transaction[] }) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#FFF8F1] p-4 rounded-xl">
                    <p className="text-arena-navy-800/40 font-bold text-[10px] uppercase tracking-widest">Entradas</p>
                    <p className="text-lg font-black text-[#20B2AA]">{formatCurrency(session.total_entradas ?? 0)}</p>
                </div>
                <div className="bg-[#FFF8F1] p-4 rounded-xl">
                    <p className="text-arena-navy-800/40 font-bold text-[10px] uppercase tracking-widest">Saídas</p>
                    <p className="text-lg font-black text-arena-button">{formatCurrency(session.total_saidas ?? 0)}</p>
                </div>
                <div className="bg-arena-navy-800/5 p-4 rounded-xl">
                    <p className="text-arena-navy-800/40 font-bold text-[10px] uppercase tracking-widest">
                        {session.totais_por_modo ? "Saldo em dinheiro" : "Saldo final"}
                    </p>
                    <p className={cn("text-lg font-black", (session.closing_balance ?? 0) < 0 ? "text-red-600" : "text-arena-navy-800")}>
                        {formatCurrency(session.closing_balance ?? 0)}
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-arena-navy-800/10 p-4">
                <p className="text-arena-navy-800/40 font-bold text-[10px] uppercase tracking-widest mb-2">Totais por forma de pagamento</p>
                <TotaisPorModo totais={session.totais_por_modo ?? caixaTotaisPorModo(transactions)} />
            </div>

            <Card className="border border-arena-navy-800/10 shadow-none rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <Table className={cn(arenaDataTable.table, "min-w-[960px]")}>
                        <TableHeader>
                            <TableRow className={arenaDataTable.theadRow}>
                                <TableHead className={arenaDataTable.th}>Data e hora</TableHead>
                                <TableHead className={arenaDataTable.th}>Descrição</TableHead>
                                <TableHead className={arenaDataTable.th}>Categoria</TableHead>
                                <TableHead className={arenaDataTable.th}>Tipo</TableHead>
                                <TableHead className={arenaDataTable.th}>Modo pagamento</TableHead>
                                <TableHead className={arenaDataTable.th}>Registrado por</TableHead>
                                <TableHead className={cn(arenaDataTable.th, "text-right")}>Valor</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="bg-arena-navy-800/[0.04]">
                                <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60 whitespace-nowrap")}>{formatDateTime(session.opened_at)}</TableCell>
                                <TableCell colSpan={5} className={cn(arenaDataTable.tdBold)}>
                                    Abertura de caixa — {session.opened_by_user?.name ?? '—'}
                                    {session.opening_notes && <span className="text-arena-navy-800/40 font-normal"> ({session.opening_notes})</span>}
                                </TableCell>
                                <TableCell className={cn(arenaDataTable.td, "text-right font-black text-arena-navy-800")}>
                                    {formatCurrency(session.opening_balance)}
                                </TableCell>
                            </TableRow>

                            {transactions.map((t) => (
                                <TableRow key={t.id} className={arenaDataTable.tbodyRow}>
                                    <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60 whitespace-nowrap")}>{formatDateTime(t.created_at)}</TableCell>
                                    <TableCell className={arenaDataTable.tdBold}>
                                        {t.description}
                                        <OrigemBadge sourceType={t.source_type} />
                                    </TableCell>
                                    <TableCell className={arenaDataTable.td}>
                                        <span className="bg-[#FFC145]/20 text-arena-navy-800/60 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{t.category}</span>
                                    </TableCell>
                                    <TableCell className={arenaDataTable.td}>
                                        <span className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                            t.type === 'entrada' ? "bg-[#20B2AA]/10 text-[#20B2AA]" : "bg-arena-button/10 text-arena-button"
                                        )}>
                                            {t.type}
                                        </span>
                                    </TableCell>
                                    <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{t.modo_pagamento?.nome ?? '—'}</TableCell>
                                    <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>{t.registered_by?.name ?? '—'}</TableCell>
                                    <TableCell className={cn(arenaDataTable.td, "text-right font-black", t.type === 'entrada' ? "text-[#20B2AA]" : "text-arena-button")}>
                                        {t.type === 'entrada' ? '+' : '-'} {formatCurrency(t.total_value)}
                                    </TableCell>
                                </TableRow>
                            ))}

                            <TableRow className="bg-arena-navy-800/[0.04]">
                                <TableCell className={cn(arenaDataTable.td, "text-arena-navy-800/60 whitespace-nowrap")}>
                                    {session.closed_at ? formatDateTime(session.closed_at) : '—'}
                                </TableCell>
                                <TableCell colSpan={6} className={arenaDataTable.tdBold}>
                                    Fechamento de caixa — {session.closed_by_user?.name ?? '—'}
                                    {session.closing_notes && <span className="text-arena-navy-800/40 font-normal"> ({session.closing_notes})</span>}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}

function OrigemBadge({ sourceType }: { sourceType: string | null | undefined }) {
    const origem = origemDoLancamento(sourceType);
    if (!origem) return null;
    return (
        <span className="ml-2 align-middle bg-arena-navy-800/5 text-arena-navy-800/50 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            {origem}
        </span>
    );
}

function TotaisPorModo({ totais }: { totais: CaixaTotalPorModo[] }) {
    if (totais.length === 0) {
        return <p className="text-xs text-arena-navy-800/40">Nenhum lançamento.</p>;
    }
    return (
        <div className="space-y-1">
            {totais.map((total) => (
                <div key={total.modo_pagamento_id ?? total.nome} className="flex justify-between gap-4 text-xs">
                    <span className={cn("text-arena-navy-800/60", isModoDinheiro(total.nome) && "font-bold text-arena-navy-800")}>
                        {total.nome}
                    </span>
                    <span className="whitespace-nowrap">
                        <span className="font-bold text-[#20B2AA]">+ {formatCurrency(total.entradas)}</span>
                        <span className="text-arena-navy-800/30"> / </span>
                        <span className="font-bold text-arena-button">- {formatCurrency(total.saidas)}</span>
                    </span>
                </div>
            ))}
        </div>
    );
}
