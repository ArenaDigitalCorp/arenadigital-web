export function matchesAsaasSubaccountOwnership(
  remote: { id?: string | null; walletId?: string | null; cpfCnpj?: string | null },
  expected: { accountId: string; walletId?: string | null; cpfCnpj: string },
): boolean {
  const document = remote.cpfCnpj?.replace(/\D/gu, '')
  return Boolean(
    remote.id && remote.walletId && document &&
    remote.id === expected.accountId &&
    (!expected.walletId || remote.walletId === expected.walletId) &&
    document === expected.cpfCnpj.replace(/\D/gu, ''),
  )
}
