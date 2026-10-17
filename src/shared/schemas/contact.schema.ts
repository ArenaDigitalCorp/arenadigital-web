import { z } from 'zod'
import { isValidCep, isValidCpf, isValidPhone, normalizeCep, normalizeCpf, normalizeEmail, normalizePhone } from '@/lib/brasil-document'

export const cpfSchema = z.string().transform(normalizeCpf).refine(isValidCpf, 'CPF inválido.')
export const optionalCpfSchema = z.string().transform(normalizeCpf).refine(value => !value || isValidCpf(value), 'CPF inválido.').optional()
export const phoneSchema = z.string().trim().refine(isValidPhone, 'Informe um telefone válido com DDD ou código do país.').transform(value => normalizePhone(value)!)
export const optionalPhoneSchema = z.string().trim().refine(value => !value || isValidPhone(value), 'Informe um telefone válido com DDD ou código do país.').transform(value => value ? normalizePhone(value)! : '').optional()
export const optionalCepSchema = z.string().transform(normalizeCep).refine(value => !value || isValidCep(value), 'Informe um CEP com 8 dígitos.').optional()
export const emailSchema = z.string().transform(normalizeEmail).pipe(z.string().email('E-mail inválido.'))
export const optionalEmailSchema = z.string().transform(normalizeEmail).refine(value => !value || z.email().safeParse(value).success, 'E-mail inválido.').optional()
