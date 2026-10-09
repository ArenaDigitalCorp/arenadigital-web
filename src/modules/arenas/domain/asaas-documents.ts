import {
  ASAAS_DOCUMENT_TYPES,
  MAX_ASAAS_DOCUMENT_FILE_BYTES,
  type ArenaAsaasDocumentGroup,
  type AsaasDocumentMimeType,
  type AsaasDocumentStatus,
} from '../types/asaas-documents.types'

export class AsaasDocumentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'AsaasDocumentError'
  }
}

export function safeAsaasOnboardingUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const url = new URL(value)
    const isAsaasHost = ['asaas.com', 'asaas.com.br'].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
    return url.protocol === 'https:' && isAsaasHost && !url.username && !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}

const DOCUMENT_STATUSES: readonly AsaasDocumentStatus[] = [
  'NOT_SENT', 'PENDING', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'IGNORED',
]

function limitedText(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null
}

export function parseAsaasDocumentGroups(payload: unknown): ArenaAsaasDocumentGroup[] {
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) {
    throw new AsaasDocumentError('Não foi possível consultar os documentos solicitados. Tente atualizar novamente.', 502, 'invalid_document_list')
  }
  if (payload.data.length > 100) {
    throw new AsaasDocumentError('A lista de documentos precisa de conferência. Entre em contato com o suporte.', 502, 'document_list_limit')
  }
  const seen = new Set<string>()
  return payload.data.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') {
      throw new AsaasDocumentError('Não foi possível consultar os documentos solicitados. Tente atualizar novamente.', 502, 'invalid_document_group')
    }
    const group = raw as Record<string, unknown>
    if (typeof group.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/u.test(group.id) || seen.has(group.id)) {
      throw new AsaasDocumentError('Não foi possível consultar os documentos solicitados. Tente atualizar novamente.', 502, 'invalid_document_group')
    }
    seen.add(group.id)
    const type = ASAAS_DOCUMENT_TYPES.find((candidate) => candidate === group.type) ?? 'UNKNOWN'
    const status = DOCUMENT_STATUSES.find((candidate) => candidate === group.status) ?? 'UNKNOWN'
    // A malformed hosted URL must never turn a hosted-only document into an API upload.
    const requiresHostedOnboarding = group.onboardingUrl !== null && group.onboardingUrl !== undefined && group.onboardingUrl !== ''
    const allowedMimeTypes: AsaasDocumentMimeType[] = type === 'IDENTIFICATION_SELFIE'
      ? ['image/jpeg', 'image/png']
      : ['image/jpeg', 'image/png', 'application/pdf']
    return {
      id: group.id,
      type,
      title: limitedText(group.title, 200) ?? 'Documento solicitado pelo Asaas',
      description: limitedText(group.description, 2000),
      status,
      onboardingUrl: safeAsaasOnboardingUrl(group.onboardingUrl),
      canUpload: !requiresHostedOnboarding && type !== 'UNKNOWN' && (status === 'NOT_SENT' || status === 'REJECTED'),
      attemptStatus: null,
      allowedMimeTypes,
    }
  })
}

export function validateAsaasDocumentFile(
  file: Pick<File, 'name' | 'size' | 'type'>,
  group: ArenaAsaasDocumentGroup,
  bytes: Uint8Array,
): { mimeType: AsaasDocumentMimeType; filename: string } {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || bytes.byteLength !== file.size) {
    throw new AsaasDocumentError('Selecione um arquivo válido.', 400, 'invalid_file_size')
  }
  if (file.size > MAX_ASAAS_DOCUMENT_FILE_BYTES) {
    throw new AsaasDocumentError('O arquivo deve ter no máximo 3 MB.', 413, 'file_too_large')
  }
  const mimeType = group.allowedMimeTypes.find((candidate) => candidate === file.type.toLowerCase())
  if (!mimeType) {
    throw new AsaasDocumentError('Selecione um arquivo em um dos formatos permitidos para este documento.', 400, 'invalid_file_type')
  }
  const extension = file.name.split('.').at(-1)?.toLowerCase()
  const validExtension = mimeType === 'image/jpeg'
    ? extension === 'jpg' || extension === 'jpeg'
    : mimeType === 'image/png' ? extension === 'png' : extension === 'pdf'
  const hasSignature = mimeType === 'image/jpeg'
    ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : mimeType === 'image/png'
      ? bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
      : bytes.length >= 5 && [0x25, 0x50, 0x44, 0x46, 0x2d].every((byte, index) => bytes[index] === byte)
  if (!validExtension || !hasSignature) {
    throw new AsaasDocumentError('O conteúdo do arquivo não corresponde ao formato informado.', 400, 'invalid_file_signature')
  }
  return { mimeType, filename: `document.${mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'pdf'}` }
}
