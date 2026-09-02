export type ArenaPixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'

export type ArenaWithdrawalStatus =
  | 'requested'
  | 'processing'
  | 'unknown'
  | 'pending'
  | 'done'
  | 'failed'
  | 'cancelled'

export type ArenaWithdrawalDestination = {
  configured: boolean
  pixKeyType: ArenaPixKeyType | null
  maskedPixKey: string | null
  updatedAt: string | null
}
export type ArenaWithdrawal = {
  id: string
  operationId: string
  amountCents: number
  feeCents: number | null
  netAmountCents: number | null
  status: ArenaWithdrawalStatus
  failureReason: string | null
  requestedAt: string
  updatedAt: string
  completedAt: string | null
}

export type ArenaStatementEntry = {
  id: string
  providerTransactionId: string
  type: string
  occurredOn: string
  amountCents: number
  balanceCents: number | null
  description: string | null
  paymentId: string | null
  withdrawalId: string | null
}

export type ArenaFinancialOverview = {
  accountReady: boolean
  onboardingStatus: string | null
  balanceCents: number | null
  balanceSyncedAt: string | null
  destination: ArenaWithdrawalDestination
  withdrawals: ArenaWithdrawal[]
  statement: ArenaStatementEntry[]
  statementPeriod: {
    startDate: string
    finishDate: string
    syncedAt: string | null
  }
}
