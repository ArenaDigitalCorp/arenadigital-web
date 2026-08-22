import { z } from 'zod'
import type {
  PublicArenaImportCampaign,
  PublicArenaImportCampaignJob,
  PublicArenaImportCampaignStatus,
  PublicArenaImportJobStatus,
} from '@/modules/platform-admin/types/platform-admin.types'

const uuidSchema = z.string().uuid()
const campaignStatusSchema = z.enum(['running', 'paused', 'completed', 'completed_with_errors'])
const jobStatusSchema = z.enum(['pending', 'processing', 'retry_wait', 'staged', 'empty', 'failed'])

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

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function jobFrom(value: unknown): PublicArenaImportCampaignJob {
  const job = record(value)
  const status = jobStatusSchema.safeParse(job.status)
  return {
    id: uuidSchema.parse(job.id),
    municipalityId: numberValue(job.municipality_id),
    municipalityName: stringValue(job.municipality_name),
    stateCode: numberValue(job.state_code),
    stateUf: stringValue(job.state_uf),
    status: (status.success ? status.data : 'failed') as PublicArenaImportJobStatus,
    attemptCount: numberValue(job.attempt_count),
    nextAttemptAt: nullableString(job.next_attempt_at),
    lastBatchId: nullableString(job.last_batch_id),
    candidateCount: numberValue(job.candidate_count),
    readyCount: numberValue(job.ready_count),
    duplicateCount: numberValue(job.duplicate_count),
    invalidCount: numberValue(job.invalid_count),
    lastErrorCode: nullableString(job.last_error_code),
    updatedAt: nullableString(job.updated_at),
    completedAt: nullableString(job.completed_at),
  }
}

export function normalizePublicArenaImportCampaign(value: unknown): PublicArenaImportCampaign {
  const outer = record(value)
  const campaign = record(outer.campaign ?? value)
  const status = campaignStatusSchema.safeParse(campaign.status)
  return {
    id: uuidSchema.parse(campaign.id),
    operationId: uuidSchema.parse(campaign.operation_id),
    name: stringValue(campaign.name),
    source: 'openstreetmap',
    status: (status.success ? status.data : 'paused') as PublicArenaImportCampaignStatus,
    sportIds: Array.isArray(campaign.sport_ids)
      ? campaign.sport_ids.filter((item): item is string => typeof item === 'string')
      : [],
    maxAttempts: numberValue(campaign.max_attempts),
    maxResultsPerMunicipality: numberValue(campaign.max_results_per_municipality),
    reason: stringValue(campaign.reason),
    createdByUserId: uuidSchema.parse(campaign.created_by_user_id),
    createdAt: stringValue(campaign.created_at),
    updatedAt: stringValue(campaign.updated_at),
    startedAt: nullableString(campaign.started_at),
    pausedAt: nullableString(campaign.paused_at),
    completedAt: nullableString(campaign.completed_at),
    totalCount: numberValue(campaign.total_count),
    pendingCount: numberValue(campaign.pending_count),
    processingCount: numberValue(campaign.processing_count),
    stagedCount: numberValue(campaign.staged_count),
    emptyCount: numberValue(campaign.empty_count),
    failedCount: numberValue(campaign.failed_count),
    candidateCount: numberValue(campaign.candidate_count),
    readyCount: numberValue(campaign.ready_count),
    duplicateCount: numberValue(campaign.duplicate_count),
    invalidCount: numberValue(campaign.invalid_count),
    batchCount: numberValue(campaign.batch_count),
    jobs: Array.isArray(campaign.jobs) ? campaign.jobs.map(jobFrom) : [],
  }
}

export function normalizePublicArenaImportCampaignList(value: unknown): PublicArenaImportCampaign[] {
  const outer = record(value)
  const campaigns = Array.isArray(value) ? value : Array.isArray(outer.campaigns) ? outer.campaigns : []
  return campaigns.map(normalizePublicArenaImportCampaign)
}
