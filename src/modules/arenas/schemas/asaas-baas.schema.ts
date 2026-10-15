import { z } from 'zod'

import { isValidCnpj, isValidCpf, normalizeCep, normalizeCpfCnpj, normalizeEmail, normalizePhone } from '@/lib/brasil-document'
export { isValidCnpj, isValidCpf }

function nationalBrazilPhone(value: string): string | null {
  const canonical = normalizePhone(value)
  return canonical?.startsWith('+55') && /^\+55\d{10,11}$/.test(canonical) ? canonical.slice(3) : null
}

const requiredText = (label: string, min: number, max: number) =>
  z.string().trim().min(min, `${label} é obrigatório.`).max(max, `${label} excede o limite permitido.`)

export const createArenaAsaasSubaccountSchema = z.object({
  name: requiredText('Nome ou razão social', 2, 120),
  email: z.string().transform(normalizeEmail).pipe(z.string().email('Informe um e-mail válido.').max(254)),
  cpfCnpj: z.string().trim().refine(isValidCnpj, {
    message: 'Informe um CNPJ válido. O Asaas não permite criar subcontas para CPF neste fluxo.',
  }),
  companyType: z.enum(['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION']),
  mobilePhone: z.string().trim().refine(value => nationalBrazilPhone(value) !== null, 'Informe um celular brasileiro válido com DDD.'),
  incomeValue: z.coerce.number().finite().positive('Informe um faturamento mensal maior que zero.').max(1_000_000_000),
  address: requiredText('Endereço', 2, 120),
  addressNumber: requiredText('Número', 1, 20),
  complement: z.string().trim().max(80).nullable().optional(),
  province: requiredText('Bairro', 2, 80),
  postalCode: z.string().trim().refine((value) => /^\d{8}$/.test(normalizeCep(value)), 'Informe um CEP válido.'),
}).strict()

export const updateArenaPixSplitSettingsSchema = z.object({
  enabled: z.boolean(),
  asaasWalletId: z.string().trim().max(120).nullable().optional(),
  asaasAccountId: z.string().trim().max(120).nullable().optional(),
  holderName: z.string().trim().max(120).nullable().optional(),
  holderDocument: z.string().trim().max(20).nullable().optional(),
  pixKey: z.string().trim().max(255).nullable().optional(),
  commissionMode: z.enum(['percentage_net', 'fixed']),
  commissionFixedCents: z.number().int().min(0).max(100_000_000),
  platformFeeBasisPoints: z.coerce.number().int().min(0).max(10_000),
}).strict().superRefine((value, ctx) => {
  if ((value.commissionMode === 'fixed' && value.platformFeeBasisPoints !== 0)
    || (value.commissionMode === 'percentage_net' && value.commissionFixedCents !== 0)) {
    ctx.addIssue({ code: 'custom', path: ['commissionMode'], message: 'Escolha apenas um tipo de comissão.' })
  }
})

export function normalizeAsaasSubaccountInput(input: z.infer<typeof createArenaAsaasSubaccountSchema>) {
  return {
    ...input,
    cpfCnpj: normalizeCpfCnpj(input.cpfCnpj),
    mobilePhone: nationalBrazilPhone(input.mobilePhone)!,
    postalCode: normalizeCep(input.postalCode),
    complement: input.complement?.trim() || undefined,
  }
}
