'use server'

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaAccess, assertArenaAdminAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import type {
  MessageTemplate,
  MessageTemplateChannel,
  MessageTemplateFormInput,
} from '@/modules/templates-mensagens/types/templateMensagem.types'
import { revalidatePath } from 'next/cache'

const IDENTIFIER_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

function revalidateTemplatesPath(arenaId: string) {
  revalidatePath(`/dashboard/settings/templates-mensagens/${arenaId}`)
}

function validateFormInput(input: MessageTemplateFormInput) {
  const identifier = input.identifier.trim()
  const name = input.name.trim()
  const message = input.message.trim()

  if (identifier.length < 2 || !IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error('Identificador inválido. Use letras minúsculas, números e hífen (ex.: confirmacao-reserva).')
  }
  if (name.length < 2) throw new Error('Nome deve ter pelo menos 2 caracteres')
  if (message.length < 5) throw new Error('Mensagem deve ter pelo menos 5 caracteres')

  return { identifier, name, message, status: input.status }
}

export async function getMessageTemplatesByArenaAction(
  arenaId: string,
  channel: MessageTemplateChannel = 'whatsapp'
) {
  try {
    await assertArenaAccess(arenaId)
    const { data, error } = await getSupabaseAdmin()
      .from('message_templates')
      .select('*')
      .eq('arena_id', arenaId)
      .eq('channel', channel)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return { success: true, data: (data ?? []) as MessageTemplate[] }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar templates de mensagem'
    return { success: false, error: message, data: [] as MessageTemplate[] }
  }
}

export async function createMessageTemplateAction(
  arenaId: string,
  input: MessageTemplateFormInput,
  channel: MessageTemplateChannel = 'whatsapp'
) {
  try {
    await assertArenaAdminAccess(arenaId)
    const { dbUserId } = await requireAuthenticatedDbUser()
    const parsed = validateFormInput(input)

    const { data, error } = await getSupabaseAdmin()
      .from('message_templates')
      .insert([{ arena_id: arenaId, channel, created_by: dbUserId, ...parsed }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') throw new Error('Já existe um template com este identificador nesta arena/canal')
      throw new Error(error.message)
    }
    revalidateTemplatesPath(arenaId)
    return { success: true, data: data as MessageTemplate }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao criar template'
    return { success: false, error: message, data: null }
  }
}

export async function updateMessageTemplateAction(
  arenaId: string,
  templateId: string,
  input: MessageTemplateFormInput
) {
  try {
    await assertArenaAdminAccess(arenaId)
    const parsed = validateFormInput(input)

    const { data, error } = await getSupabaseAdmin()
      .from('message_templates')
      .update(parsed)
      .eq('id', templateId)
      .eq('arena_id', arenaId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') throw new Error('Já existe um template com este identificador nesta arena/canal')
      throw new Error(error.message)
    }
    revalidateTemplatesPath(arenaId)
    return { success: true, data: data as MessageTemplate }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar template'
    return { success: false, error: message, data: null }
  }
}

export async function deleteMessageTemplateAction(arenaId: string, templateId: string) {
  try {
    await assertArenaAdminAccess(arenaId)
    const { error } = await getSupabaseAdmin()
      .from('message_templates')
      .delete()
      .eq('id', templateId)
      .eq('arena_id', arenaId)

    if (error) throw new Error(error.message)
    revalidateTemplatesPath(arenaId)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir template'
    return { success: false, error: message }
  }
}
