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
  /**
   * Recorrências ativas a que o crédito pode ser vinculado (opcional), com os
   * atletas que participam de cada uma — o seletor só oferece as do atleta
   * escolhido, a mesma regra que o RPC valida.
   */
  recorrencias: { id: string; label: string; atletaIds: string[] }[]
}

/** Radix Select não aceita `value=""` — este é o "sem vínculo". */
const SEM_VINCULO = 'sem-vinculo'

export function LancarCreditoModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  atletas,
  defaultAtletaId,
  recorrencias,
}: Props) {
  const [atletaId, setAtletaId] = useState(defaultAtletaId)
  const [planoId, setPlanoId] = useState(SEM_VINCULO)
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAtletaId(defaultAtletaId)
      setPlanoId(SEM_VINCULO)
      setValor('')
      setDescricao('')
    }
  }, [open, defaultAtletaId])

  const valorNum = Number(valor.replace(',', '.')) || 0
  const recorrenciasDoAtleta = recorrencias.filter((r) => r.atletaIds.includes(atletaId))
  const vinculada = planoId !== SEM_VINCULO

  const handleAtletaChange = (id: string) => {
    setAtletaId(id)
    // Trocar de atleta pode tirar a recorrência escolhida das opções.
    if (!recorrencias.some((r) => r.id === planoId && r.atletaIds.includes(id))) {
      setPlanoId(SEM_VINCULO)
    }
  }

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
        planoId: vinculada ? planoId : null,
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
            <Select value={atletaId} onValueChange={handleAtletaChange}>
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

          {recorrenciasDoAtleta.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
                Recorrência{' '}
                <span className="font-medium normal-case text-arena-navy-800/40">
                  (opcional)
                </span>
              </label>
              <Select value={planoId} onValueChange={setPlanoId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_VINCULO}>Geral (sem vínculo)</SelectItem>
                  {recorrenciasDoAtleta.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            {vinculada
              ? 'O crédito fica separado para esta recorrência: no pagamento da mensalidade dela, é usado antes do crédito geral, e só pode ser retirado daqui. Aparece identificado no extrato e nos relatórios.'
              : 'O crédito vai para o saldo geral do atleta e abate mensalidades futuras dele nesta arena.'}
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
