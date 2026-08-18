import { z } from 'zod'
import type {
  PublicArenaImportBatch,
  PublicArenaImportBatchSummary,
  PublicArenaImportCounts,
  PublicArenaImportDraft,
  PublicArenaImportItem,
  PublicArenaImportItemStatus,
  PublicArenaImportSource,
} from '@/modules/platform-admin/types/platform-admin.types'

const uuidSchema = z.string().uuid()
const sourceSchema = z.enum(['csv', 'openstreetmap', 'receita_cnpj', 'brasilapi'])
const itemStatusSchema = z.enum(['ready', 'duplicate', 'invalid', 'applied'])

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function numericValue(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

function numericInput(value: unknown): number | string | null {
  return typeof value === 'number' || typeof value === 'string' ? value : null
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function draftFrom(value: unknown): PublicArenaImportDraft {
  const item = record(value)
  return {
    external_id: nullableString(item.external_id),
    name: stringValue(item.name),
    cnpj: nullableString(item.cnpj),
    address: stringValue(item.address),
    number: nullableString(item.number),
    complement: nullableString(item.complement),
    neighborhood: nullableString(item.neighborhood),
    zip_code: nullableString(item.zip_code),
    phone: nullableString(item.phone),
    email: nullableString(item.email),
    description: nullableString(item.description),
    municipality_id: numericInput(item.municipality_id),
    sport_ids: arrayValue(item.sport_ids).filter((sport): sport is string => typeof sport === 'string'),
    latitude: numericInput(item.latitude),
    longitude: numericInput(item.longitude),
    platform_notes: nullableString(item.platform_notes),
  }
}

function importItemFrom(value: unknown, index: number): PublicArenaImportItem {
  const item = record(value)
  const payload = item.normalized_item ?? item.normalized_payload ?? item.payload ?? item.data ?? item
  const status = itemStatusSchema.safeParse(item.status ?? item.validation_status)
  const errors = arrayValue(item.errors ?? item.validation_errors)
    .map((error) => typeof error === 'string' ? error : stringValue(record(error).message))
    .filter(Boolean)

  return {
    id: uuidSchema.parse(item.id ?? item.item_id),
    rowNumber: numericValue(item.row_number ?? item.rowNumber) || index + 1,
    status: status.success ? status.data : 'invalid',
    errors,
    arenaId: nullableString(item.created_arena_id ?? item.duplicate_arena_id ?? item.arena_id),
    ...draftFrom(payload),
  }
}

function countsFrom(batch: Record<string, unknown>, items: PublicArenaImportItem[]): PublicArenaImportCounts {
  const supplied = record(batch.counts)
  const count = (name: PublicArenaImportItemStatus) => items.filter((item) => item.status === name).length
  return {
    total: numericValue(supplied.total ?? batch.total_items ?? batch.total_count) || items.length,
    ready: numericValue(supplied.ready ?? batch.ready_count) || count('ready'),
    duplicate: numericValue(supplied.duplicate ?? batch.duplicate_count) || count('duplicate'),
    invalid: numericValue(supplied.invalid ?? batch.invalid_count) || count('invalid'),
    applied: numericValue(supplied.applied ?? batch.applied_count) || count('applied'),
  }
}

export function normalizePublicArenaImportBatch(value: unknown): PublicArenaImportBatch {
  const outer = record(value)
  const batch = record(outer.batch ?? value)
  const rawItems = arrayValue(outer.items ?? batch.items)
  const items = rawItems.map(importItemFrom)
  const source = sourceSchema.safeParse(batch.source)

  return {
    id: uuidSchema.parse(batch.id ?? batch.batch_id),
    operationId: uuidSchema.parse(batch.operation_id ?? batch.operationId),
    source: source.success ? source.data : 'csv',
    filename: nullableString(batch.filename),
    status: stringValue(batch.status, 'staged'),
    counts: countsFrom(batch, items),
    items,
    createdAt: nullableString(batch.created_at ?? batch.createdAt),
    updatedAt: nullableString(batch.updated_at ?? batch.updatedAt),
  }
}

export function normalizePublicArenaImportBatchList(value: unknown): PublicArenaImportBatchSummary[] {
  const outer = record(value)
  const batches = Array.isArray(value) ? value : arrayValue(outer.batches ?? outer.items)
  return batches.map((entry) => {
    const batch = record(entry)
    const source = sourceSchema.safeParse(batch.source)
    return {
      id: uuidSchema.parse(batch.id ?? batch.batch_id),
      operationId: uuidSchema.parse(batch.operation_id ?? batch.operationId),
      source: (source.success ? source.data : 'csv') as PublicArenaImportSource,
      filename: nullableString(batch.filename),
      status: stringValue(batch.status, 'staged'),
      counts: countsFrom(batch, []),
      createdAt: nullableString(batch.created_at ?? batch.createdAt),
      updatedAt: nullableString(batch.updated_at ?? batch.updatedAt),
    }
  })
}
