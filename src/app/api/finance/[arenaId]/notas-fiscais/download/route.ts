import { z } from 'zod'
import { assertArenaResourceAccess, AuthorizationError } from '@/lib/server-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const input = z.object({ invoiceId: z.uuid(), format: z.enum(['pdf', 'xml']) })
const documentResult = z.object({ url: z.url() })
const privateHeaders = { 'Cache-Control': 'private, no-store' }

function failure(status: number) {
  return new Response(null, { status, headers: privateHeaders })
}

export async function POST(request: Request, { params }: { params: Promise<{ arenaId: string }> }) {
  const { arenaId } = await params
  const parsed = input.safeParse(await request.json().catch(() => null))
  if (!z.uuid().safeParse(arenaId).success || !parsed.success) return failure(400)

  const invoiceId = parsed.data.invoiceId.toLowerCase()
  const { format } = parsed.data

  try {
    await assertArenaResourceAccess(arenaId, 'finance.overview')
    const session = await createSupabaseServerClient()
    const { data, error } = await session.functions.invoke<unknown>('booking-fiscal-documents', { body: { invoiceId, format } })
    if (error) {
      const status = error.context instanceof Response ? error.context.status : 503
      return failure([401, 403, 404, 409].includes(status) ? status : 503)
    }

    const signed = documentResult.safeParse(data)
    if (!signed.success) return failure(503)

    const url = new URL(signed.data.url)
    const storageOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin
    const documentPath = `/storage/v1/object/sign/booking-fiscal-documents/${invoiceId}/invoice.${format}`
    if (url.origin !== storageOrigin || url.pathname !== documentPath || !url.searchParams.get('token')) {
      return failure(503)
    }

    const file = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) })
    if (!file.ok || !file.body) return failure(503)
    return new Response(file.body, {
      headers: {
        ...privateHeaders,
        'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/xml',
        'Content-Disposition': `attachment; filename="nfse-${invoiceId}.${format}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof AuthorizationError) return failure(error.status)
    return failure(503)
  }
}
