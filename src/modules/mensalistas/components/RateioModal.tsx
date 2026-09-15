'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Plus, Search, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { searchAthletesAction } from '@/modules/loyalty/actions/loyaltyActions'
import {
  configureRateioAction,
  removerParticipanteRateioAction,
} from '@/modules/mensalistas/actions/mensalistaActions'
import { RegistrarPagamentoModal } from '@/modules/mensalistas/components/RegistrarPagamentoModal'
import type {
  CobrancaRow,
  MensalidadeRow,
} from '@/modules/mensalistas/types/mensalista.types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  arenaId: string
  mensalidade: MensalidadeRow | null
  cobrancas: CobrancaRow[]
  /** Participantes adicionais vinculados à reserva na criação do plano — sugeridos
   *  como atalho para adicionar ao rateio quando ele ainda não foi ligado. */
  participantesSugeridos?: { id: string; nome: string }[]
  creditoSaldo: number
  modosPagamento: { id: string; nome: string }[]
  /** Nome do responsável pela recorrência — recebe o crédito quando a parcela é de um avulso. */
  responsavelNome?: string
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function RateioModal({
  open,
  onClose,
  onSuccess,
  arenaId,
  mensalidade,
  cobrancas,
  participantesSugeridos = [],
  creditoSaldo,
  modosPagamento,
  responsavelNome,
}: Props) {
  const valorTotal = Number(mensalidade?.valor_total ?? 0)

  const [rows, setRows] = useState<CobrancaRow[]>([])
  const [rateioAtivo, setRateioAtivo] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    { id: string; nome_perfil: string }[]
  >([])
  const [searching, setSearching] = useState(false)
  const [disablingRateio, setDisablingRateio] = useState(false)
  const [pagamentoTarget, setPagamentoTarget] = useState<CobrancaRow | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open || !mensalidade) return
    setRows(cobrancas.filter((c) => c.ativo))
    setRateioAtivo(mensalidade.rateio)
    setAdding(false)
    setQuery('')
    setResults([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mensalidade?.id])

  const pagoTotal = useMemo(
    () =>
      round2(
        rows.reduce(
          (s, r) => s + Number(r.valor_pago) + Number(r.credito_aplicado),
          0
        )
      ),
    [rows]
  )
  const restante = round2(Math.max(0, valorTotal - pagoTotal))
  const excedente = round2(Math.max(0, pagoTotal - valorTotal))

  const existingIds = useMemo(
    () => new Set(rows.map((r) => r.atleta_id).filter((id): id is string => !!id)),
    [rows]
  )
  const sugeridosDisponiveis = participantesSugeridos.filter(
    (p) => !existingIds.has(p.id)
  )

  /** Envia a lista completa de participantes ainda não pagos (as fatias já
   *  pagas ficam congeladas no servidor) e sincroniza a lista local com a
   *  resposta — sem precisar de refresh de página a cada participante. */
  const persist = async (
    nextAtivos: { atleta_id: string | null; nome: string; ativo: boolean }[],
    busyKey_: string
  ) => {
    if (!mensalidade) return
    setBusyKey(busyKey_)
    try {
      const res = await configureRateioAction({
        arenaId,
        mensalidadeId: mensalidade.id,
        rateio: true,
        participantes: nextAtivos.map((p) => ({ ...p, valor: 0 })),
      })
      if (res.success) {
        setRows((res.data?.cobrancas ?? []).filter((c) => c.ativo))
        setRateioAtivo(true)
        onSuccess()
      } else {
        toast.error(res.error ?? 'Erro ao atualizar o rateio')
      }
    } finally {
      setBusyKey(null)
    }
  }

  const hasPayment = (r: CobrancaRow) =>
    Number(r.valor_pago) + Number(r.credito_aplicado) > 0 || r.pago_em != null

  /** A RPC preserva sozinha as fatias já pagas (congeladas) e as apaga da
   *  lista "editável" que reconstrói a cada chamada — reenviá-las aqui faria
   *  a RPC inserir uma cobrança NOVA pra elas, duplicando o participante. */
  const currentParticipantes = () =>
    rows
      .filter((r) => !hasPayment(r))
      .map((r) => ({ atleta_id: r.atleta_id, nome: r.nome, ativo: r.ativo }))

  const handleAtivarRateio = () => persist([], 'ativar')

  const handleAddRow = (atletaId: string | null, nome: string) => {
    if (!nome.trim()) return
    setAdding(false)
    setQuery('')
    setResults([])
    void persist(
      [...currentParticipantes(), { atleta_id: atletaId, nome: nome.trim(), ativo: true }],
      'add'
    )
  }

  const handleToggle = (row: CobrancaRow) => {
    void persist(
      currentParticipantes().map((p) =>
        p.atleta_id === row.atleta_id && p.nome === row.nome
          ? { ...p, ativo: !row.ativo }
          : p
      ),
      row.id
    )
  }

  /** Sem pagamento: só sai da lista de participantes (barato, via
   *  configureRateioAction). Com pagamento: precisa reverter o dinheiro e o
   *  crédito lançados para essa pessoa — ação destrutiva, exige confirmação. */
  const handleRemove = (row: CobrancaRow) => {
    const pago = Number(row.valor_pago) + Number(row.credito_aplicado)
    if (pago <= 0) {
      void persist(
        currentParticipantes().filter(
          (p) => !(p.atleta_id === row.atleta_id && p.nome === row.nome)
        ),
        row.id
      )
      return
    }

    if (
      !window.confirm(
        `Excluir "${row.nome}" do rateio e reverter ${formatCurrency(pago)} lançados para ela(e)? O dinheiro sai do caixa da arena e o crédito envolvido é desfeito. Esta ação não pode ser desfeita.`
      )
    ) {
      return
    }

    setBusyKey(row.id)
    void removerParticipanteRateioAction({ arenaId, cobrancaId: row.id })
      .then((res) => {
        if (res.success) {
          setRows((res.data?.cobrancas ?? []).filter((c) => c.ativo))
          toast.success(`Participante removido e ${formatCurrency(pago)} revertidos.`)
          onSuccess()
        } else {
          toast.error(res.error ?? 'Erro ao remover participante')
        }
      })
      .finally(() => setBusyKey(null))
  }

  const handleDesativarRateio = async () => {
    if (!mensalidade) return
    setDisablingRateio(true)
    try {
      const res = await configureRateioAction({
        arenaId,
        mensalidadeId: mensalidade.id,
        rateio: false,
        participantes: [],
      })
      if (res.success) {
        toast.success('Rateio desativado.')
        onSuccess()
        onClose()
      } else {
        toast.error(res.error ?? 'Erro ao desativar rateio')
      }
    } finally {
      setDisablingRateio(false)
    }
  }

  const handlePagamentoSuccess = () => {
    // O pagamento muda o total pago da mensalidade inteira; mais simples e
    // seguro reabrir o rateio do que tentar remendar o estado local.
    setPagamentoTarget(null)
    onSuccess()
    onClose()
  }

  useEffect(() => {
    if (!adding || query.trim().length < 2) {
      setResults([])
      return
    }
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
  }, [adding, query, arenaId])

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Rateio da mensalidade</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-arena-navy-800/50">
                Valor total devido
              </p>
              <p className="text-2xl font-black text-arena-navy-800">
                {formatCurrency(valorTotal)}
              </p>
            </div>

            {!rateioAtivo ? (
              <div className="space-y-3">
                <p className="text-sm text-arena-navy-800/60">
                  Ao ativar o rateio, os participantes podem ser lançados aos
                  poucos, ao longo do mês — cada um paga quando aparece, sem
                  precisar declarar de antemão quanto vai pagar.
                </p>
                <Button
                  onClick={handleAtivarRateio}
                  disabled={busyKey === 'ativar'}
                  className="w-full bg-arena-button hover:bg-arena-button-hover text-white font-bold"
                >
                  {busyKey === 'ativar' && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  )}
                  Ativar rateio
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-arena-navy-800/60">
                  Adicione cada participante quando ele aparecer e registre o
                  que está pagando. O total pago abate do valor devido acima.
                </p>

                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {rows.length === 0 && (
                    <p className="text-sm text-arena-navy-800/40 italic py-2">
                      Ainda não há participantes lançados neste rateio.
                    </p>
                  )}
                  {rows.map((r) => {
                    const pago = Number(r.valor_pago) + Number(r.credito_aplicado)
                    const rowHasPayment = hasPayment(r)
                    const isBusy = busyKey === r.id
                    return (
                      <div
                        key={r.id}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3',
                          r.ativo
                            ? 'border-arena-navy-800/10'
                            : 'border-dashed border-arena-navy-800/10 opacity-60'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-arena-navy-800 truncate">
                            {r.nome}
                            {!r.atleta_id && (
                              <span className="ml-1.5 text-[10px] font-medium text-arena-navy-800/40">
                                avulso
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-arena-navy-800/50 font-medium">
                            {pago > 0 ? (
                              <span className="text-emerald-600 font-bold">
                                {formatCurrency(pago)} pago
                              </span>
                            ) : (
                              'ainda não pagou'
                            )}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          disabled={restante <= 0.01}
                          onClick={() => setPagamentoTarget(r)}
                          className="h-8 px-3 rounded-lg text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex-shrink-0"
                        >
                          Registrar pagamento
                        </Button>

                        {!rowHasPayment && (
                          <Switch
                            checked={r.ativo}
                            disabled={isBusy}
                            onCheckedChange={() => handleToggle(r)}
                          />
                        )}
                        {/* Sem pagamento: só sai da lista. Com pagamento: exclui e reverte
                            o dinheiro/crédito lançados para essa pessoa (ver handleRemove). */}
                        <button
                          onClick={() => handleRemove(r)}
                          disabled={isBusy}
                          title={rowHasPayment ? 'Excluir e reverter lançamento' : 'Remover'}
                          className="text-arena-navy-800/30 hover:text-red-500 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {sugeridosDisponiveis.length > 0 && !adding && (
                  <div className="flex flex-wrap gap-1.5">
                    {sugeridosDisponiveis.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleAddRow(p.id, p.nome)}
                        disabled={busyKey === 'add'}
                        className="text-xs font-bold text-arena-button bg-arena-button/10 hover:bg-arena-button/20 rounded-full px-3 py-1"
                      >
                        + {p.nome}
                      </button>
                    ))}
                  </div>
                )}

                {adding ? (
                  <div className="rounded-xl border border-arena-navy-800/10 p-3 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-arena-navy-800/30" />
                      <Input
                        autoFocus
                        placeholder="Buscar atleta ou digitar um nome..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {searching && (
                      <p className="text-[11px] text-arena-navy-800/40">Buscando...</p>
                    )}
                    {results.length > 0 && (
                      <div className="space-y-1">
                        {results.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => handleAddRow(a.id, a.nome_perfil)}
                            className="block w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-slate-50"
                          >
                            {a.nome_perfil}
                          </button>
                        ))}
                      </div>
                    )}
                    {query.trim().length >= 2 && (
                      <button
                        onClick={() => handleAddRow(null, query)}
                        className="text-sm text-arena-button font-bold"
                      >
                        + Adicionar “{query.trim()}” como participante avulso
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setAdding(true)}
                    disabled={busyKey === 'add'}
                    className="flex items-center gap-1.5 text-sm text-arena-button font-bold"
                  >
                    {busyKey === 'add' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Adicionar participante
                  </button>
                )}

                <div
                  className={cn(
                    'rounded-xl p-3 text-sm flex items-center justify-between',
                    restante <= 0.01
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  )}
                >
                  <span className="font-bold">Pago: {formatCurrency(pagoTotal)}</span>
                  <span className="font-bold">
                    {excedente > 0.01
                      ? `Pago a mais: ${formatCurrency(excedente)}`
                      : `Falta: ${formatCurrency(restante)}`}
                  </span>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            {rateioAtivo ? (
              <Button
                variant="ghost"
                onClick={handleDesativarRateio}
                disabled={disablingRateio}
                className="text-arena-navy-800/60"
              >
                {disablingRateio && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
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

      <RegistrarPagamentoModal
        open={!!pagamentoTarget}
        onClose={() => setPagamentoTarget(null)}
        onSuccess={handlePagamentoSuccess}
        arenaId={arenaId}
        cobranca={pagamentoTarget}
        restanteMensalidade={restante}
        creditoSaldo={creditoSaldo}
        modosPagamento={modosPagamento}
        responsavelNome={responsavelNome}
      />
    </>
  )
}
