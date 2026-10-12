'use client'

import { useEffect, useState } from 'react'
import { addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { reajustarValorPlanoAction } from '@/modules/mensalistas/actions/mensalistaActions'
import {
  clampCreditoAbatimento,
  type SubcontaCredito,
} from '@/modules/mensalistas/credito-recorrencia'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  planoId: string
  planoLabel: string
  valorAtual: number
  /** Valor total da mensalidade do mês visualizado (se já gerada). */
  valorMesAtual: number | null
  /** Mês que a tela está exibindo, em YYYY-MM-01. Âncora da vigência. */
  competencia: string
  /** Subcontas de crédito do atleta (geral + uma por recorrência que ele participa). */
  creditoSubcontas: SubcontaCredito[]
  /** Cobrança do mês visualizado sem rateio e ainda sem pagamento/crédito lançado —
   *  só nesse caso o abatimento de crédito tem o que abater. */
  creditoElegivel: boolean
}

type Escopo = 'somente_mes' | 'mes_atual' | 'mes_seguinte'

export function ReajustarValorModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  planoId,
  planoLabel,
  valorAtual,
  valorMesAtual,
  competencia,
  creditoSubcontas = [],
  creditoElegivel,
}: Props) {
  // "Somente este mês" é o ajuste mais comum (desconto pontual combinado) e é
  // onde o abatimento de crédito aparece — vem marcado por padrão para o
  // gestor já ver a funcionalidade, em vez de precisar trocar a vigência.
  const [escopo, setEscopo] = useState<Escopo>('somente_mes')
  // O valor sugerido depende da vigência: "somente este mês" edita a cobrança
  // JÁ GERADA daquele mês (que pode ser pró-rata, ex. R$300 num plano de
  // R$500) — sugerir o valor do PLANO ali confundia o gestor, que via R$500
  // onde devia ver R$300. As outras vigências mudam o valor do plano em si,
  // então a sugestão certa é o valor atual dele.
  const [valor, setValor] = useState(() => String((valorMesAtual ?? valorAtual) || ''))
  const [valorTocado, setValorTocado] = useState(false)
  const [obs, setObs] = useState('')
  const [creditoValor, setCreditoValor] = useState('')
  const [creditoTocado, setCreditoTocado] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setEscopo('somente_mes')
      setObs('')
      setCreditoValor('')
      setCreditoTocado(false)
      setValorTocado(false)
    }
  }, [open])

  const valorReferencia = escopo === 'somente_mes' ? (valorMesAtual ?? valorAtual) : valorAtual

  useEffect(() => {
    if (!open || valorTocado) return
    setValor(String(valorReferencia || ''))
  }, [open, valorReferencia, valorTocado])

  // Os rótulos nomeiam o mês. "Mês atual" era lido como "o mês que estou vendo"
  // e o servidor entendia "o mês do calendário" — olhando outubro em setembro,
  // o reajuste caía em setembro. Com o nome na tela não há como confundir.
  const ancoraDate = parseISO(competencia || '1970-01-01')
  const nomeMes = (d: Date) => format(d, "MMMM 'de' yyyy", { locale: ptBR })
  const mesAncora = nomeMes(ancoraDate)
  const mesSeguinte = nomeMes(addMonths(ancoraDate, 1))

  const novo = Number(valor.replace(',', '.'))
  const invalido = !Number.isFinite(novo) || novo < 0
  const semMudanca = !invalido && Math.abs(novo - valorReferencia) < 0.005

  // O crédito "desta recorrência" + o "geral" é o que pode ser abatido sem
  // aviso: é o mesmo atleta, mas crédito de OUTRA recorrência dele só entra se
  // o gestor pedir explicitamente (ver aviso abaixo) — sai primeiro dali, depois
  // do geral, e só transborda para outra recorrência se o pedido passar disso.
  const subcontaRecorrencia = creditoSubcontas.find((s) => s.planoId === planoId)?.saldo ?? 0
  const subcontaGeral = creditoSubcontas.find((s) => s.planoId === null)?.saldo ?? 0
  const outrasRecorrencias = creditoSubcontas.filter(
    (s) => s.planoId !== null && s.planoId !== planoId
  )
  const creditoSeguro = Math.round((subcontaRecorrencia + subcontaGeral) * 100) / 100
  const creditoTotal = Math.round(
    (creditoSeguro + outrasRecorrencias.reduce((t, s) => t + s.saldo, 0)) * 100
  ) / 100

  // "Mês seguinte em diante" não toca a cobrança do mês visualizado — não há o
  // que abater nela, então a opção de crédito só aparece nos outros dois escopos.
  const mostraCredito = escopo !== 'mes_seguinte' && creditoElegivel && creditoTotal > 0.005
  // O teto do que cabe abater é o valor que a cobrança vai assumir com ESTE
  // reajuste — crédito não "sobra" para virar saque: um mês zerado não tem o
  // que abater, por mais crédito que o atleta tenha.
  const valorCobrancaPosReajuste = !invalido ? novo : 0
  const sugestaoCredito =
    !invalido && mostraCredito
      ? clampCreditoAbatimento(valorCobrancaPosReajuste, valorCobrancaPosReajuste, creditoSeguro)
      : 0

  useEffect(() => {
    if (!open || creditoTocado || !mostraCredito) return
    setCreditoValor(sugestaoCredito > 0 ? String(sugestaoCredito) : '')
  }, [open, mostraCredito, sugestaoCredito, creditoTocado])

  const creditoNum = mostraCredito ? Number(creditoValor.replace(',', '.')) || 0 : 0
  const creditoExcedeCobranca = creditoNum > valorCobrancaPosReajuste + 0.005
  const creditoInvalido =
    creditoNum < 0 || creditoNum > creditoTotal + 0.005 || creditoExcedeCobranca
  const creditoUsaOutraRecorrencia = creditoNum > creditoSeguro + 0.005
  const creditoDeOutras = Math.round((creditoNum - creditoSeguro) * 100) / 100

  const submit = async () => {
    if (invalido) {
      toast.error('Informe um valor válido')
      return
    }
    if (creditoInvalido) {
      toast.error('Informe um valor de crédito válido')
      return
    }
    setSaving(true)
    try {
      const res = await reajustarValorPlanoAction({
        arenaId,
        planoId,
        operationId: crypto.randomUUID(),
        novoValor: Math.round(novo * 100) / 100,
        escopo,
        competencia,
        observacao: obs.trim() || null,
        creditoAplicado: Math.round(creditoNum * 100) / 100,
        creditoOperationId: creditoNum > 0 ? crypto.randomUUID() : null,
      })
      if (!res.success || !res.data) {
        toast.error(res.error ?? 'Erro ao reajustar o valor')
        return
      }
      const d = res.data
      const ignoradas = d.ignoradasRateio + d.ignoradasPagamento
      toast.success(
        (d.escopo === 'somente_mes'
          ? `Cobrança de ${mesAncora} ajustada para ${formatCurrency(d.valorNovo)}. O plano segue em ${formatCurrency(valorAtual)}/mês.`
          : `Plano reajustado para ${formatCurrency(d.valorNovo)}/mês, de ${
              d.escopo === 'mes_seguinte' ? mesSeguinte : mesAncora
            } em diante.`) +
          (ignoradas > 0
            ? ` ${ignoradas} ${ignoradas === 1 ? 'mês' : 'meses'} com rateio/pagamento não ${ignoradas === 1 ? 'foi ajustado' : 'foram ajustados'} automaticamente.`
            : '') +
          (d.creditoAplicado > 0
            ? ` + ${formatCurrency(d.creditoAplicado)} de crédito aplicado nesta cobrança.`
            : '') +
          (d.creditoAplicado === 0 && d.creditoNaoAplicadoMotivo
            ? ` Crédito não aplicado: ${d.creditoNaoAplicadoMotivo}.`
            : '') +
          (d.creditoAplicado > 0 && d.creditoNaoAplicadoMotivo
            ? ` (${d.creditoNaoAplicadoMotivo}.)`
            : '')
      )
      onSuccess()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]">
        <DialogHeader className="border-b border-slate-100 px-6 pb-3.5 pt-5 text-left">
          <DialogTitle>Reajustar valor</DialogTitle>
          <DialogDescription className="text-xs text-arena-navy-800/50">
            {planoLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <span className="text-arena-navy-800/55">
              Plano <b className="text-arena-navy-800">{formatCurrency(valorAtual)}/mês</b>
            </span>
            {valorMesAtual != null && (
              <span className="text-arena-navy-800/55">
                {mesAncora} <b className="text-arena-navy-800">{formatCurrency(valorMesAtual)}</b>
              </span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-arena-navy-800/55">
              {escopo === 'somente_mes' ? `Valor da cobrança de ${mesAncora}` : 'Novo valor mensal'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-arena-navy-800/40">
                R$
              </span>
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => {
                  setValorTocado(true)
                  setValor(e.target.value)
                }}
                className="pl-9 font-bold"
              />
            </div>
            {semMudanca && (
              <p className="text-xs text-amber-600">O valor informado é igual ao atual.</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-arena-navy-800/55">Vigência</label>
            <div className="grid gap-1">
              {(
                [
                  [
                    'somente_mes',
                    `Somente ${mesAncora}`,
                    'Ajuste pontual: muda só a cobrança deste mês.',
                  ],
                  [
                    'mes_atual',
                    `De ${mesAncora} em diante`,
                    'Novo valor do plano, já valendo para este mês.',
                  ],
                  [
                    'mes_seguinte',
                    `De ${mesSeguinte} em diante`,
                    `Novo valor do plano. ${mesAncora} fica como está.`,
                  ],
                ] as [Escopo, string, string][]
              ).map(([value, label, ajuda]) => {
                const selecionado = escopo === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setEscopo(value)}
                    aria-pressed={selecionado}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                      selecionado
                        ? 'border-arena-button bg-arena-button/[0.06]'
                        : 'border-slate-200 hover:border-arena-navy-800/20'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full border-2',
                        selecionado ? 'border-arena-button' : 'border-slate-300'
                      )}
                    >
                      {selecionado && <span className="h-1.5 w-1.5 rounded-full bg-arena-button" />}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          'block text-[13px] font-bold capitalize',
                          selecionado ? 'text-arena-button' : 'text-arena-navy-800'
                        )}
                      >
                        {label}
                      </span>
                      {selecionado && (
                        <span className="block text-[11px] leading-snug text-arena-navy-800/50">
                          {ajuda}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {mostraCredito && (
            <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-sky-900">Usar crédito do cliente</label>
                <span className="text-[11px] text-sky-900/55">
                  disponível {formatCurrency(creditoSeguro)}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-arena-navy-800/40">
                  R$
                </span>
                <Input
                  inputMode="decimal"
                  value={creditoValor}
                  onChange={(e) => {
                    setCreditoTocado(true)
                    setCreditoValor(e.target.value)
                  }}
                  className="pl-9 font-bold bg-white"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-sky-300 bg-white px-3 py-2">
                <span className="text-[11px] font-bold text-arena-navy-800/55 uppercase">
                  Resta cobrar em dinheiro
                </span>
                <span className="text-base font-black text-arena-navy-800">
                  {formatCurrency(
                    Math.max(
                      0,
                      Math.round((valorCobrancaPosReajuste - creditoNum) * 100) / 100
                    )
                  )}
                </span>
              </div>
              {creditoExcedeCobranca ? (
                <p className="text-xs text-red-600">
                  Não pode passar do valor da cobrança ({formatCurrency(valorCobrancaPosReajuste)}
                  {valorCobrancaPosReajuste <= 0.005 ? ' — mês zerado' : ''}).
                </p>
              ) : (
                creditoInvalido && (
                  <p className="text-xs text-red-600">
                    O valor não pode passar do crédito disponível.
                  </p>
                )
              )}
              {creditoUsaOutraRecorrencia && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">
                  {formatCurrency(creditoDeOutras)} vem do crédito de outra recorrência —{' '}
                  {outrasRecorrencias.map((s) => `${s.label} (${formatCurrency(s.saldo)})`).join(', ')}.
                </p>
              )}
            </div>
          )}

          <details className="group">
            <summary className="list-none cursor-pointer text-xs font-bold text-arena-navy-800/55 [&::-webkit-details-marker]:hidden">
              Observação (opcional)
            </summary>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Ex.: reajuste anual combinado com o responsável"
              className="mt-1.5"
            />
          </details>
        </div>

        <DialogFooter className="border-t border-slate-100 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={saving || invalido || creditoInvalido}
            className="bg-arena-button hover:bg-arena-button-hover text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Reajustar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
