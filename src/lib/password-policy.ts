export function isStrongPassword(value: string) {
  return value.length >= 8
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value)
}

export const STRONG_PASSWORD_HELP = 'Use 8 ou mais caracteres, com maiúscula, minúscula, número e símbolo.'
