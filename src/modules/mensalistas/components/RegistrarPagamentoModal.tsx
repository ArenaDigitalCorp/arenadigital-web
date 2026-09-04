'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { registrarPagamentoAction } from '@/modules/mensalistas/actions/mensalistaActions'
import type { CobrancaRow } from '@/modules/mensalistas/types/mensalista.types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  cobranca: CobrancaRow | null
  creditoSaldo: number
  modosPagamento: { id: string; nome: string }[]
  /** Nome do responsável pela recorrência — recebe o crédito quando a parcela é de um avulso. */
  responsavelNome?: string
}

export function RegistrarPagamentoModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  cobranca,
  creditoSaldo,
  modosPagamento,
  responsavelNome,
}: Props) {
  const restante = cobranca
    ? Math.max(
        0,
        Number(cobranca.valor_devido) -
          Number(cobranca.valor_pago) -
          Number(cobranca.credito_aplicado)
      )
    : 0

  const creditoDisponivel = cobranca?.atleta_id
    ? Math.min(creditoSaldo, restante)
    : 0

  const [valor, setValor] = useState('')
  const [credito, setCredito] = useState('')
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [modoId, setModoId] = useState<string>('')
  const [observacao, setObservacao] = useState('')
  const [lancarCredito, setLancarCredito] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && cobranca) {
      setValor(restante.toFixed(2))
      setCredito('')
      setData(format(new Date(), 'yyyy-MM-dd'))
      setModoId('')
      setObservacao('')
      setLancarCredito(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cobranca?.id])

  const valorNum = Number(valor.replace(',', '.')) || 0
  const creditoNum = Number(credito.replace(',', '.')) || 0
  const total = useMemo(() => valorNum + creditoNum, [valorNum, creditoNum])

  // O excedente vem sempre do dinheiro (o crédito aplicado é limitado ao restante).
  const excedente = Math.max(0, Math.round((total - restante) * 100) / 100)
  // O crédito é sempre possível: se a parcela for de um avulso, vai para o responsável.
  const isAvulso = !cobranca?.atleta_id
  const creditoExcede = creditoNum > creditoDisponivel + 0.01

  const handleSave = async () => {
    if (!cobranca) return
    if (total <= 0) {
      toast.error('Informe um valor a pagar.')
      return
    }
    if (creditoExcede) {
      toast.error('Crédito acima do saldo disponível.')
      return
    }
    setSaving(true)
    try {
      const res = await registrarPagamentoAction({
        arenaId,
        cobrancaId: cobranca.id,
        operationId: crypto.randomUUID(),
        valor: Number(valorNum.toFixed(2)),
        creditoAplicado: Number(creditoNum.toFixed(2)),
        data,
        modoPagamentoId: modoId || null,
        observacao: observacao.trim() || null,
        lancarExcedenteCredito: excedente > 0.005 && lancarCredito,
      })
      if (res.success) {
        const d = res.data
        if (d?.creditoExcedenteLancado) {
          toast.success(
            `Pagamento registrado. ${formatCurrency(d.excedente)} lançado como crédito do mensalista.`
          )
        } else if (d && d.excedente > 0.005) {
          toast.success(
            `Pagamento registrado (${formatCurrency(d.excedente)} acima do valor devido).`
          )
        } else {
          toast.success('Pagamento registrado.')
        }
        onSuccess()
        onClose()
      } else {
        toast.error(res.error ?? 'Erro ao registrar pagamento')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>

        {cobranca && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-bold text-arena-navy-800">{cobranca.nome}</p>
              <p className="text-arena-navy-800/60">
                Devido {formatCurrency(cobranca.valor_devido)} · Restante{' '}
                <span className="font-bold text-amber-600">
                  {formatCurrency(restante)}
                </span>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
                Valor (dinheiro)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-arena-navy-800/40 text-sm">
                  R$
                </span>
                <Input
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {creditoDisponivel > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
                  Aplicar crédito (disponível {formatCurrency(creditoDisponivel)})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-arena-navy-800/40 text-sm">
                    R$
                  </span>
                  <Input
                    inputMode="decimal"
                    value={credito}
                    onChange={(e) => setCredito(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
                  Data
                </label>
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
                  Forma
                </label>
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
              <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
                Observação
              </label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
              />
            </div>

            <p className="text-sm text-arena-navy-800/70">
              Total do lançamento:{' '}
              <span className="font-bold text-arena-navy-800">
                {formatCurrency(total)}
              </span>
            </p>

            {excedente > 0.005 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-800">
                  O pagamento excede o valor devido em {formatCurrency(excedente)}.
                </p>
                <label className="flex items-start gap-2.5 text-sm text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lancarCredito}
                    onChange={(e) => setLancarCredito(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-arena-button"
                  />
                  <span>
                    Lançar {formatCurrency(excedente)} como <b>crédito</b> para{' '}
                    {isAvulso
                      ? `o responsável pela reserva${responsavelNome ? ` (${responsavelNome})` : ''}`
                      : cobranca?.nome}
                    . A cobrança fica quitada no valor exato e o excedente vira saldo
                    de crédito.
                  </span>
                </label>
                <p className="text-[11px] text-amber-800/70">
                  O valor total em dinheiro ({formatCurrency(valorNum)}) entra no
                  Financeiro da arena de qualquer forma.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !cobranca}
            className="bg-arena-button hover:bg-arena-button-hover text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
