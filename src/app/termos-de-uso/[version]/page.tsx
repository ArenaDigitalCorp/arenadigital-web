import { notFound } from 'next/navigation'
import { TermsDocumentPage } from '@/modules/terms/TermsDocumentPage'
import { termsDocuments } from '@/modules/terms/terms-documents'

export const dynamicParams = false

export function generateStaticParams() {
  return termsDocuments.map(({ version }) => ({ version }))
}

export default async function VersionedTermsPage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params
  const document = termsDocuments.find(item => item.version === version)
  if (!document) notFound()
  return <TermsDocumentPage document={document} />
}
