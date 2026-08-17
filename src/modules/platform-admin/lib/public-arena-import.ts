import type {
  PublicArenaImportDraft,
  PublicArenaImportPreviewRow,
} from '@/modules/platform-admin/types/platform-admin.types'

export const PUBLIC_ARENA_IMPORT_HEADERS = [
  'external_id',
  'name',
  'cnpj',
  'address',
  'number',
  'complement',
  'neighborhood',
  'zip_code',
  'phone',
  'email',
  'description',
  'municipality_id',
  'sport_ids',
  'latitude',
  'longitude',
  'platform_notes',
] as const

const MAX_CSV_BYTES = 2_000_000
const MAX_CSV_ROWS = 500

function nullable(value: string): string | null {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function numericOrRaw(value: string): number | string | null {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : normalized
}

function parseCsvCells(text: string): string[][] {
  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) {
    throw new Error('O CSV excede o limite de 2 MB.')
  }

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let justClosedQuote = false

  const pushField = () => {
    row.push(field)
    field = ''
    justClosedQuote = false
  }
  const pushRow = () => {
    pushField()
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row)
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
          justClosedQuote = true
        }
      } else {
        field += character
      }
      continue
    }

    if (character === '"') {
      if (field.length > 0 || justClosedQuote) throw new Error('CSV inválido: aspas em posição inesperada.')
      quoted = true
    } else if (character === ',') {
      pushField()
    } else if (character === '\n') {
      pushRow()
    } else if (character === '\r') {
      if (text[index + 1] === '\n') index += 1
      pushRow()
    } else {
      if (justClosedQuote && !/\s/u.test(character)) {
        throw new Error('CSV inválido: conteúdo após o fechamento de aspas.')
      }
      field += character
    }
  }

  if (quoted) throw new Error('CSV inválido: campo entre aspas não foi fechado.')
  if (field.length > 0 || row.length > 0) pushRow()
  return rows
}

export function parsePublicArenaCsv(text: string): PublicArenaImportPreviewRow[] {
  const rows = parseCsvCells(text.replace(/^\uFEFF/u, ''))
  if (rows.length < 2) throw new Error('O CSV precisa conter o cabeçalho e ao menos uma linha.')

  const headers = rows[0].map((header) => header.trim().toLowerCase())
  const expected = new Set<string>(PUBLIC_ARENA_IMPORT_HEADERS)
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index)
  const unknown = headers.filter((header) => !expected.has(header))
  const missing = PUBLIC_ARENA_IMPORT_HEADERS.filter((header) => !headers.includes(header))
  if (duplicates.length > 0) throw new Error(`Cabeçalho repetido: ${[...new Set(duplicates)].join(', ')}.`)
  if (unknown.length > 0) throw new Error(`Cabeçalho não permitido: ${unknown.join(', ')}.`)
  if (missing.length > 0) throw new Error(`Cabeçalhos ausentes: ${missing.join(', ')}.`)

  const dataRows = rows.slice(1)
  if (dataRows.length > MAX_CSV_ROWS) throw new Error('O lote pode conter no máximo 500 linhas.')

  return dataRows.map((cells, index) => {
    const values = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? '']))
    const latitude = numericOrRaw(values.latitude)
    const longitude = numericOrRaw(values.longitude)
    const municipalityId = numericOrRaw(values.municipality_id)
    const errors: string[] = []
    if (cells.length > headers.length) errors.push('A linha possui colunas além do cabeçalho.')
    if (!values.name.trim()) errors.push('Nome não informado.')
    if (!values.address.trim()) errors.push('Endereço não informado.')
    if (typeof municipalityId === 'string') errors.push('municipality_id deve ser numérico.')
    if (typeof latitude === 'string') errors.push('latitude deve ser numérica.')
    if (typeof longitude === 'string') errors.push('longitude deve ser numérica.')

    const item: PublicArenaImportDraft = {
      external_id: nullable(values.external_id),
      name: values.name.trim(),
      cnpj: nullable(values.cnpj),
      address: values.address.trim(),
      number: nullable(values.number),
      complement: nullable(values.complement),
      neighborhood: nullable(values.neighborhood),
      zip_code: nullable(values.zip_code),
      phone: nullable(values.phone),
      email: nullable(values.email),
      description: nullable(values.description),
      municipality_id: municipalityId,
      sport_ids: values.sport_ids.split('|').map((value) => value.trim()).filter(Boolean),
      latitude,
      longitude,
      platform_notes: nullable(values.platform_notes),
    }
    if (item.sport_ids.length === 0) errors.push('sport_ids não informado.')

    return { rowNumber: index + 2, item, errors }
  })
}

export function publicArenaImportCsvTemplate(): string {
  return `${PUBLIC_ARENA_IMPORT_HEADERS.join(',')}\n`
}
