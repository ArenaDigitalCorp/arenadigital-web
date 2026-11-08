"use client"

import { Ban, CalendarClock, Check, CreditCard, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AppBookingMode } from '../domain/app-booking-mode'
import type { ArenaReceivingSetup } from '../types/receiving-setup.types'

type Props = {
  selectedMode: AppBookingMode
  savedMode: AppBookingMode
  setup: ArenaReceivingSetup | null
  busy: boolean
  onSelectionChange: (mode: AppBookingMode) => void
  onSave: (mode: AppBookingMode) => void
  onCancel: () => void
}
const OPTIONS = [
  {value:'disabled',title:'Desativado',description:'A arena permanece visível, mas combina as reservas fora do aplicativo.',icon:Ban},
  {value:'pre_booking',title:'Pré-reserva',description:'O atleta solicita. A arena aprova e o pagamento acontece presencialmente.',icon:CalendarClock},
  {value:'online_payment',title:'Pagamento online',description:'A reserva é confirmada por Pix, com split e política de cancelamento.',icon:CreditCard},
] as const
export function ArenaAppBookingSettingsCard({ selectedMode, savedMode, setup, busy, onSelectionChange, onSave, onCancel }: Props) {
  const pending=setup?.intent_status==='pending'
  return <section className="space-y-4 px-5 py-6 sm:px-7" aria-labelledby="app-booking-settings-title">
    <div><h3 id="app-booking-settings-title" className="flex items-center gap-2.5 text-sm font-bold text-arena-navy-800"><span className="grid size-6 place-items-center rounded-full bg-arena-navy-800/5 text-xs">1</span>Modalidade do aplicativo</h3><p className="ml-8 mt-1 text-xs text-slate-500">Escolha como os atletas poderão efetuar reservas.</p></div>
    <div className="grid gap-3 lg:grid-cols-3" role="radiogroup" aria-label="Modo de reservas pelo aplicativo">
      {OPTIONS.map(option=>{
        const Icon=option.icon, selected=selectedMode===option.value
        return <button key={option.value} type="button" role="radio" aria-checked={selected} disabled={busy} onClick={()=>onSelectionChange(option.value)} className={cn('relative flex min-h-36 flex-col items-start rounded-xl border p-4 text-left transition-colors disabled:opacity-60',selected?'border-arena-button bg-orange-50/30 shadow-sm':'border-slate-200 bg-white hover:border-slate-300')}>
          <div className="mb-3 flex w-full items-center justify-between gap-2"><span className={cn('grid size-8 shrink-0 place-items-center rounded-lg',selected?'bg-arena-button text-white':'bg-slate-100 text-slate-500')}><Icon className="size-4"/></span>
            {option.value==='online_payment' && pending ? <span role="status" className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">Aguardando aprovação</span> : savedMode===option.value ? <span className="text-[10px] font-medium text-emerald-700">{savedMode==='disabled'?'Modalidade atual':'Ativo'}</span>:null}
          </div>
          <b className="text-xs text-arena-navy-800">{option.title}</b><p className="mt-1 pr-3 text-xs leading-relaxed text-slate-500">{option.description}</p>
          {selected && <Check className="absolute bottom-3 right-3 size-3.5 text-arena-button"/>}
        </button>
      })}
    </div>
    {selectedMode==='online_payment' ? <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-900">
      {savedMode==='online_payment' ? 'Pagamento online ativo. Você pode preparar uma nova versão da política sem alterar as condições das reservas existentes.' : pending ? 'Solicitação enviada. A modalidade atual permanece ativa durante a análise. O pagamento online será ativado após a aprovação da conta e a publicação da política.' : <>Prepare a política e a conta abaixo. Ao solicitar o pagamento online, a modalidade atual será mantida durante a análise. O <strong>Pagamento online</strong> será ativado após a aprovação.</>}
    </div> : <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-xl text-xs leading-relaxed text-slate-500">{pending ? 'Você pode alterar a modalidade atual sem interromper a análise. O pagamento online será ativado após a aprovação.' : selectedMode==='pre_booking' ? 'Na pré-reserva, solicitações pendentes não ocupam a agenda. O horário é bloqueado quando a arena aprova.' : 'Política e conta de recebimento aparecem ao selecionar Pagamento online. Seus dados salvos são preservados.'}</p>
      <Button type="button" className="bg-arena-button text-white hover:bg-arena-button-hover" disabled={busy||!setup||selectedMode===savedMode} onClick={()=>onSave(selectedMode)}>{busy?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}Salvar modalidade</Button>
    </div>}
    {pending&&<div className="flex justify-end"><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar solicitação online</Button></div>}
  </section>
}
