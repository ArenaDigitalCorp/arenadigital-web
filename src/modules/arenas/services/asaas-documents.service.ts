import 'server-only'

import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { AsaasDocumentError, validateAsaasDocumentFile } from '@/modules/arenas/domain/asaas-documents'
import { AsaasDocumentProviderError, createArenaAsaasDocumentTransport } from '@/modules/arenas/services/asaas-document-transport'
import {
  ASAAS_DOCUMENT_TYPES,
  type ArenaAsaasDocumentGroup,
  type ArenaAsaasDocuments,
  type AsaasDocumentAttemptStatus,
  type AsaasDocumentType,
} from '@/modules/arenas/types/asaas-documents.types'

type RpcError = { code?: string; message?: string }
type DocumentRpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: RpcError | null }>
}
type DocumentAttempt = {
  groupId: string
  type: AsaasDocumentType
  requestId: string
  status: AsaasDocumentAttemptStatus
}
type UploadClaim = { claimed: boolean; status: AsaasDocumentAttemptStatus; requestId: string; requiresExplicitRetry: boolean }

const ATTEMPT_STATUSES: readonly AsaasDocumentAttemptStatus[] = ['processing', 'submitted', 'failed', 'unknown']
const STORAGE_UNAVAILABLE_MESSAGE = 'O envio de documentos pelo painel ainda não está disponível. Entre em contato com o suporte.'

export class AsaasDocumentUploadError extends AsaasDocumentError {
  constructor(
    message: string,
    status: number,
    code: string,
    readonly requestId: string,
    readonly attemptStatus: AsaasDocumentAttemptStatus,
    readonly providerDiagnostics?: {
      httpStatus: AsaasDocumentProviderError['providerHttpStatus']
      errorCodes: AsaasDocumentProviderError['providerErrorCodes']
    },
  ) {
    super(message, status, code)
    this.name = 'AsaasDocumentUploadError'
  }
}

function documentRpc(): DocumentRpcClient {
  return getSupabaseAdmin() as unknown as DocumentRpcClient
}

async function assertDocumentsReadyForConsultation(arenaId: string): Promise<void> {
  const { data, error } = await getSupabaseAdmin()
    .from('arena_payment_accounts')
    .select('updated_at,last_status_checked_at')
    .eq('arena_id', arenaId)
    .eq('provider', 'asaas')
    .maybeSingle()
  if (error || !data) throw storageFailure()
  const updatedAt = Date.parse(data.updated_at)
  if (!data.last_status_checked_at && Number.isFinite(updatedAt) && Date.now() < updatedAt + 15_000) {
    throw new AsaasDocumentError('Aguarde ao menos 15 segundos após criar a subconta antes de consultar os documentos.', 409, 'document_initialization_pending')
  }
}

function isMissingRpc(error: RpcError): boolean {
  return error.code === 'PGRST202' || error.code === '42883'
}

function storageFailure(error?: RpcError): AsaasDocumentError {
  return error?.code === '42501'
    ? new AsaasDocumentError('Você não tem permissão para gerenciar os documentos desta arena.', 403, 'document_access_denied')
    : new AsaasDocumentError(STORAGE_UNAVAILABLE_MESSAGE, 503, 'document_upload_unavailable')
}

async function loadDocumentAttempts(arenaId: string, actorId: string): Promise<DocumentAttempt[] | null> {
  const { data, error } = await documentRpc().rpc('get_arena_asaas_document_uploads', {
    p_arena_id: arenaId,
    p_actor_user_id: actorId,
  })
  if (error) {
    if (isMissingRpc(error)) return null
    throw storageFailure(error)
  }
  if (!Array.isArray(data) || data.length > 100) throw storageFailure()
  const seen = new Set<string>()
  return data.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw storageFailure()
    const attempt = raw as Record<string, unknown>
    const type = ASAAS_DOCUMENT_TYPES.find((candidate) => candidate === attempt.document_type)
    const status = ATTEMPT_STATUSES.find((candidate) => candidate === attempt.status)
    if (
      typeof attempt.document_group_id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,100}$/u.test(attempt.document_group_id) ||
      seen.has(attempt.document_group_id) ||
      typeof attempt.request_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(attempt.request_id) ||
      !type || !status
    ) throw storageFailure()
    seen.add(attempt.document_group_id)
    return { groupId: attempt.document_group_id, type, requestId: attempt.request_id, status }
  })
}

function withAttempts(groups: ArenaAsaasDocumentGroup[], attempts: DocumentAttempt[] | null): ArenaAsaasDocumentGroup[] {
  return groups.map((group) => {
    const attempt = attempts?.find((candidate) => candidate.groupId === group.id)
    const isBlocked = attempt?.status === 'processing' || attempt?.status === 'unknown'
    return { ...group, attemptStatus: attempt?.status ?? null, canUpload: attempts !== null && group.canUpload && !isBlocked }
  })
}

export async function getArenaAsaasDocuments(arenaId: string, actorId: string): Promise<ArenaAsaasDocuments> {
  let attempts = await loadDocumentAttempts(arenaId, actorId)
  await assertDocumentsReadyForConsultation(arenaId)
  const transport = await createArenaAsaasDocumentTransport(arenaId)
  const groups = await transport.list()
  if (attempts !== null) {
    const observedAt = new Date().toISOString()
    for (const group of groups) {
      const attempt = attempts.find((candidate) => candidate.groupId === group.id)
      if (
        (attempt?.status === 'processing' || attempt?.status === 'unknown') &&
        ['PENDING', 'AWAITING_APPROVAL', 'APPROVED'].includes(group.status)
      ) {
        const { error } = await documentRpc().rpc('reconcile_arena_asaas_document_upload', {
          p_arena_id: arenaId,
          p_actor_user_id: actorId,
          p_document_group_id: group.id,
          p_provider_status: group.status,
          p_provider_status_observed_at: observedAt,
        })
        if (error) throw storageFailure(error)
      }
    }
    attempts = await loadDocumentAttempts(arenaId, actorId)
  }
  return { groups: withAttempts(groups, attempts), uploadAvailable: attempts !== null }
}

function parseClaim(data: unknown, requestId: string): UploadClaim {
  if (!data || typeof data !== 'object') throw storageFailure()
  const claim = data as Record<string, unknown>
  const status = ATTEMPT_STATUSES.find((candidate) => candidate === claim.status)
  if (
    typeof claim.claimed !== 'boolean' || !status ||
    typeof claim.request_id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(claim.request_id) ||
    (claim.claimed && claim.request_id !== requestId)
  ) throw storageFailure()
  return {
    claimed: claim.claimed, status, requestId: claim.request_id,
    requiresExplicitRetry: claim.reason_code === 'explicit_retry_required',
  }
}

async function claimUpload(input: {
  arenaId: string
  actorId: string
  group: ArenaAsaasDocumentGroup
  requestId: string
  sha256: string
  observedAt: string
  explicitRetry: boolean
}): Promise<UploadClaim> {
  const { data, error } = await documentRpc().rpc('claim_arena_asaas_document_upload', {
    p_arena_id: input.arenaId,
    p_actor_user_id: input.actorId,
    p_document_group_id: input.group.id,
    p_document_type: input.group.type,
    p_request_id: input.requestId,
    p_content_sha256: input.sha256,
    p_provider_status: input.group.status,
    p_provider_status_observed_at: input.observedAt,
    p_explicit_retry: input.explicitRetry,
  })
  if (error) {
    if (error.code === '22023') {
      throw new AsaasDocumentError('A solicitação de envio mudou. Atualize os documentos e confirme novamente.', 409, 'upload_request_conflict')
    }
    throw storageFailure(error)
  }
  return parseClaim(data, input.requestId)
}

async function finishUpload(input: {
  arenaId: string
  actorId: string
  requestId: string
  outcome: 'submitted' | 'failed' | 'unknown'
  reasonCode: string | null
}): Promise<void> {
  const { data, error } = await documentRpc().rpc('finish_arena_asaas_document_upload', {
    p_arena_id: input.arenaId,
    p_actor_user_id: input.actorId,
    p_request_id: input.requestId,
    p_outcome: input.outcome,
    p_reason_code: input.reasonCode,
  })
  if (error || !data || typeof data !== 'object' || !('status' in data) || data.status !== input.outcome) {
    throw new AsaasDocumentUploadError(
      'O resultado do envio precisa de conferência. Atualize os documentos antes de enviar novamente.',
      503, 'upload_result_unknown', input.requestId, 'unknown',
    )
  }
}

export async function uploadArenaAsaasDocument(input: {
  arenaId: string
  actorId: string
  documentGroupId: string
  requestId: string
  explicitRetry: boolean
  file: File
  bytes: Uint8Array
}): Promise<{ requestId: string; status: AsaasDocumentAttemptStatus }> {
  const attempts = await loadDocumentAttempts(input.arenaId, input.actorId)
  if (attempts === null) throw storageFailure()
  const previous = attempts.find((attempt) => attempt.groupId === input.documentGroupId && attempt.requestId === input.requestId)
  const sha256 = createHash('sha256').update(input.bytes).digest('hex')
  if (previous) {
    const previousGroup: ArenaAsaasDocumentGroup = {
      id: previous.groupId, type: previous.type, title: '', description: null,
      status: 'NOT_SENT', onboardingUrl: null, canUpload: false, attemptStatus: previous.status,
      allowedMimeTypes: previous.type === 'IDENTIFICATION_SELFIE' ? ['image/jpeg', 'image/png'] : ['image/jpeg', 'image/png', 'application/pdf'],
    }
    validateAsaasDocumentFile(input.file, previousGroup, input.bytes)
    const claim = await claimUpload({ ...input, group: previousGroup, sha256, observedAt: new Date().toISOString() })
    if (claim.claimed) throw storageFailure()
    return { requestId: claim.requestId, status: claim.status }
  }

  await assertDocumentsReadyForConsultation(input.arenaId)
  const transport = await createArenaAsaasDocumentTransport(input.arenaId)
  const groups = await transport.list()
  const observedAt = new Date().toISOString()
  const group = groups.find((candidate) => candidate.id === input.documentGroupId)
  if (!group || !group.canUpload || group.type === 'UNKNOWN') {
    throw new AsaasDocumentError('Este documento não está disponível para envio pelo painel. Atualize a lista e siga a orientação do Asaas.', 409, 'document_not_uploadable')
  }
  const accepted = validateAsaasDocumentFile(input.file, group, input.bytes)
  const claim = await claimUpload({ ...input, group, sha256, observedAt })
  if (!claim.claimed) {
    if (claim.requiresExplicitRetry) {
      throw new AsaasDocumentUploadError(
        'Confirme a substituição do arquivo anterior antes de enviar novamente.',
        409, 'explicit_retry_required', claim.requestId, claim.status,
      )
    }
    return { requestId: claim.requestId, status: claim.status }
  }

  try {
    await transport.upload({ groupId: group.id, type: group.type, bytes: input.bytes, ...accepted })
  } catch (error) {
    const outcome = error instanceof AsaasDocumentProviderError ? error.outcome : 'unknown'
    const reasonCode = error instanceof AsaasDocumentProviderError ? error.reasonCode : 'transport_unknown'
    await finishUpload({ ...input, outcome, reasonCode })
    throw new AsaasDocumentUploadError(
      error instanceof AsaasDocumentError ? error.message : 'O resultado do envio não foi confirmado. Atualize os documentos antes de enviar novamente.',
      error instanceof AsaasDocumentError ? error.status : 502,
      error instanceof AsaasDocumentError ? error.code : 'upload_result_unknown',
      input.requestId, outcome,
      error instanceof AsaasDocumentProviderError ? { httpStatus: error.providerHttpStatus, errorCodes: error.providerErrorCodes } : undefined,
    )
  }
  await finishUpload({ ...input, outcome: 'submitted', reasonCode: null })
  return { requestId: input.requestId, status: 'submitted' }
}
