import type { AppBookingMode } from '../domain/app-booking-mode'

export const RECEIVING_DRAFT_FIELDS = [
  'name', 'email', 'cpfCnpj', 'companyType', 'mobilePhone', 'incomeValue',
  'address', 'addressNumber', 'complement', 'province', 'postalCode',
] as const
export type ReceivingDraftData = Partial<Record<typeof RECEIVING_DRAFT_FIELDS[number], string>>
export type ReceivingDraftSnapshot = { data: ReceivingDraftData; revision: number; updated_at: string }
export type ArenaReceivingSetup = {
  draft: ReceivingDraftSnapshot | null
  desired_mode: 'online_payment' | null
  intent_status: 'pending' | 'activated' | 'cancelled' | null
  intent_revision: number
  cancellation_reason: string | null
  active_mode: AppBookingMode
  ready: boolean
  missing: string[]
}
