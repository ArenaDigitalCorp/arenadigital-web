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
import { lancarCreditoAction } from '@/modules/mensalistas/actions/mensalistaActions'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  /** Athletes that can receive credit — responsible + rateio participants. */
  atletas: { id: string; nome: string }[]
  defaultAtletaId: string
}

export function LancarCreditoModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  atletas,
  defaultAtletaId,
}: Props) {
  const [atletaId, setAtletaId] = useState(defaultAtletaId)
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAtletaId(defaultAtletaId)
      setValor('')
      setDescricao('')
    }
  }, [open, defaultAtletaId])

  const valorNum = Number(valor.replace(',', '.')) || 0

  const handleSave = async () => {
    if (valorNum <= 0) {
      toast.error('Informe um valor de crédito maior que zero.')
      return
    }
    setSaving(true)
    try {
      const res = await lancarCreditoAction({
        arenaId,
        atletaId,
        operationId: crypto.randomUUID(),
        valor: Number(valorNum.toFixed(2)),
        descricao: descricao.trim() || null,
      })
      if (res.success) {
        toast.success('Crédito lançado.')
        onSuccess()
        onClose()
      } else {
        toast.error(res.error ?? 'Erro ao lançar crédito')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Lançar crédito</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              Atleta
            </label>
            <Select value={atletaId} onValueChange={setAtletaId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {atletas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              Valor
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
              placeholder="Ex.: crédito por sessão não utilizada"
            />
          </div>

          <p className="text-[11px] text-arena-navy-800/40">
            O crédito fica disponível para abater de mensalidades futuras deste
            atleta nesta arena.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
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
