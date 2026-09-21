'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, isSameMonth, parseISO } from 'date-fns'
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
import {
  pausarPlanoMensalistaAction,
  removerPausaMensalistaAction,
} from '@/modules/mensalistas/actions/mensalistaActions'
import type { PausaRow } from '@/modules/mensalistas/types/mensalista.types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  planoId: string
  planoLabel: string
  /** Pausa ativa (futura ou em andamento) desta recorrência, se houver. */
  pausaAtiva: PausaRow | null
}

type CobrancaModo = 'integral' | 'proporcional' | 'nenhuma'
type BookingsAcao = 'liberar' | 'manter'

function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function PausarPlanoModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  planoId,
  planoLabel,
  pausaAtiva,
}: Props) {
  const podeEditar = !!pausaAtiva && pausaAtiva.pausa_inicio > todayISO()

  const [pausaInicio, setPausaInicio] = useState('')
  const [pausaFim, setPausaFim] = useState('')
  const [cobrancaModo, setCobrancaModo] = useState<CobrancaModo>('integral')
  const [bookingsAcao, setBookingsAcao] = useState<BookingsAcao>('liberar')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (open) {
      if (podeEditar && pausaAtiva) {
        setPausaInicio(pausaAtiva.pausa_inicio)
        setPausaFim(pausaAtiva.pausa_fim)
        setCobrancaModo(pausaAtiva.cobranca_modo)
        setBookingsAcao(pausaAtiva.bookings_acao)
        setObs(pausaAtiva.observacao ?? '')
      } else {
        setPausaInicio('')
        setPausaFim('')
        setCobrancaModo('integral')
        setBookingsAcao('liberar')
        setObs('')
      }
    }
  }, [open, podeEditar, pausaAtiva])

  const mesesTexto = useMemo(() => {
    if (!pausaInicio || !pausaFim) return null
    try {
      const inicio = parseISO(pausaInicio)
      const fim = parseISO(pausaFim)
      const nomeInicio = format(inicio, "MMMM 'de' yyyy", { locale: ptBR })
      if (isSameMonth(inicio, fim)) return nomeInicio
      const nomeFim = format(fim, "MMMM 'de' yyyy", { locale: ptBR })
      return `${nomeInicio} a ${nomeFim}`
    } catch {
      return null
    }
  }, [pausaInicio, pausaFim])

  const invalido =
    !pausaInicio || !pausaFim || pausaFim < pausaInicio || pausaInicio < todayISO()

  const submit = async () => {
    if (invalido) {
      toast.error('Informe um período de pausa válido, a partir de hoje')
      return
    }
    setSaving(true)
    try {
      const res = await pausarPlanoMensalistaAction({
        arenaId,
        planoId,
        operationId: crypto.randomUUID(),
        pausaInicio,
        pausaFim,
        cobrancaModo,
        bookingsAcao,
        observacao: obs.trim() || null,
      })
      if (!res.success || !res.data) {
        toast.error(res.error ?? 'Erro ao pausar o plano')
        return
      }
      const d = res.data
      toast.success(
        `Plano pausado de ${format(parseISO(d.pausaInicio), 'dd/MM')} a ${format(parseISO(d.pausaFim), 'dd/MM')}.` +
          (d.bookingsLiberados > 0
            ? ` ${d.bookingsLiberados} reserva(s) liberada(s).`
            : '')
      )
      onSuccess()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const remover = async () => {
    if (!pausaAtiva) return
    setRemoving(true)
    try {
      const res = await removerPausaMensalistaAction({
        arenaId,
        planoId,
        pausaId: pausaAtiva.id,
      })
      if (!res.success) {
        toast.error(res.error ?? 'Erro ao remover a pausa')
        return
      }
      toast.success('Pausa removida.')
      onSuccess()
      onClose()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{podeEditar ? 'Editar pausa' : 'Pausar plano'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-arena-navy-800/60">
            Recorrência: <span className="font-bold">{planoLabel}</span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
                Início
              </label>
              <Input
                type="date"
                min={todayISO()}
                value={pausaInicio}
                onChange={(e) => setPausaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
                Fim
              </label>
              <Input
                type="date"
                min={pausaInicio || todayISO()}
                value={pausaFim}
                onChange={(e) => setPausaFim(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              Cobrança {mesesTexto ? `de ${mesesTexto}` : 'do período'}
            </label>
            <div className="grid gap-1.5">
              {(
                [
                  [
                    'integral',
                    'Cobrar integralmente',
                    'O mensalista paga o mês normalmente, mesmo sem usar o horário.',
                  ],
                  [
                    'proporcional',
                    'Cobrar valor proporcional',
                    'Desconta as sessões dentro do período de pausa.',
                  ],
                  [
                    'nenhuma',
                    'Não cobrar nada',
                    'Zera a cobrança do(s) mês(es) tocados pela pausa.',
                  ],
                ] as [CobrancaModo, string, string][]
              ).map(([value, label, ajuda]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCobrancaModo(value)}
                  aria-pressed={cobrancaModo === value}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                    cobrancaModo === value
                      ? 'border-arena-button bg-arena-button/[0.07]'
                      : 'border-slate-200 hover:border-arena-navy-800/25'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2',
                      cobrancaModo === value ? 'border-arena-button' : 'border-slate-300'
                    )}
                  >
                    {cobrancaModo === value && (
                      <span className="h-1.5 w-1.5 rounded-full bg-arena-button" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-[13px] font-bold',
                        cobrancaModo === value ? 'text-arena-button' : 'text-arena-navy-800'
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
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-arena-navy-800/60 uppercase">
              Reservas já marcadas no período
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['liberar', 'Liberar horário'],
                  ['manter', 'Manter reservas'],
                ] as [BookingsAcao, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBookingsAcao(value)}
                  aria-pressed={bookingsAcao === value}
                  className={cn(
                    'rounded-xl border p-2.5 text-center text-[13px] font-bold transition-colors',
                    bookingsAcao === value
                      ? 'border-arena-button bg-arena-button/[0.07] text-arena-button'
                      : 'border-slate-200 text-arena-navy-800 hover:border-arena-navy-800/25'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-arena-navy-800/45">
              {bookingsAcao === 'liberar'
                ? 'As reservas do mensalista dentro do período ficam livres para outras reservas.'
                : 'As reservas já marcadas continuam do jeito que estão.'}
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
              placeholder="Ex.: viagem combinada com o responsável"
            />
          </div>

          <p className="text-[11px] text-arena-navy-800/40">
            Nenhuma reserva nova nasce dentro do período pausado — a agenda volta ao
            normal automaticamente depois do fim.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          {podeEditar ? (
            <Button
              variant="ghost"
              onClick={remover}
              disabled={saving || removing}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              {removing && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Remover pausa
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving || removing}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={saving || removing || invalido}
              className="bg-arena-button hover:bg-arena-button-hover text-white"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {podeEditar ? 'Salvar' : 'Pausar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
