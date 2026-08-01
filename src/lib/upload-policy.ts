export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const MAX_MULTIPART_BODY_BYTES = 6 * 1024 * 1024

const ALLOWED_IMAGE_EXTENSIONS: Record<string, ReadonlySet<string>> = {
  'image/jpeg': new Set(['jpg', 'jpeg']),
  'image/png': new Set(['png']),
  'image/webp': new Set(['webp']),
  'image/avif': new Set(['avif']),
}

const CANONICAL_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export class UploadPolicyError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'UploadPolicyError'
    this.status = status
  }
}

export type AcceptedUpload = {
  contentType: keyof typeof CANONICAL_EXTENSION
  extension: string
}

export function validateMultipartContentLength(contentLength: string | null): void {
  // Chunked requests and clients that omit the header still go through the
  // mandatory File.size validation after multipart parsing.
  if (contentLength === null) return

  if (!/^\d+$/.test(contentLength)) {
    throw new UploadPolicyError('Content-Length inválido.')
  }

  const bytes = Number(contentLength)
  if (!Number.isSafeInteger(bytes) || bytes > MAX_MULTIPART_BODY_BYTES) {
    throw new UploadPolicyError('O corpo multipart excede o limite de 6 MB.', 413)
  }
}

export function validateUploadDescriptor(file: Pick<File, 'name' | 'size' | 'type'>): AcceptedUpload {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    throw new UploadPolicyError('O arquivo está vazio ou possui tamanho inválido.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadPolicyError('A imagem excede o limite de 5 MB.', 413)
  }

  const contentType = file.type.toLowerCase()
  const allowedExtensions = ALLOWED_IMAGE_EXTENSIONS[contentType]
  if (!allowedExtensions) {
    throw new UploadPolicyError('Formato de imagem não permitido.')
  }

  const separator = file.name.lastIndexOf('.')
  const extension = separator >= 0 ? file.name.slice(separator + 1).toLowerCase() : ''
  if (!allowedExtensions.has(extension)) {
    throw new UploadPolicyError('A extensão do arquivo não corresponde ao formato informado.')
  }

  return {
    contentType: contentType as AcceptedUpload['contentType'],
    extension: CANONICAL_EXTENSION[contentType],
  }
}

export function validateImageSignature(buffer: Buffer, contentType: AcceptedUpload['contentType']): void {
  const valid = contentType === 'image/jpeg'
    ? buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    : contentType === 'image/png'
      ? buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : contentType === 'image/webp'
        ? buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
        : buffer.length >= 16
          && buffer.toString('ascii', 4, 8) === 'ftyp'
          && ['avif', 'avis'].includes(buffer.toString('ascii', 8, 12))

  if (!valid) {
    throw new UploadPolicyError('O conteúdo do arquivo não corresponde a uma imagem válida.')
  }
}

export function createUploadObjectName(extension: string, id = crypto.randomUUID()): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new UploadPolicyError('Identificador de upload inválido.')
  }
  if (!Object.values(CANONICAL_EXTENSION).includes(extension)) {
    throw new UploadPolicyError('Extensão de upload inválida.')
  }
  return `${id}.${extension}`
}
