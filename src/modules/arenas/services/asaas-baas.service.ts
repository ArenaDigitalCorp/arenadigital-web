import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase-server'
import type { CreateArenaAsaasSubaccountInput } from '@/modules/arenas/types/pix-split.types'

const BOOKING_WEBHOOK_EVENTS = [
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_REFUND_DENIED',
  'PAYMENT_REFUNDED',
  'PAYMENT_DELETED',
  'PAYMENT_RESTORED',
  'PAYMENT_SPLIT_CANCELLED',
  'PAYMENT_SPLIT_DIVERGENCE_BLOCK',
  'PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED',
] as const

export type AsaasRegistrationStatus = 'PENDING' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED'

export type AsaasSubaccountCreation = {
  id: string
  walletId: string
  apiKey: string
}

export type AsaasSubaccountSummary = {
  id: string
  walletId: string
  cpfCnpj?: string | null
}

type AsaasSubaccountList = {
  data?: AsaasSubaccountSummary[]
}

type AsaasPixAddressKey = {
  id?: string | null
  key?: string | null
  status?: string | null
}

type AsaasPixAddressKeyList = {
  data?: AsaasPixAddressKey[]
}

export class AsaasRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message)
    this.name = 'AsaasRequestError'
  }
}

type AsaasSubaccountAccessToken = {
  apiKey?: string | null
}

export type AsaasAccountStatus = {
  id: string
  general: AsaasRegistrationStatus
  commercialInfo: AsaasRegistrationStatus
  bankAccountInfo: AsaasRegistrationStatus
  documentation: AsaasRegistrationStatus
}

export type AsaasDocumentGroup = {
  id: string
  status: AsaasRegistrationStatus
  type: string
  title: string
  description: string | null
  onboardingUrl: string | null
}

type AsaasErrorPayload = {
  errors?: Array<{ code?: string; description?: string; message?: string }>
}

type RuntimeCredentialRpcClient = {
  rpc(
    name: 'get_arena_asaas_runtime_credentials',
    args: { p_arena_id: string },
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

function baseUrl(): string {
  const explicit = process.env.ASAAS_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/u, '')
  const environment = process.env.ASAAS_ENV?.trim().toLowerCase()
  if (environment === 'production') return 'https://api.asaas.com'
  if (environment === 'sandbox') return 'https://api-sandbox.asaas.com'
  throw new Error('ASAAS_ENV deve ser configurado explicitamente como sandbox ou production.')
}

function parentApiKey(): string {
  const apiKey = process.env.ASAAS_API_KEY?.trim()
  if (!apiKey) throw new Error('A chave principal do Asaas não está configurada.')
  return apiKey
}

function assertBaasEnabled(): void {
  if (process.env.ASAAS_BAAS_ENABLED === 'false') {
    throw new Error('O onboarding Asaas BaaS não está habilitado neste ambiente.')
  }
}

function errorMessage(status: number, payload: unknown): string {
  const errors = payload && typeof payload === 'object' && 'errors' in payload
    ? (payload as AsaasErrorPayload).errors
    : undefined
  const descriptions = errors
    ?.map((error) => error.description ?? error.message)
    .filter((message): message is string => Boolean(message))
  return descriptions?.length
    ? descriptions.join('; ')
    : `O Asaas recusou a operação (HTTP ${status}).`
}

async function asaasRequest<T>(path: string, apiKey: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      accept: 'application/json',
      access_token: apiKey,
      'User-Agent': 'arenadigital-web/1.0',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  })

  const responseText = await response.text()
  let payload: unknown = null
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown
    } catch {
      payload = null
    }
  }
  if (!response.ok) throw new AsaasRequestError(errorMessage(response.status, payload), response.status, payload)
  return payload as T
}

export async function findAsaasSubaccountsByDocument(cpfCnpj: string): Promise<AsaasSubaccountSummary[]> {
  assertBaasEnabled()
  const document = cpfCnpj.replace(/\D/gu, '')
  const response = await asaasRequest<AsaasSubaccountList>(
    `/v3/accounts?cpfCnpj=${encodeURIComponent(document)}&limit=3`,
    parentApiKey(),
  )
  return response.data ?? []
}

function webhookConfiguration(email: string, webhookToken: string) {
  const explicitUrl = process.env.ASAAS_BOOKING_WEBHOOK_URL?.trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/u, '')
  const url = explicitUrl || (supabaseUrl ? `${supabaseUrl}/functions/v1/asaas-booking-webhook` : '')
  if (!url) throw new Error('A URL do webhook de reservas não está configurada para o onboarding BaaS.')

  return [{
    name: 'Arena Digital - reservas',
    url,
    email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken: webhookToken,
    sendType: 'SEQUENTIALLY',
    events: BOOKING_WEBHOOK_EVENTS,
  }]
}

export async function createAsaasSubaccount(
  input: CreateArenaAsaasSubaccountInput,
  webhookToken: string,
): Promise<AsaasSubaccountCreation> {
  assertBaasEnabled()
  const response = await asaasRequest<Partial<AsaasSubaccountCreation>>('/v3/accounts', parentApiKey(), {
    method: 'POST',
    body: {
      ...input,
      complement: input.complement || undefined,
      webhooks: webhookConfiguration(input.email, webhookToken),
    },
  })

  if (!response.id || !response.walletId || !response.apiKey) {
    throw new Error('O Asaas criou uma resposta incompleta para a subconta. A operação precisa de suporte manual.')
  }
  return { id: response.id, walletId: response.walletId, apiKey: response.apiKey }
}

export async function recoverAsaasSubaccountCredential(input: {
  accountId?: string | null
  cpfCnpj: string
}): Promise<AsaasSubaccountCreation> {
  assertBaasEnabled()
  const apiKey = parentApiKey()
  let account: AsaasSubaccountSummary | null = null

  if (input.accountId) {
    account = await asaasRequest<AsaasSubaccountSummary>(
      `/v3/accounts/${encodeURIComponent(input.accountId)}`,
      apiKey,
    )
  } else {
    const document = input.cpfCnpj.replace(/\D/gu, '')
    const response = await asaasRequest<AsaasSubaccountList>(
      `/v3/accounts?cpfCnpj=${encodeURIComponent(document)}&limit=2`,
      apiKey,
    )
    const matches = response.data ?? []
    if (matches.length !== 1) {
      throw new Error(
        matches.length === 0
          ? 'Nenhuma subconta Asaas foi localizada para o CNPJ da arena.'
          : 'Mais de uma subconta Asaas foi localizada para o CNPJ; a recuperação exige conferência manual.',
      )
    }
    account = matches[0]
  }

  if (!account?.id || !account.walletId) {
    throw new Error('O cadastro recuperado no Asaas não possui conta e wallet válidas.')
  }

  const token = await asaasRequest<AsaasSubaccountAccessToken>(
    `/v3/accounts/${encodeURIComponent(account.id)}/accessTokens`,
    apiKey,
    {
      method: 'POST',
      body: { name: `Arena Digital recovery ${new Date().toISOString()}` },
    },
  )
  if (!token.apiKey) throw new Error('O Asaas não devolveu a nova chave da subconta.')
  return { id: account.id, walletId: account.walletId, apiKey: token.apiKey }
}

function apiKeyFromRpcPayload(payload: unknown): string | null {
  if (typeof payload === 'string') return payload.trim() || null
  const first = Array.isArray(payload) ? payload[0] : payload
  if (!first || typeof first !== 'object') return null
  for (const key of ['api_key', 'apiKey', 'asaas_api_key']) {
    const value = (first as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

async function loadSubaccountApiKey(arenaId: string): Promise<string> {
  const rpc = getSupabaseAdmin() as unknown as RuntimeCredentialRpcClient
  const { data, error } = await rpc.rpc('get_arena_asaas_runtime_credentials', { p_arena_id: arenaId })
  if (error) throw new Error(`Não foi possível acessar a credencial protegida da subconta: ${error.message}`)
  const apiKey = apiKeyFromRpcPayload(data)
  if (!apiKey) throw new Error('A credencial protegida da subconta não foi encontrada.')
  return apiKey
}

export async function assertArenaAsaasRuntimeCredentials(arenaId: string): Promise<void> {
  await loadSubaccountApiKey(arenaId)
}

function activePixKey(keys: AsaasPixAddressKey[]): string | null {
  return keys.find((entry) => entry.status?.toUpperCase() === 'ACTIVE' && entry.key)?.key ?? null
}

function pendingPixKey(keys: AsaasPixAddressKey[]): AsaasPixAddressKey | null {
  return keys.find((entry) => {
    const status = entry.status?.toUpperCase()
    return entry.key && status && !['DELETED', 'ERROR', 'REJECTED'].includes(status)
  }) ?? null
}

async function listAsaasPixKeys(apiKey: string): Promise<AsaasPixAddressKey[]> {
  const response = await asaasRequest<AsaasPixAddressKeyList>('/v3/pix/addressKeys?limit=100', apiKey)
  return response.data ?? []
}

export async function ensureArenaAsaasPixKey(arenaId: string): Promise<string> {
  const apiKey = await loadSubaccountApiKey(arenaId)
  const keys = await listAsaasPixKeys(apiKey)
  const currentActiveKey = activePixKey(keys)
  if (currentActiveKey) return currentActiveKey
  if (pendingPixKey(keys)) {
    throw new Error('A chave Pix da subconta Asaas ainda está aguardando ativação.')
  }

  let created: AsaasPixAddressKey
  try {
    created = await asaasRequest<AsaasPixAddressKey>('/v3/pix/addressKeys', apiKey, {
      method: 'POST',
      body: { type: 'EVP' },
    })
  } catch (error) {
    if (!(error instanceof AsaasRequestError) || error.status < 500) throw error
    const reconciledKeys = await listAsaasPixKeys(apiKey)
    const reconciledActiveKey = activePixKey(reconciledKeys)
    if (reconciledActiveKey) return reconciledActiveKey
    if (pendingPixKey(reconciledKeys)) {
      throw new Error('A chave Pix da subconta Asaas foi solicitada e ainda está aguardando ativação.')
    }
    throw new Error('O resultado da criação da chave Pix não foi confirmado pelo Asaas. Sincronize novamente mais tarde.')
  }
  if (!created.key) throw new Error('O Asaas não devolveu a chave Pix criada para a subconta.')
  if (created.status && created.status.toUpperCase() !== 'ACTIVE') {
    throw new Error('A chave Pix da subconta Asaas foi criada e ainda está aguardando ativação.')
  }
  return created.key
}

export async function getArenaAsaasOnboardingSnapshot(arenaId: string): Promise<{
  status: AsaasAccountStatus
  documents: AsaasDocumentGroup[]
}> {
  const apiKey = await loadSubaccountApiKey(arenaId)
  const [status, documentsResponse] = await Promise.all([
    asaasRequest<AsaasAccountStatus>('/v3/myAccount/status', apiKey),
    asaasRequest<{ data?: AsaasDocumentGroup[] }>('/v3/myAccount/documents', apiKey),
  ])
  return { status, documents: documentsResponse.data ?? [] }
}
