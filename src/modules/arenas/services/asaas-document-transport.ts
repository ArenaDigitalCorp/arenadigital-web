import 'server-only'

import { AsaasDocumentError, parseAsaasDocumentGroups } from '@/modules/arenas/domain/asaas-documents'
import { asaasBaseUrl, loadSubaccountApiKey } from '@/modules/arenas/services/asaas-baas.service'
import type { ArenaAsaasDocumentGroup, AsaasDocumentMimeType, AsaasDocumentType } from '@/modules/arenas/types/asaas-documents.types'

const PROVIDER_TIMEOUT_MS = 20_000
const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024
const SAFE_PROVIDER_ERROR_CODES = ['invalid_action', 'invalid_object', 'invalid_value', 'invalid_environment', 'access_token_not_found'] as const
type SafeProviderErrorCode = typeof SAFE_PROVIDER_ERROR_CODES[number] | 'unclassified'
type ProviderErrorDiagnostics = { codes: readonly SafeProviderErrorCode[]; uploadMethodUnavailable: boolean }

export class AsaasDocumentProviderError extends AsaasDocumentError {
  constructor(
    message: string,
    status: number,
    code: string,
    readonly outcome: 'failed' | 'unknown',
    readonly reasonCode: 'provider_rejected' | 'provider_unauthorized' | 'provider_not_found' | 'rate_limited' | 'transport_unknown' | 'response_unknown',
    readonly providerHttpStatus: number | null = null,
    readonly providerErrorCodes: readonly SafeProviderErrorCode[] = [],
  ) {
    super(message, status, code)
    this.name = 'AsaasDocumentProviderError'
  }
}

async function providerErrorDiagnostics(response: Response): Promise<ProviderErrorDiagnostics> {
  try {
    const payload = await responseJson(response)
    if (!payload || typeof payload !== 'object' || !('errors' in payload) || !Array.isArray(payload.errors)) return { codes: ['unclassified'], uploadMethodUnavailable: false }
    const errors: unknown[] = payload.errors.slice(0, 10)
    const codes = errors.map((error: unknown): SafeProviderErrorCode => {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null
      return SAFE_PROVIDER_ERROR_CODES.find((candidate) => candidate === code) ?? 'unclassified'
    })
    // Only this precise refusal changes the instruction; descriptions are never retained or echoed.
    const uploadMethodUnavailable = errors.some((error) => {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'invalid_object' || !('description' in error) || typeof error.description !== 'string') return false
      const description = error.description.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').trim().toLowerCase()
      return /^esse tipo de documento nao pode ser enviado via api(?:[.!;]|$)/u.test(description)
    })
    return { codes: codes.length ? [...new Set(codes)] : ['unclassified'], uploadMethodUnavailable }
  } catch {
    // Receiving a definite HTTP rejection remains a failure even if its diagnostic body is unreadable.
    return { codes: ['unclassified'], uploadMethodUnavailable: false }
  }
}

async function responseJson(response: Response): Promise<unknown> {
  if (!response.body) throw new AsaasDocumentError('Não foi possível consultar os documentos solicitados. Tente atualizar novamente.', 502, 'invalid_document_list')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      totalBytes += chunk.value.byteLength
      if (totalBytes > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel()
        throw new AsaasDocumentError('A lista de documentos precisa de conferência. Entre em contato com o suporte.', 502, 'document_list_limit')
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new AsaasDocumentError('Não foi possível consultar os documentos solicitados. Tente atualizar novamente.', 502, 'invalid_document_list')
  }
}

function providerFailure(status: number, diagnostics: ProviderErrorDiagnostics = { codes: [], uploadMethodUnavailable: false }): AsaasDocumentProviderError {
  const { codes } = diagnostics
  if (status === 401 || status === 403) {
    return new AsaasDocumentProviderError('O acesso financeiro da arena precisa de conferência pelo suporte.', 503, 'provider_access_unavailable', 'failed', 'provider_unauthorized', status, codes)
  }
  if (status === 404) {
    return new AsaasDocumentProviderError('A solicitação deste documento mudou. Atualize a lista antes de tentar novamente.', 409, 'provider_document_not_found', 'failed', 'provider_not_found', status, codes)
  }
  if (status === 429) {
    return new AsaasDocumentProviderError('O Asaas está recebendo muitas solicitações. Aguarde antes de tentar novamente.', 429, 'provider_rate_limited', 'failed', 'rate_limited', status, codes)
  }
  if (status >= 500) {
    return new AsaasDocumentProviderError('O resultado do envio não foi confirmado. Atualize os documentos antes de qualquer novo envio; se continuar pendente, fale com o suporte.', 502, 'upload_result_unknown', 'unknown', 'response_unknown', status, codes)
  }
  if ((status === 400 || status === 422) && diagnostics.uploadMethodUnavailable) {
    return new AsaasDocumentProviderError('O Asaas não permite enviar este documento pela API para esta conta. Entre em contato com o suporte do Asaas para confirmar o método de envio e disponibilizar o link, quando aplicável.', 409, 'provider_document_api_unavailable', 'failed', 'provider_rejected', status, codes)
  }
  return new AsaasDocumentProviderError('O Asaas recusou o envio deste documento. Atualize a lista e confira a solicitação; se a recusa continuar, entre em contato com o suporte.', 422, 'provider_document_rejected', 'failed', 'provider_rejected', status, codes)
}

export interface ArenaAsaasDocumentTransport {
  list(): Promise<ArenaAsaasDocumentGroup[]>
  upload(input: {
    groupId: string
    type: AsaasDocumentType
    bytes: Uint8Array
    mimeType: AsaasDocumentMimeType
    filename: string
  }): Promise<void>
}

export async function createArenaAsaasDocumentTransport(arenaId: string): Promise<ArenaAsaasDocumentTransport> {
  let apiKey: string
  let url: string
  try {
    apiKey = await loadSubaccountApiKey(arenaId)
    url = asaasBaseUrl()
  } catch {
    throw new AsaasDocumentError('O acesso financeiro da arena precisa de conferência pelo suporte.', 503, 'document_access_unavailable')
  }
  const headers = { accept: 'application/json', access_token: apiKey, 'User-Agent': 'arenadigital-web/1.0' }
  return {
    async list() {
      let response: Response
      try {
        response = await fetch(`${url}/v3/myAccount/documents`, {
          headers,
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        })
      } catch {
        throw new AsaasDocumentError('Não foi possível consultar os documentos no Asaas. Tente atualizar novamente.', 502, 'document_list_unavailable')
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw providerFailure(response.status)
      }
      try {
        return parseAsaasDocumentGroups(await responseJson(response))
      } catch (error) {
        if (error instanceof AsaasDocumentError) throw error
        throw new AsaasDocumentError('Não foi possível consultar os documentos no Asaas. Tente atualizar novamente.', 502, 'document_list_unavailable')
      }
    },
    async upload(input) {
      const form = new FormData()
      form.set('type', input.type)
      form.set('documentFile', new Blob([new Uint8Array(input.bytes)], { type: input.mimeType }), input.filename)
      let response: Response
      try {
        response = await fetch(`${url}/v3/myAccount/documents/${encodeURIComponent(input.groupId)}`, {
          method: 'POST',
          headers,
          body: form,
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        })
      } catch {
        throw new AsaasDocumentProviderError('O resultado do envio não foi confirmado. Atualize os documentos antes de qualquer novo envio; se continuar pendente, fale com o suporte.', 502, 'upload_result_unknown', 'unknown', 'transport_unknown')
      }
      if (!response.ok) throw providerFailure(response.status, await providerErrorDiagnostics(response))
      // Successful delivery is distinct from approval; no response payload or file ID is retained.
      await response.body?.cancel()
    },
  }
}
