'use client'

import { formatDecimalInput, parseBrazilianDecimal } from '@/lib/format'
import { DecimalInput } from '@/components/ui/decimal-input'
import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AlertTriangle, CalendarX2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  blocosDeHora,
  descricaoCreditoHorariosCancelados,
  descricaoCreditoJogoCancelado,
  diaCurto,
  diaExtenso,
  faixaHoraria,
  listarFaixasHorarias,
  selecaoDeCancelamento,
  type BlocoHorario,
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

const hora = (iso: string) => format(parseISO(iso), 'HH:mm')

/**
 * Cancela **um** jogo da recorrência — inteiro ou só parte dele (ex.: a 1ª
 * hora, que fica livre para outra reserva) — nunca a recorrência nem a
 * mensalidade. O mês continua devido; o crédito (opcional) é a compensação para
 * o mensalista que avisou com antecedência e vai remarcar.
 *
 * O pai remonta o modal a cada abertura (`key`), então o estado nasce limpo.
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
  const blocos = useMemo(() => blocosDeHora(startTime, endTime), [startTime, endTime])
  // Por padrão, o jogo inteiro — o gestor desmarca o que continua valendo.
  const [selecionados, setSelecionados] = useState<number[]>(() => blocos.map((_, i) => i))
  const [lancarCredito, setLancarCredito] = useState(true)
  const [ajustes, setAjustes] = useState<Record<string, { valor?: string; descricao?: string }>>({})
  const [quote, setQuote] = useState<{ intervalos: BlocoHorario[]; data: SessaoMensalistaQuote | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const operacoes = useRef(new Map<string, string>())
  const enviando = useRef(false)

  const { intervalos, sessaoInteira } = useMemo(
    () => selecaoDeCancelamento(blocos, selecionados),
    [blocos, selecionados]
  )
  const temSelecao = intervalos.length > 0
  const parcial = temSelecao && !sessaoInteira
  const plural = intervalos.length > 1

  useEffect(() => {
    if (!open || !lancarCredito || !intervalos.length) return
    let ativa = true
    async function cotar() {
      try {
        const res = await quoteSessaoMensalistaAction(arenaId, bookingId, intervalos)
        if (!ativa) return
        if (!res.success || !res.data) throw new Error(res.error ?? 'Não foi possível calcular o valor da sessão.')
        setQuote({ intervalos, data: res.data })
      } catch (err) {
        if (!ativa) return
        setQuote({ intervalos, data: null })
        toast.error(err instanceof Error ? err.message : 'Não foi possível calcular o valor da sessão.')
      }
    }
    void cotar()
    return () => { ativa = false }
  }, [open, lancarCredito, arenaId, bookingId, intervalos])

  const loadingQuote = lancarCredito && temSelecao && quote?.intervalos !== intervalos
  const quoteAtual = quote?.intervalos === intervalos ? quote.data : null
  const creditoManual = plural && quoteAtual?.precoFixo === true
  const horariosCancelados = listarFaixasHorarias(intervalos)
  const descricaoDoDia = descricaoCreditoJogoCancelado(startTime)
  const trechos = intervalos.map(({ inicio, fim }) => {
    const key = `${inicio}/${fim}`
    const chaveValor = creditoManual ? `manual/${key}` : key
    const sugestao = quoteAtual?.valoresPorTrecho.find(trecho => trecho.inicio === inicio && trecho.fim === fim)
    const valor = ajustes[chaveValor]?.valor ?? (sugestao ? formatDecimalInput(sugestao.valor) : '')
    const descricao = ajustes[key]?.descricao ?? (sessaoInteira
      ? descricaoDoDia
      : descricaoCreditoHorariosCancelados(startTime, [{ inicio, fim }]))
    const horas = quoteAtual?.valoresPorHorario.filter(hora => hora.inicio >= inicio && hora.fim <= fim) ?? []
    return { key, chaveValor, inicio, fim, valor, valorNum: parseBrazilianDecimal(valor), descricao, horas }
  })
  const total = trechos.reduce((centavos, trecho) => centavos + Math.round((trecho.valorNum ?? 0) * 100), 0) / 100
  const valoresValidos = trechos.every(trecho => trecho.valorNum !== null && trecho.valorNum >= 0)
  const dia = diaExtenso(startTime)
  const horario = faixaHoraria(startTime, endTime)

  const toggleBloco = (i: number) => {
    setSelecionados(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  const ajustar = (key: string, campo: 'valor' | 'descricao', texto: string) =>
    setAjustes(prev => ({ ...prev, [key]: { ...prev[key], [campo]: texto } }))

  const handleConfirm = async () => {
    if (enviando.current || !temSelecao || loadingQuote) return
    if (lancarCredito && !valoresValidos) {
      toast.error('Informe um valor válido para cada horário selecionado.')
      return
    }
    if (lancarCredito && total <= 0) {
      toast.error('Informe um valor de crédito maior que zero.')
      return
    }
    const descricao = plural ? descricaoCreditoHorariosCancelados(startTime, intervalos) : trechos[0].descricao
    const payload = {
      arenaId, bookingId, lancarCredito,
      intervalos: trechos.map(trecho => ({
        inicio: trecho.inicio, fim: trecho.fim,
        valorCredito: lancarCredito ? trecho.valorNum ?? 0 : 0,
        descricao: lancarCredito ? trecho.descricao.trim() : '',
      })),
      valorCredito: lancarCredito ? total : 0,
      descricao: lancarCredito ? descricao.trim() : '',
    }
    const key = JSON.stringify(payload)
    // Uma resposta perdida pode chegar depois de o gestor rever outra seleção.
    const operationId = operacoes.current.get(key) ?? crypto.randomUUID()
    operacoes.current.set(key, operationId)
    enviando.current = true
    setSaving(true)
    try {
      const res = await cancelarSessaoMensalistaAction({ ...payload, operationId })
      if (!res.success) throw new Error(res.error)

      const oQue = parcial
        ? `${plural ? 'Horários' : 'Horário'} ${horariosCancelados} do dia ${diaCurto(startTime)} ${plural ? 'cancelados' : 'cancelado'}`
        : `Jogo do dia ${diaCurto(startTime)} cancelado`
      toast.success(
        lancarCredito
          ? `${oQue} e ${brl(res.data?.valorCredito ?? total)} de crédito lançado.`
          : `${oQue}.`
      )
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar a sessão.')
    } finally {
      enviando.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-arena-navy-800">
            <CalendarX2 className="h-5 w-5 text-red-500" />
            Cancelar dia ou horário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* O que exatamente vai ser cancelado */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="flex items-start gap-2 text-[13px] leading-snug text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              {!temSelecao ? (
                <span>Selecione os horários que deseja liberar para outras reservas.</span>
              ) : parcial ? (
                <span>
                  Você vai cancelar <strong>{horariosCancelados}</strong> deste jogo. O restante
                  continua reservado. A
                  recorrência do mensalista continua ativa e a mensalidade do mês{' '}
                  <strong>não</strong> é alterada.
                </span>
              ) : (
                <span>
                  Você vai cancelar <strong>somente este jogo</strong>. A recorrência do
                  mensalista continua ativa e a mensalidade do mês <strong>não</strong> é
                  alterada.
                </span>
              )}
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
                {quoteAtual?.atletaNome ?? responsavelNome}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Espaço</dt>
              <dd className="text-right font-semibold text-arena-navy-800">{espacoNome}</dd>
            </div>
          </dl>

          {/* Quais horários cancelar (só faz sentido com mais de 1h) */}
          {blocos.length > 1 && (
            <div className="space-y-2 rounded-xl border border-arena-navy-800/10 p-3.5">
              <p className="text-sm font-semibold text-arena-navy-800">O que cancelar</p>
              <p className="text-[11.5px] leading-snug text-muted-foreground">
                Desmarque os horários que ele ainda vai jogar. O que for cancelado fica livre
                para outra reserva.
              </p>
              <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Horários a cancelar">
                {blocos.map((b, i) => {
                  const marcado = selecionados.includes(i)
                  return (
                    <button
                      key={b.inicio}
                      type="button"
                      aria-pressed={marcado}
                      disabled={saving}
                      onClick={() => toggleBloco(i)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors',
                        marcado
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-arena-navy-800/15 bg-white text-arena-navy-800/60 hover:bg-slate-50'
                      )}
                    >
                      {hora(b.inicio)}–{hora(b.fim)}
                    </button>
                  )
                })}
              </div>
              {!temSelecao ? (
                <p className="text-[11.5px] font-medium text-red-600">Marque ao menos um horário para cancelar.</p>
              ) : (
                <p className="text-[11.5px] text-muted-foreground">
                  {parcial ? (
                    <>
                      {plural ? 'Horários a liberar' : 'Horário a liberar'}: <strong>{horariosCancelados}</strong>.
                    </>
                  ) : (
                    <>Todos os horários marcados: cancela o jogo inteiro.</>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Crédito */}
          <div className="space-y-3 rounded-xl border border-arena-navy-800/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="lancar-credito"
                checked={lancarCredito}
                disabled={saving}
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

            {lancarCredito && temSelecao && (
              <div className="space-y-3 border-t border-arena-navy-800/5 pt-3">
                {loadingQuote ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground" role="status">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Calculando o crédito dos horários selecionados…
                  </p>
                ) : quoteAtual ? (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {creditoManual ? (
                      <>
                        {quoteAtual.valorFixoReserva !== null && (
                          <>Preço fixo da reserva: <strong>{brl(quoteAtual.valorFixoReserva)}</strong>.{' '}</>
                        )}
                        {quoteAtual.tabelaNome && <>Tabela <strong>{quoteAtual.tabelaNome}</strong>.{' '}</>}
                        Informe o crédito de cada faixa. Use zero para apenas liberar um horário.
                      </>
                    ) : (
                      <>
                        Sugestão {quoteAtual.tabelaNome ? <>pela tabela <strong>{quoteAtual.tabelaNome}</strong></> : 'da tabela de preço'}
                        {quoteAtual.valorSugerido !== null && <> de <strong>{brl(quoteAtual.valorSugerido)}</strong></>}.
                        {quoteAtual.precoFixo && <> Este espaço cobra preço fixo por reserva.</>}
                        {' '}Você pode ajustar o valor.
                      </>
                    )}
                    {quoteAtual.origem === 'padrao' && (
                      <> Confira o valor pela tabela padrão do espaço.</>
                    )}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Cotação indisponível. Informe o valor para lançar o crédito.
                  </p>
                )}
                {trechos.map((trecho, i) => (
                  <fieldset key={trecho.key} className={cn('space-y-2.5', plural && 'rounded-lg border px-3 pb-3')}>
                    {plural && (
                      <legend className="px-1 text-xs font-semibold text-arena-navy-800">
                        {faixaHoraria(trecho.inicio, trecho.fim)}
                      </legend>
                    )}
                    {trecho.horas.length > 1 && (
                      <dl aria-label="Crédito sugerido por horário" className="space-y-1 text-xs text-muted-foreground">
                        {trecho.horas.map(h => (
                          <div key={h.inicio} className="flex justify-between gap-3">
                            <dt>{faixaHoraria(h.inicio, h.fim)}</dt>
                            <dd className="tabular-nums">{brl(h.valor)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor={`credito-valor-${i}`} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Valor do crédito
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                        <DecimalInput
                          id={`credito-valor-${i}`}
                          value={loadingQuote ? '' : trecho.valor}
                          onChange={e => ajustar(trecho.chaveValor, 'valor', e.target.value)}
                          inputMode="decimal"
                          disabled={saving || loadingQuote}
                          className="pl-9 font-semibold tabular-nums"
                          placeholder={loadingQuote ? 'Calculando…' : creditoManual ? 'Informe o valor' : '0,00'}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`credito-descricao-${i}`} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Descrição do crédito
                      </Label>
                      <Textarea
                        id={`credito-descricao-${i}`}
                        value={trecho.descricao}
                        onChange={e => ajustar(trecho.key, 'descricao', e.target.value)}
                        disabled={saving}
                        maxLength={500}
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>
                  </fieldset>
                ))}
                {plural && (
                  <>
                    {creditoManual ? (
                      valoresValidos && total === 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Para liberar todas as faixas sem crédito, desmarque “Lançar crédito para o mensalista”.
                        </p>
                      )
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Use R$ 0,00 na faixa que deseja liberar sem crédito.
                      </p>
                    )}
                    <div className="flex justify-between gap-3 text-sm font-semibold text-arena-navy-800">
                      <span>Total a lançar</span>
                      <span className="tabular-nums">{loadingQuote || !valoresValidos ? '—' : brl(total)}</span>
                    </div>
                  </>
                )}
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
            disabled={saving || !temSelecao || loadingQuote || (lancarCredito && creditoManual && (!valoresValidos || total === 0))}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelando…
              </>
            ) : !sessaoInteira ? (
              `Cancelar ${plural ? 'horários' : 'horário'}${lancarCredito ? ' e lançar crédito' : ''}`
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
