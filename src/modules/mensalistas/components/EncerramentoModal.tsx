'use client'

import { useEffect, useMemo, useState } from 'react'
import { addMonths, format, startOfMonth } from 'date-fns'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { setEncerramentoAction } from '@/modules/mensalistas/actions/mensalistaActions'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  planoId: string
  planoLabel: string
  currentDataPrevista: string | null
  currentObs: string | null
}

export function EncerramentoModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  planoId,
  planoLabel,
  currentDataPrevista,
  currentObs,
}: Props) {
  const monthOptions = useMemo(() => {
    const base = startOfMonth(new Date())
    return Array.from({ length: 13 }, (_, i) => {
      const d = addMonths(base, i + 1)
      return {
        value: format(d, 'yyyy-MM-dd'),
        label: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
      }
    })
  }, [])

  const [mes, setMes] = useState<string>(currentDataPrevista ?? '')
  const [obs, setObs] = useState(currentObs ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setMes(currentDataPrevista ?? '')
      setObs(currentObs ?? '')
    }
  }, [open, currentDataPrevista, currentObs])

  const submit = async (clear: boolean) => {
    setSaving(true)
    try {
      const res = await setEncerramentoAction({
        arenaId,
        planoId,
        dataPrevista: clear ? null : mes || null,
        observacao: clear ? null : obs.trim() || null,
      })
      if (res.success) {
        toast.success(
          clear ? 'Previsão de encerramento removida.' : 'Encerramento registrado.'
        )
        onSuccess()
        onClose()
      } else {
        toast.error(res.error ?? 'Erro ao registrar encerramento')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Registrar encerramento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-arena-navy-800/60">
            Recorrência: <span className="font-bold">{planoLabel}</span>
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              Encerra a partir de
            </label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              Observação
            </label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Ex.: combinado com o responsável em 20/08"
            />
          </div>

          <p className="text-[11px] text-arena-navy-800/40">
            As reservas ainda não confirmadas a partir do mês escolhido serão
            canceladas, liberando o horário para revenda. O encerramento
            definitivo continua sendo feito ao cancelar o plano.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          {currentDataPrevista ? (
            <Button
              variant="ghost"
              onClick={() => submit(true)}
              disabled={saving}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              Remover previsão
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={() => submit(false)}
              disabled={saving || !mes}
              className="bg-arena-button hover:bg-arena-button-hover text-white"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
