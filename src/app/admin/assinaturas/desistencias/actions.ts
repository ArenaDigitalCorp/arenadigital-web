'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { assertPlatformSuperAdminAccess } from '@/lib/server-auth'
import { actOnSubscriptionWithdrawal } from '@/modules/payments/usecases/subscription-withdrawal.usecase'

const path = '/admin/assinaturas/desistencias'
const schema = z.object({
  requestId: z.uuid(),
  action: z.enum(['approve', 'reject', 'resume']),
  reason: z.string().trim().max(280).refine(value => !/[\p{Cc}]/u.test(value)),
  paymentId: z.string().max(120).optional(),
  amountCents: z.coerce.number().int().nonnegative().optional(),
}).refine(input => input.action === 'resume' || input.reason.length > 0)

export async function reviewSubscriptionWithdrawal(formData: FormData) {
  const reviewer = await assertPlatformSuperAdminAccess()
  const parsed = schema.safeParse({
    requestId: formData.get('requestId'),
    action: formData.get('action'),
    reason: formData.get('reason') ?? '',
    paymentId: formData.get('paymentId') ?? undefined,
    amountCents: formData.get('amountCents') ?? undefined,
  })
  if (!parsed.success) redirect(`${path}?resultado=invalid`)

  const { requestId, action, reason, paymentId, amountCents } = parsed.data
  let outcome = 'updated'
  try {
    await actOnSubscriptionWithdrawal({
      reviewerAuthId: reviewer.authUserId, requestId, action, reason,
      expectedPaymentId: paymentId, expectedAmountCents: amountCents,
    })
  } catch {
    outcome = 'error'
  }
  revalidatePath(path)
  redirect(`${path}?${new URLSearchParams({ pedido: requestId, resultado: outcome })}`)
}
