'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { addMonths, parseISO } from 'date-fns'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Minus,
  RotateCcw,
  Search,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn, normalizeString } from '@/lib/utils'
import { formatCompetencia, formatCurrency, toCompetencia } from '@/lib/format'
import {
  aplicarReajusteMesLoteAction,
  getReajusteMesPreviewAction,
} from '@/modules/mensalistas/actions/mensalistaActions'
import {
  ARREDONDAMENTO_LABEL,
  MOTIVO_IGNORADO_LABEL,
  SELO_LABEL,
  editavel,
  impacto,
  parseValor,
  precisaAnalise,
  selecionadaPorPadrao,
  selos,
  semAlteracao,
  validarNovoValor,
  valorInicial,
  variacaoJogos,
  type Arredondamento,
  type SeloReajuste,
} from '@/modules/mensalistas/reajuste-mes'
import type {
  ReajusteMesLinha,
  ReajusteMesLoteResultado,
} from '@/modules/mensalistas/types/mensalista.types'

interface Props {
  open: boolean
  onClose: () => void
  /** Depois de um lote com algo ajustado — a tela de Mensalistas recarrega. */
  onApplied: () => void
  arenaId: string
  /** Mês exibido na tela de Mensalistas (`YYYY-MM`); o modal pode navegar a partir dele. */
  competenciaInicial: string
}

type Etapa = 'editar' | 'revisar' | 'resultado'
type Filtro = 'analise' | 'todas'

const SELO_CLASSE: Record<SeloReajuste, string> = {
  quitada: 'bg-emerald-50 text-emerald-700',
  cancelada: 'bg-gray-100 text-gray-500',
  rateio: 'bg-sky-50 text-sky-700',
  parcial: 'bg-amber-50 text-amber-700',
  pausa: 'bg-slate-100 text-slate-600',
  estreia: 'bg-indigo-50 text-indigo-700',
  encerra: 'bg-rose-50 text-rose-700',
}

/** Colunas da grade: no celular, só a seleção e o conteúdo empilhado. */
const GRADE =
  'grid grid-cols-[28px_1fr] gap-x-3 gap-y-1.5 md:grid-cols-[28px_minmax(190px,1.7fr)_88px_104px_112px_136px_104px_minmax(120px,1fr)] md:items-center'

function paraCampo(valor: number): string {
  return valor.toFixed(2).replace('.', ',')
}

function diferencaTexto(valor: number): string {
  if (Math.abs(valor) < 0.005) return '—'
  return `${valor > 0 ? '+' : '−'}${formatCurrency(Math.abs(valor))}`
}

function RotuloCelular({ children }: { children: React.ReactNode }) {
  return <span className="mr-1 text-[11px] font-medium text-arena-navy-800/40 md:hidden">{children}</span>
}

function Jogos({ linha }: { linha: ReajusteMesLinha }) {
  const variacao = variacaoJogos(linha)
  const Icone = variacao === 'sobe' ? ArrowUp : variacao === 'desce' ? ArrowDown : Minus
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-bold text-arena-navy-800"
      title={
        linha.jogosEmPausa > 0
          ? `${linha.jogos} no calendário, ${linha.jogosEmPausa} em pausa`
          : `${linha.jogosAnterior} jogos no mês anterior, ${linha.jogosLiquidos} neste mês`
      }
    >
      {linha.jogosAnterior} → {linha.jogosLiquidos}
      <Icone
        className={cn(
          'h-3.5 w-3.5',
          variacao === 'sobe' && 'text-emerald-600',
          variacao === 'desce' && 'text-amber-600',
          variacao === 'igual' && 'text-arena-navy-800/25'
        )}
      />
    </span>
  )
}

export function AjustarMensalidadesMesModal({
  open,
  onClose,
  onApplied,
  arenaId,
  competenciaInicial,
}: Props) {
  const [competencia, setCompetencia] = useState(competenciaInicial)
  const [etapa, setEtapa] = useState<Etapa>('editar')
  const [linhas, setLinhas] = useState<ReajusteMesLinha[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [editadas, setEditadas] = useState<Set<string>>(new Set())
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [filtro, setFiltro] = useState<Filtro>('analise')
  const [busca, setBusca] = useState('')
  const [arredondamento, setArredondamento] = useState<Arredondamento>('centavos')
  const [observacao, setObservacao] = useState('')
  const [aplicando, setAplicando] = useState(false)
  const [resultado, setResultado] = useState<ReajusteMesLoteResultado | null>(null)
  const [recarga, setRecarga] = useState(0)
  // Uma revisão = uma operação: reenviar depois de uma falha de rede não reaplica.
  const operationIdRef = useRef<string | null>(null)
  // A carga lê o arredondamento atual sem recarregar a cada troca dele.
  const arredondamentoRef = useRef(arredondamento)
  useEffect(() => {
    arredondamentoRef.current = arredondamento
  }, [arredondamento])

  useEffect(() => {
    if (!open) return
    // Abrir de novo recomeça do mês da tela, sem herdar edição antiga.
    setCompetencia(competenciaInicial)
    setEtapa('editar')
    setResultado(null)
    setObservacao('')
    setBusca('')
    setFiltro('analise')
  }, [open, competenciaInicial])

  useEffect(() => {
    if (!open) return
    let ativo = true
    setCarregando(true)
    setErro(null)
    getReajusteMesPreviewAction(arenaId, competencia).then((res) => {
      if (!ativo) return
      setCarregando(false)
      if (!res.success || !res.data) {
        setErro(res.error ?? 'Não foi possível carregar as mensalidades do mês.')
        setLinhas([])
        return
      }
      const novas = res.data.linhas
      setLinhas(novas)
      setValores(
        Object.fromEntries(
          novas.map((l) => [l.planoId, paraCampo(valorInicial(l, arredondamentoRef.current))])
        )
      )
      setEditadas(new Set())
      setSelecionadas(new Set(novas.filter(selecionadaPorPadrao).map((l) => l.planoId)))
    })
    return () => {
      ativo = false
    }
  }, [open, arenaId, competencia, recarga])

  const editaveisOuVisiveis = useMemo(() => linhas.filter((l) => !l.porBlocos), [linhas])
  const porBlocos = linhas.length - editaveisOuVisiveis.length
  const comMudancaDeJogos = editaveisOuVisiveis.filter((l) => variacaoJogos(l) !== 'igual').length
  const paraAnalise = editaveisOuVisiveis.filter(precisaAnalise).length

  const novoDe = (l: ReajusteMesLinha) => parseValor(valores[l.planoId] ?? '')

  const visiveis = useMemo(() => {
    const termo = normalizeString(busca.trim())
    return editaveisOuVisiveis.filter((l) => {
      const noFiltro = filtro === 'todas' || precisaAnalise(l) || selecionadas.has(l.planoId)
      const naBusca =
        !termo || normalizeString(`${l.atleta} ${l.recorrencia}`).includes(termo)
      return noFiltro && naBusca
    })
  }, [editaveisOuVisiveis, filtro, busca, selecionadas])

  const selecionadasEditaveis = editaveisOuVisiveis.filter(
    (l) => selecionadas.has(l.planoId) && editavel(l)
  )
  const comErro = selecionadasEditaveis.filter((l) => validarNovoValor(l, novoDe(l)) !== null)
  const paraEnviar = selecionadasEditaveis.filter(
    (l) => validarNovoValor(l, novoDe(l)) === null && !semAlteracao(l, novoDe(l))
  )
  const impactoTotal = impacto(
    paraEnviar.map((l) => ({ valorAtual: l.valorAtual, novoValor: novoDe(l) }))
  )
  const mesLabel = formatCompetencia(competencia)

  function alternar(planoId: string, marcada: boolean) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual)
      if (marcada) proximo.add(planoId)
      else proximo.delete(planoId)
      return proximo
    })
  }

  function editar(linha: ReajusteMesLinha, texto: string) {
    setValores((atual) => ({ ...atual, [linha.planoId]: texto }))
    setEditadas((atual) => new Set(atual).add(linha.planoId))
    // Mexeu no valor, quer ajustar: marca a linha.
    alternar(linha.planoId, true)
  }

  function restaurar(linha: ReajusteMesLinha) {
    setValores((atual) => ({ ...atual, [linha.planoId]: paraCampo(valorInicial(linha, arredondamento)) }))
    setEditadas((atual) => {
      const proximo = new Set(atual)
      proximo.delete(linha.planoId)
      return proximo
    })
  }

  function mudarArredondamento(modo: Arredondamento) {
    setArredondamento(modo)
    // O que o gestor digitou fica; só as sugestões ainda não tocadas mudam.
    setValores((atual) => {
      const proximo = { ...atual }
      for (const l of linhas) {
        if (!editadas.has(l.planoId)) proximo[l.planoId] = paraCampo(valorInicial(l, modo))
      }
      return proximo
    })
  }

  function aplicarSugestaoNasSelecionadas() {
    setValores((atual) => {
      const proximo = { ...atual }
      for (const l of selecionadasEditaveis) proximo[l.planoId] = paraCampo(valorInicial(l, arredondamento))
      return proximo
    })
    setEditadas((atual) => {
      const proximo = new Set(atual)
      for (const l of selecionadasEditaveis) proximo.delete(l.planoId)
      return proximo
    })
  }

  function marcarVisiveis(marcar: boolean) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual)
      for (const l of visiveis) {
        if (!editavel(l)) continue
        if (marcar) proximo.add(l.planoId)
        else proximo.delete(l.planoId)
      }
      return proximo
    })
  }

  function mudarMes(delta: number) {
    setCompetencia((atual) => toCompetencia(addMonths(parseISO(`${atual}-01`), delta)))
    setEtapa('editar')
  }

  function revisar() {
    if (comErro.length > 0) {
      toast.error(`Corrija ${comErro.length === 1 ? 'o valor marcado' : `os ${comErro.length} valores marcados`} em vermelho.`)
      return
    }
    if (paraEnviar.length === 0) {
      toast.error('Nenhum ajuste selecionado com valor diferente do atual.')
      return
    }
    operationIdRef.current = crypto.randomUUID()
    setEtapa('revisar')
  }

  async function aplicar() {
    if (!operationIdRef.current) operationIdRef.current = crypto.randomUUID()
    setAplicando(true)
    try {
      const res = await aplicarReajusteMesLoteAction({
        arenaId,
        operationId: operationIdRef.current,
        competencia,
        observacao: observacao.trim() || null,
        itens: paraEnviar.map((l) => ({
          planoId: l.planoId,
          novoValor: Number(novoDe(l).toFixed(2)),
          valorEsperado: l.valorAtual,
        })),
      })
      if (!res.success || !res.data) {
        toast.error(res.error ?? 'Não foi possível aplicar os ajustes.')
        return
      }
      setResultado(res.data)
      setEtapa('resultado')
      operationIdRef.current = null
      if (res.data.aplicados > 0) onApplied()
    } finally {
      setAplicando(false)
    }
  }

  const linhaPorPlano = new Map(linhas.map((l) => [l.planoId, l]))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !aplicando && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="space-y-3 border-b border-slate-100 px-6 pb-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="text-xl font-black text-arena-navy-800">
                Ajustar mensalidades do mês
              </DialogTitle>
              <DialogDescription className="text-xs text-arena-navy-800/50">
                Compara os jogos de cada recorrência com o mês anterior e sugere o valor
                pelo preço por jogo do contrato. Só muda a cobrança deste mês — o valor
                do plano continua o mesmo.
              </DialogDescription>
            </div>
            <div className="flex items-center rounded-xl border border-arena-navy-800/5 bg-gray-50 p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-white"
                disabled={carregando || aplicando || etapa === 'revisar'}
                onClick={() => mudarMes(-1)}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[150px] px-3 text-center text-sm font-black uppercase tracking-wider text-arena-navy-800">
                {mesLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-white"
                disabled={carregando || aplicando || etapa === 'revisar'}
                onClick={() => mudarMes(1)}
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {etapa === 'editar' && (
          <>
            <div className="space-y-3 border-b border-slate-100 px-6 py-3">
              {!carregando && !erro && (
                <p className="text-sm text-arena-navy-800/70">
                  <b className="text-arena-navy-800">{editaveisOuVisiveis.length}</b> recorrências ·{' '}
                  <b className="text-arena-navy-800">{comMudancaDeJogos}</b> com mudança de jogos ·{' '}
                  <b className="text-arena-button">{paraAnalise}</b>{' '}
                  {paraAnalise === 1 ? 'precisa' : 'precisam'} de análise
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
                  <SelectTrigger className="h-9 w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="analise">Precisam de análise</SelectItem>
                    <SelectItem value="todas">Todas as recorrências</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-navy-800/30" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar mensalista ou recorrência"
                    className="h-9 pl-9"
                  />
                </div>
                <Select value={arredondamento} onValueChange={(v) => mudarArredondamento(v as Arredondamento)}>
                  <SelectTrigger className="h-9 w-[215px]" title="Arredondamento das sugestões">
                    <span className="text-arena-navy-800/50">Arredondar:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ARREDONDAMENTO_LABEL) as Arredondamento[]).map((modo) => (
                      <SelectItem key={modo} value={modo}>
                        {ARREDONDAMENTO_LABEL[modo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={selecionadasEditaveis.length === 0}
                  onClick={aplicarSugestaoNasSelecionadas}
                >
                  Usar sugestão nos selecionados
                </Button>
              </div>
            </div>

            <div className="min-h-[220px] flex-1 overflow-y-auto px-6 py-2">
              {carregando ? (
                <div className="space-y-2 py-2" aria-busy="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : erro ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                  <p className="text-sm text-arena-navy-800/70">{erro}</p>
                  <Button variant="outline" size="sm" onClick={() => setRecarga((n) => n + 1)}>
                    Tentar de novo
                  </Button>
                </div>
              ) : editaveisOuVisiveis.length === 0 ? (
                <p className="py-12 text-center text-sm text-arena-navy-800/50">
                  Nenhuma recorrência ativa com mensalidade em {mesLabel}.
                </p>
              ) : visiveis.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  <p className="text-sm text-arena-navy-800/70">
                    {busca
                      ? 'Nenhuma recorrência encontrada para a busca.'
                      : `Nenhuma recorrência precisa de ajuste em ${mesLabel} — os valores batem com os jogos do mês.`}
                  </p>
                  {filtro === 'analise' && (
                    <Button variant="outline" size="sm" onClick={() => setFiltro('todas')}>
                      Ver todas as recorrências
                    </Button>
                  )}
                </div>
              ) : (
                <div role="table" aria-label={`Mensalidades de ${mesLabel}`}>
                  <div
                    role="row"
                    className={cn(
                      GRADE,
                      'sticky top-0 z-10 hidden border-b border-slate-100 bg-white py-2 text-[11px] font-bold uppercase tracking-wide text-arena-navy-800/40 md:grid'
                    )}
                  >
                    <Checkbox
                      aria-label="Selecionar todas as visíveis"
                      checked={
                        visiveis.some((l) => editavel(l)) &&
                        visiveis.filter(editavel).every((l) => selecionadas.has(l.planoId))
                      }
                      onCheckedChange={(c) => marcarVisiveis(c === true)}
                    />
                    <span>Mensalista</span>
                    <span>Jogos</span>
                    <span className="text-right">Mês anterior</span>
                    <span className="text-right">Atual</span>
                    <span>Novo valor</span>
                    <span className="text-right">Diferença</span>
                    <span>Situação</span>
                  </div>

                  {visiveis.map((l) => {
                    const podeEditar = editavel(l)
                    const novo = novoDe(l)
                    const erroValor = podeEditar ? validarNovoValor(l, novo) : null
                    const diferenca = erroValor || !Number.isFinite(novo) ? 0 : novo - l.valorAtual
                    const listaSelos = selos(l)
                    const editada = editadas.has(l.planoId)
                    return (
                      <div
                        key={l.planoId}
                        role="row"
                        className={cn(
                          GRADE,
                          'border-b border-slate-50 py-2.5',
                          !podeEditar && 'opacity-60',
                          selecionadas.has(l.planoId) && podeEditar && 'bg-arena-button/[0.03]'
                        )}
                      >
                        <Checkbox
                          aria-label={`Selecionar ${l.atleta} — ${l.recorrencia}`}
                          disabled={!podeEditar}
                          checked={podeEditar && selecionadas.has(l.planoId)}
                          onCheckedChange={(c) => alternar(l.planoId, c === true)}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-arena-navy-800">{l.atleta}</p>
                          <p className="truncate text-xs text-arena-navy-800/50">{l.recorrencia}</p>
                        </div>
                        <div className="col-start-2 md:col-start-auto">
                          <RotuloCelular>Jogos</RotuloCelular>
                          <Jogos linha={l} />
                        </div>
                        <div className="col-start-2 text-sm text-arena-navy-800/60 md:col-start-auto md:text-right">
                          <RotuloCelular>Mês anterior</RotuloCelular>
                          {l.valorAnterior == null ? '—' : formatCurrency(l.valorAnterior)}
                        </div>
                        <div className="col-start-2 md:col-start-auto md:text-right">
                          <RotuloCelular>Atual</RotuloCelular>
                          <span className="text-sm font-semibold text-arena-navy-800">
                            {formatCurrency(l.valorAtual)}
                          </span>
                          {l.valorPorJogo != null && (
                            <span className="block text-[11px] text-arena-navy-800/40">
                              {formatCurrency(l.valorPorJogo)}/jogo
                            </span>
                          )}
                        </div>
                        <div className="col-start-2 md:col-start-auto">
                          {podeEditar ? (
                            <>
                              <div className="relative w-[128px]">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-arena-navy-800/40">
                                  R$
                                </span>
                                <Input
                                  inputMode="decimal"
                                  aria-label={`Novo valor de ${l.atleta}`}
                                  aria-invalid={erroValor !== null}
                                  value={valores[l.planoId] ?? ''}
                                  onChange={(e) => editar(l, e.target.value)}
                                  className={cn(
                                    'h-8 pl-8 text-right text-sm font-bold',
                                    erroValor && 'border-red-400 focus-visible:ring-red-300'
                                  )}
                                />
                              </div>
                              {erroValor === 'abaixo_do_pago' ? (
                                <span className="block text-[11px] text-red-600">
                                  Acima de {formatCurrency(l.valorPago)} (já pago)
                                </span>
                              ) : erroValor === 'invalido' ? (
                                <span className="block text-[11px] text-red-600">Valor inválido</span>
                              ) : editada ? (
                                <button
                                  type="button"
                                  onClick={() => restaurar(l)}
                                  className="inline-flex items-center gap-1 text-[11px] text-arena-navy-800/45 hover:text-arena-navy-800"
                                >
                                  <RotateCcw className="h-3 w-3" /> voltar à sugestão
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-sm text-arena-navy-800/40">—</span>
                          )}
                        </div>
                        <div
                          className={cn(
                            'col-start-2 text-sm font-bold md:col-start-auto md:text-right',
                            diferenca > 0.005 && 'text-emerald-600',
                            diferenca < -0.005 && 'text-amber-600',
                            Math.abs(diferenca) <= 0.005 && 'text-arena-navy-800/30'
                          )}
                        >
                          <RotuloCelular>Diferença</RotuloCelular>
                          {podeEditar ? diferencaTexto(diferenca) : '—'}
                        </div>
                        <div className="col-start-2 flex flex-wrap gap-1 md:col-start-auto">
                          {listaSelos.map((selo) => (
                            <span
                              key={selo}
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                SELO_CLASSE[selo]
                              )}
                              title={
                                selo === 'parcial'
                                  ? `Já pago: ${formatCurrency(l.valorPago)}`
                                  : selo === 'pausa'
                                    ? `${l.jogosEmPausa} jogo(s) dentro de uma pausa — o valor pode já ter sido ajustado por ela`
                                    : selo === 'rateio'
                                      ? 'Ajusta o total do grupo: a diferença vai para a parte do responsável (redistribua no rateio se precisar); o que cada um já pagou continua'
                                      : undefined
                              }
                            >
                              {SELO_LABEL[selo]}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {!carregando && !erro && porBlocos > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-arena-navy-800/45">
                  <Info className="h-3.5 w-3.5" />
                  {porBlocos} {porBlocos === 1 ? 'recorrência por blocos já é calculada' : 'recorrências por blocos já são calculadas'} automaticamente
                  pelos jogos do mês.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 md:flex-row md:items-center">
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                maxLength={400}
                placeholder={`Observação (opcional) — ex.: ${mesLabel} com 5 jogos`}
                className="h-9 md:flex-1"
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={revisar}
                  disabled={carregando || paraEnviar.length === 0}
                  className="bg-arena-button text-white hover:bg-arena-button-hover"
                >
                  Revisar {paraEnviar.length} {paraEnviar.length === 1 ? 'ajuste' : 'ajustes'}
                  {paraEnviar.length > 0 && ` (${diferencaTexto(impactoTotal)})`}
                </Button>
              </div>
            </div>
          </>
        )}

        {etapa === 'revisar' && (
          <>
            <div className="min-h-[220px] flex-1 space-y-3 overflow-y-auto px-6 py-4">
              <p className="text-sm text-arena-navy-800/70">
                Confira antes de aplicar. Muda <b>só a cobrança de {mesLabel}</b>; o valor dos
                planos continua o mesmo.
              </p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {paraEnviar.map((l) => {
                  const novo = novoDe(l)
                  return (
                    <li key={l.planoId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-arena-navy-800">{l.atleta}</p>
                        <p className="text-xs text-arena-navy-800/50">
                          {l.recorrencia} · {l.jogosAnterior} → {l.jogosLiquidos} jogos
                        </p>
                      </div>
                      <p className="text-sm text-arena-navy-800">
                        {formatCurrency(l.valorAtual)} → <b>{formatCurrency(novo)}</b>{' '}
                        <span className={novo > l.valorAtual ? 'text-emerald-600' : 'text-amber-600'}>
                          ({diferencaTexto(novo - l.valorAtual)})
                        </span>
                      </p>
                    </li>
                  )
                })}
              </ul>
              {observacao.trim() && (
                <p className="text-xs text-arena-navy-800/50">Observação: {observacao.trim()}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
              <p className="text-sm text-arena-navy-800/70">
                {paraEnviar.length} {paraEnviar.length === 1 ? 'ajuste' : 'ajustes'} · impacto no mês:{' '}
                <b className={impactoTotal >= 0 ? 'text-emerald-600' : 'text-amber-600'}>
                  {diferencaTexto(impactoTotal)}
                </b>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={aplicando} onClick={() => setEtapa('editar')}>
                  Voltar
                </Button>
                <Button
                  onClick={aplicar}
                  disabled={aplicando}
                  className="bg-arena-button text-white hover:bg-arena-button-hover"
                >
                  {aplicando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Aplicar {paraEnviar.length} {paraEnviar.length === 1 ? 'ajuste' : 'ajustes'}
                </Button>
              </div>
            </div>
          </>
        )}

        {etapa === 'resultado' && resultado && (
          <>
            <div className="min-h-[200px] flex-1 space-y-4 overflow-y-auto px-6 py-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-base font-bold text-arena-navy-800">
                    {resultado.aplicados}{' '}
                    {resultado.aplicados === 1 ? 'mensalidade ajustada' : 'mensalidades ajustadas'} em {mesLabel}
                  </p>
                  <p className="text-sm text-arena-navy-800/60">
                    Impacto no mês: {diferencaTexto(resultado.impacto)}
                    {resultado.ignorados > 0 &&
                      ` · ${resultado.ignorados} ${resultado.ignorados === 1 ? 'ficou' : 'ficaram'} de fora`}
                  </p>
                </div>
              </div>
              {resultado.ignorados > 0 && (
                <ul className="divide-y divide-slate-100 rounded-xl border border-amber-100 bg-amber-50/40">
                  {resultado.itens
                    .filter((item) => item.status !== 'ok')
                    .map((item) => {
                      const l = linhaPorPlano.get(item.planoId)
                      return (
                        <li key={`${item.planoId}-${item.status}`} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-sm">
                          <span className="text-arena-navy-800">
                            <b>{l?.atleta ?? 'Recorrência'}</b>
                            {l && <span className="text-arena-navy-800/50"> · {l.recorrencia}</span>}
                          </span>
                          <span className="font-medium text-amber-700">{MOTIVO_IGNORADO_LABEL[item.status]}</span>
                        </li>
                      )
                    })}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              {resultado.ignorados > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEtapa('editar')
                    setResultado(null)
                    setRecarga((n) => n + 1)
                  }}
                >
                  Revisar de novo
                </Button>
              )}
              <Button onClick={onClose} className="bg-arena-button text-white hover:bg-arena-button-hover">
                Concluir
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
