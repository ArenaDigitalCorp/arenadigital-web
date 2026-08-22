'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useArena } from '@/contexts/ArenaContext';
import { useDbUser } from '@/contexts/UserContext';
import { CURRENT_ONBOARDING_VERSION } from '@/lib/onboarding';
import {
  EXPERIMENTAL_PLAN_KEY,
  PARTNER_PLAN_KEY,
} from '@/modules/payments/plans';
import {
  hasUsableSubscription,
  isExpiredExperimentalSubscription,
} from '@/modules/payments/subscription-rules';

type SubscriptionSnapshot = {
  status: string;
  hasInternalAccess: boolean;
  planKey: string | null;
  currentPeriodEnd: string | null;
  card: unknown | null;
};

type State =
  | { status: 'idle' }
  | { status: 'ready'; arenaId: string; subscription: SubscriptionSnapshot }
  | { status: 'error'; arenaId: string };

const PAYMENT_ISSUE_STATUSES = new Set([
  'past_due',
  'unpaid',
  'incomplete',
  'incomplete_expired',
]);

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getExperimentalNotice(subscription: SubscriptionSnapshot) {
  if (
    subscription.planKey !== EXPERIMENTAL_PLAN_KEY ||
    !ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status) ||
    !subscription.currentPeriodEnd
  ) {
    return null;
  }

  const periodEnd = Date.parse(subscription.currentPeriodEnd);
  if (Number.isNaN(periodEnd)) return null;

  const formattedEnd = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(periodEnd));
  const remainingDays = Math.max(
    0,
    Math.ceil((periodEnd - Date.now()) / DAY_IN_MS)
  );

  if (remainingDays === 0) {
    return {
      expired: true,
      message:
        'Seu Plano Experimental terminou. Escolha um plano para continuar usando a Arena Digital.',
    };
  }

  return {
    expired: false,
    message: `Plano Experimental ativo: ${remainingDays === 1 ? 'resta 1 dia' : `restam ${remainingDays} dias`} de acesso gratuito, até ${formattedEnd}.`,
  };
}

export function DashboardSubscriptionGate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dbUser } = useDbUser();
  const { selectedArena, selectedArenaDetails, isLoadingArenas } = useArena();
  const [state, setState] = useState<State>({ status: 'idle' });
  const isGlobalAdminRoute = pathname.startsWith('/dashboard/admin');
  const isTutorialAccess = Boolean(
    searchParams.get('tutorial') === '1' &&
    dbUser &&
    dbUser.onboarding_version < CURRENT_ONBOARDING_VERSION
  );

  const canManageSubscription = Boolean(
    selectedArenaDetails?.isOwner || selectedArenaDetails?.role === 'Gestor'
  );

  const experimentalNotice =
    state.status === 'ready' && state.arenaId === selectedArena
      ? getExperimentalNotice(state.subscription)
      : null;

  useEffect(() => {
    if (
      isGlobalAdminRoute ||
      isTutorialAccess ||
      isLoadingArenas ||
      !selectedArena ||
      !canManageSubscription
    ) {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/payments/subscriptions/${selectedArena}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('subscription fetch failed');
        const data = (await res.json()) as SubscriptionSnapshot;
        setState({
          status: 'ready',
          arenaId: selectedArena,
          subscription: data,
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setState({ status: 'error', arenaId: selectedArena });
      });

    return () => controller.abort();
  }, [
    canManageSubscription,
    isGlobalAdminRoute,
    isLoadingArenas,
    isTutorialAccess,
    selectedArena,
  ]);

  useEffect(() => {
    if (
      isGlobalAdminRoute ||
      isTutorialAccess ||
      !selectedArena ||
      !canManageSubscription ||
      state.status !== 'ready' ||
      state.arenaId !== selectedArena
    ) {
      return;
    }

    const subscriptionPath = `/dashboard/settings/subscription/${selectedArena}`;
    if (pathname.startsWith('/dashboard/settings/subscription')) return;

    const isDashboardHome = pathname === '/dashboard';
    const isExpiredExperimental = isExpiredExperimentalSubscription(
      state.subscription
    );
    const hasAccess = hasUsableSubscription(state.subscription);
    const partnerNeedsCard =
      state.subscription.planKey === PARTNER_PLAN_KEY &&
      !state.subscription.card;

    if (
      isExpiredExperimental ||
      (partnerNeedsCard && !isDashboardHome) ||
      (!hasAccess && !isDashboardHome)
    ) {
      router.replace(subscriptionPath);
    }
  }, [
    canManageSubscription,
    isGlobalAdminRoute,
    isTutorialAccess,
    pathname,
    router,
    selectedArena,
    state,
  ]);

  if (
    isGlobalAdminRoute ||
    isTutorialAccess ||
    !selectedArena ||
    !canManageSubscription ||
    state.status !== 'ready' ||
    state.arenaId !== selectedArena ||
    (!PAYMENT_ISSUE_STATUSES.has(state.subscription.status) &&
      !experimentalNotice)
  ) {
    return null;
  }

  const hasPaymentIssue = PAYMENT_ISSUE_STATUSES.has(state.subscription.status);

  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/dashboard/settings/subscription/${selectedArena}`)
      }
      className="-mt-2 mb-4 w-full cursor-pointer rounded-md bg-gradient-to-r from-orange-500 to-yellow-400 px-4 py-3 text-center text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 md:-mt-3 lg:-mt-4"
    >
      {hasPaymentIssue ? (
        <>
          Sua assinatura <strong>não foi paga</strong>. Regularize para evitar o
          cancelamento da assinatura{' '}
          <span className="underline">clicando aqui</span>
        </>
      ) : (
        <>
          {experimentalNotice?.message}{' '}
          <span className="underline">
            {experimentalNotice?.expired
              ? 'Escolher um plano'
              : 'Conhecer os planos'}
          </span>
        </>
      )}
    </button>
  );
}
