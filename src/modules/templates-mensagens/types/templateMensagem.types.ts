import type { Database } from '@/types/supabase.types'

type Row = Database['public']['Tables']['message_templates']['Row']

export type CreateMessageTemplateDTO = Database['public']['Tables']['message_templates']['Insert']
export type UpdateMessageTemplateDTO = Database['public']['Tables']['message_templates']['Update']

export type MessageTemplateChannel = 'whatsapp'

export type MessageTemplateStatus = 'Ativo' | 'Inativo'

/**
 * `channel`/`status` vêm de `text` + `CHECK` no banco (não enum do Postgres),
 * então o tipo gerado é `string`. A constraint garante os valores — refinamos
 * aqui para o app não precisar normalizar em runtime.
 */
export type MessageTemplate = Omit<Row, 'channel' | 'status'> & {
  channel: MessageTemplateChannel
  status: MessageTemplateStatus
}

export interface MessageTemplateFormInput {
  identifier: string
  name: string
  message: string
  status: MessageTemplateStatus
}
