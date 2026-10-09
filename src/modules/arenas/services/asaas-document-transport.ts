import 'server-only'

import { AsaasDocumentError, parseAsaasDocumentGroups } from '@/modules/arenas/domain/asaas-documents'
import { asaasBaseUrl, loadSubaccountApiKey } from '@/modules/arenas/services/asaas-baas.service'
import type { ArenaAsaasDocumentGroup, AsaasDocumentMimeType, AsaasDocumentType } from '@/modules/arenas/types/asaas-documents.types'

const PROVIDER_TIMEOUT_MS = 20_000
const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024

export class AsaasDocumentProviderError extends AsaasDocumentError {
  constructor(
    message: string,
    status: number,
    code: string,
    readonly outcome: 'failed' | 'unknown',
    readonly reasonCode: 'provider_rejected' | 'provider_unauthorized' | 'provider_not_found' | 'rate_limited' | 'transport_unknown' | 'response_unknown',
  ) {
    super(message, status, code)
    this.name = 'AsaasDocumentProviderError'
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

function providerFailure(status: number): AsaasDocumentProviderError {
  if (status === 401 || status === 403) {
    return new AsaasDocumentProviderError('O acesso financeiro da arena precisa de conferência pelo suporte.', 503, 'provider_access_unavailable', 'failed', 'provider_unauthorized')
  }
  if (status === 404) {
    return new AsaasDocumentProviderError('A solicitação deste documento mudou. Atualize a lista antes de tentar novamente.', 409, 'provider_document_not_found', 'failed', 'provider_not_found')
  }
  if (status === 429) {
    return new AsaasDocumentProviderError('O Asaas está recebendo muitas solicitações. Aguarde antes de tentar novamente.', 429, 'provider_rate_limited', 'failed', 'rate_limited')
  }
  if (status >= 500) {
    return new AsaasDocumentProviderError('O resultado do envio não foi confirmado. Atualize os documentos antes de qualquer novo envio; se continuar pendente, fale com o suporte.', 502, 'upload_result_unknown', 'unknown', 'response_unknown')
  }
  return new AsaasDocumentProviderError('O Asaas não aceitou este arquivo. Confira o formato e a solicitação antes de tentar novamente.', 422, 'provider_document_rejected', 'failed', 'provider_rejected')
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
      // Successful delivery is distinct from approval; no response payload or file ID is retained.
      await response.body?.cancel()
      if (!response.ok) throw providerFailure(response.status)
    },
  }
}
