import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthorizationError } from '@/lib/server-auth'
import { observeHttpRequest } from '@/lib/observability/server'
import { AsaasDocumentError } from '@/modules/arenas/domain/asaas-documents'
import { assertAsaasDocumentUploadOrigin, parseAsaasDocumentUploadRequest } from '@/modules/arenas/domain/asaas-document-upload-request'
import { assertArenaFinancialOnboardingAccess } from '@/modules/arenas/services/financial-onboarding-access'
import { AsaasDocumentUploadError, getArenaAsaasDocuments, uploadArenaAsaasDocument } from '@/modules/arenas/services/asaas-documents.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RouteContext = { params: Promise<{ arenaId: string }> }
const arenaIdSchema = z.string().uuid()

function errorResponse(error: unknown): NextResponse {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ success: false, error: error.status === 401 ? 'Entre na sua conta para continuar.' : 'Você não tem permissão para gerenciar os documentos desta arena.' }, { status: error.status })
  }
  if (error instanceof AsaasDocumentError) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      ...(error instanceof AsaasDocumentUploadError ? { data: { requestId: error.requestId, status: error.attemptStatus } } : {}),
    }, { status: error.status })
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ success: false, error: 'Arena inválida.' }, { status: 400 })
  }
  return NextResponse.json({ success: false, error: 'Não foi possível concluir a solicitação de documentos. Tente atualizar novamente.' }, { status: 503 })
}

export async function GET(request: Request, context: RouteContext) {
  const observer = observeHttpRequest(request, { component: 'arena_asaas_documents', operation: 'list' })
  try {
    const arenaId = arenaIdSchema.parse((await context.params).arenaId)
    const access = await assertArenaFinancialOnboardingAccess(arenaId)
    const documents = await getArenaAsaasDocuments(arenaId, access.dbUserId)
    return observer.respond(NextResponse.json({ success: true, data: documents }))
  } catch (error) {
    observer.log('warn', 'arena_asaas_documents.list.rejected', { reason_code: error instanceof AsaasDocumentError ? error.code : 'request_rejected' })
    return observer.respond(errorResponse(error))
  }
}

export async function POST(request: Request, context: RouteContext) {
  const observer = observeHttpRequest(request, { component: 'arena_asaas_documents', operation: 'upload' })
  try {
    assertAsaasDocumentUploadOrigin(request)
    const arenaId = arenaIdSchema.parse((await context.params).arenaId)
    const access = await assertArenaFinancialOnboardingAccess(arenaId)
    const uploadRequest = await parseAsaasDocumentUploadRequest(request)
    const upload = await uploadArenaAsaasDocument({ arenaId, actorId: access.dbUserId, ...uploadRequest })
    return observer.respond(NextResponse.json({ success: true, data: upload }))
  } catch (error) {
    observer.log('warn', 'arena_asaas_documents.upload.rejected', { reason_code: error instanceof AsaasDocumentError ? error.code : 'request_rejected' })
    return observer.respond(errorResponse(error))
  }
}
