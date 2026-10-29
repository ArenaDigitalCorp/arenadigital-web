import { z } from 'zod'
import { CLEANUP_MODULE_IDS, CLEANUP_MODULES } from './catalog'

export const cleanupPreviewSchema = z.object({
  arenaId: z.string().uuid(),
  modules: z.array(z.enum(CLEANUP_MODULE_IDS)).min(1, 'Selecione ao menos um grupo.').max(CLEANUP_MODULES.length),
  reason: z.string().trim().min(8, 'Informe um motivo com pelo menos 8 caracteres.').max(500),
  cutoff: z.string().datetime({ offset: true }).nullable(),
}).strict()
export const cleanupExecuteSchema = z.object({
  arenaId: z.string().uuid(),
  operationId: z.string().uuid(),
  confirmationName: z.string().trim().min(1).max(240),
  confirmTestData: z.literal(true, { error: 'Confirme que os dados selecionados são de teste.' }),
}).strict()
export const cleanupRestoreSchema = z.object({
  arenaId: z.string().uuid(),
  operationId: z.string().uuid(),
  confirmationName: z.string().trim().min(1).max(240),
  reason: z.string().trim().min(8).max(500),
}).strict()

export const cleanupOperationSchema = z.object({
  id: z.string().uuid(), arenaId: z.string().uuid(), arenaName: z.string(), reason: z.string(),
  modules: z.array(z.enum(CLEANUP_MODULE_IDS)), cutoff: z.string(),
  status: z.enum(['preview','completed','restored']), createdAt: z.string(), expiresAt: z.string(),
  completedAt: z.string().nullable(), restoredAt: z.string().nullable(),
  summary: z.object({
    transactionCount: z.number().int().nonnegative(), sessionCount: z.number().int().nonnegative(),
    openSessionCount: z.number().int().nonnegative(), incomingTotal: z.string(), outgoingTotal: z.string(),
    preservedAutomaticCount: z.number().int().nonnegative(), preservedTransactionCount: z.number().int().nonnegative(),
    canExecute: z.boolean(), blockers: z.array(z.object({code:z.string(),message:z.string(),count:z.number().nonnegative(),requiredModule:z.enum(CLEANUP_MODULE_IDS).nullable().optional()})),
    recordCount: z.number().int().nonnegative().optional(), effectCount: z.number().int().nonnegative().optional(),
    moduleCounts: z.array(z.object({module:z.enum(CLEANUP_MODULE_IDS),label:z.string(),count:z.number().int().nonnegative()})).optional(),
    dependencies: z.array(z.object({
      from: z.enum(CLEANUP_MODULE_IDS), to: z.enum(CLEANUP_MODULE_IDS).nullable(), label: z.string(),
      kind: z.enum(['foreign_key','financial_source','stock_source','closed_cash']),
      count: z.number().int().nonnegative(), includedCount: z.number().int().nonnegative(),
      missingCount: z.number().int().nonnegative(), blockedCount: z.number().int().nonnegative(), canInclude: z.boolean(),
    })).optional(),
  }),
})

export const cleanupHistoryCursorSchema = z.object({
  createdAt: z.string().datetime({offset:true}), id: z.string().uuid(),
}).strict().nullable()

export const cleanupSelectionInputSchema = cleanupPreviewSchema.omit({reason:true}).extend({
  modules: z.array(z.enum(CLEANUP_MODULE_IDS)).max(CLEANUP_MODULES.length),
}).strict()
export const cleanupSelectionSchema = z.object({
  arenaId: z.string().uuid(), requestedModules: z.array(z.enum(CLEANUP_MODULE_IDS)),
  modules: z.array(z.enum(CLEANUP_MODULE_IDS)), cutoff: z.string().datetime({offset:true}),
  dependencies: cleanupOperationSchema.shape.summary.shape.dependencies.unwrap(), resolved: z.literal(true),
}).refine(value => new Set(value.modules).size===value.modules.length && value.requestedModules.every(id=>value.modules.includes(id)), 'Não foi possível validar os vínculos da seleção.')
