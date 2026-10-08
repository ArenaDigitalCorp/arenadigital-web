import type { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { AsaasProviderNotice } from '@/components/payments/asaas-provider-notice'

export const metadata: Metadata = {
  title: 'Serviços financeiros | Arena Digital',
  description: 'Informações sobre os serviços financeiros Asaas integrados à Arena Digital e seus canais de atendimento.',
}

export default function FinancialServicesPage() {
  return (
    <div className="min-h-screen bg-white text-arena-navy-800">
      <Navbar />
      <main className="bg-[#F6F7F9] px-4 pb-24 pt-36 md:px-10 md:pt-40">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-arena-button">Pagamentos na plataforma</p>
            <h1 className="mt-2 font-heading text-3xl font-bold">Serviços financeiros</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              A Arena Digital oferece ferramentas para organizar reservas e acompanhar pagamentos. Os serviços financeiros de recebimento Pix e saque integrados à plataforma são prestados pelo Asaas.
            </p>
          </div>
          <AsaasProviderNotice />
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-heading text-lg font-bold">Cadastro e recebimento da arena</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Para receber pagamentos online, a arena precisa concluir o cadastro e a validação dos dados e documentos solicitados pelo Asaas. Criar a conta não significa que o recebimento já foi aprovado. O painel da arena apresenta os status e, quando disponível, o link para envio de documentos.
            </p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-heading text-lg font-bold">Qual suporte procurar?</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Para dúvidas sobre os serviços financeiros e a documentação da conta de recebimento, utilize os canais do Asaas acima. Para dificuldades de acesso ou uso da Arena Digital, fale com nossa equipe pelo{' '}
              <a href="mailto:contato@arenadigital.app" className="break-all underline underline-offset-2">contato@arenadigital.app</a>.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link href="/termos-de-uso" className="underline underline-offset-2">Termos de uso</Link>
              <Link href="/politica-de-privacidade" className="underline underline-offset-2">Política de privacidade</Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
