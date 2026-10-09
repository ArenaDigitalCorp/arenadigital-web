export const MAX_ASAAS_DOCUMENT_FILE_BYTES = 3 * 1024 * 1024

export const ASAAS_DOCUMENT_TYPES = [
  'ALLOW_BANK_ACCOUNT_DEPOSIT_STATEMENT',
  'CUSTOM',
  'EMANCIPATION_OF_MINORS',
  'ENTREPRENEUR_REQUIREMENT',
  'IDENTIFICATION_SELFIE',
  'IDENTIFICATION',
  'INVOICE',
  'MEI_CERTIFICATE',
  'MINUTES_OF_CONSTITUTION',
  'MINUTES_OF_ELECTION',
  'POWER_OF_ATTORNEY',
  'SOCIAL_CONTRACT',
] as const

export type AsaasDocumentType = typeof ASAAS_DOCUMENT_TYPES[number]
export type AsaasDocumentStatus =
  | 'NOT_SENT'
  | 'PENDING'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'IGNORED'
  | 'UNKNOWN'

export type AsaasDocumentAttemptStatus = 'processing' | 'submitted' | 'failed' | 'unknown'
export type AsaasDocumentMimeType = 'image/jpeg' | 'image/png' | 'application/pdf'

export interface ArenaAsaasDocumentGroup {
  id: string
  type: AsaasDocumentType | 'UNKNOWN'
  title: string
  description: string | null
  status: AsaasDocumentStatus
  onboardingUrl: string | null
  canUpload: boolean
  attemptStatus: AsaasDocumentAttemptStatus | null
  allowedMimeTypes: AsaasDocumentMimeType[]
}

export interface ArenaAsaasDocuments {
  groups: ArenaAsaasDocumentGroup[]
  uploadAvailable: boolean
}
