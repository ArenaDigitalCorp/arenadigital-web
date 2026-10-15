import { normalizeCpfCnpj } from '@/lib/brasil-document'

export function matchesAsaasSubaccountOwnership(
  remote: { id?: string | null; walletId?: string | null; cpfCnpj?: string | null },
  expected: { accountId: string; walletId?: string | null; cpfCnpj: string },
): boolean {
  const document = normalizeCpfCnpj(remote.cpfCnpj ?? '')
  return Boolean(
    remote.id && remote.walletId && document &&
    remote.id === expected.accountId &&
    (!expected.walletId || remote.walletId === expected.walletId) &&
    document === normalizeCpfCnpj(expected.cpfCnpj),
  )
}
