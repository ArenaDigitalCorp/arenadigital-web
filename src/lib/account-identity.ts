import { normalizeCpf, formatCpf } from '@/lib/brasil-document'
import type { getSupabaseAdmin } from '@/lib/supabase-server'

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>

export type IdentityUser = {
  id: string
  auth_user_id?: string | null
  email: string
  name: string | null
  cpf: string | null
  role: string | null
}

export type IdentityAthlete = {
  id: string
  id_users: string
  cpf: string | null
  nome_perfil: string
}

export function normalizeEmail(email: string | null | undefined) {
  return String(email ?? '').trim().toLowerCase()
}

export function normalizeDocument(value: string | null | undefined) {
  return normalizeCpf(value)
}

export { formatCpf }

export function cpfMatches(left: string | null | undefined, right: string | null | undefined) {
  const a = normalizeDocument(left)
  const b = normalizeDocument(right)
  return a.length > 0 && b.length > 0 && a === b
}

export async function findUserByAuthUserId(supabase: SupabaseAdmin, authUserId: string) {
  const { data, error } = await (supabase as any)
    .from('users')
    .select('id, auth_user_id, email, name, cpf, role')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as IdentityUser | null
}

export async function findUserById(supabase: SupabaseAdmin, userId: string) {
  const { data, error } = await (supabase as any)
    .from('users')
    .select('id, auth_user_id, email, name, cpf, role')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as IdentityUser | null
}

export async function findUserByEmail(supabase: SupabaseAdmin, email: string) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  const { data, error } = await (supabase as any)
    .from('users')
    .select('id, auth_user_id, email, name, cpf, role')
    .eq('email', normalized)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as IdentityUser | null
}

export async function findUserByCpf(supabase: SupabaseAdmin, cpf: string) {
  const digits = normalizeDocument(cpf)
  if (!digits) return null
  const variants = Array.from(new Set([digits, formatCpf(digits)]))

  const { data, error } = await (supabase as any)
    .from('users')
    .select('id, auth_user_id, email, name, cpf, role')
    .in('cpf', variants)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as IdentityUser | null
}

export async function findAthleteByCpf(supabase: SupabaseAdmin, cpf: string) {
  const digits = normalizeDocument(cpf)
  if (!digits) return null

  const variants = Array.from(new Set([digits, formatCpf(digits)]))
  const { data, error } = await supabase
    .from('atleta')
    .select('id, id_users, cpf, nome_perfil')
    .in('cpf', variants)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as IdentityAthlete | null
}

export async function resolveAuthenticatedDbUser(supabase: SupabaseAdmin, authUserId: string) {
  return (
    (await findUserByAuthUserId(supabase, authUserId)) ??
    (await findUserById(supabase, authUserId))
  )
}
