export type ArenaPixSplitStatus = 'pending' | 'active' | 'disabled' | 'rejected'
export type ArenaPaymentFlow = 'arena_subaccount_split'
export type ArenaAsaasOnboardingStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'

export type AsaasCompanyType = 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION'

export interface ArenaPixSplitSettings {
  enabled: boolean
  hasPaymentAccount: boolean
  onboardingStarted: boolean
  webhookConfigured: boolean
  credentialRecoveryRequired: boolean
  paymentFlow: ArenaPaymentFlow
  asaasWalletId: string
  asaasAccountId: string
  holderName: string
  holderDocument: string
  pixKey: string
  status: ArenaPixSplitStatus
  onboardingStatus: ArenaAsaasOnboardingStatus
  commercialInfoStatus: ArenaAsaasOnboardingStatus
  bankAccountInfoStatus: ArenaAsaasOnboardingStatus
  documentationStatus: ArenaAsaasOnboardingStatus
  onboardingUrl: string | null
  lastStatusCheckedAt: string | null
  activatedAt: string | null
  platformFeeBasisPoints: number
  updatedAt: string | null
}

export interface CreateArenaAsaasSubaccountInput {
  name: string
  email: string
  cpfCnpj: string
  companyType: AsaasCompanyType
  mobilePhone: string
  incomeValue: number
  address: string
  addressNumber: string
  complement?: string | null
  province: string
  postalCode: string
}

export interface UpdateArenaPixSplitSettingsInput {
  enabled: boolean
  asaasWalletId?: string | null
  asaasAccountId?: string | null
  holderName?: string | null
  holderDocument?: string | null
  pixKey?: string | null
  platformFeeBasisPoints: number
}
