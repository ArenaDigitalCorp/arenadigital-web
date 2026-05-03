/** Apenas dígitos. */
export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/** CPF com 11 dígitos e dígitos verificadores válidos (ignora formatação). */
export function isValidCpf(digits: string): boolean {
  const d = onlyDigits(digits)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]!, 10) * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10) r = 0
  if (r !== parseInt(d[9]!, 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]!, 10) * (11 - i)
  r = (sum * 10) % 11
  if (r === 10) r = 0
  return r === parseInt(d[10]!, 10)
}

/** CNPJ com 14 dígitos e dígitos verificadores válidos (ignora formatação). */
export function isValidCnpj(digits: string): boolean {
  const d = onlyDigits(digits)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false

  const calc = (base: string, weights: number[]) => {
    let sum = 0
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(base[i]!, 10) * weights[i]!
    }
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const dv1 = calc(d.slice(0, 12), w1)
  const dv2 = calc(d.slice(0, 13), w2)
  return dv1 === parseInt(d[12]!, 10) && dv2 === parseInt(d[13]!, 10)
}

export function isValidCpfOrCnpj(value: string | null | undefined): boolean {
  const d = onlyDigits(value)
  if (d.length === 0) return true
  if (d.length === 11) return isValidCpf(d)
  if (d.length === 14) return isValidCnpj(d)
  return false
}
