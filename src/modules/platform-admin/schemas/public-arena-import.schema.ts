import { z } from 'zod'

export const PUBLIC_ARENA_IMPORT_MAX_ITEMS = 500
export const PUBLIC_ARENA_IMPORT_SOURCES = [
  'csv',
  'openstreetmap',
  'receita_cnpj',
  'brasilapi',
] as const

const nullableText = (max: number) => z.string().trim().max(max).nullable()
const nullableNumericInput = z.union([
  z.number().finite(),
  z.string().trim().max(32),
]).nullable()

export const publicArenaImportDraftSchema = z.object({
  external_id: nullableText(200),
  name: z.string().trim().max(160),
  cnpj: nullableText(18),
  address: z.string().trim().max(240),
  number: nullableText(30),
  complement: nullableText(120),
  neighborhood: nullableText(120),
  zip_code: nullableText(12),
  phone: nullableText(30),
  email: nullableText(254),
  description: nullableText(2000),
  municipality_id: nullableNumericInput,
  sport_ids: z.array(z.string().trim().max(64)).max(30),
  latitude: nullableNumericInput,
  longitude: nullableNumericInput,
  platform_notes: nullableText(1000),
}).strict()

export const stagePublicArenaImportBatchInputSchema = z.object({
  operationId: z.string().uuid(),
  source: z.enum(PUBLIC_ARENA_IMPORT_SOURCES),
  filename: z.string().trim().min(1).max(240).nullable(),
  items: z.array(publicArenaImportDraftSchema).min(1).max(PUBLIC_ARENA_IMPORT_MAX_ITEMS),
  reason: z.string().trim().min(8).max(500),
}).strict()

export const publicArenaImportBatchIdSchema = z.string().uuid()

export const listPublicArenaImportBatchesInputSchema = z.number().int().min(1).max(25)

export const applyPublicArenaImportBatchInputSchema = z.object({
  batchId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1).max(PUBLIC_ARENA_IMPORT_MAX_ITEMS),
  reason: z.string().trim().min(8).max(500),
}).strict()

export const claimPublicArenaAsCustomerInputSchema = z.object({
  arenaId: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  reason: z.string().trim().min(8).max(500),
  keepDiscoverable: z.boolean(),
}).strict()

export const reviewArenaClaimRequestInputSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(8).max(500),
  keepDiscoverable: z.boolean(),
}).strict()

export const discoverOpenStreetMapArenasInputSchema = z.object({
  stateCode: z.number().int().positive(),
  municipalityId: z.number().int().positive(),
  sportIds: z.array(z.string().uuid()).min(1).max(30),
}).strict()

export const searchEligibleArenaOwnersInputSchema = z.string().trim().min(3).max(100)

export type StagePublicArenaImportBatchInput = z.input<typeof stagePublicArenaImportBatchInputSchema>
export type ApplyPublicArenaImportBatchInput = z.input<typeof applyPublicArenaImportBatchInputSchema>
export type ClaimPublicArenaAsCustomerInput = z.input<typeof claimPublicArenaAsCustomerInputSchema>
export type ReviewArenaClaimRequestInput = z.input<typeof reviewArenaClaimRequestInputSchema>
export type DiscoverOpenStreetMapArenasInput = z.input<typeof discoverOpenStreetMapArenasInputSchema>
