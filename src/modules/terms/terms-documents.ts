import october from './versions/2026-10-09.json'
import november from './versions/2026-11-20.json'

export interface TermsSection {
  id?: string
  title: string
  body: string[]
  list?: string[]
  after?: string[]
  groups?: { label: string; text: string }[]
}

export interface TermsDocument {
  version: string
  dateLabel: string
  sections: TermsSection[]
}

export const termsDocuments: readonly TermsDocument[] = [
  { version: '2026-11-20', dateLabel: '20 de novembro de 2026', sections: november },
  { version: '2026-10-09', dateLabel: '9 de outubro de 2026', sections: october },
]
