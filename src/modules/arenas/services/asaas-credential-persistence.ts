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
  } catch (error) {
    // A stale provisioning attempt must never write its key into the current arena.
    return { protected: false, error }
  }
  try {
    await steps.storeRecoveryEnvelope()
  } catch (envelopeError) {
    // The Vault RPC can persist the account, wallet and secret atomically.
    // Only an unavailable recovery-envelope RPC may use this fallback.
    try {
      await steps.storeVaultCredentials()
      return { protected: true }
    } catch {
      return { protected: false, error: envelopeError }
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
