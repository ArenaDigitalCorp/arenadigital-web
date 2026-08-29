'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Building2,
  Check,
  FlaskConical,
  Layers3,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { trackAction } from '@/lib/telemetry/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmActionDialog } from '@/components/dashboard/ConfirmActionDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { arenaDataTable } from '@/lib/arena-data-table';
import { PaymentMethodCollector } from '@/modules/payments/components/PaymentMethodCollector';
import type { CardCollectionContext } from '@/modules/payments/gateway/payment-gateway.interface';
import {
  PARTNER_PLAN_KEY,
  hasUnlimitedSpaces,
  type PlanKey,
  type UserSelectablePlanKey,
} from '@/modules/payments/plans';
import type { PaymentHistoryItem } from '@/modules/payments/usecases/get-payment-history.usecase';
import type { ArenaBillingAddress } from '@/modules/arenas/usecases/get-arena-billing-address.usecase';
import type { ArenaSubscription } from '@/modules/payments/usecases/get-subscription.usecase';

type SetupData = {
  cardCollection: CardCollectionContext;
  planKey: PlanKey;
  planLabel: string;
  priceCents: number;
};

type SubscriptionPlanOption = {
  key: UserSelectablePlanKey;
  label: string;
  priceCents: number;
  maxSpaces: number;
  features: string[];
};

type PlanPresentation = {
  icon: LucideIcon;
  iconClassName: string;
};

interface Props {
  arenaId: string;
  initialSubscription: ArenaSubscription;
  initialPaymentHistory: PaymentHistoryItem[];
  billingAddress: ArenaBillingAddress;
  plans: SubscriptionPlanOption[];
  planSelectionEnabled: boolean;
}

const PLAN_PRESENTATION: Record<UserSelectablePlanKey, PlanPresentation> = {
  experimental: {
    icon: FlaskConical,
    iconClassName: 'bg-orange-50 text-arena-button',
  },
  starter: {
    icon: Layers3,
    iconClassName: 'bg-teal-50 text-teal-700',
  },
  max: {
    icon: ShieldCheck,
    iconClassName: 'bg-sky-50 text-sky-700',
  },
  pro: {
    icon: Trophy,
    iconClassName: 'bg-amber-50 text-amber-700',
  },
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatCalendarOrInstant(value: string) {
  const t = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    return `${d}/${mo}/${y}`;
  }
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return t;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(ms));
}

function formatMaskedCardLine(last4: string) {
  const digits = last4.replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `**** **** **** ${digits}`;
}

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatSpaceLimit(maxSpaces: number) {
  if (hasUnlimitedSpaces(maxSpaces)) return 'Espaços ilimitados.';
  return `Até ${maxSpaces} espaços/quadras incluídos.`;
}

function getPlanRules(plan: SubscriptionPlanOption) {
  return plan.key === 'experimental'
    ? ['Cartão válido obrigatório', 'Acesso gratuito por até 5 dias']
    : ['Contrato anual', 'Cobrança mensal'];
}

function getSubscriptionNotice(subscription: ArenaSubscription) {
  if (subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    return {
      title: 'Cancelamento agendado',
      message: `O acesso segue ativo ate ${formatCalendarOrInstant(subscription.currentPeriodEnd)}. Para continuar usando, clique em "Manter assinatura".`,
      className: 'bg-amber-50 text-amber-700',
    };
  }

  const notices: Partial<
    Record<
      ArenaSubscription['status'],
      { title: string; message: string; className: string }
    >
  > = {
    past_due: {
      title: 'Pagamento em atraso',
      message: 'Atualize o cartao para regularizar a assinatura.',
      className: 'bg-red-50 text-red-700',
    },
    unpaid: {
      title: 'Assinatura com cobranca contestada',
      message:
        'Identificamos um problema grave na cobranca. Atualize o cartao ou entre em contato com o suporte para regularizar o acesso.',
      className: 'bg-red-50 text-red-700',
    },
    incomplete: {
      title: 'Pagamento pendente',
      message:
        'Conclua o checkout ou atualize o cartao para ativar a assinatura.',
      className: 'bg-amber-50 text-amber-700',
    },
    incomplete_expired: {
      title: 'Checkout expirado',
      message: 'Inicie um novo checkout para ativar a assinatura.',
      className: 'bg-amber-50 text-amber-700',
    },
    canceled: {
      title: 'Assinatura cancelada',
      message: 'Cadastre um cartao ou escolha um plano para reativar o acesso.',
      className: 'bg-red-50 text-red-700',
    },
    paused: {
      title: 'Assinatura pausada',
      message: 'Atualize a forma de pagamento ou fale com o suporte.',
      className: 'bg-amber-50 text-amber-700',
    },
  };

  return notices[subscription.status] ?? null;
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
  billingAddress,
  plans,
  planSelectionEnabled,
}: Props) {
  const [subscription, setSubscription] =
    useState<ArenaSubscription>(initialSubscription);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState<UserSelectablePlanKey | null>(
    plans.some((plan) => plan.key === initialSubscription.planKey)
      ? (initialSubscription.planKey as UserSelectablePlanKey)
      : null
  );

  const selectedPlan =
    plans.find((plan) => plan.key === selectedPlanKey) ?? null;
  const isPartnerSubscription = subscription.planKey === PARTNER_PLAN_KEY;
  const isInternalSubscription = subscription.hasInternalAccess;
  const subscriptionNotice = getSubscriptionNotice(subscription);
  const resolveBillingPlanKey = (): PlanKey | null =>
    subscription.planKey ?? selectedPlanKey;

  const hasSubscription =
    isInternalSubscription || subscription.status !== 'none';
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

  async function handleOpenCardModal(
    planKey: PlanKey | null = resolveBillingPlanKey()
  ) {
    if (!planKey) {
      toast.error('Selecione um plano para continuar.');
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch('/api/payments/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arenaId, planKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        trackAction('subscription_setup', 'failure', {
          arena_id: arenaId,
          plan_key: planKey,
          source: 'http_error',
        });
        toast.error(data.error ?? 'Erro ao iniciar cadastro do cartao.');
        return;
      }

      if (data.cardCollection?.provider === 'asaas-checkout') {
        window.location.href = data.cardCollection.checkoutUrl;
        return;
      }

      setSetupData({
        cardCollection: data.cardCollection,
        planKey: data.planKey,
        planLabel: data.planLabel,
        priceCents: data.priceCents,
      });
      trackAction('subscription_setup', 'success', {
        arena_id: arenaId,
        plan_key: planKey,
        provider: data.cardCollection?.provider,
      });
      setCardModalOpen(true);
    } catch (error) {
      trackAction('subscription_setup', 'failure', {
        arena_id: arenaId,
        plan_key: planKey,
        source: error instanceof Error ? 'exception' : 'unknown_error',
      });
      toast.error('Erro ao iniciar cadastro do cartao.');
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
        trackAction('subscription_cancel', 'failure', {
          arena_id: arenaId,
          source: 'http_error',
        });
        const data = await res.json();
        toast.error(data.error ?? 'Erro ao cancelar assinatura.');
        return;
      }

      toast.success(
        'Assinatura cancelada. O acesso segue ativo ate o fim do periodo atual.'
      );
      trackAction('subscription_cancel', 'success', { arena_id: arenaId });
      setCancelModalOpen(false);
      await refreshSubscription();
    } catch (error) {
      trackAction('subscription_cancel', 'failure', {
        arena_id: arenaId,
        source: error instanceof Error ? 'exception' : 'unknown_error',
      });
      toast.error('Erro ao cancelar assinatura.');
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
        trackAction('subscription_reactivate', 'failure', {
          arena_id: arenaId,
          source: 'http_error',
        });
        const data = await res.json();
        toast.error(data.error ?? 'Erro ao reativar assinatura.');
        return;
      }

      toast.success('Assinatura reativada com sucesso.');
      trackAction('subscription_reactivate', 'success', { arena_id: arenaId });
      await refreshSubscription();
    } catch (error) {
      trackAction('subscription_reactivate', 'failure', {
        arena_id: arenaId,
        source: error instanceof Error ? 'exception' : 'unknown_error',
      });
      toast.error('Erro ao reativar assinatura.');
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
        <p className="text-xs font-bold uppercase text-arena-button">
          Configurações financeiras
        </p>
        <h2 className="mt-1 font-heading text-3xl font-black tracking-normal text-arena-navy-800">
          Assinatura
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-arena-navy-800/60">
          Gerencie seu plano, forma de pagamento e historico de cobranca.
        </p>
      </div>

      {planSelectionEnabled &&
        !isPartnerSubscription &&
        !isInternalSubscription && (
          <section>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => {
                const isSelected = plan.key === selectedPlanKey;
                const presentation = PLAN_PRESENTATION[plan.key];
                const PlanIcon = presentation.icon;
                const rules = getPlanRules(plan);

                return (
                  <Card
                    key={plan.key}
                    className={cn(
                      'relative overflow-hidden rounded-lg border-slate-200 bg-white py-0 shadow-sm transition-[border-color,box-shadow,transform] duration-200',
                      isSelected &&
                        'border-arena-button shadow-[0_0_0_1px_rgba(255,107,0,0.16),0_10px_28px_rgba(0,43,64,0.08)]',
                      !isSelected &&
                        'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'
                    )}
                  >
                    <CardContent className="flex h-full flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-lg',
                              presentation.iconClassName
                            )}
                          >
                            <PlanIcon className="h-5 w-5" />
                          </div>
                          <h4 className="font-heading text-lg font-black text-arena-navy-800">
                            {plan.label}
                          </h4>
                        </div>
                      </div>

                      <div className="mt-5 border-y border-slate-100 py-4">
                        <p className="font-heading text-3xl font-black leading-none text-arena-navy-800">
                          {formatPrice(plan.priceCents)}
                          {plan.key !== 'experimental' && (
                            <span className="ml-1 font-sans text-sm font-semibold text-arena-navy-800/50">
                              /mês
                            </span>
                          )}
                        </p>
                        <p className="mt-2 text-xs font-medium text-arena-navy-800/50">
                          {plan.key === 'experimental'
                            ? 'Gratuito por até 5 dias'
                            : 'Plano anual'}
                        </p>
                      </div>

                      <div className="mt-4 flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2.5 text-sm font-bold text-arena-navy-800">
                        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                        <span>{formatSpaceLimit(plan.maxSpaces)}</span>
                      </div>

                      <div className="mt-4 flex-1 space-y-2">
                        {rules.map((rule) => (
                          <div
                            key={rule}
                            className="flex items-start gap-2 text-sm text-arena-navy-800/75"
                          >
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                            <span>{rule}</span>
                          </div>
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        aria-pressed={isSelected}
                        className={cn(
                          'mt-5 w-full rounded-md font-bold',
                          isSelected
                            ? 'bg-arena-button text-white hover:bg-arena-button-hover'
                            : 'border-slate-300 text-arena-navy-800 hover:bg-slate-50'
                        )}
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

                {isInternalSubscription ? (
                  <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-900">
                    <p className="font-medium">Plano interno ativo</p>
                    <p className="mt-1 text-teal-900/70">
                      Acesso liberado pela Arena Digital, sem cobrança e sem
                      necessidade de cartão.
                    </p>
                  </div>
                ) : (
                  !hasSubscription && (
                    <div className="rounded-lg border border-arena-button/20 bg-arena-button/5 px-3 py-2.5 text-sm text-[#0D3B45]">
                      <p className="font-medium">Nenhuma assinatura ativa</p>
                      <p className="mt-1 text-muted-foreground">
                        Cadastre o cartão em &quot;Dados do cartão&quot; nesta
                        página para ativar
                        {selectedPlan
                          ? ` o plano ${selectedPlan.label}`
                          : ' a assinatura'}
                        .
                      </p>
                    </div>
                  )
                )}

                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <div>
                    <p className="text-xs text-muted-foreground">Plano atual</p>
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
                        ? formatCalendarOrInstant(subscription.currentPeriodEnd)
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
                  {subscription.lastPaymentValueCents != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Valor da ultima cobranca
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {formatPrice(subscription.lastPaymentValueCents)}
                      </p>
                    </div>
                  )}
                  {subscription.installmentSummary ? (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Parcelamento
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {subscription.installmentSummary}
                      </p>
                    </div>
                  ) : null}
                  {subscription.lastPaymentConfirmedAt ? (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Cobranca liquidada em
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {formatCalendarOrInstant(
                          subscription.lastPaymentConfirmedAt
                        )}
                      </p>
                    </div>
                  ) : null}
                </div>

                {subscriptionNotice && (
                  <div
                    className={`flex items-start gap-2 rounded-md p-3 text-sm ${subscriptionNotice.className}`}
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">
                        {subscriptionNotice.title}
                      </p>
                      <p>{subscriptionNotice.message}</p>
                    </div>
                  </div>
                )}

                {hasSubscription &&
                  planSelectionEnabled &&
                  !isPartnerSubscription &&
                  !isInternalSubscription &&
                  selectedPlan &&
                  selectedPlan.key !== subscription.planKey && (
                    <div className="space-y-3 rounded-lg border border-arena-button/20 bg-arena-button/5 p-4">
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
                        className="bg-arena-button text-white hover:bg-arena-button-hover"
                      >
                        {actionLoading
                          ? 'Processando...'
                          : `Trocar para ${selectedPlan.label}`}
                      </Button>
                    </div>
                  )}

                {(subscription.cancelAtPeriodEnd ||
                  subscription.status === 'active') && (
                  <div className="grid grid-cols-2 gap-x-8 pt-1">
                    <div />
                    <div>
                      {subscription.cancelAtPeriodEnd ? (
                        <button
                          type="button"
                          onClick={handleReactivate}
                          disabled={actionLoading}
                          className="text-sm text-arena-button hover:underline disabled:opacity-50"
                        >
                          Manter assinatura
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCancelModalOpen(true)}
                          disabled={actionLoading}
                          className="text-sm text-[#1B7B8A] hover:underline disabled:opacity-50"
                        >
                          Cancelar assinatura
                        </button>
                      )}
                    </div>
                  </div>
                )}
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
                        <p className="text-xs text-muted-foreground">Cartão</p>
                        <p className="mt-0.5 text-sm font-medium tracking-wide">
                          {formatMaskedCardLine(subscription.card.last4)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 pt-1">
                      <div />
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenCardModal(resolveBillingPlanKey())
                          }
                          disabled={actionLoading}
                          className="text-sm text-[#1B7B8A] hover:underline disabled:opacity-50"
                        >
                          Alterar cartao
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Nenhum cartao cadastrado.
                    </p>
                    {isInternalSubscription ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-muted-foreground">
                        O plano interno não exige cartão cadastrado.
                      </div>
                    ) : !hasSubscription ? (
                      <Button
                        type="button"
                        onClick={() => handleOpenCardModal(selectedPlanKey)}
                        disabled={actionLoading || !selectedPlan}
                        className="bg-arena-button text-white hover:bg-arena-button-hover"
                      >
                        {actionLoading
                          ? 'Aguarde...'
                          : 'Cadastrar cartao e ativar'}
                      </Button>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-8">
                        <div />
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCardModal(resolveBillingPlanKey())
                            }
                            disabled={actionLoading}
                            className="text-sm text-[#1B7B8A] hover:underline disabled:opacity-50"
                          >
                            Cadastrar cartao
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-5 pt-6">
                <h3 className="text-lg font-semibold">Endereço de cobrança</h3>

                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <div>
                    <p className="text-xs text-muted-foreground">CPF / CNPJ</p>
                    <p className="mt-0.5 text-sm font-medium">
                      {billingAddress.cpfCnpj ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Logradouro</p>
                    <p className="mt-0.5 text-sm font-medium">
                      {billingAddress.street ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bairro</p>
                    <p className="mt-0.5 text-sm font-medium">
                      {billingAddress.neighborhood ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cidade</p>
                    <p className="mt-0.5 text-sm font-medium">
                      {billingAddress.city ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">UF</p>
                    <p className="mt-0.5 text-sm font-medium">
                      {billingAddress.stateUf ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Número</p>
                    <p className="mt-0.5 text-sm font-medium">
                      {billingAddress.number ?? '—'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Complemento</p>
                    <p className="mt-0.5 text-sm font-medium">
                      {billingAddress.complement ?? '—'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-8 pt-1">
                  <div />
                  <div>
                    <Link
                      href={`/dashboard/arenas/${arenaId}/edit`}
                      className="text-sm text-[#1B7B8A] hover:underline"
                    >
                      Editar
                    </Link>
                  </div>
                </div>
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
                <Table className={arenaDataTable.table}>
                  <TableHeader>
                    <TableRow className={arenaDataTable.theadRow}>
                      <TableHead className={arenaDataTable.th}>Valor</TableHead>
                      <TableHead className={arenaDataTable.th}>
                        Status
                      </TableHead>
                      <TableHead className={arenaDataTable.th}>
                        N do pedido
                      </TableHead>
                      <TableHead className={arenaDataTable.th}>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialPaymentHistory.map((payment) => (
                      <TableRow
                        key={payment.id}
                        className={arenaDataTable.tbodyRow}
                      >
                        <TableCell className={arenaDataTable.tdBold}>
                          {formatPrice(payment.amountCents)}
                        </TableCell>
                        <TableCell className={arenaDataTable.td}>
                          <PaymentStatusBadge status={payment.status} />
                        </TableCell>
                        <TableCell
                          className={cn(
                            arenaDataTable.td,
                            'text-arena-navy-800/60'
                          )}
                        >
                          {payment.invoiceNumber ?? '—'}
                        </TableCell>
                        <TableCell
                          className={cn(
                            arenaDataTable.td,
                            'text-arena-navy-800/60'
                          )}
                        >
                          {formatCalendarOrInstant(payment.createdAt)}
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
            <DialogTitle className="pr-10 text-xl font-bold tracking-tight text-arena-navy-800">
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
                submitLabel={
                  modalPlanChange ? 'Salvar e trocar plano' : 'Salvar'
                }
              />
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#CBD5E1] border-t-arena-button" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancelamento de assinatura"
        description="Tem certeza que deseja cancelar a renovacao automatica? Seus dados permanecem salvos e o acesso continua ativo ate o fim do periodo contratado."
        confirmLabel="Cancelar renovacao"
        loadingLabel="Cancelando..."
        loading={actionLoading}
        onConfirm={handleCancel}
      />
    </div>
  );
}
