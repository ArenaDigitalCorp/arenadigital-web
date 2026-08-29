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
import { formatCurrency } from '@/lib/format'
import { retirarCreditoAction } from '@/modules/mensalistas/actions/mensalistaActions'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  atletaId: string
  atletaNome: string
  saldo: number
}

export function RetirarCreditoModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  atletaId,
  atletaNome,
  saldo,
}: Props) {
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setValor('')
      setDescricao('')
    }
  }, [open])

  const valorNum = Number(valor.replace(',', '.')) || 0
  const excede = valorNum > saldo + 0.01
  const restanteAposRetirada = Math.max(0, saldo - valorNum)

  const handleSave = async () => {
    if (valorNum <= 0) {
      toast.error('Informe um valor de retirada maior que zero.')
      return
    }
    if (excede) {
      toast.error('A retirada não pode ultrapassar o saldo de crédito.')
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
              Valor da retirada (máx. {formatCurrency(saldo)})
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
            Saldo após a retirada:{' '}
            <span
              className={
                excede ? 'font-bold text-red-600' : 'font-bold text-arena-navy-800'
              }
            >
              {excede ? 'excede o saldo' : formatCurrency(restanteAposRetirada)}
            </span>
          </p>
          <p className="text-[11px] text-arena-navy-800/40">
            A retirada é registrada no histórico de créditos e pode ser feita em
            várias parcelas até zerar o saldo. Não gera lançamento no caixa.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || valorNum <= 0 || excede}
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
