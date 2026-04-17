import z from 'zod'

// PlanKey e planKeySchema são usados para validação de input nas API routes.
// Os dados dos planos (label, preço, maxSpaces, stripe_price_id) vivem na tabela
// subscription_plans no banco — consulte via subscription-plans.repository.ts.

export const planKeySchema = z.enum(['starter', 'pro', 'max'])
export type PlanKey = z.infer<typeof planKeySchema>

export const EARLY_ACCESS_PLAN_KEY: PlanKey = 'starter'

export function isPlanSelectionEnabled() {
  return process.env.STRIPE_PLAN_SELECTION_ENABLED === 'true'
}

export function resolveCheckoutPlanKey(planKey: PlanKey) {
  return isPlanSelectionEnabled() ? planKey : EARLY_ACCESS_PLAN_KEY
}
