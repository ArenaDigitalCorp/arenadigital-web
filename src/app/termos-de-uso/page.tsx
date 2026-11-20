import type { Metadata } from 'next'
import { TermsDocumentPage } from '@/modules/terms/TermsDocumentPage'
import { ARENA_TERMS_VERSION } from '@/modules/terms/arena-terms'
import { termsDocuments } from '@/modules/terms/terms-documents'

export const metadata: Metadata = {
  title: 'Termos de Uso | Arena Digital',
  description: 'Termos de uso da plataforma Arena Digital.',
}

export default function TermsOfUsePage() {
  const current = termsDocuments.find(document => document.version === ARENA_TERMS_VERSION)
  if (!current) throw new Error('Versão atual dos termos indisponível.')
  return <TermsDocumentPage document={current} />
}
