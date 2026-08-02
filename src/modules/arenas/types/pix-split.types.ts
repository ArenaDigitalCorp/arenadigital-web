export type ArenaPixSplitStatus = 'pending' | 'active' | 'disabled' | 'rejected'

export interface ArenaPixSplitSettings {
  enabled: boolean
  asaasWalletId: string
  asaasAccountId: string
  holderName: string
  holderDocument: string
  pixKey: string
  status: ArenaPixSplitStatus
  platformFeeBasisPoints: number
  updatedAt: string | null
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
