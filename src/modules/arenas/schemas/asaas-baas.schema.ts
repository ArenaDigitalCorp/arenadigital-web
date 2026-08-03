import { z } from 'zod'

function digits(value: string): string {
  return value.replace(/\D/g, '')
}

function hasRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/u.test(value)
}

export function isValidCpf(value: string): boolean {
  const cpf = digits(value)
  if (cpf.length !== 11 || hasRepeatedDigits(cpf)) return false

  for (let position = 9; position <= 10; position += 1) {
    let sum = 0
    for (let index = 0; index < position; index += 1) {
      sum += Number(cpf[index]) * (position + 1 - index)
    }
    const digit = ((sum * 10) % 11) % 10
    if (digit !== Number(cpf[position])) return false
  }
  return true
}

export function isValidCnpj(value: string): boolean {
  const cnpj = digits(value)
  if (cnpj.length !== 14 || hasRepeatedDigits(cnpj)) return false

  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const firstDigit = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const secondDigit = calculateDigit(`${cnpj.slice(0, 12)}${firstDigit}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return cnpj.endsWith(`${firstDigit}${secondDigit}`)
}

const requiredText = (label: string, min: number, max: number) =>
  z.string().trim().min(min, `${label} é obrigatório.`).max(max, `${label} excede o limite permitido.`)

export const createArenaAsaasSubaccountSchema = z.object({
  name: requiredText('Nome ou razão social', 2, 120),
  email: z.string().trim().email('Informe um e-mail válido.').max(254),
  cpfCnpj: z.string().trim().refine(isValidCnpj, {
    message: 'Informe um CNPJ válido. O Asaas não permite criar subcontas para CPF neste fluxo.',
  }),
  companyType: z.enum(['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION']),
  mobilePhone: z.string().trim().refine((value) => {
    const phone = digits(value)
    return phone.length === 10 || phone.length === 11
  }, 'Informe um celular com DDD.'),
  incomeValue: z.coerce.number().finite().positive('Informe um faturamento mensal maior que zero.').max(1_000_000_000),
  address: requiredText('Endereço', 2, 120),
  addressNumber: requiredText('Número', 1, 20),
  complement: z.string().trim().max(80).nullable().optional(),
  province: requiredText('Bairro', 2, 80),
  postalCode: z.string().trim().refine((value) => digits(value).length === 8, 'Informe um CEP válido.'),
}).strict()

export const updateArenaPixSplitSettingsSchema = z.object({
  enabled: z.boolean(),
  asaasWalletId: z.string().trim().max(120).nullable().optional(),
  asaasAccountId: z.string().trim().max(120).nullable().optional(),
  holderName: z.string().trim().max(120).nullable().optional(),
  holderDocument: z.string().trim().max(20).nullable().optional(),
  pixKey: z.string().trim().max(255).nullable().optional(),
  platformFeeBasisPoints: z.coerce.number().int().min(0).max(10_000),
}).strict()

export function normalizeAsaasSubaccountInput(input: z.infer<typeof createArenaAsaasSubaccountSchema>) {
  return {
    ...input,
    cpfCnpj: digits(input.cpfCnpj),
    mobilePhone: digits(input.mobilePhone),
    postalCode: digits(input.postalCode),
    complement: input.complement?.trim() || undefined,
  }
}
