import { formatCpfCnpj } from '@/lib/brasil-document'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import type { Json } from '@/types/supabase.types'

export type ArenaBillingAddress = {
  cpfCnpj: string | null
  street: string | null
  neighborhood: string | null
  city: string | null
  stateUf: string | null
  number: string | null
  complement: string | null
}

function logradouroFromAddress(address: Json | null): string | null {
  if (address == null) return null
  if (typeof address === 'string') {
    const t = address.trim()
    return t || null
  }
  if (typeof address === 'object' && !Array.isArray(address)) {
    const o = address as Record<string, unknown>
    const s = o.street ?? o.logradouro
    if (typeof s === 'string' && s.trim()) return s.trim()
  }
  return null
}

export async function getArenaBillingAddress(
  arenaId: string
): Promise<ArenaBillingAddress> {
  const supabase = getSupabaseAdmin()

  const { data: arena } = await supabase
    .from('arenas')
    .select('cpf_cnpj, address, neighborhood, number, complement, id_municipio')
    .eq('id', arenaId)
    .maybeSingle()

  if (!arena) {
    return {
      cpfCnpj: null,
      street: null,
      neighborhood: null,
      city: null,
      stateUf: null,
      number: null,
      complement: null,
    }
  }

  let city: string | null = null
  let stateUf: string | null = null

  if (arena.id_municipio != null) {
    const { data: mun } = await supabase
      .from('municipios')
      .select('nome, codigo_uf')
      .eq('codigo_ibge', arena.id_municipio)
      .maybeSingle()

    if (mun) {
      city = mun.nome ?? null
      const { data: est } = await supabase
        .from('estados')
        .select('uf')
        .eq('codigo_uf', mun.codigo_uf)
        .maybeSingle()
      stateUf = est?.uf ?? null
    }
  }

  const complement =
    arena.complement?.trim() && arena.complement.trim().length > 0
      ? arena.complement.trim()
      : null

  const number =
    arena.number?.trim() && arena.number.trim().length > 0
      ? arena.number.trim()
      : null

  return {
    cpfCnpj: formatCpfCnpj(arena.cpf_cnpj) || null,
    street: logradouroFromAddress(arena.address),
    neighborhood: arena.neighborhood?.trim() || null,
    city,
    stateUf,
    number,
    complement,
  }
}
