import { isValidCpf, isValidCnpj, normalizeCpf, normalizeCpfCnpj, normalizeEmail, normalizePhone } from '@/lib/brasil-document'
import { z } from 'zod'
import type { ArenaPixKeyType } from '@/modules/finance/types/arena-financial-account.types'

export function normalizePixKey(type: ArenaPixKeyType, value: string): string | null {
  if (type === 'CPF') return isValidCpf(value) ? normalizeCpf(value) : null
  if (type === 'CNPJ') return isValidCnpj(value) ? normalizeCpfCnpj(value) : null
  if (type === 'PHONE') {
    const phone = normalizePhone(value)
    return phone && /^\+55\d{2}9\d{8}$/.test(phone) ? phone : null
  }
  if (type === 'EMAIL') {
    const email = normalizeEmail(value)
    return z.email().safeParse(email).success ? email : null
  }
  if (type === 'EVP') {
    const key = value.trim()
    return z.uuid().safeParse(key).success ? key.toLowerCase() : null
  }
  return null
}
