'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronLeft, Clock, Loader2, Printer, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { StationOrder } from '@/modules/stations/types/station.types';
import {
  getOrderByIdAction,
  getOrderPrintDataAction,
  markOrderPendingAction,
  revertOrderToOpenAction,
  updateOrderAction,
} from '@/modules/stations/actions/orderActions';
import { Skeleton } from '@/components/ui/skeleton';
import { LaunchItemModal } from '@/modules/stations/components/LaunchItemModal';
import { RegisterPaymentModal } from '@/modules/stations/components/RegisterPaymentModal';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ARENA_BRAND_HEX } from '@/constants/arena-brand-hex';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const arenaId = params.id as string;
  const stationId = params.stationId as string;
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<StationOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isMarkingPending, setIsMarkingPending] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  const loadOrderData = async () => {
    setIsLoading(true);
    try {
      const res = await getOrderByIdAction(arenaId, orderId);
      setOrder(res.data as StationOrder | null);
    } catch (error) {
      console.error('Error loading order details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) loadOrderData();
  }, [orderId]);

  const handleCancelOrder = async () => {
    if (!order) return;
    if (
      !window.confirm(
        'Tem certeza que deseja cancelar esta comanda? Essa ação não pode ser desfeita e os itens retornarão ao estoque.'
      )
    )
      return;

    setIsCancelling(true);
    try {
      const result = await updateOrderAction(arenaId, order.id, { status: 'cancelled' });
      if (!result.success) throw new Error(result.error);
      toast.success('Comanda cancelada com sucesso!');
      loadOrderData();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Erro ao cancelar comanda.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleMarkPending = async () => {
    if (!order) return;
    if (!window.confirm('Marcar esta comanda como pendente? O cliente irá efetuar o pagamento em outro momento.'))
      return;

    setIsMarkingPending(true);
    try {
      const result = await markOrderPendingAction(arenaId, order.id);
      if (!result.success) throw new Error(result.error);
      toast.success('Comanda marcada como pendente.');
      loadOrderData();
    } catch (error) {
      console.error('Error marking order as pending:', error);
      toast.error('Erro ao marcar comanda como pendente.');
    } finally {
      setIsMarkingPending(false);
    }
  };

  const handleRevertToOpen = async () => {
    if (!order) return;
    if (!window.confirm('Reverter esta comanda para aberta?')) return;

    setIsReverting(true);
    try {
      const result = await revertOrderToOpenAction(arenaId, order.id);
      if (!result.success) throw new Error(result.error);
      toast.success('Comanda revertida para aberta.');
      loadOrderData();
    } catch (error) {
      console.error('Error reverting order to open:', error);
      toast.error('Erro ao reverter comanda para aberta.');
    } finally {
      setIsReverting(false);
    }
  };

  const handlePrint = async () => {
    if (!order) return;
    setIsPrinting(true);
    try {
      const res = await getOrderPrintDataAction(arenaId, orderId);
      if (!res.success || !res.data) throw new Error(res.error);
      const { order: printOrder, arena } = res.data;

      const printWindow = window.open('', '_blank', 'width=420,height=800');
      if (!printWindow) {
        toast.error('Habilite pop-ups para imprimir.');
        return;
      }

      const totalPaidPrint =
        printOrder.station_payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
      const balancePrint = printOrder.total_value - totalPaidPrint;
      const customerName =
        printOrder.atleta?.nome_perfil ||
        printOrder.station_customer?.name ||
        printOrder.customer_name ||
        'Cliente avulso';
      const customerDoc =
        printOrder.atleta?.cpf || printOrder.station_customer?.cpf || null;
      const customerPhone =
        printOrder.atleta?.telefone || printOrder.station_customer?.phone || null;

      const addressParts = [
        arena.street,
        arena.number ? `nº ${arena.number}` : null,
        arena.complement,
      ]
        .filter(Boolean)
        .join(', ');
      const cityLine = [arena.neighborhood, [arena.city, arena.stateUf].filter(Boolean).join('/')]
        .filter(Boolean)
        .join(' - ');

      const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

      const itemsRows = (printOrder.station_order_items ?? [])
        .map(
          (item) => `
        <tr>
          <td class="qty">${item.quantity}x</td>
          <td class="desc">${item.product?.name ?? ''}</td>
          <td class="val">${money(item.total_price)}</td>
        </tr>`
        )
        .join('');

      const paymentsRows = (printOrder.station_payments ?? [])
        .map(
          (p) => `
        <tr>
          <td class="desc" colspan="2">${p.payment_method}${p.paid_by_name ? ` — ${p.paid_by_name}` : ''}</td>
          <td class="val">${money(p.amount)}</td>
        </tr>`
        )
        .join('');

      printWindow.document.write(`
<html><head>
<title>Romaneio — Comanda #${printOrder.order_number.toString().padStart(3, '0')}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; color: ${ARENA_BRAND_HEX.navy800}; background: #fff; width: 76mm; font-size: 11px; }
  h1 { font-size: 13px; font-weight: 700; text-align: center; margin: 0 0 2px; }
  .center { text-align: center; }
  .muted { color: #555; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  td.qty { width: 28px; }
  td.val { width: 64px; text-align: right; white-space: nowrap; }
  .totals td { padding-top: 3px; font-weight: 700; }
  .badge { display: inline-block; margin-top: 4px; padding: 2px 6px; border: 1px solid #000; font-size: 10px; }
  footer { margin-top: 10px; text-align: center; font-size: 9px; color: #555; }
</style>
</head><body>
  <h1>${arena.name}</h1>
  ${addressParts ? `<p class="center muted">${addressParts}</p>` : ''}
  ${cityLine ? `<p class="center muted">${cityLine}</p>` : ''}
  ${arena.cpfCnpj ? `<p class="center muted">CNPJ: ${arena.cpfCnpj}</p>` : ''}
  ${arena.phone ? `<p class="center muted">Tel: ${arena.phone}</p>` : ''}
  <div class="sep"></div>
  <p class="center"><strong>ROMANEIO DE COMANDA</strong></p>
  <p class="center muted">Não é documento fiscal</p>
  <div class="sep"></div>
  <p>Comanda: #${printOrder.order_number.toString().padStart(3, '0')}${printOrder.station?.name ? ` — ${printOrder.station.name}` : ''}</p>
  <p>Abertura: ${format(new Date(printOrder.created_at), "dd/MM/yyyy HH:mm:ss")}</p>
  <p>Cliente: ${customerName}</p>
  ${customerDoc ? `<p>CPF: ${customerDoc}</p>` : ''}
  ${customerPhone ? `<p>Telefone: ${customerPhone}</p>` : ''}
  <div class="sep"></div>
  <table>
    ${itemsRows}
  </table>
  <div class="sep"></div>
  <table class="totals">
    <tr><td colspan="2">Total produtos:</td><td class="val">${money(printOrder.total_value)}</td></tr>
    ${paymentsRows ? `<tr><td colspan="3" style="padding-top:6px;font-weight:400" class="muted">Pagamentos:</td></tr>${paymentsRows}` : ''}
    <tr><td colspan="2">Total pago:</td><td class="val">${money(totalPaidPrint)}</td></tr>
    <tr><td colspan="2">Saldo restante:</td><td class="val">${money(balancePrint)}</td></tr>
  </table>
  <p class="center badge">${printOrder.status === 'closed' ? 'FECHADA' : printOrder.status === 'cancelled' ? 'CANCELADA' : printOrder.status === 'pending' ? 'PENDENTE' : 'ABERTA'}</p>
  <footer>Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss")}<br/>Arena Digital</footer>
  <script>window.onload=()=>{setTimeout(()=>window.print(),400)}</script>
</body></html>`);
      printWindow.document.close();
    } catch (error) {
      console.error('Error printing order:', error);
      toast.error('Erro ao gerar romaneio para impressão.');
    } finally {
      setIsPrinting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-arena-navy-800/40 font-medium text-lg">
          Comanda não encontrada.
        </p>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const totalPaid =
    order.station_payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const balance = order.total_value - totalPaid;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center text-arena-navy-800/60 font-bold text-sm hover:text-arena-navy-800 transition-colors w-fit"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black text-arena-navy-800 tracking-tight">
                Comanda nº #{order.order_number.toString().padStart(3, '0')}
              </h1>
              {order.status === 'pending' && (
                <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-black uppercase border border-amber-200">
                  Pendente
                </span>
              )}
              {order.status === 'closed' && (
                <span className="bg-[#E6F8F7] text-[#20B2AA] px-3 py-1 rounded-full text-xs font-black uppercase">
                  Fechada
                </span>
              )}
              {order.status === 'cancelled' && (
                <span className="bg-red-50 text-red-500 px-3 py-1 rounded-full text-xs font-black uppercase border border-red-200">
                  Cancelada
                </span>
              )}
            </div>
            <p className="text-arena-navy-800/60 font-medium">
              Cliente:{' '}
              {order.atleta?.nome_perfil ||
                order.station_customer?.name ||
                order.customer_name ||
                'N/A'}
            </p>
            {order.status === 'pending' && order.pending_marked_at && (
              <p className="text-amber-600 font-medium text-sm">
                Pendente desde {format(new Date(order.pending_marked_at), 'dd/MM/yyyy HH:mm')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              disabled={isPrinting}
              className="rounded-xl border-arena-navy-800/10 font-semibold text-arena-navy-800 shadow-sm hover:bg-arena-navy-800/5"
            >
              {isPrinting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Imprimir romaneio
            </Button>
            <div
              className={cn(
                'rounded-xl p-4 shadow-lg flex items-center gap-4',
                balance > 0
                  ? 'bg-[linear-gradient(90deg,#F97415_0%,#F9A91F_100%)] text-white shadow-[#F97415]/25'
                  : 'bg-[#E6F8F7] text-arena-navy-800 shadow-[#20B2AA]/10'
              )}
            >
              <span
                className={cn(
                  'font-bold uppercase text-xs',
                  balance > 0 ? 'text-white/85' : 'text-arena-navy-800/60'
                )}
              >
                Saldo:
              </span>
              <span
                className={cn(
                  'text-2xl font-black tabular-nums',
                  balance > 0 ? 'text-white' : 'text-arena-navy-800'
                )}
              >
                R$ {balance.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table Section */}
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-arena-navy-800">
              Itens pedidos
            </h2>
            {(order.status === 'open' || order.status === 'pending') && (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button
                  onClick={() => setIsLaunchModalOpen(true)}
                  className="rounded-xl bg-arena-button font-semibold text-white shadow-sm hover:bg-arena-button-hover"
                >
                  Lançar item
                </Button>
                <Button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="rounded-xl bg-arena-navy-800 font-semibold text-white shadow-sm hover:bg-arena-navy-900"
                >
                  Registrar pagamento
                </Button>
                {order.status === 'open' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleMarkPending}
                    disabled={isMarkingPending}
                    className="rounded-xl border-amber-200 bg-amber-50 font-semibold text-amber-600 shadow-sm hover:bg-amber-100"
                  >
                    {isMarkingPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                    Marcar como pendente
                  </Button>
                )}
                {order.status === 'pending' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRevertToOpen}
                    disabled={isReverting}
                    className="rounded-xl border-arena-navy-800/10 font-semibold text-arena-navy-800 shadow-sm hover:bg-arena-navy-800/5"
                  >
                    {isReverting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Undo2 className="h-4 w-4" />
                    )}
                    Reverter para aberta
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCancelOrder}
                  disabled={isCancelling}
                  title="Cancelar comanda"
                  aria-label="Cancelar comanda"
                  className="h-10 w-10 shrink-0 rounded-xl border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                >
                  {isCancelling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-arena-navy-800/5">
                <tr>
                  <th className="py-4 text-xs font-bold text-arena-navy-800/40 uppercase">
                    Horário do lançamento
                  </th>
                  <th className="py-4 text-xs font-bold text-arena-navy-800/40 uppercase">
                    Descrição
                  </th>
                  <th className="py-4 text-xs font-bold text-arena-navy-800/40 uppercase">
                    Quantidade
                  </th>
                  <th className="py-4 text-xs font-bold text-arena-navy-800/40 uppercase text-right">
                    Valor unitário
                  </th>
                  <th className="py-4 text-xs font-bold text-arena-navy-800/40 uppercase text-right">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arena-navy-800/5">
                {order.station_order_items?.map((item) => (
                  <tr key={item.id} className="group">
                    <td className="py-4 text-sm font-medium text-arena-navy-800/60">
                      {format(new Date(item.created_at), 'dd/MM/yy HH:mm')}
                    </td>
                    <td className="py-4 text-sm font-bold text-arena-navy-800">
                      {item.product?.name}
                    </td>
                    <td className="py-4 text-sm font-medium text-arena-navy-800/60">
                      {item.quantity}
                    </td>
                    <td className="py-4 text-sm font-medium text-arena-navy-800/60 text-right">
                      R$ {item.unit_price.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="py-4 text-sm font-bold text-arena-navy-800 text-right">
                      R$ {item.total_price.toFixed(2).replace('.', ',')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={4}
                    className="pt-8 text-right font-bold text-arena-navy-800/60"
                  >
                    Total:
                  </td>
                  <td className="pt-8 text-right">
                    <span className="rounded-lg bg-[linear-gradient(90deg,#F97415_0%,#F9A91F_100%)] px-4 py-2 text-sm font-black text-white shadow-sm shadow-[#F97415]/20">
                      R$ {order.total_value.toFixed(2).replace('.', ',')}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table Section */}
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-8">
          <h2 className="text-xl font-black text-arena-navy-800 mb-8">
            Pagamentos
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-arena-navy-800/5">
                <tr>
                  <th className="py-4 text-xs font-bold text-arena-navy-800/40 uppercase">
                    Horário do pagamento
                  </th>
                  <th className="py-4 text-xs font-bold text-arena-navy-800/40 uppercase">
                    Forma de pagamento
                  </th>
                  <th className="py-4 text-xs font-bold text-arena-navy-800/40 uppercase">
                    Observação
                  </th>
                  <th className="py-4 text-xs font-bold text-arena-navy-800/40 uppercase">
                    Pago por
                  </th>
                  <th className="py-4 text-xs font-bold text-arena-navy-800/40 uppercase text-right">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arena-navy-800/5">
                {order.station_payments && order.station_payments.length > 0 ? (
                  order.station_payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="py-4 text-sm font-medium text-arena-navy-800/60">
                        {format(new Date(payment.created_at), 'HH:mm:ss')}
                      </td>
                      <td className="py-4 text-sm font-bold text-arena-navy-800">
                        {payment.payment_method}
                      </td>
                      <td className="py-4 text-sm font-medium text-arena-navy-800/60">
                        {payment.observation || '--'}
                      </td>
                      <td className="py-4 text-sm font-medium text-arena-navy-800/60">
                        {payment.paid_by_name || '--'}
                      </td>
                      <td className="py-4 text-sm font-bold text-arena-navy-800 text-right">
                        R$ {payment.amount.toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-arena-navy-800/20 font-medium"
                    >
                      Nenhum pagamento registrado.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={4}
                    className="pt-8 text-right font-bold text-arena-navy-800/60"
                  >
                    Total pago:
                  </td>
                  <td className="pt-8 text-right">
                    <span className="bg-[#E6F8F7] text-[#20B2AA] px-4 py-2 rounded-lg font-black text-sm">
                      R$ {totalPaid.toFixed(2).replace('.', ',')}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <LaunchItemModal
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
        arenaId={arenaId}
        stationId={stationId}
        stationTypeId={order.station?.station_type_id ?? undefined}
        order={order}
        onSuccess={loadOrderData}
      />

      <RegisterPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        order={order}
        onSuccess={loadOrderData}
      />
    </div>
  );
}
