'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { assertArenaAdminAccess } from '@/lib/server-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { RECEIVING_DRAFT_FIELDS, type ArenaReceivingSetup, type ReceivingDraftSnapshot } from '../types/receiving-setup.types'
import { APP_BOOKING_MODES, type AppBookingMode } from '../domain/app-booking-mode'

// Match the database's allowed control characters (tab, LF and CR only).
const draftTextSchema = z.string().max(254).refine(value => [...value].every(character => {
  const code = character.charCodeAt(0)
  return code >= 32 || code === 9 || code === 10 || code === 13
}), 'Remova os caracteres inválidos do campo.')
const draftSchema = z.object(Object.fromEntries(RECEIVING_DRAFT_FIELDS.map(key => [key, draftTextSchema.optional()]))).strict()
const snapshotSchema = z.object({data: draftSchema, revision: z.number().int().positive(), updated_at: z.string()})
const setupSchema = z.object({
  draft: snapshotSchema.nullable(), desired_mode: z.literal('online_payment').nullable(),
  intent_status: z.enum(['pending','activated','cancelled']).nullable(), intent_revision: z.number().int().nonnegative(),
  cancellation_reason: z.string().nullable(), active_mode: z.enum(APP_BOOKING_MODES), ready: z.boolean(), missing: z.array(z.string()),
})
type Result<T> = { success: true; data: T } | { success: false; error: string }
type RpcName = 'get_arena_receiving_setup' | 'save_arena_receiving_draft' | 'set_arena_receiving_booking_mode'
async function rpc(arenaId: string, name: RpcName, args: Record<string, unknown> = {}) {
  z.string().uuid().parse(arenaId)
  await assertArenaAdminAccess(arenaId)
  const client = await createSupabaseServerClient()
  const api = client as unknown as {rpc(name:RpcName,args:Record<string,unknown>):Promise<{data:unknown;error:{message:string}|null}>}
  const result = await api.rpc(name,{p_arena_id:arenaId,...args})
  if(result.error) throw new Error(result.error.message)
  return setupSchema.parse(result.data) as ArenaReceivingSetup
}
const message = (error: unknown) => error instanceof z.ZodError ? 'Confira os dados informados e tente novamente.' : error instanceof Error ? error.message : 'Não foi possível confirmar a operação.'
function refresh(arenaId:string) {
  try { revalidatePath(`/dashboard/arenas/${arenaId}/edit`) } catch { /* Confirmed mutation is returned even when cache invalidation is unavailable. */ }
}
export async function getArenaReceivingSetupAction(arenaId:string):Promise<Result<ArenaReceivingSetup>> {
  try { return {success:true,data:await rpc(arenaId,'get_arena_receiving_setup')} }
  catch(error) { return {success:false,error:message(error)} }
}
export async function saveArenaReceivingDraftAction(arenaId:string, input:unknown, revision:number|null=0):Promise<Result<ReceivingDraftSnapshot>> {
  try {
    const payload=draftSchema.parse(input)
    const expected=z.number().int().nonnegative().parse(revision ?? 0)
    const setup=await rpc(arenaId,'save_arena_receiving_draft',{p_payload:payload,p_revision:expected})
    if(!setup.draft) throw new Error('Não foi possível confirmar o rascunho salvo.')
    refresh(arenaId)
    return {success:true,data:setup.draft}
  } catch(error) {return {success:false,error:message(error)}}
}
export async function setArenaReceivingBookingModeAction(arenaId:string, mode:AppBookingMode, revision:number|null=0, cancelPending=false):Promise<Result<ArenaReceivingSetup>> {
  try {
    const chosen=z.enum(APP_BOOKING_MODES).parse(mode)
    const expected=z.number().int().nonnegative().parse(revision ?? 0)
    const setup=await rpc(arenaId,'set_arena_receiving_booking_mode',{p_mode:chosen,p_revision:expected,p_preserve_pending:!z.boolean().parse(cancelPending)})
    refresh(arenaId)
    return {success:true,data:setup}
  } catch(error) {return {success:false,error:message(error)}}
}
