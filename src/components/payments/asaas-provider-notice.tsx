import { cn } from '@/lib/utils'

const ASAAS_SEAL_URL = 'https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=671c09ea-68b6-403f-a423-1ad64beec632'

export function AsaasProviderNotice({ className }: { className?: string }) {
  return (
    <aside aria-label="Prestador dos serviços financeiros" className={cn('rounded-lg border border-slate-200 bg-slate-50/60 px-3 pt-3 text-slate-600', className)}>
      <div className="flex flex-wrap items-center gap-3">
        {/* O selo individual deve ser carregado diretamente do Asaas, com a origem da página. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASAAS_SEAL_URL} alt="Serviços financeiros Asaas" width={128} height={47} referrerPolicy="strict-origin-when-cross-origin" className="h-auto w-32 max-w-full shrink-0" />
        <p className="min-w-0 max-w-xl flex-1 basis-24 text-xs leading-5">
          Serviços financeiros e de pagamentos prestados pelo Asaas.
        </p>
      </div>
      <details className="mt-1 text-xs leading-5">
        <summary className="min-h-11 cursor-pointer content-center rounded text-slate-600 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">
          Suporte do pagamento
        </summary>
        <div className="flex flex-wrap gap-x-4 border-t border-slate-200 pb-1 pt-1">
          <a className="inline-flex min-h-11 items-center rounded underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700" href="tel:08000090037">0800 009 0037</a>
          <a className="inline-flex min-h-11 min-w-0 items-center break-all rounded underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700" href="mailto:contato@asaas.com.br">contato@asaas.com.br</a>
        </div>
      </details>
    </aside>
  )
}
