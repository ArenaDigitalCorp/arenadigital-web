'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useArena } from '@/contexts/ArenaContext'
import { useDbUser } from '@/contexts/UserContext'
import { CURRENT_ONBOARDING_VERSION } from '@/lib/onboarding'
import { PARTNER_PLAN_KEY } from '@/modules/payments/plans'
import {
  hasUsableSubscription,
  isExpiredExperimentalSubscription,
} from '@/modules/payments/subscription-rules'

type SubscriptionSnapshot = {
  status: string
  hasInternalAccess: boolean
  planKey: string | null
  currentPeriodEnd: string | null
  card: unknown | null
}

type State =
  | { status: 'idle' }
  | { status: 'ready'; arenaId: string; subscription: SubscriptionSnapshot }
  | { status: 'error'; arenaId: string }

const PAYMENT_ISSUE_STATUSES = new Set([
  'past_due',
  'unpaid',
  'incomplete',
  'incomplete_expired',
])

export function DashboardSubscriptionGate() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { dbUser } = useDbUser()
  const { selectedArena, selectedArenaDetails, isLoadingArenas } = useArena()
  const [state, setState] = useState<State>({ status: 'idle' })
  const isGlobalAdminRoute = pathname.startsWith('/dashboard/admin')
  const isTutorialAccess = Boolean(
    searchParams.get('tutorial') === '1' &&
    dbUser &&
    dbUser.onboarding_version < CURRENT_ONBOARDING_VERSION
  )

  const canManageSubscription = Boolean(
    selectedArenaDetails?.isOwner || selectedArenaDetails?.role === 'Gestor'
  )

  useEffect(() => {
    if (isGlobalAdminRoute || isTutorialAccess || isLoadingArenas || !selectedArena || !canManageSubscription) {
      return
    }

    const controller = new AbortController()

    fetch(`/api/payments/subscriptions/${selectedArena}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('subscription fetch failed')
        const data = (await res.json()) as SubscriptionSnapshot
        setState({ status: 'ready', arenaId: selectedArena, subscription: data })
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ status: 'error', arenaId: selectedArena })
      })

    return () => controller.abort()
  }, [canManageSubscription, isGlobalAdminRoute, isLoadingArenas, isTutorialAccess, selectedArena])

  useEffect(() => {
    if (
      isGlobalAdminRoute ||
      isTutorialAccess ||
      !selectedArena ||
      !canManageSubscription ||
      state.status !== 'ready' ||
      state.arenaId !== selectedArena
    ) {
      return
    }

    const subscriptionPath = `/dashboard/settings/subscription/${selectedArena}`
    if (pathname.startsWith('/dashboard/settings/subscription')) return

    const isDashboardHome = pathname === '/dashboard'
    const isExpiredExperimental = isExpiredExperimentalSubscription(
      state.subscription
    )
    const hasAccess = hasUsableSubscription(state.subscription)
    const partnerNeedsCard =
      state.subscription.planKey === PARTNER_PLAN_KEY && !state.subscription.card

    if (
      isExpiredExperimental ||
      (partnerNeedsCard && !isDashboardHome) ||
      (!hasAccess && !isDashboardHome)
    ) {
      router.replace(subscriptionPath)
    }
  }, [canManageSubscription, isGlobalAdminRoute, isTutorialAccess, pathname, router, selectedArena, state])

  if (
    isGlobalAdminRoute ||
    isTutorialAccess ||
    !selectedArena ||
    !canManageSubscription ||
    state.status !== 'ready' ||
    state.arenaId !== selectedArena ||
    !PAYMENT_ISSUE_STATUSES.has(state.subscription.status)
  ) {
    return null
  }

  return (
    <button
      type="button"
      onClick={() => router.push(`/dashboard/settings/subscription/${selectedArena}`)}
      className="mb-4 w-full rounded-md bg-gradient-to-r from-orange-500 to-yellow-400 px-4 py-3 text-center text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95"
    >
      Sua assinatura <strong>não foi paga</strong>. Regularize para evitar o
      cancelamento da assinatura <span className="underline">clicando aqui</span>
    </button>
  )
}
