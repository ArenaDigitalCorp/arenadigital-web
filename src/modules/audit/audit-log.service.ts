import { getSupabaseAdmin } from '@/lib/supabase-server'
import type { Database, Json } from '@/types/supabase.types'

type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']

function toJson(value?: Record<string, unknown> | null): Json | null {
  return (value ?? null) as Json | null
}

export type AuditActorType = 'user' | 'system' | 'stripe_webhook'

export type AuditEventInput = {
  entityType: string
  entityId: string
  action: string
  actorId?: string | null
  actorType: AuditActorType
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

/**
 * Registra um evento de auditoria de forma fire-and-forget.
 * Erros de escrita são logados mas NUNCA propagados — falhas de auditoria
 * não devem interromper o fluxo principal da aplicação.
 */
export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    const payload: AuditLogInsert = {
      entity_type: event.entityType,
      entity_id: event.entityId,
      action: event.action,
      actor_id: event.actorId ?? null,
      actor_type: event.actorType,
      old_value: toJson(event.oldValue),
      new_value: toJson(event.newValue),
      metadata: toJson(event.metadata)
    }

    const { error } = await supabase.from('audit_logs').insert(payload)

    if (error) {
      console.error('[audit] Falha ao registrar evento de auditoria', { event, error })
    }
  } catch (err) {
    console.error('[audit] Erro inesperado ao registrar evento de auditoria', { event, err })
  }
}
