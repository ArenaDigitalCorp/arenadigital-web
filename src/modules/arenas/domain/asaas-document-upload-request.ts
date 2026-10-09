import { z } from 'zod'
import { AsaasDocumentError } from './asaas-documents'
import { MAX_ASAAS_DOCUMENT_FILE_BYTES } from '../types/asaas-documents.types'

const MAX_MULTIPART_BYTES = MAX_ASAAS_DOCUMENT_FILE_BYTES + 64 * 1024
const fieldsSchema = z.object({
  documentGroupId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/u),
  requestId: z.string().uuid(),
  explicitRetry: z.enum(['true', 'false']).default('false'),
}).strict()

export function assertAsaasDocumentUploadOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AsaasDocumentError('A solicitação de envio precisa ser feita pelo painel da arena.', 403, 'invalid_upload_origin')
  }
}

export async function parseAsaasDocumentUploadRequest(request: Request): Promise<{
  documentGroupId: string
  requestId: string
  explicitRetry: boolean
  file: File
  bytes: Uint8Array
}> {
  const contentType = request.headers.get('content-type')
  if (!contentType?.toLowerCase().startsWith('multipart/form-data;') || !/boundary=/iu.test(contentType)) {
    throw new AsaasDocumentError('Selecione um documento para enviar pelo formulário.', 415, 'invalid_upload_content_type')
  }
  const length = request.headers.get('content-length')
  if (length !== null && (!/^\d+$/u.test(length) || !Number.isSafeInteger(Number(length)))) {
    throw new AsaasDocumentError('A solicitação de envio é inválida.', 400, 'invalid_content_length')
  }
  if (length !== null && Number(length) > MAX_MULTIPART_BYTES) {
    throw new AsaasDocumentError('O arquivo deve ter no máximo 3 MB.', 413, 'file_too_large')
  }
  if (!request.body) throw new AsaasDocumentError('Selecione um documento para enviar.', 400, 'missing_upload_body')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      totalBytes += chunk.value.byteLength
      if (totalBytes > MAX_MULTIPART_BYTES) {
        await reader.cancel()
        throw new AsaasDocumentError('O arquivo deve ter no máximo 3 MB.', 413, 'file_too_large')
      }
      chunks.push(chunk.value)
    }
  } catch (error) {
    if (error instanceof AsaasDocumentError) throw error
    throw new AsaasDocumentError('Não foi possível ler o arquivo. Selecione-o novamente.', 400, 'invalid_upload_body')
  } finally {
    reader.releaseLock()
  }
  const bodyBytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  let form: FormData
  try {
    form = await new Response(bodyBytes, { headers: { 'Content-Type': contentType } }).formData()
  } catch {
    throw new AsaasDocumentError('A solicitação de envio é inválida.', 400, 'invalid_upload_body')
  }
  const fieldNames = [...form.keys()]
  const allowedFields = new Set(['documentGroupId', 'requestId', 'documentFile', 'explicitRetry'])
  if (fieldNames.some((name) => !allowedFields.has(name)) || new Set(fieldNames).size !== fieldNames.length) {
    throw new AsaasDocumentError('Envie apenas um arquivo por documento solicitado.', 400, 'invalid_upload_fields')
  }
  const parsed = fieldsSchema.safeParse({
    documentGroupId: form.get('documentGroupId'),
    requestId: form.get('requestId'),
    explicitRetry: form.get('explicitRetry') ?? 'false',
  })
  const file = form.get('documentFile')
  if (!parsed.success || !(file instanceof File)) {
    throw new AsaasDocumentError('Selecione um documento válido para enviar.', 400, 'invalid_upload_fields')
  }
  if (file.size <= 0 || file.size > MAX_ASAAS_DOCUMENT_FILE_BYTES) {
    throw new AsaasDocumentError('O arquivo deve ter entre 1 byte e 3 MB.', 413, 'file_too_large')
  }
  return { ...parsed.data, explicitRetry: parsed.data.explicitRetry === 'true', file, bytes: new Uint8Array(await file.arrayBuffer()) }
}
