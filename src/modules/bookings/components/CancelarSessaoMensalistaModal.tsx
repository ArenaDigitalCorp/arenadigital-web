'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarX2, Loader2 } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  descricaoCreditoJogoCancelado,
  diaCurto,
  diaExtenso,
  faixaHoraria,
} from '@/modules/bookings/lib/cancelamento-sessao'
import {
  cancelarSessaoMensalistaAction,
  quoteSessaoMensalistaAction,
  type SessaoMensalistaQuote,
} from '@/modules/bookings/actions/mensalistaActions'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  bookingId: string
  /** Início e fim da sessão, para o gestor conferir o dia que está cancelando. */
  startTime: string
  endTime: string
  responsavelNome: string
  espacoNome: string
}

const brl = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

/**
 * Cancela **um** jogo da recorrência — nunca a recorrência inteira nem a
 * mensalidade. O mês continua devido; o crédito (opcional) é a compensação para
 * o mensalista que avisou com antecedência e vai remarcar.
 */
export function CancelarSessaoMensalistaModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  bookingId,
  startTime,
  endTime,
  responsavelNome,
  espacoNome,
}: Props) {
  const [lancarCredito, setLancarCredito] = useState(true)
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [quote, setQuote] = useState<SessaoMensalistaQuote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLancarCredito(true)
    setValor('')
    setDescricao(descricaoCreditoJogoCancelado(startTime))
    setQuote(null)
    setLoadingQuote(true)

    let cancelled = false
    void quoteSessaoMensalistaAction(arenaId, bookingId).then((res) => {
      if (cancelled) return
      setLoadingQuote(false)
      if (!res.success || !res.data) {
        toast.error(res.error ?? 'Não foi possível calcular o valor da sessão.')
        return
      }
      setQuote(res.data)
      setValor(res.data.valorSugerido.toFixed(2))
    })
    return () => {
      cancelled = true
    }
  }, [open, arenaId, bookingId, startTime])

  const valorNum = Number(valor.replace(',', '.')) || 0
  const dia = diaExtenso(startTime)
  const horario = faixaHoraria(startTime, endTime)

  const handleConfirm = async () => {
    if (lancarCredito && valorNum <= 0) {
      toast.error('Informe um valor de crédito maior que zero.')
      return
    }
    setSaving(true)
    try {
      const res = await cancelarSessaoMensalistaAction({
        arenaId,
        bookingId,
        // Chave de idempotência: vira o id da linha de crédito, então um duplo
        // clique não credita duas vezes.
        operationId: crypto.randomUUID(),
        lancarCredito,
        valorCredito: lancarCredito ? valorNum : 0,
        descricao: lancarCredito ? descricao.trim() : '',
      })
      if (!res.success) throw new Error(res.error)

      toast.success(
        lancarCredito
          ? `Jogo do dia ${diaCurto(startTime)} cancelado e ${brl(
              res.data?.valorCredito ?? valorNum
            )} de crédito lançado.`
          : `Jogo do dia ${diaCurto(startTime)} cancelado.`
      )
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar a sessão.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-arena-navy-800">
            <CalendarX2 className="h-5 w-5 text-red-500" />
            Cancelar este dia
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* O que exatamente vai ser cancelado */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="flex items-start gap-2 text-[13px] leading-snug text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>
                Você vai cancelar <strong>somente este jogo</strong>. A recorrência do
                mensalista continua ativa e a mensalidade do mês <strong>não</strong> é
                alterada.
              </span>
            </p>
          </div>

          <dl className="grid gap-2 rounded-xl border border-arena-navy-800/10 bg-muted/30 p-3.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Dia</dt>
              <dd className="text-right font-semibold capitalize text-arena-navy-800">
                {dia}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Horário</dt>
              <dd className="text-right font-semibold tabular-nums text-arena-navy-800">
                {horario}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Mensalista</dt>
              <dd className="text-right font-semibold text-arena-navy-800">
                {quote?.atletaNome ?? responsavelNome}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Espaço</dt>
              <dd className="text-right font-semibold text-arena-navy-800">{espacoNome}</dd>
            </div>
          </dl>

          {/* Crédito */}
          <div className="space-y-3 rounded-xl border border-arena-navy-800/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="lancar-credito"
                checked={lancarCredito}
                onCheckedChange={(checked) => setLancarCredito(checked === true)}
                className="mt-0.5 data-[state=checked]:border-arena-button data-[state=checked]:bg-arena-button"
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor="lancar-credito"
                  className="cursor-pointer select-none text-sm font-semibold text-arena-navy-800"
                >
                  Lançar crédito para o mensalista
                </Label>
                <p className="text-[11.5px] leading-snug text-muted-foreground">
                  Use quando ele avisou com antecedência e vai remarcar o jogo ou abater o
                  valor numa próxima mensalidade. O crédito fica na conta dele em
                  Mensalistas.
                </p>
              </div>
            </div>

            {lancarCredito && (
              <div className="space-y-3 border-t border-arena-navy-800/5 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Valor do crédito
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      R$
                    </span>
                    <Input
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      inputMode="decimal"
                      disabled={loadingQuote}
                      className="pl-9 font-semibold tabular-nums"
                      placeholder={loadingQuote ? 'Calculando…' : '0,00'}
                    />
                  </div>
                  {loadingQuote ? (
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Buscando o valor da hora na tabela de preço do plano…
                    </p>
                  ) : quote ? (
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Valor da hora reservada
                      {quote.tabelaNome ? (
                        <>
                          {' '}
                          pela tabela <strong>{quote.tabelaNome}</strong>
                        </>
                      ) : null}
                      : <strong>{brl(quote.valorSugerido)}</strong>.
                      {quote.origem === 'padrao' && (
                        <>
                          {' '}
                          O plano não tem tabela de mensalista definida, então veio da
                          tabela padrão do espaço — confira antes de confirmar.
                        </>
                      )}{' '}
                      Você pode ajustar o valor.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Descrição do crédito
                  </Label>
                  <Textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    É o que aparece no extrato de créditos do mensalista.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Voltar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={saving || (lancarCredito && loadingQuote)}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelando…
              </>
            ) : lancarCredito ? (
              'Cancelar este dia e lançar crédito'
            ) : (
              'Cancelar este dia'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
