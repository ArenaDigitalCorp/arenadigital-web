'use client'

import { useEffect, useState } from 'react'
import { addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { reajustarValorPlanoAction } from '@/modules/mensalistas/actions/mensalistaActions'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  planoId: string
  planoLabel: string
  valorAtual: number
  /** Valor total da mensalidade do mês visualizado (se já gerada). */
  valorMesAtual: number | null
  /** Mês que a tela está exibindo, em YYYY-MM-01. Âncora da vigência. */
  competencia: string
}

type Escopo = 'somente_mes' | 'mes_atual' | 'mes_seguinte'

export function ReajustarValorModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  planoId,
  planoLabel,
  valorAtual,
  valorMesAtual,
  competencia,
}: Props) {
  const [valor, setValor] = useState(String(valorAtual || ''))
  const [escopo, setEscopo] = useState<Escopo>('mes_seguinte')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setValor(String(valorAtual || ''))
      setEscopo('mes_seguinte')
      setObs('')
    }
  }, [open, valorAtual])

  // Os rótulos nomeiam o mês. "Mês atual" era lido como "o mês que estou vendo"
  // e o servidor entendia "o mês do calendário" — olhando outubro em setembro,
  // o reajuste caía em setembro. Com o nome na tela não há como confundir.
  const ancoraDate = parseISO(competencia || '1970-01-01')
  const nomeMes = (d: Date) => format(d, "MMMM 'de' yyyy", { locale: ptBR })
  const mesAncora = nomeMes(ancoraDate)
  const mesSeguinte = nomeMes(addMonths(ancoraDate, 1))

  const novo = Number(valor.replace(',', '.'))
  const invalido = !Number.isFinite(novo) || novo < 0
  const semMudanca = !invalido && Math.abs(novo - valorAtual) < 0.005

  const submit = async () => {
    if (invalido) {
      toast.error('Informe um valor válido')
      return
    }
    setSaving(true)
    try {
      const res = await reajustarValorPlanoAction({
        arenaId,
        planoId,
        operationId: crypto.randomUUID(),
        novoValor: Math.round(novo * 100) / 100,
        escopo,
        competencia,
        observacao: obs.trim() || null,
      })
      if (!res.success || !res.data) {
        toast.error(res.error ?? 'Erro ao reajustar o valor')
        return
      }
      const d = res.data
      const ignoradas = d.ignoradasRateio + d.ignoradasPagamento
      toast.success(
        (d.escopo === 'somente_mes'
          ? `Cobrança de ${mesAncora} ajustada para ${formatCurrency(d.valorNovo)}. O plano segue em ${formatCurrency(valorAtual)}/mês.`
          : `Plano reajustado para ${formatCurrency(d.valorNovo)}/mês, de ${
              d.escopo === 'mes_seguinte' ? mesSeguinte : mesAncora
            } em diante.`) +
          (ignoradas > 0
            ? ` ${ignoradas} ${ignoradas === 1 ? 'mês' : 'meses'} com rateio/pagamento não ${ignoradas === 1 ? 'foi ajustado' : 'foram ajustados'} automaticamente.`
            : '')
      )
      onSuccess()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Reajustar valor</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-arena-navy-800/60">
            Recorrência: <span className="font-bold">{planoLabel}</span>
          </p>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-arena-navy-800/60">Valor atual do plano</span>
              <span className="font-bold text-arena-navy-800">
                {formatCurrency(valorAtual)}/mês
              </span>
            </div>
            {valorMesAtual != null && (
              <div className="flex justify-between mt-1">
                <span className="text-arena-navy-800/60">Cobrança do mês visualizado</span>
                <span className="font-semibold text-arena-navy-800/80">
                  {formatCurrency(valorMesAtual)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              {escopo === 'somente_mes' ? `Valor da cobrança de ${mesAncora}` : 'Novo valor mensal'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-arena-navy-800/40">
                R$
              </span>
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="pl-9 font-bold"
              />
            </div>
            {semMudanca && (
              <p className="text-[11px] text-amber-600">
                O valor informado é igual ao atual.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              Vigência
            </label>
            <div className="grid gap-1.5">
              {(
                [
                  [
                    'somente_mes',
                    `Somente ${mesAncora}`,
                    'Ajuste pontual: muda só a cobrança deste mês. O valor do plano continua o mesmo nos outros meses.',
                  ],
                  [
                    'mes_atual',
                    `De ${mesAncora} em diante`,
                    'Novo valor do plano, já valendo para a cobrança deste mês.',
                  ],
                  [
                    'mes_seguinte',
                    `De ${mesSeguinte} em diante`,
                    `Novo valor do plano. A cobrança de ${mesAncora} fica como está.`,
                  ],
                ] as [Escopo, string, string][]
              ).map(([value, label, ajuda]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEscopo(value)}
                  aria-pressed={escopo === value}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                    escopo === value
                      ? 'border-arena-button bg-arena-button/[0.07]'
                      : 'border-slate-200 hover:border-arena-navy-800/25'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2',
                      escopo === value ? 'border-arena-button' : 'border-slate-300'
                    )}
                  >
                    {escopo === value && (
                      <span className="h-1.5 w-1.5 rounded-full bg-arena-button" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-[13px] font-bold capitalize',
                        escopo === value ? 'text-arena-button' : 'text-arena-navy-800'
                      )}
                    >
                      {label}
                    </span>
                    <span className="block text-[11px] leading-snug text-arena-navy-800/50">
                      {ajuda}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-arena-navy-800/45">
              Meses com rateio ou pagamento já registrado não são alterados.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              Observação
            </label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Ex.: reajuste anual combinado com o responsável"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={saving || invalido}
            className="bg-arena-button hover:bg-arena-button-hover text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Reajustar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
