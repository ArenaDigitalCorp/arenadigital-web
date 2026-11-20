import Link from 'next/link'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { ARENA_TERMS_VERSION } from './arena-terms'
import { termsDocuments, type TermsDocument } from './terms-documents'

export function TermsDocumentPage({ document: terms }: { document: TermsDocument }) {
  const current = terms.version === ARENA_TERMS_VERSION
  return (
    <div className="min-h-screen bg-white font-sans text-[#003049]">
      <Navbar />
      <main className="bg-[#F6F7F9] px-4 pb-28 pt-36 md:px-10 md:pb-32 md:pt-40">
        <article className="mx-auto max-w-4xl">
          <h1 className="font-heading text-3xl font-bold md:text-4xl">Termos de Uso</h1>
          <p className="mt-2 text-sm">
            {current ? 'Versão atual' : 'Versão anterior'} de <time dateTime={terms.version}>{terms.dateLabel}</time>
          </p>
          {terms.version === '2026-11-20' && (
            <aside aria-label="O que mudou nesta versão" className="mt-6 rounded-lg border border-arena-navy-100 bg-white px-5 py-4 text-sm leading-6">
              <p className="font-bold">O que mudou para as arenas</p>
              <p>Incluímos a autorização para exibir o logo e as fotos do perfil e explicamos como o titular pode pedir a retirada de uma imagem. <a className="font-semibold underline" href="#imagens-da-arena">Ler a cláusula 5.1</a></p>
            </aside>
          )}
          <div className="mt-8 space-y-7 text-sm leading-6">
            {terms.sections.map(section => (
              <section key={section.title} id={section.id} className="scroll-mt-28 space-y-2">
                <h2 className="font-bold">{section.title}</h2>
                {section.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                {section.groups?.map(group => (
                  <p key={group.label}><strong>{group.label}</strong> {group.text}</p>
                ))}
                {section.list && (
                  <ul className="list-disc pl-6">
                    {section.list.map(item => <li key={item}>{item}</li>)}
                  </ul>
                )}
                {section.after?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              </section>
            ))}
          </div>
          <nav aria-label="Versões dos Termos de Uso" className="mt-10 border-t pt-6 text-sm">
            <h2 className="font-bold">Histórico de versões</h2>
            <ul className="mt-2 space-y-2">
              {termsDocuments.map(entry => (
                <li key={entry.version}>
                  <Link href={`/termos-de-uso/${entry.version}`} className="underline" aria-current={entry.version === terms.version ? 'page' : undefined}>
                    {entry.dateLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      </main>
      <Footer />
    </div>
  )
}
