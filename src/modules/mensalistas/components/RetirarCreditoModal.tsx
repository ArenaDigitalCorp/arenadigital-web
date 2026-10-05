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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { retirarCreditoAction } from '@/modules/mensalistas/actions/mensalistaActions'
import type { SubcontaCredito } from '@/modules/mensalistas/credito-recorrencia'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  atletaId: string
  atletaNome: string
  saldo: number
  /** Subcontas com saldo (geral primeiro). A retirada sai de uma delas e não passa do saldo dela. */
  subcontas: SubcontaCredito[]
}

/** Radix Select não aceita `value=""` nem `null` — este é o da subconta geral. */
const GERAL = 'geral'
const chaveDa = (s: SubcontaCredito) => s.planoId ?? GERAL

export function RetirarCreditoModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  atletaId,
  atletaNome,
  saldo,
  subcontas,
}: Props) {
  const [subcontaChave, setSubcontaChave] = useState(GERAL)
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      // Começa pela geral quando ela tem saldo (é o crédito "solto"); senão pela primeira.
      setSubcontaChave(subcontas[0] ? chaveDa(subcontas[0]) : GERAL)
      setValor('')
      setDescricao('')
    }
  }, [open, subcontas])

  const subconta = subcontas.find((s) => chaveDa(s) === subcontaChave) ?? null
  const disponivel = subconta?.saldo ?? 0
  const valorNum = Number(valor.replace(',', '.')) || 0
  const excede = valorNum > disponivel + 0.01
  const restanteAposRetirada = Math.max(0, disponivel - valorNum)

  const handleSave = async () => {
    if (valorNum <= 0) {
      toast.error('Informe um valor de retirada maior que zero.')
      return
    }
    if (!subconta) {
      toast.error('Escolha de qual crédito sai a retirada.')
      return
    }
    if (excede) {
      toast.error('A retirada não pode ultrapassar o saldo deste crédito.')
      return
    }
    setSaving(true)
    try {
      const res = await retirarCreditoAction({
        arenaId,
        atletaId,
        operationId: crypto.randomUUID(),
        valor: Number(valorNum.toFixed(2)),
        descricao: descricao.trim() || null,
        planoId: subconta.planoId,
      })
      if (res.success) {
        toast.success('Retirada de crédito registrada.')
        onSuccess()
        onClose()
      } else {
        toast.error(res.error ?? 'Erro ao retirar crédito')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Retirar crédito</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-bold text-arena-navy-800">{atletaNome}</p>
            <p className="text-arena-navy-800/60">
              Saldo de crédito:{' '}
              <span className="font-bold text-sky-600">{formatCurrency(saldo)}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              Retirar de
            </label>
            {subcontas.length > 1 ? (
              <Select value={subcontaChave} onValueChange={setSubcontaChave}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subcontas.map((s) => (
                    <SelectItem key={chaveDa(s)} value={chaveDa(s)}>
                      {s.label} — {formatCurrency(s.saldo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="rounded-md border border-input px-3 py-2 text-sm text-arena-navy-800">
                {subconta ? `${subconta.label} — ${formatCurrency(subconta.saldo)}` : 'Sem crédito disponível'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              Valor da retirada (máx. {formatCurrency(disponivel)})
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
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              Observação
            </label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Ex.: devolução parcial em dinheiro"
            />
          </div>

          <p className="text-sm text-arena-navy-800/70">
            {subconta?.planoId ? 'Saldo desta recorrência após a retirada' : 'Saldo geral após a retirada'}:{' '}
            <span
              className={
                excede ? 'font-bold text-red-600' : 'font-bold text-arena-navy-800'
              }
            >
              {excede ? 'excede o saldo' : formatCurrency(restanteAposRetirada)}
            </span>
          </p>
          <p className="text-[11px] text-arena-navy-800/40">
            A retirada sai só do crédito escolhido e fica registrada no histórico
            com ele. Pode ser feita em várias parcelas até zerar esse crédito. Não
            gera lançamento no caixa.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !subconta || valorNum <= 0 || excede}
            className="bg-arena-button hover:bg-arena-button-hover text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Confirmar retirada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
