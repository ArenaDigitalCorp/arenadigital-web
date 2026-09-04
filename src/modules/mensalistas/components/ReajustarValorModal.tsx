'use client'

import { useEffect, useState } from 'react'
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
}

type Escopo = 'mes_atual' | 'mes_seguinte'

export function ReajustarValorModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  planoId,
  planoLabel,
  valorAtual,
  valorMesAtual,
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
        observacao: obs.trim() || null,
      })
      if (!res.success || !res.data) {
        toast.error(res.error ?? 'Erro ao reajustar o valor')
        return
      }
      const d = res.data
      const ignoradas = d.ignoradasRateio + d.ignoradasPagamento
      toast.success(
        `Valor reajustado para ${formatCurrency(d.valorNovo)} a partir de ${d.competenciaVigencia}.` +
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
              Novo valor mensal
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
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {(
                [
                  ['mes_atual', 'Mês atual'],
                  ['mes_seguinte', 'Mês seguinte'],
                ] as [Escopo, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEscopo(value)}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm font-bold transition-colors',
                    escopo === value
                      ? 'bg-white text-arena-button shadow-sm'
                      : 'text-arena-navy-800/50 hover:text-arena-navy-800'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-arena-navy-800/45">
              {escopo === 'mes_atual'
                ? 'A cobrança deste mês passa a ser o novo valor. Meses com rateio ou pagamento já registrado não são alterados.'
                : 'A cobrança deste mês fica como está; o novo valor vale do próximo mês em diante.'}
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
