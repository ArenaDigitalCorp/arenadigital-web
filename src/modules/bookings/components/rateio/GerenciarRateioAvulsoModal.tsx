'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, Plus, Search, Split, Trash2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { searchAthletesAction } from '@/modules/loyalty/actions/loyaltyActions'
import {
  adicionarParticipanteRateioAction,
  atualizarValoresRateioAction,
  configurarRateioAction,
  getRateioAction,
  removerParticipanteRateioAvulsoAction,
  type RateioSnapshot,
} from '@/modules/bookings/actions/bookingRateioActions'
import {
  diferencaRateio,
  dividirIgualmente,
  parteLocacao,
  restanteCobranca,
  resumoRateio,
  type BookingCobranca,
} from '@/modules/bookings/lib/booking-rateio'
import { RegistrarPagamentoRateioModal } from '@/modules/bookings/components/rateio/RegistrarPagamentoRateioModal'

export type RateioReservaInfo = {
  id: string
  responsavel: string
  espaco: string | null
  start_time: string
  end_time: string
}

interface Props {
  open: boolean
  onClose: () => void
  /** Chamado depois de qualquer mudança persistida (para recarregar a lista). */
  onChanged: () => void
  arenaId: string
  reserva: RateioReservaInfo | null
  modosPagamento: { id: string; nome: string }[]
}

const parseValor = (v: string) => Number(v.replace(',', '.'))

function statusLabel(c: BookingCobranca) {
  if (c.status === 'quitado') return { text: 'Pago', cls: 'bg-emerald-100 text-emerald-700' }
  if (c.status === 'parcial') return { text: 'Parcial', cls: 'bg-amber-100 text-amber-700' }
  return { text: 'Pendente', cls: 'bg-orange-100 text-orange-700' }
}

export function GerenciarRateioAvulsoModal({
  open,
  onClose,
  onChanged,
  arenaId,
  reserva,
  modosPagamento,
}: Props) {
  // O pai remonta o modal por reserva (key), então o estado nasce limpo a cada abertura.
  const [snapshot, setSnapshot] = useState<RateioSnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [results, setResults] = useState<{ id: string; nome_perfil: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [pagamentoTarget, setPagamentoTarget] = useState<BookingCobranca | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applySnapshot = (next: RateioSnapshot) => {
    setSnapshot(next)
    setValores(
      Object.fromEntries(next.cobrancas.map((c) => [c.id, parteLocacao(c).toFixed(2)]))
    )
  }

  useEffect(() => {
    if (!open || !reserva) return
    let cancelled = false
    void getRateioAction(arenaId, reserva.id).then((res) => {
      if (cancelled) return
      if (res.success) applySnapshot(res.data)
      else setLoadError(res.error)
    })
    return () => {
      cancelled = true
    }
  }, [open, reserva, arenaId])

  const loading = open && Boolean(reserva) && !snapshot && !loadError

  const cobrancas = useMemo(() => snapshot?.cobrancas ?? [], [snapshot])
  const editavel = snapshot?.bookingStatus === 'reservado'
  const rateioAtivo = Boolean(snapshot?.rateioAtivo)
  const locacao = snapshot?.rentalPrice ?? 0
  const resumo = resumoRateio(cobrancas)
  const temPagamento = cobrancas.some((c) => c.valor_pago > 0)
  const servicos = cobrancas.find((c) => c.responsavel)?.valor_servicos ?? 0

  const partesDigitadas = cobrancas.map((c) => parseValor(valores[c.id] ?? '0'))
  const diferenca = diferencaRateio(partesDigitadas, locacao)
  const alterados = cobrancas.filter(
    (c) => Math.abs(parseValor(valores[c.id] ?? '0') - parteLocacao(c)) > 0.005
  )
  const valorInvalido = partesDigitadas.some((v) => !Number.isFinite(v) || v < 0)

  const done = (next: RateioSnapshot, message?: string) => {
    applySnapshot(next)
    if (message) toast.success(message)
    onChanged()
  }

  const handleAtivar = async () => {
    if (!reserva) return
    setBusy('ativar')
    const res = await configurarRateioAction({ arenaId, bookingId: reserva.id, ativo: true })
    setBusy(null)
    if (res.success) done(res.data, 'Rateio ativado. Adicione as pessoas que vão dividir.')
    else toast.error(res.error)
  }

  const handleDesativar = async () => {
    if (!reserva) return
    if (
      cobrancas.length > 1 &&
      !window.confirm('Desativar o rateio? A reserva volta a ser uma cobrança única do responsável e as pessoas adicionadas saem do rateio.')
    ) {
      return
    }
    setBusy('desativar')
    const res = await configurarRateioAction({ arenaId, bookingId: reserva.id, ativo: false })
    setBusy(null)
    if (res.success) done(res.data, 'Rateio desativado.')
    else toast.error(res.error)
  }

  const handleDividir = () => {
    const partes = dividirIgualmente(locacao, cobrancas.length)
    setValores(Object.fromEntries(cobrancas.map((c, i) => [c.id, partes[i].toFixed(2)])))
  }

  const handleSalvarValores = async () => {
    if (!reserva || alterados.length === 0) return
    if (valorInvalido) {
      toast.error('Informe valores válidos para todas as pessoas.')
      return
    }
    setBusy('valores')
    const res = await atualizarValoresRateioAction({
      arenaId,
      bookingId: reserva.id,
      valores: alterados.map((c) => ({
        cobrancaId: c.id,
        valor: Number(parseValor(valores[c.id]).toFixed(2)),
      })),
    })
    setBusy(null)
    if (res.success) done(res.data, 'Valores do rateio atualizados.')
    else toast.error(res.error)
  }

  const handleAdd = async (atletaId: string | null, nome: string) => {
    if (!reserva) return
    const valor = parseValor(novoValor || '0')
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error('Informe um valor válido para a parte.')
      return
    }
    setBusy('add')
    const res = await adicionarParticipanteRateioAction({
      arenaId,
      bookingId: reserva.id,
      atletaId,
      nome: atletaId ? null : nome.trim(),
      valor: Number(valor.toFixed(2)),
    })
    setBusy(null)
    if (res.success) {
      setAdding(false)
      setQuery('')
      setResults([])
      done(res.data, `${nome.trim()} entrou no rateio.`)
    } else {
      toast.error(res.error)
    }
  }

  const handleRemove = async (c: BookingCobranca) => {
    const aviso =
      c.valor_pago > 0
        ? `Excluir "${c.nome}" do rateio e estornar ${formatCurrency(c.valor_pago)} já pagos? O lançamento sai do Financeiro da arena. Esta ação não pode ser desfeita.`
        : `Remover "${c.nome}" do rateio?`
    if (!window.confirm(aviso)) return
    setBusy(c.id)
    const res = await removerParticipanteRateioAvulsoAction({ arenaId, cobrancaId: c.id })
    setBusy(null)
    if (res.success) {
      done(
        res.data,
        res.data.valorRevertido > 0
          ? `${c.nome} removido(a) e ${formatCurrency(res.data.valorRevertido)} estornados.`
          : `${c.nome} removido(a) do rateio.`
      )
    } else {
      toast.error(res.error)
    }
  }

  // Sugestão para a próxima pessoa: o que falta para as partes cobrirem a locação.
  const abrirAdicionar = () => {
    setNovoValor(Math.max(0, -diferenca).toFixed(2))
    setAdding(true)
  }

  const buscaAtiva = adding && query.trim().length >= 2
  const visibleResults = buscaAtiva ? results : []

  useEffect(() => {
    if (!buscaAtiva) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchAthletesAction(arenaId, query.trim())
      setSearching(false)
      if (res.success) setResults(res.data ?? [])
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [buscaAtiva, query, arenaId])

  const jaNoRateio = new Set(cobrancas.map((c) => c.atleta_id).filter(Boolean))

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Rateio da reserva</DialogTitle>
            {reserva && (
              <p className="text-sm font-medium text-arena-navy-800/60">
                {reserva.responsavel}
                {reserva.espaco ? ` · ${reserva.espaco}` : ''} ·{' '}
                {format(parseISO(reserva.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {loading && (
              <div className="flex items-center justify-center py-10 text-arena-navy-800/40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}

            {loadError && (
              <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{loadError}</p>
            )}

            {snapshot && !rateioAtivo && (
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-arena-navy-800/50">
                    Valor da locação
                  </p>
                  <p className="text-2xl font-black text-arena-navy-800">{formatCurrency(locacao)}</p>
                </div>
                {editavel ? (
                  <>
                    <p className="text-sm text-arena-navy-800/60">
                      Com o rateio, cada pessoa tem sua própria cobrança — atleta cadastrado ou
                      alguém sem cadastro, só pelo nome. Os valores são livres e cada um pode pagar
                      aos poucos. A reserva é confirmada quando todos quitarem.
                    </p>
                    <Button
                      onClick={handleAtivar}
                      disabled={busy === 'ativar'}
                      className="w-full bg-arena-button font-bold text-white hover:bg-arena-button-hover"
                    >
                      {busy === 'ativar' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      Ativar rateio
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-arena-navy-800/60">
                    Esta reserva não está mais aguardando pagamento, então o rateio não pode ser ativado.
                  </p>
                )}
              </div>
            )}

            {snapshot && rateioAtivo && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-arena-navy-800/50">
                      Locação
                    </p>
                    <p className="text-base font-black text-arena-navy-800">{formatCurrency(locacao)}</p>
                    {servicos > 0 && (
                      <p className="text-[10px] font-medium text-arena-navy-800/45">
                        + {formatCurrency(servicos)} serviços
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/70">Pago</p>
                    <p className="text-base font-black text-emerald-700">{formatCurrency(resumo.pago)}</p>
                    <p className="text-[10px] font-medium text-emerald-700/70">
                      {resumo.quitadas}/{resumo.pessoas} quitaram
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700/70">Falta</p>
                    <p className="text-base font-black text-amber-700">{formatCurrency(resumo.restante)}</p>
                  </div>
                </div>

                {!editavel && (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs font-medium text-arena-navy-800/60">
                    {snapshot.bookingStatus === 'confirmed'
                      ? 'Todos pagaram e a reserva está confirmada — o rateio está encerrado.'
                      : 'Esta reserva não está mais aguardando pagamento — o rateio é só para consulta.'}
                  </p>
                )}

                <ul className="space-y-2">
                  {cobrancas.map((c) => {
                    const st = statusLabel(c)
                    const restante = restanteCobranca(c)
                    const isBusy = busy === c.id
                    return (
                      <li
                        key={c.id}
                        className="rounded-xl border border-arena-navy-800/10 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-arena-navy-800">
                              {c.nome}
                              {c.responsavel && (
                                <span className="ml-1.5 text-[9px] font-black uppercase text-arena-button">
                                  Responsável
                                </span>
                              )}
                              {!c.atleta_id && (
                                <span className="ml-1.5 text-[10px] font-medium text-arena-navy-800/40">
                                  sem cadastro
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] font-medium text-arena-navy-800/50">
                              {c.valor_pago > 0 ? (
                                <span className="font-bold text-emerald-600">
                                  {formatCurrency(c.valor_pago)} pago
                                </span>
                              ) : (
                                'ainda não pagou'
                              )}
                              {restante > 0 && c.valor_pago > 0 && <> · falta {formatCurrency(restante)}</>}
                            </p>
                          </div>

                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', st.cls)}>
                            {st.text}
                          </span>

                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-arena-navy-800/40">
                              R$
                            </span>
                            <Input
                              inputMode="decimal"
                              aria-label={`Parte de ${c.nome}`}
                              value={valores[c.id] ?? ''}
                              disabled={!editavel || busy !== null}
                              onChange={(e) =>
                                setValores((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              className="h-8 pl-8 text-sm"
                            />
                          </div>

                          {editavel && restante > 0 && (
                            <Button
                              size="sm"
                              disabled={busy !== null || alterados.length > 0}
                              title={alterados.length > 0 ? 'Salve os valores antes de registrar pagamentos' : undefined}
                              onClick={() => setPagamentoTarget(c)}
                              className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-white hover:bg-emerald-600"
                            >
                              Registrar pagamento
                            </Button>
                          )}

                          {editavel && !c.responsavel && (
                            <button
                              type="button"
                              onClick={() => handleRemove(c)}
                              disabled={busy !== null}
                              title={c.valor_pago > 0 ? 'Excluir e estornar o que foi pago' : 'Remover do rateio'}
                              aria-label={`Remover ${c.nome}`}
                              className="text-arena-navy-800/30 hover:text-red-500 disabled:opacity-40"
                            >
                              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                        {c.responsavel && c.valor_servicos > 0 && (
                          <p className="mt-1 text-[10px] font-medium text-arena-navy-800/45">
                            Parte da locação + {formatCurrency(c.valor_servicos)} de serviços ={' '}
                            {formatCurrency(c.valor_devido)}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {editavel && (
                  <div
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 text-xs font-bold',
                      Math.abs(diferenca) <= 0.005
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    )}
                  >
                    <span>
                      Soma das partes {formatCurrency(partesDigitadas.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0))}
                      {' · '}locação {formatCurrency(locacao)}
                      {Math.abs(diferenca) > 0.005 &&
                        ` (${diferenca > 0 ? 'a mais' : 'faltam'} ${formatCurrency(Math.abs(diferenca))})`}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleDividir}
                        disabled={busy !== null || cobrancas.length === 0}
                        className="h-7 gap-1 rounded-lg text-xs"
                      >
                        <Split className="h-3.5 w-3.5" />
                        Dividir igualmente
                      </Button>
                      {alterados.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSalvarValores}
                          disabled={busy !== null || valorInvalido}
                          className="h-7 rounded-lg bg-arena-button text-xs font-bold text-white hover:bg-arena-button-hover"
                        >
                          {busy === 'valores' && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                          Salvar valores
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {editavel &&
                  (adding ? (
                    <div className="space-y-2 rounded-xl border border-arena-navy-800/10 p-3">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-navy-800/30" />
                          <Input
                            autoFocus
                            placeholder="Buscar atleta ou digitar um nome..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <div className="relative w-28">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-arena-navy-800/40">
                            R$
                          </span>
                          <Input
                            inputMode="decimal"
                            aria-label="Valor da parte"
                            value={novoValor}
                            onChange={(e) => setNovoValor(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setAdding(false)}
                          aria-label="Cancelar"
                          className="text-arena-navy-800/30 hover:text-arena-navy-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {buscaAtiva && searching && <p className="text-[11px] text-arena-navy-800/40">Buscando...</p>}
                      {visibleResults.length > 0 && (
                        <div className="space-y-1">
                          {visibleResults.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              disabled={busy === 'add' || jaNoRateio.has(a.id)}
                              onClick={() => handleAdd(a.id, a.nome_perfil)}
                              className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-40"
                            >
                              {a.nome_perfil}
                              {jaNoRateio.has(a.id) && (
                                <span className="ml-1.5 text-[10px] text-arena-navy-800/40">já no rateio</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {query.trim().length >= 2 && (
                        <button
                          type="button"
                          disabled={busy === 'add'}
                          onClick={() => handleAdd(null, query)}
                          className="text-sm font-bold text-arena-button"
                        >
                          {busy === 'add' && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                          + Adicionar “{query.trim()}” sem cadastro
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={abrirAdicionar}
                      disabled={busy !== null}
                      className="flex items-center gap-1.5 text-sm font-bold text-arena-button disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar pessoa
                    </button>
                  ))}
              </>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            {snapshot && rateioAtivo && editavel && !temPagamento ? (
              <Button
                variant="ghost"
                onClick={handleDesativar}
                disabled={busy !== null}
                className="text-arena-navy-800/60"
              >
                {busy === 'desativar' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Desativar rateio
              </Button>
            ) : (
              <span />
            )}
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RegistrarPagamentoRateioModal
        open={!!pagamentoTarget}
        onClose={() => setPagamentoTarget(null)}
        onSuccess={(next) => done(next)}
        arenaId={arenaId}
        cobranca={pagamentoTarget}
        modosPagamento={modosPagamento}
      />
    </>
  )
}
