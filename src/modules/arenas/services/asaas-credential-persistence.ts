export type CredentialPersistenceResult = {
  protected: boolean
  error?: unknown
}

// The Asaas key is shown only once. Keep the claim blocked until either Vault
// holds it or a recovery envelope is durable for the same account and wallet.
export async function persistCreatedAsaasCredential(steps: {
  bindOwnership: () => Promise<void>
  storeRecoveryEnvelope: () => Promise<void>
  storeVaultCredentials: () => Promise<void>
  deleteRecoveryEnvelope: () => Promise<void>
}): Promise<CredentialPersistenceResult> {
  try {
    await steps.bindOwnership()
    await steps.storeRecoveryEnvelope()
  } catch (initialError) {
    // The Vault RPC can persist the account, wallet and secret atomically.
    // This fallback also covers an unavailable recovery-envelope RPC.
    try {
      await steps.storeVaultCredentials()
      return { protected: true }
    } catch {
      return { protected: false, error: initialError }
    }
  }

  try {
    await steps.storeVaultCredentials()
  } catch (error) {
    // The envelope remains durable when Vault fails.
    return { protected: false, error }
  }
  // A confirmed Vault write is enough. The database trigger clears recovery;
  // explicit cleanup is best effort if the acknowledgement was interrupted.
  await steps.deleteRecoveryEnvelope().catch(() => undefined)
  return { protected: true }
}
