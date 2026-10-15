/** Formatting never changes a stored identifier or silently truncates input. */
export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

export function normalizeCpf(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/[.\-\s]/g, '')
}

export function normalizeCpfCnpj(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/[.\/\-\s]/g, '').toUpperCase()
}

export function normalizeCep(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/[.\-\s]/g, '')
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function isValidCpf(value: string): boolean {
  const d = normalizeCpf(value)
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false
  for (const length of [9, 10]) {
    let sum = 0
    for (let i = 0; i < length; i++) sum += Number(d[i]) * (length + 1 - i)
    const remainder = (sum * 10) % 11
    if ((remainder === 10 ? 0 : remainder) !== Number(d[length])) return false
  }
  return true
}

/** Numeric and alphanumeric CNPJ use the same modulo-11 weights (ASCII − 48). */
export function isValidCnpj(value: string): boolean {
  const d = normalizeCpfCnpj(value)
  if (!/^[A-Z0-9]{12}\d{2}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false
  const digit = (base: string, weights: number[]) => {
    const sum = [...base].reduce((total, char, index) => total + (char.charCodeAt(0) - 48) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  return digit(d.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]) === Number(d[12])
    && digit(d.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]) === Number(d[13])
}

export function isValidCpfOrCnpj(value: string | null | undefined): boolean {
  const d = normalizeCpfCnpj(value)
  return d === '' || (d.length === 11 ? isValidCpf(d) : isValidCnpj(d))
}

export function isValidCep(value: string | null | undefined): boolean {
  return /^\d{8}$/.test(normalizeCep(value))
}

const BRAZIL_DDDS = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '))
function validBrazilPhone(value: string): boolean {
  return BRAZIL_DDDS.has(value.slice(0, 2)) && /^\d{2}(?:[2-5]\d{7}|9\d{8})$/.test(value)
}

/** Brazil national numbers require a valid DDD. Explicit foreign country codes survive. */
export function normalizePhone(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim().replace(/[\u2010-\u2015\u2212]/g, '-')
  if (!raw) return null
  if (!/^\+?[\d\s().\-]+$/.test(raw)) return null
  const digits = onlyDigits(raw)
  if (raw.startsWith('+')) {
    if (!/^[1-9]\d{6,14}$/.test(digits)) return null
    if (digits.startsWith('55') && !validBrazilPhone(digits.slice(2))) return null
    return `+${digits}`
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55') && validBrazilPhone(digits.slice(2))) return `+${digits}`
  return validBrazilPhone(digits) ? `+55${digits}` : null
}

export function isValidPhone(value: string | null | undefined): boolean {
  return normalizePhone(value) !== null
}

/** The Asaas domestic customer API accepts DDD + number, not country code. */
export function asaasDomesticPhone(value: string | null | undefined): string | undefined {
  const phone = normalizePhone(value)
  return phone?.startsWith('+55') ? phone.slice(3) : undefined
}

function grouped(value: string, lengths: number[], separators: string[]): string {
  let offset = 0
  return lengths.map((length, index) => {
    const part = value.slice(offset, offset + length)
    offset += length
    return part ? `${index ? separators[index - 1] : ''}${part}` : ''
  }).join('')
}

export function maskCpf(value: string): string {
  const d = normalizeCpf(value)
  return /^\d{0,11}$/.test(d) ? grouped(d, [3,3,3,2], ['.','.','-']) : value
}
export function maskCnpj(value: string): string {
  const d = normalizeCpfCnpj(value)
  return /^[A-Z0-9]{0,12}\d{0,2}$/.test(d) && d.length <= 14
    ? grouped(d, [2,3,3,4,2], ['.','.','/','-']) : value
}
export function maskCpfCnpj(value: string): string {
  const d = normalizeCpfCnpj(value)
  return /[A-Z]/.test(d) || d.length > 11 ? maskCnpj(value) : maskCpf(value)
}
export function maskCep(value: string): string {
  const d = normalizeCep(value)
  return /^\d{0,8}$/.test(d) ? grouped(d, [5,3], ['-']) : value
}
function maskNationalPhone(digits: string): string {
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  const subscriber = digits.slice(2)
  const split = subscriber.length > 8 ? 5 : 4
  return `(${digits.slice(0, 2)}) ${subscriber.slice(0, split)}${subscriber.length > split ? `-${subscriber.slice(split)}` : ''}`
}
export function maskPhone(value: string): string {
  const raw = value.trim().replace(/[\u2010-\u2015\u2212]/g, '-')
  if (!raw || !/^\+?[\d\s().\-]+$/.test(raw)) return value
  const digits = onlyDigits(raw)
  if (raw.startsWith('+') && !digits.startsWith('55')) return `+${digits}`
  const hasCountryCode = raw.startsWith('+55') || (digits.startsWith('55') && [12,13].includes(digits.length))
  const national = hasCountryCode ? digits.slice(2) : digits
  if (national.length > 11) return value
  return `${hasCountryCode ? '+55 ' : ''}${maskNationalPhone(national)}`
}

/** Display masks apply only to complete shapes; malformed legacy data remains visible. */
export function formatCpf(value: string | null | undefined): string {
  const d = normalizeCpf(value)
  return /^\d{11}$/.test(d) ? maskCpf(d) : (value ?? '').trim()
}
export function formatCnpj(value: string | null | undefined): string {
  const d = normalizeCpfCnpj(value)
  return /^[A-Z0-9]{12}\d{2}$/.test(d) ? maskCnpj(d) : (value ?? '').trim()
}
export function formatCpfCnpj(value: string | null | undefined): string {
  const d = normalizeCpfCnpj(value)
  return d.length === 11 ? formatCpf(value) : formatCnpj(value)
}
export function formatCep(value: string | null | undefined): string {
  return isValidCep(value) ? maskCep(normalizeCep(value)) : (value ?? '').trim()
}
export function formatPhone(value: string | null | undefined): string {
  const normalized = normalizePhone(value)
  return normalized?.startsWith('+55') ? `+55 ${maskNationalPhone(normalized.slice(3))}` : normalized ?? (value ?? '').trim()
}
