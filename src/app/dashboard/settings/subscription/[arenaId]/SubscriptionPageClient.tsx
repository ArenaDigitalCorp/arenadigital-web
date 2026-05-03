'use client';

import { useState } from 'react';
import { AlertCircle, Check, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentMethodCollector } from '@/modules/payments/components/PaymentMethodCollector';
import type { CardCollectionContext } from '@/modules/payments/gateway/payment-gateway.interface';
import type { PlanKey } from '@/modules/payments/plans';
import type { PaymentHistoryItem } from '@/modules/payments/usecases/get-payment-history.usecase';
import type { ArenaSubscription } from '@/modules/payments/usecases/get-subscription.usecase';

type SetupData = {
  cardCollection: CardCollectionContext;
  planKey: PlanKey;
  planLabel: string;
  priceCents: number;
};

type SubscriptionPlanOption = {
  key: PlanKey;
  label: string;
  priceCents: number;
  maxSpaces: number;
  features: string[];
};

interface Props {
  arenaId: string;
  initialSubscription: ArenaSubscription;
  initialPaymentHistory: PaymentHistoryItem[];
  plans: SubscriptionPlanOption[];
  planSelectionEnabled: boolean;
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(iso));
}

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    paid: {
      label: 'Pago',
      className: 'border-emerald-200 bg-emerald-500/10 text-emerald-600',
    },
    open: {
      label: 'Em aberto',
      className: 'border-yellow-200 bg-yellow-500/10 text-yellow-700',
    },
    void: {
      label: 'Cancelado',
      className: 'border-gray-200 bg-gray-100 text-gray-500',
    },
    uncollectible: {
      label: 'Nao cobrado',
      className: 'border-red-200 bg-red-500/10 text-red-500',
    },
    draft: {
      label: 'Rascunho',
      className: 'border-gray-200 bg-gray-100 text-gray-500',
    },
  };

  const { label, className } = config[status] ?? {
    label: status,
    className: 'border-gray-200 bg-gray-100 text-gray-500',
  };

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

export function SubscriptionPageClient({
  arenaId,
  initialSubscription,
  initialPaymentHistory,
  plans,
  planSelectionEnabled,
}: Props) {
  const [subscription, setSubscription] =
    useState<ArenaSubscription>(initialSubscription);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState<PlanKey>(
    initialSubscription.planKey ?? plans[0]?.key ?? 'starter'
  );

  const selectedPlan =
    plans.find((plan) => plan.key === selectedPlanKey) ?? null;

  const hasSubscription = subscription.status !== 'none';
  const modalPlanChange =
    Boolean(setupData?.planKey) &&
    Boolean(subscription.planKey) &&
    setupData?.planKey !== subscription.planKey;

  async function refreshSubscription() {
    try {
      const res = await fetch(`/api/payments/subscriptions/${arenaId}`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao atualizar assinatura.');
        return;
      }

      setSubscription(data);
    } catch {
      toast.error('Erro ao atualizar assinatura.');
    }
  }

  async function handleOpenCardModal(planKey = selectedPlanKey) {
    setActionLoading(true);

    try {
      const res = await fetch('/api/payments/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arenaId, planKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao iniciar cadastro do cartao.');
        return;
      }

      setSetupData({
        cardCollection: data.cardCollection,
        planKey: data.planKey,
        planLabel: data.planLabel,
        priceCents: data.priceCents,
      });
      setCardModalOpen(true);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);

    try {
      const res = await fetch('/api/payments/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arenaId, action: 'cancel' }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Erro ao cancelar assinatura.');
        return;
      }

      toast.success(
        'Assinatura cancelada. O acesso segue ativo ate o fim do periodo atual.'
      );
      setCancelModalOpen(false);
      await refreshSubscription();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate() {
    setActionLoading(true);

    try {
      const res = await fetch('/api/payments/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arenaId, action: 'reactivate' }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Erro ao reativar assinatura.');
        return;
      }

      toast.success('Assinatura reativada com sucesso.');
      await refreshSubscription();
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePaymentSuccess() {
    const paymentAction = !hasSubscription
      ? 'Assinatura ativada com sucesso.'
      : modalPlanChange
        ? 'Plano atualizado com sucesso.'
        : 'Cartao atualizado com sucesso.';

    setSetupData(null);
    setCardModalOpen(false);
    toast.success(paymentAction);
    await refreshSubscription();
  }

  function handleCloseCardModal() {
    setCardModalOpen(false);
    setSetupData(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Assinatura</h2>
        <p className="mt-1 text-muted-foreground">
          Gerencie seu plano, forma de pagamento e historico de cobranca.
        </p>
      </div>

      {planSelectionEnabled && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Planos disponiveis</h3>
              <p className="text-sm text-muted-foreground">
                Escolha explicitamente o plano antes de cadastrar ou trocar o
                cartao.
              </p>
            </div>
            {selectedPlan && (
              <Badge
                variant="outline"
                className="border-[#FF6B00]/30 bg-[#FF6B00]/5 text-[#C65100]"
              >
                Selecionado: {selectedPlan.label}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {plans.map((plan) => {
              const isSelected = plan.key === selectedPlanKey;
              const isCurrent = subscription.planKey === plan.key;

              return (
                <Card
                  key={plan.key}
                  className={
                    isSelected
                      ? 'border-[#FF6B00] shadow-[0_0_0_1px_rgba(255,107,0,0.15)]'
                      : 'border-border'
                  }
                >
                  <CardContent className="space-y-5 pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{plan.label}</p>
                        <p className="mt-1 text-2xl font-bold text-[#0D3B45]">
                          {formatPrice(plan.priceCents)}
                          <span className="ml-1 text-sm font-medium text-muted-foreground">
                            / mes
                          </span>
                        </p>
                      </div>
                      {isCurrent && (
                        <Badge className="bg-[#1B7B8A] text-white">Atual</Badge>
                      )}
                    </div>

                    <div className="rounded-lg border border-dashed border-[#1B7B8A]/20 bg-[#1B7B8A]/5 px-3 py-2 text-sm text-[#0D3B45]">
                      Ate {plan.maxSpaces} espacos/quadras incluidos.
                    </div>

                    <div className="space-y-2">
                      {plan.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-start gap-2 text-sm text-foreground"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1B7B8A]" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      className={
                        isSelected
                          ? 'w-full bg-[#FF6B00] text-white hover:bg-[#E66000]'
                          : 'w-full border-[#0D3B45] text-[#0D3B45]'
                      }
                      onClick={() => setSelectedPlanKey(plan.key)}
                    >
                      {isSelected ? 'Plano selecionado' : 'Selecionar plano'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {!hasSubscription && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Nenhuma assinatura ativa</p>
              <p className="text-sm text-muted-foreground">
                {selectedPlan
                  ? `Cadastre um cartao para ativar o plano ${selectedPlan.label}.`
                  : 'Cadastre um cartao para ativar sua assinatura.'}
              </p>
            </div>
            <Button
              onClick={() => handleOpenCardModal()}
              disabled={actionLoading || !selectedPlan}
              className="bg-[#FF6B00] text-white hover:bg-[#E66000]"
            >
              {actionLoading ? 'Aguarde...' : 'Cadastrar cartao e ativar'}
            </Button>
          </CardContent>
        </Card>
      )}

      {hasSubscription && (
        <Tabs defaultValue="dados-basicos">
          <TabsList variant="line">
            <TabsTrigger value="dados-basicos">Dados basicos</TabsTrigger>
            <TabsTrigger value="historico">Historico de pagamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="dados-basicos" className="mt-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardContent className="space-y-5 pt-6">
                  <h3 className="text-lg font-semibold">Plano de assinatura</h3>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Plano atual
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {subscription.planLabel ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="mt-0.5 text-sm font-medium">
                        {subscription.priceCents
                          ? formatPrice(subscription.priceCents)
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Renovacao</p>
                      <p className="mt-0.5 text-sm font-medium">
                        {subscription.currentPeriodEnd
                          ? formatDate(subscription.currentPeriodEnd)
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Forma de pagamento
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {subscription.paymentMethod ?? '—'}
                      </p>
                    </div>
                  </div>

                  {subscription.status === 'past_due' && (
                    <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      Pagamento em atraso. Atualize o cartao para regularizar a
                      assinatura.
                    </div>
                  )}

                  {planSelectionEnabled &&
                    selectedPlan &&
                    selectedPlan.key !== subscription.planKey && (
                      <div className="space-y-3 rounded-lg border border-[#FF6B00]/20 bg-[#FF6B00]/5 p-4">
                        <div>
                          <p className="text-sm font-medium text-[#0D3B45]">
                            Plano selecionado para troca
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {selectedPlan.label} por{' '}
                            {formatPrice(selectedPlan.priceCents)} ao mes.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => handleOpenCardModal(selectedPlan.key)}
                          disabled={actionLoading}
                          className="bg-[#FF6B00] text-white hover:bg-[#E66000]"
                        >
                          {actionLoading
                            ? 'Processando...'
                            : `Trocar para ${selectedPlan.label}`}
                        </Button>
                      </div>
                    )}

                  <div className="pt-1">
                    {subscription.cancelAtPeriodEnd ? (
                      <button
                        onClick={handleReactivate}
                        disabled={actionLoading}
                        className="text-sm text-[#FF6B00] hover:underline disabled:opacity-50"
                      >
                        Manter assinatura
                      </button>
                    ) : (
                      subscription.status === 'active' && (
                        <button
                          onClick={() => setCancelModalOpen(true)}
                          disabled={actionLoading}
                          className="text-sm text-[#1B7B8A] hover:underline disabled:opacity-50"
                        >
                          Cancelar assinatura
                        </button>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-5 pt-6">
                  <h3 className="text-lg font-semibold">Dados do cartao</h3>

                  {subscription.card ? (
                    <>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Bandeira
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {capitalizeFirst(subscription.card.brand)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Terminando em
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {subscription.card.last4}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Proximo debito
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {subscription.currentPeriodEnd
                              ? formatDate(subscription.currentPeriodEnd)
                              : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() =>
                            handleOpenCardModal(
                              subscription.planKey ?? selectedPlanKey
                            )
                          }
                          disabled={actionLoading}
                          className="text-sm text-[#1B7B8A] hover:underline disabled:opacity-50"
                        >
                          Alterar cartao
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Nenhum cartao cadastrado.
                      </p>
                      <button
                        onClick={() =>
                          handleOpenCardModal(
                            subscription.planKey ?? selectedPlanKey
                          )
                        }
                        disabled={actionLoading}
                        className="text-sm text-[#1B7B8A] hover:underline disabled:opacity-50"
                      >
                        Cadastrar cartao
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="historico" className="mt-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-4 text-lg font-semibold">Seus pagamentos</h3>

                {initialPaymentHistory.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum pagamento registrado.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[#1B7B8A]">Valor</TableHead>
                        <TableHead className="text-[#1B7B8A]">Status</TableHead>
                        <TableHead className="text-[#1B7B8A]">
                          N do pedido
                        </TableHead>
                        <TableHead className="text-[#1B7B8A]">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {initialPaymentHistory.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {formatPrice(payment.amountCents)}
                          </TableCell>
                          <TableCell>
                            <PaymentStatusBadge status={payment.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {payment.invoiceNumber ?? '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(payment.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={cardModalOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseCardModal();
        }}
      >
        <DialogContent
          showCloseButton
          className="flex h-[min(594px,90vh)] w-[min(588px,calc(100%-2rem))] max-w-[588px] flex-col gap-0 overflow-hidden rounded-xl border-[#E2E8F0] p-0 shadow-xl sm:max-w-[588px]"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-[#E2E8F0] px-8 pb-5 pt-7 text-left sm:text-left">
            <DialogTitle className="pr-10 text-xl font-bold tracking-tight text-[#002B40]">
              {setupData?.planLabel
                ? `Cartão — ${setupData.planLabel}`
                : 'Alterar cartão'}
            </DialogTitle>
            {setupData ? (
              <DialogDescription className="text-sm leading-snug text-[#64748B]">
                O pagamento será vinculado ao plano {setupData.planLabel} (
                {formatPrice(setupData.priceCents)}/mês).
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">
                Carregando formulário de cartão
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            {setupData ? (
              <PaymentMethodCollector
                arenaId={arenaId}
                planKey={setupData.planKey}
                cardCollection={setupData.cardCollection}
                onSuccess={handlePaymentSuccess}
                onError={(msg) => toast.error(msg)}
                onCancel={handleCloseCardModal}
                submitLabel={modalPlanChange ? 'Salvar e trocar plano' : 'Salvar'}
              />
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#CBD5E1] border-t-[#FF6B00]" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#0D3B45]">
              Cancelamento de assinatura
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-foreground">
              Tem certeza que deseja cancelar a renovacao automatica? Seus dados
              permanecem salvos e o acesso continua ativo ate o fim do periodo
              contratado.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-2 flex-row gap-3 sm:justify-start">
            <Button
              variant="outline"
              className="flex-1 border-[#0D3B45] text-[#0D3B45]"
              onClick={() => setCancelModalOpen(false)}
              disabled={actionLoading}
            >
              Fechar
            </Button>
            <Button
              className="flex-1 bg-[#FF6B00] text-white hover:bg-[#E66000]"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              {actionLoading ? 'Cancelando...' : 'Cancelar renovacao'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
