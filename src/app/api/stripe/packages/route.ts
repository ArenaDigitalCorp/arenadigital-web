import { fetchAllActivePlans } from '@/modules/stripe/repositories/subscription-plans.repository'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const plans = await fetchAllActivePlans()

    return NextResponse.json(
      plans.map(({ key, label, price_cents, max_spaces, features }) => ({
        key,
        label,
        priceCents: price_cents,
        maxSpaces: max_spaces,
        features: Array.isArray(features)
          ? features.filter((feature): feature is string => typeof feature === 'string')
          : []
      }))
    )
  } catch (error) {
    console.error('[stripe] packages error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
