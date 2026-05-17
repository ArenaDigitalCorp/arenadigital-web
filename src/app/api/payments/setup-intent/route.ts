import { PaymentApiError } from '@/modules/payments/errors';
import { planKeySchema } from '@/modules/payments/plans';
import { createSetupIntent } from '@/modules/payments/usecases/create-setup-intent.usecase';
import { verifyArenaAccess } from '@/modules/payments/utils/verify-arena-access';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import z from 'zod';

const RequestSchema = z.object({
  arenaId: z.string().uuid(),
  planKey: planKeySchema,
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const hasAccess = await verifyArenaAccess(user.id, parsed.data.arenaId);
  if (!hasAccess)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const email = user.email ?? '';
    const meta = user.user_metadata ?? {};
    const fullName =
      [meta.firstName, meta.lastName].filter(Boolean).join(' ') ||
      (typeof meta.name === 'string' ? meta.name : null);

    const result = await createSetupIntent(
      parsed.data.arenaId,
      parsed.data.planKey,
      email,
      fullName,
      user.id
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
