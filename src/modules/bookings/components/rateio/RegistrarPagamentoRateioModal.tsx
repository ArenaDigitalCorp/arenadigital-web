'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import {
  registrarPagamentoRateioAction,
  type RateioSnapshot,
} from '@/modules/bookings/actions/bookingRateioActions'
import { restanteCobranca, type BookingCobranca } from '@/modules/bookings/lib/booking-rateio'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (snapshot: RateioSnapshot) => void
  arenaId: string
  cobranca: BookingCobranca | null
  modosPagamento: { id: string; nome: string }[]
}

export function RegistrarPagamentoRateioModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  cobranca,
  modosPagamento,
}: Props) {
  const restante = cobranca ? restanteCobranca(cobranca) : 0
  const [valor, setValor] = useState('')
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [modoId, setModoId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [saving, setSaving] = useState(false)
  // Uma chave por abertura: um duplo clique ou retry não lança o pagamento duas vezes.
  const operationId = useRef<string | null>(null)

  useEffect(() => {
    if (open && cobranca) {
      setValor(restante.toFixed(2))
      setData(format(new Date(), 'yyyy-MM-dd'))
      setModoId('')
      setObservacao('')
      operationId.current = crypto.randomUUID()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cobranca?.id])

  const valorNum = Number(valor.replace(',', '.')) || 0
  const excede = valorNum > restante + 0.005

  const handleSave = async () => {
    if (!cobranca || !operationId.current) return
    if (valorNum <= 0) {
      toast.error('Informe um valor a pagar.')
      return
    }
    if (excede) {
      toast.error(`O valor excede o que falta pagar (${formatCurrency(restante)}).`)
      return
    }
    setSaving(true)
    try {
      const res = await registrarPagamentoRateioAction({
        arenaId,
        cobrancaId: cobranca.id,
        operationId: operationId.current,
        valor: Number(valorNum.toFixed(2)),
        data,
        modoPagamentoId: modoId || null,
        observacao: observacao.trim() || null,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      const quitou = valorNum + 0.005 >= restante
      toast.success(
        res.data.bookingStatus === 'confirmed'
          ? 'Pagamento registrado. Todos pagaram: reserva confirmada!'
          : quitou
            ? `Pagamento registrado. ${cobranca.nome} quitou a parte.`
            : `Pagamento parcial registrado para ${cobranca.nome}.`
      )
      onSuccess(res.data)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>

        {cobranca && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-bold text-arena-navy-800">{cobranca.nome}</p>
              <p className="text-arena-navy-800/60">
                Parte {formatCurrency(cobranca.valor_devido)}
                {cobranca.valor_pago > 0 && <> · pago {formatCurrency(cobranca.valor_pago)}</>}
                {' · '}falta{' '}
                <span className="font-bold text-amber-600">{formatCurrency(restante)}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-arena-navy-800/60">Valor</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-arena-navy-800/40">
                  R$
                </span>
                <Input
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="pl-9"
                  aria-invalid={excede}
                />
              </div>
              <p className="text-[11px] text-arena-navy-800/45">
                Pode ser parcial: o restante continua em aberto para esta pessoa.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-arena-navy-800/60">Data</label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-arena-navy-800/60">Forma</label>
                <Select value={modoId} onValueChange={setModoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {modosPagamento.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-arena-navy-800/60">Observação</label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !cobranca || excede}
            className="bg-emerald-500 text-white hover:bg-emerald-600"
          >
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
