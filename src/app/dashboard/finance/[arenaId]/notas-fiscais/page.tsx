import Link from 'next/link'
import { AlertCircle, ArrowLeft, ArrowRight, FileText } from 'lucide-react'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'
import { assertArenaResourceAccess, AuthorizationError } from '@/lib/server-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import {
  BookingFiscalDocumentActions,
  RefreshBookingFiscalInvoices,
} from '@/modules/finance/components/BookingFiscalDocumentActions'

const pageSize = 20
const lastSupportedPage = 5_001 // The listing RPC caps the offset at 100,000.
const invoiceRows = z.array(z.object({
  id: z.uuid(),
  booking_id: z.uuid().nullable(),
  operation_id: z.uuid().nullable(),
  status: z.string(),
  invoice_number: z.string().nullable(),
  amount_cents: z.number().int().nonnegative(),
  refunded_amount_cents: z.number().int().nonnegative().nullable().default(null),
  effective_date: z.iso.date().nullable(),
  authorized_at: z.iso.datetime({ offset: true }).nullable(),
  failure_code: z.string().nullable(),
  has_pdf: z.boolean(),
  has_xml: z.boolean().default(false),
}))

type Invoice = z.infer<typeof invoiceRows>[number]

type InvoiceListClient = {
  rpc(name: 'list_arena_booking_fiscal_invoices', args: {
    p_arena_id: string
    p_limit: number
    p_offset: number
  }): Promise<{ data: unknown; error: { code?: string } | null }>
}

const tones = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  progress: 'border-sky-200 bg-sky-50 text-sky-800',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  review: 'border-amber-200 bg-amber-50 text-amber-900',
}

const statusLabels: Record<string, { label: string; tone: keyof typeof tones }> = {
  queued: { label: 'Aguardando emissão', tone: 'progress' },
  scheduling: { label: 'Preparando emissão', tone: 'progress' },
  pending: { label: 'Aguardando autorização', tone: 'progress' },
  authorized: { label: 'Autorizada', tone: 'done' },
  review: { label: 'Requer revisão', tone: 'review' },
  cancel_queued: { label: 'Aguardando cancelamento', tone: 'progress' },
  canceling: { label: 'Cancelamento em andamento', tone: 'progress' },
  canceled: { label: 'Cancelada', tone: 'neutral' },
  suppressed: { label: 'Emissão suspensa', tone: 'neutral' },
}

const authorizationDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })

function describeReview(invoice: Invoice) {
  const code = invoice.failure_code
  if (code === 'partial_refund') {
    return 'Estorno parcial confirmado. Consulte a contabilidade para definir a correção fiscal.'
  }
  if (invoice.status === 'review' && (code?.startsWith('provider_cancel') || code === 'full_refund_review' || (invoice.authorized_at && code === 'provider_fiscal_error'))) {
    return 'Cancelamento fiscal depende de revisão. Confirme a situação com a contabilidade antes de emitir outra nota.'
  }
  if (code === 'fiscal_profile_incomplete' && invoice.status === 'review') {
    return 'Confira com a contabilidade os dados fiscais da arena e o código do serviço.'
  }
  if (invoice.status === 'review') {
    return 'Informe o código desta operação ao suporte para verificar a pendência fiscal.'
  }
  return null
}

async function loadInvoices(arenaId: string, offset: number) {
  try {
    await assertArenaResourceAccess(arenaId, 'finance.overview')
    const session = await createSupabaseServerClient()
    // Keep the web migration independent of generated types until the DB contract is released.
    const client = session as unknown as InvoiceListClient
    const { data, error } = await client.rpc('list_arena_booking_fiscal_invoices', {
      p_arena_id: arenaId,
      p_limit: pageSize + 1,
      p_offset: offset,
    })
    if (error?.code === 'PGRST202' || error?.code === '42883') return { state: 'unavailable' } as const
    if (error?.code === '42501') return { state: 'forbidden' } as const
    if (error) return { state: 'error' } as const
    const parsed = invoiceRows.safeParse(data)
    return parsed.success ? { state: 'ready', rows: parsed.data } as const : { state: 'error' } as const
  } catch (error) {
    return { state: error instanceof AuthorizationError ? 'forbidden' : 'error' } as const
  }
}

const listMessages = {
  forbidden: { title: 'Acesso restrito', description: 'Seu perfil precisa de acesso à visão geral do Financeiro desta arena.' },
  unavailable: { title: 'Notas fiscais indisponíveis neste ambiente', description: 'A consulta ficará disponível após a atualização do banco.' },
  error: { title: 'Não foi possível carregar as notas', description: 'Tente novamente. Se o problema continuar, fale com o suporte.' },
}

const listColumns = 'xl:grid xl:grid-cols-[minmax(9rem,1.1fr)_minmax(11rem,1.45fr)_minmax(8rem,0.9fr)_minmax(6rem,0.65fr)_minmax(9rem,0.8fr)] xl:gap-4'

function InvoiceRow({ invoice, arenaId }: { invoice: Invoice; arenaId: string }) {
  const status = Object.hasOwn(statusLabels, invoice.status)
    ? statusLabels[invoice.status]
    : { label: 'Status indisponível', tone: 'neutral' as const }
  const review = describeReview(invoice)
  const reference = invoice.booking_id ?? invoice.operation_id ?? invoice.id
  const canDownload = invoice.authorized_at !== null && invoice.status !== 'canceled'
  const formats: ('pdf' | 'xml')[] = []
  if (canDownload) {
    if (invoice.has_pdf) formats.push('pdf')
    if (invoice.has_xml) formats.push('xml')
  }

  return (
    <li className={cn('space-y-4 px-5 py-5 xl:items-start xl:space-y-0 xl:px-6', listColumns)}>
      <div className="space-y-1">
        <p className="break-words text-sm font-bold text-arena-navy-950">
          {invoice.invoice_number ? `NFS-e ${invoice.invoice_number}` : 'NFS-e sem número'}
        </p>
        <details className="text-xs text-slate-600">
          <summary className="w-fit cursor-pointer">
            {invoice.booking_id ? 'Reserva' : 'Referência'} <span className="font-mono">{reference.slice(0, 8)}</span>
          </summary>
          <p className="mt-1 break-all font-mono text-[11px]">{reference}</p>
        </details>
      </div>
      <div className="space-y-2">
        <Badge variant="outline" className={cn('max-w-full whitespace-normal text-left', tones[status.tone])}>{status.label}</Badge>
        {review && <p className="max-w-64 text-xs leading-relaxed text-slate-700">{review}</p>}
      </div>
      <dl className="grid grid-cols-2 gap-y-2 text-sm xl:grid-cols-1">
        <div>
          <dt className="text-xs text-slate-600 xl:sr-only">Competência</dt>
          <dd className="tabular-nums">{formatDate(invoice.effective_date)}</dd>
        </div>
        {invoice.authorized_at && (
          <div>
            <dt className="text-xs text-slate-600">Autorização</dt>
            <dd className="tabular-nums">{authorizationDate.format(new Date(invoice.authorized_at))}</dd>
          </div>
        )}
      </dl>
      <dl className="space-y-2 text-sm tabular-nums">
        <div>
          <dt className="text-xs text-slate-600 xl:sr-only">Valor da nota</dt>
          <dd className="font-semibold">{formatCurrency(invoice.amount_cents / 100)}</dd>
        </div>
        {invoice.refunded_amount_cents !== null && (
          <div>
            <dt className="text-xs text-slate-600">Estorno confirmado</dt>
            <dd>{formatCurrency(invoice.refunded_amount_cents / 100)}</dd>
          </div>
        )}
      </dl>
      {formats.length > 0 ? (
        <BookingFiscalDocumentActions arenaId={arenaId} invoiceId={invoice.id} formats={formats} />
      ) : (
        <p className="text-xs text-slate-600 xl:pt-1">
          {canDownload ? 'Arquivos em processamento' : 'Sem arquivos disponíveis'}
        </p>
      )}
    </li>
  )
}

export default async function BookingFiscalInvoicesPage({ params, searchParams }: {
  params: Promise<{ arenaId: string }>
  searchParams: Promise<{ pagina?: string | string[] }>
}) {
  const [{ arenaId }, { pagina }] = await Promise.all([params, searchParams])
  const requestedPage = typeof pagina === 'string' && /^[1-9]\d{0,4}$/.test(pagina) ? Number(pagina) : 1
  const page = Math.min(requestedPage, lastSupportedPage)
  const offset = (page - 1) * pageSize
  const result = await loadInvoices(arenaId, offset)
  const path = `/dashboard/finance/${arenaId}/notas-fiscais`

  return (
    <section className="space-y-6 pb-10 text-arena-navy-950">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight">Notas fiscais</h1>
          <p className="max-w-xl text-sm text-slate-600">Acompanhe a emissão e baixe as NFS-e das reservas desta arena.</p>
        </div>
        {result.state === 'ready' && <RefreshBookingFiscalInvoices />}
      </header>

      {result.state === 'ready' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          {result.rows.length > 0 ? (
            <>
              <div aria-hidden="true" className={cn('hidden border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-bold text-slate-700', listColumns)}>
                <span>Nota e reserva</span><span>Situação</span><span>Competência</span><span>Valor</span><span>Arquivos</span>
              </div>
              <ul aria-label="Notas fiscais das reservas" className="divide-y divide-slate-100">
                {result.rows.slice(0, pageSize).map(invoice => <InvoiceRow key={invoice.id} invoice={invoice} arenaId={arenaId} />)}
              </ul>
            </>
          ) : (
            <div className="flex items-start gap-4 px-5 py-10 sm:px-6">
              <div className="rounded-xl bg-slate-100 p-3"><FileText aria-hidden className="size-5" /></div>
              <div className="space-y-1">
                <h2 className="font-bold">Nenhuma nota fiscal nesta página</h2>
                <p className="text-sm text-slate-600">As notas das reservas aparecem aqui quando entram no processo de emissão.</p>
              </div>
            </div>
          )}
          {(page > 1 || result.rows.length > pageSize) && (
            <nav aria-label="Paginação das notas fiscais" className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3 sm:px-6">
              <span className="mr-auto text-xs font-medium text-slate-600">Página {page.toLocaleString('pt-BR')}</span>
              {page > 1 && <Button asChild size="sm" variant="outline"><Link href={page === 2 ? path : `${path}?pagina=${page - 1}`}><ArrowLeft /> Anterior</Link></Button>}
              {page < lastSupportedPage && result.rows.length > pageSize && <Button asChild size="sm" variant="outline"><Link href={`${path}?pagina=${page + 1}`}>Próxima <ArrowRight /></Link></Button>}
            </nav>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-slate-600" />
            <div className="space-y-1">
              <h2 className="font-bold">{listMessages[result.state].title}</h2>
              <p className="text-sm text-slate-600">{listMessages[result.state].description}</p>
            </div>
          </div>
          {result.state !== 'forbidden' && <RefreshBookingFiscalInvoices>Tentar novamente</RefreshBookingFiscalInvoices>}
        </div>
      )}
    </section>
  )
}
