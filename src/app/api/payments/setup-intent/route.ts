import { PaymentApiError } from '@/modules/payments/errors';
import { planKeySchema } from '@/modules/payments/plans';
import { createSetupIntent } from '@/modules/payments/usecases/create-setup-intent.usecase';
import { verifyArenaAccess } from '@/modules/payments/utils/verify-arena-access';
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import z from 'zod';

const RequestSchema = z.object({
  arenaId: z.string().uuid(),
  planKey: planKeySchema,
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const hasAccess = await verifyArenaAccess(userId, parsed.data.arenaId);
  if (!hasAccess)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? '';
    const name = user?.fullName ?? null;

    const result = await createSetupIntent(
      parsed.data.arenaId,
      parsed.data.planKey,
      email,
      name,
      userId
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaymentApiError) return error.toNextResponse();
    console.error('[payments] setup-intent error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
