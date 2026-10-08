import { cn } from '@/lib/utils'

const ASAAS_SEAL_URL = 'https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=671c09ea-68b6-403f-a423-1ad64beec632'

export function AsaasProviderNotice({ className }: { className?: string }) {
  return (
    <aside aria-label="Prestador dos serviços financeiros" className={cn('rounded-xl border border-slate-200 bg-white p-4 text-slate-700', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-5">
          Serviços financeiros e de pagamentos prestados pelo Asaas. A Arena Digital integra esses serviços à plataforma.
        </p>
        {/* O selo individual deve ser carregado diretamente do Asaas, com a origem da página. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASAAS_SEAL_URL} alt="Serviços financeiros Asaas" width={180} height={48} referrerPolicy="strict-origin-when-cross-origin" className="h-auto max-w-full shrink-0 self-start sm:self-center" />
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5">
        <span>Suporte financeiro Asaas:</span>
        <a className="rounded underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2" href="tel:08000090037">0800 009 0037</a>
        <span aria-hidden="true">·</span>
        <a className="rounded break-all underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2" href="mailto:contato@asaas.com.br">contato@asaas.com.br</a>
      </p>
    </aside>
  )
}
