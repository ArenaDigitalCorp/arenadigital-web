"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { format, getDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CheckCircle,
  Clock,
  XCircle,
  FileSpreadsheet,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Search,
  X,
  Wallet,
  CalendarClock,
  Receipt,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SendTemplateMessageButton } from '@/modules/templates-mensagens/components/SendTemplateMessageButton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { cn, normalizeString } from '@/lib/utils'
import { arenaDataTable } from '@/lib/arena-data-table'
import { getPaymentStatusReportAction } from '@/modules/reports/actions/reportActions'
import { searchAthletesAction } from '@/modules/loyalty/actions/loyaltyActions'
import {
  buildAthleteSummarySheetData,
  buildPaymentStatusSheetData,
} from '@/modules/reports/payment-status-export'
import { buildAppliedFiltersDescription } from '@/modules/reports/payment-status-pdf-data'
import { PERFIL_LABEL, PERFIS_ATLETA, type PerfilAtleta } from '@/modules/athletes/types/perfil.types'
import type {
  PaymentStatusRow,
  PaymentStatusSummary,
  CourtFilter,
  SportFilter,
  AthleteDebtSummary,
  PaymentStatusArenaInfo,
  PaymentStatusAthleteSummary,
} from '@/modules/reports/types/report.types'

const PAGE_SIZE = 10

const EMPTY_SUMMARY: PaymentStatusSummary = {
  totalPago: 0, totalPendente: 0, totalCancelado: 0,
  countPago: 0, countPendente: 0, countCancelado: 0,
  totalACobrar: 0, totalHoras: 0,
}

/** "Maria Teste" → "maria-teste", pro nome do arquivo do PDF por atleta. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const statusConfig: Record<
  PaymentStatusRow['status'],
  { label: string; className: string }
> = {
  Pago: { label: 'Pago', className: 'bg-green-100 text-green-700 border-green-200' },
  Pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  Cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700 border-red-200' },
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return iso
  }
}

/**
 * "16:00 às 17:00" quando a linha ocupa um intervalo. Linha sem instante usa o
 * rótulo que o servidor mandou (faixa da recorrência) ou "—" quando ela não
 * tem horário nenhum — derivar hora de uma data daria um horário fantasma.
 */
function formatHorario(row: PaymentStatusRow) {
  if (row.horario !== undefined) return row.horario ?? '—'
  try {
    const inicio = format(parseISO(row.data), 'HH:mm', { locale: ptBR })
    if (!row.fim) return inicio
    return `${inicio} às ${format(parseISO(row.fim), 'HH:mm', { locale: ptBR })}`
  } catch {
    return '—'
  }
}

function formatHoras(horas: number) {
  const arredondado = Math.round(horas * 100) / 100
  return `${arredondado.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h`
}

const DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Dia da semana da ocorrência (mesma lógica de `formatDate`/`formatHorario`: lê direto de `row.data`). */
function formatDiaSemana(row: PaymentStatusRow) {
  try {
    return DIAS_SEMANA_ABREV[getDay(parseISO(row.data))]
  } catch {
    return '—'
  }
}

type SortKey =
  | 'data'
  | 'horario'
  | 'diaSemana'
  | 'atleta'
  | 'servico'
  | 'espaco'
  | 'esporte'
  | 'valor'
  | 'status'

function getSortValue(row: PaymentStatusRow, key: SortKey): string | number {
  switch (key) {
    case 'data':
      return parseISO(row.data).getTime()
    case 'horario':
      return formatHorario(row)
    case 'diaSemana':
      try {
        return getDay(parseISO(row.data))
      } catch {
        return -1
      }
    case 'atleta':
      return row.atleta ?? 'Avulsa'
    case 'servico':
      return row.servico
    case 'espaco':
      return row.espaco ?? ''
    case 'esporte':
      return row.esporte ?? ''
    case 'valor':
      return row.valor ?? -Infinity
    case 'status':
      return row.status
  }
}

/** Linha exibida na tabela — igual a `PaymentStatusRow`, mas pode representar várias ocorrências coladas (Agrupar por atleta). */
type PaymentStatusDisplayRow = PaymentStatusRow & { occurrences?: number }

function distinctJoin(values: (string | null)[]): string | null {
  const uniq = [...new Set(values.filter((v): v is string => Boolean(v)))]
  return uniq.length > 0 ? uniq.join(', ') : null
}

/**
 * Colapsa as ocorrências semanais da mesma recorrência (várias datas do mês)
 * numa linha só por atleta + dia da semana — pensado para o extrato por hora
 * do mensalista, onde cada semana vira uma linha idêntica em tudo, menos a data.
 * Valor soma as ocorrências (é isso que se cobra do atleta naquele slot no
 * mês); status prioriza "Pendente" (ainda tem o que cobrar) sobre "Pago", e só
 * fecha "Cancelado" se todas as ocorrências foram canceladas.
 */
function groupByAtletaEDiaSemana(rows: PaymentStatusRow[]): PaymentStatusDisplayRow[] {
  const groups = new Map<string, PaymentStatusRow[]>()
  const order: string[] = []

  for (const row of rows) {
    const atletaKey = row.atleta ?? 'Avulsa'
    let dia = -1
    try {
      dia = getDay(parseISO(row.data))
    } catch {
      // mantém dia = -1 (linha sem data válida cai no próprio grupo)
    }
    const key = `${atletaKey}__${dia}`
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(row)
  }

  return order.map((key) => {
    const group = groups.get(key)!
    const first = [...group].sort(
      (a, b) => parseISO(a.data).getTime() - parseISO(b.data).getTime()
    )[0]
    const valores = group.map((r) => r.valor).filter((v): v is number => v != null)
    const valor = valores.length > 0 ? Math.round(valores.reduce((s, v) => s + v, 0) * 100) / 100 : null
    const status: PaymentStatusRow['status'] = group.every((r) => r.status === 'Cancelado')
      ? 'Cancelado'
      : group.some((r) => r.status === 'Pendente')
        ? 'Pendente'
        : 'Pago'

    return {
      ...first,
      id: `grp-${key}`,
      valor,
      status,
      espaco: distinctJoin(group.map((r) => r.espaco)),
      esporte: distinctJoin(group.map((r) => r.esporte)),
      horario: distinctJoin(group.map((r) => formatHorario(r))),
      occurrences: group.length,
    }
  })
}

/**
 * Mesmo pipeline de exibição (filtro de status → agrupar por atleta → ordenar)
 * usado tanto pela tabela/exportações da tela quanto pela exportação avulsa
 * por atleta — para as duas verem exatamente os mesmos dados sob os mesmos
 * controles (status/agrupamento/ordenação) vigentes na tela.
 */
function deriveDisplayRows(
  inputRows: PaymentStatusRow[],
  statusFiltro: 'todos' | PaymentStatusRow['status'],
  agruparPorAtleta: boolean,
  sortKey: SortKey | null,
  sortDir: 'asc' | 'desc'
): PaymentStatusDisplayRow[] {
  const statusFiltered =
    statusFiltro === 'todos' ? inputRows : inputRows.filter((r) => r.status === statusFiltro)
  const grouped = agruparPorAtleta ? groupByAtletaEDiaSemana(statusFiltered) : statusFiltered
  if (!sortKey) return grouped
  const dir = sortDir === 'asc' ? 1 : -1
  return [...grouped].sort((a, b) => {
    const va = getSortValue(a, sortKey)
    const vb = getSortValue(b, sortKey)
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base', numeric: true }) * dir
  })
}

/** Data normal para linha única; contagem de ocorrências quando a linha é um grupo. */
function formatDataCell(row: PaymentStatusDisplayRow) {
  if (row.occurrences && row.occurrences > 1) return `${row.occurrences}x no mês`
  return formatDate(row.data)
}

function SortableTh<K extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'left',
  className,
}: {
  label: string
  sortKey: K
  activeKey: K | null
  direction: 'asc' | 'desc'
  onSort: (key: K) => void
  align?: 'left' | 'right'
  className?: string
}) {
  const isActive = activeKey === sortKey
  const Icon = isActive ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <th
      className={cn(
        align === 'right' ? arenaDataTable.thRight : arenaDataTable.th,
        'cursor-pointer select-none hover:text-arena-navy-800',
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'w-full justify-end')}>
        {label}
        <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-arena-navy-800' : 'text-arena-navy-800/30')} />
      </span>
    </th>
  )
}

function generateMonthOptions() {
  const options: { label: string; value: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      label: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
      value: format(d, 'yyyy-MM'),
    })
  }
  return options
}

function getMonthRange(yearMonth: string): { startDate: string; endDate: string } {
  const [year, month] = yearMonth.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  }
}

interface Props {
  arenaId: string
  initialRows: PaymentStatusRow[]
  initialSummary: PaymentStatusSummary
  initialAthleteSummaries: PaymentStatusAthleteSummary[]
  initialCourts: CourtFilter[]
  initialSports: SportFilter[]
  initialStartDate: string
  initialEndDate: string
  arenaInfo: PaymentStatusArenaInfo
}

/** Combobox de atleta único, com busca — casa reserva/mensalidade como responsável ou participante. */
function AthleteFilterField({
  arenaId,
  selected,
  onSelect,
  onClear,
}: {
  arenaId: string
  selected: { id: string; nome_perfil: string } | null
  onSelect: (a: { id: string; nome_perfil: string }) => void
  onClear: () => void
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: string; nome_perfil: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  function handleSearch(value: string) {
    setSearch(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (value.length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const result = await searchAthletesAction(arenaId)
        if (result.success && result.data) {
          const normalizedSearch = normalizeString(value)
          setResults(
            (result.data as { id: string; nome_perfil: string }[]).filter((a) =>
              normalizeString(a.nome_perfil).includes(normalizedSearch)
            )
          )
        }
      } finally {
        setIsSearching(false)
      }
    }, 400)
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-1 min-w-[200px]">
        <label className="text-xs font-medium text-gray-500">Atleta</label>
        <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-white px-3 text-sm">
          <span className="truncate font-medium text-arena-navy-800">{selected.nome_perfil}</span>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-arena-navy-800/40 hover:text-arena-navy-800"
            aria-label="Limpar filtro de atleta"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col gap-1 min-w-[200px]">
      <label className="text-xs font-medium text-gray-500">Atleta</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-navy-800/30" />
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar atleta..."
          className="h-9 w-full rounded-md border border-input bg-white pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-arena-button/30"
        />
      </div>
      {search.length >= 2 && (
        <div className="absolute top-full z-10 mt-1 max-h-56 w-full min-w-[220px] overflow-y-auto rounded-md border border-slate-100 bg-white shadow-lg">
          {isSearching ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-arena-navy-800/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-arena-navy-800/40">Nenhum atleta encontrado.</p>
          ) : (
            results.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onSelect(a)
                  setSearch('')
                  setResults([])
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm font-medium text-arena-navy-800 hover:bg-arena-navy-800/5"
              >
                {a.nome_perfil}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

type SecaoRecolhivel = 'filtros' | 'resumo' | 'lancamentos'

const SECOES_RECOLHIDAS_STORAGE_KEY = 'relatorio-pagamentos:secoes-recolhidas'
const SECOES_ABERTAS: Record<SecaoRecolhivel, boolean> = {
  filtros: false,
  resumo: false,
  lancamentos: false,
}

/**
 * Quais seções da tela o gestor minimizou. Fica no navegador (mesmo esquema do
 * `sidebar-collapsed`) para a tela voltar como ele deixou; sem storage
 * (aba anônima, bloqueio) tudo abre expandido e o botão segue funcionando.
 */
function useSecoesRecolhidas() {
  const [recolhidas, setRecolhidas] = useState(SECOES_ABERTAS)

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(SECOES_RECOLHIDAS_STORAGE_KEY) ?? 'null')
      if (!salvo || typeof salvo !== 'object') return
      const lido = { ...SECOES_ABERTAS }
      for (const secao of Object.keys(SECOES_ABERTAS) as SecaoRecolhivel[]) {
        if (typeof salvo[secao] === 'boolean') lido[secao] = salvo[secao]
      }
      // Só dá para ler o storage depois da hidratação — no SSR ele não existe.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecolhidas(lido)
    } catch {
      // Storage indisponível: segue tudo expandido.
    }
  }, [])

  const alternar = useCallback((secao: SecaoRecolhivel) => {
    setRecolhidas((atual) => {
      const proximo = { ...atual, [secao]: !atual[secao] }
      try {
        localStorage.setItem(SECOES_RECOLHIDAS_STORAGE_KEY, JSON.stringify(proximo))
      } catch {
        // Sem storage o estado vale só para esta visita.
      }
      return proximo
    })
  }, [])

  return [recolhidas, alternar] as const
}

/** Título clicável da seção, com o chevron que minimiza/expande o conteúdo. */
function SectionToggle({
  aberta,
  onToggle,
  controla,
  children,
}: {
  aberta: boolean
  onToggle: () => void
  /** `id` do conteúdo que o botão mostra/esconde (acessibilidade). */
  controla: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-expanded={aberta}
      aria-controls={controla}
      title={aberta ? 'Minimizar' : 'Expandir'}
      onClick={onToggle}
      className="group flex min-w-0 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arena-button/40"
    >
      <ChevronDown
        className={cn(
          'h-4 w-4 shrink-0 text-arena-navy-800/30 transition-transform group-hover:text-arena-navy-800/60',
          aberta && 'rotate-180'
        )}
      />
      {children}
    </button>
  )
}

type SummarySortKey = 'atleta' | 'horas' | 'devido' | 'pago' | 'emAberto' | 'status'

/**
 * Ordena o Resumo por atleta pela coluna clicada. Sem coluna escolhida, fica a
 * ordem do servidor (quem deve mais primeiro). Empate desempata pelo nome, para
 * a ordem não "pular" entre um filtro e outro.
 */
function sortAthleteSummaries(
  summaries: PaymentStatusAthleteSummary[],
  key: SummarySortKey | null,
  dir: 'asc' | 'desc'
): PaymentStatusAthleteSummary[] {
  if (!key) return summaries
  const sentido = dir === 'asc' ? 1 : -1
  const porNome = (a: PaymentStatusAthleteSummary, b: PaymentStatusAthleteSummary) =>
    a.atleta.localeCompare(b.atleta, 'pt-BR', { sensitivity: 'base', numeric: true })
  return [...summaries].sort((a, b) => {
    const comparacao =
      key === 'atleta'
        ? porNome(a, b)
        : key === 'status'
          ? a.status.localeCompare(b.status, 'pt-BR')
          : a[key] - b[key]
    return comparacao * sentido || porNome(a, b)
  })
}

/**
 * "Quem deve quanto" no período: uma linha por atleta com o total do mês, o
 * que já entrou e o que falta. Respeita o filtro de Status (atleta Pendente =
 * ainda tem saldo em aberto). O PDF da linha é o extrato de uso do atleta.
 */
function AthleteSummaryCard({
  arenaId,
  competencia,
  monthLabel,
  summaries,
  showHoras,
  isPending,
  exportingAthleteId,
  onExportPdf,
  sortKey,
  sortDir,
  onSort,
  recolhido,
  onToggle,
}: {
  arenaId: string
  competencia: string
  monthLabel: string
  summaries: PaymentStatusAthleteSummary[]
  showHoras: boolean
  isPending: boolean
  exportingAthleteId: string | null
  onExportPdf: (atletaId: string, atletaNome: string) => void
  sortKey: SummarySortKey | null
  sortDir: 'asc' | 'desc'
  onSort: (key: SummarySortKey) => void
  recolhido: boolean
  onToggle: () => void
}) {
  const sortProps = { activeKey: sortKey, direction: sortDir, onSort }
  const totais = summaries.reduce(
    (acc, s) => ({
      horas: acc.horas + s.horas,
      devido: acc.devido + s.devido,
      pago: acc.pago + s.pago,
      emAberto: acc.emAberto + s.emAberto,
    }),
    { horas: 0, devido: 0, pago: 0, emAberto: 0 }
  )
  const colSpan = showHoras ? 7 : 6

  return (
    <Card className="rounded-lg border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 px-6 py-4',
          !recolhido && 'border-b border-slate-100'
        )}
      >
        <SectionToggle aberta={!recolhido} onToggle={onToggle} controla="resumo-por-atleta">
          <Users className="h-5 w-5 shrink-0 text-arena-button" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-arena-navy-800">Resumo por atleta</h2>
            <p className="text-xs text-arena-navy-800/40">
              {monthLabel} · total do mês, pago e em aberto por atleta
            </p>
          </div>
        </SectionToggle>
        {/* Continua visível minimizado: o essencial sem abrir a tabela. */}
        {!isPending && summaries.length > 0 && (
          <p className="text-xs text-arena-navy-800/50">
            {summaries.length} atleta{summaries.length !== 1 ? 's' : ''} ·{' '}
            <span className="font-bold text-arena-button">{formatCurrency(totais.emAberto)}</span> em aberto
          </p>
        )}
      </div>
      <div id="resumo-por-atleta" className={cn('max-h-[420px] overflow-auto px-6', recolhido && 'hidden')}>
        <table className={arenaDataTable.table}>
          <thead>
            <tr className={arenaDataTable.theadRow}>
              <SortableTh label="Atleta" sortKey="atleta" {...sortProps} />
              {showHoras && <SortableTh label="Horas" sortKey="horas" align="right" {...sortProps} />}
              <SortableTh label="Total do mês" sortKey="devido" align="right" {...sortProps} />
              <SortableTh label="Pago" sortKey="pago" align="right" {...sortProps} />
              <SortableTh label="Em aberto" sortKey="emAberto" align="right" {...sortProps} />
              <SortableTh label="Status" sortKey="status" align="right" className="w-28" {...sortProps} />
              <th className={cn(arenaDataTable.thRight, 'w-14')}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={colSpan} className={arenaDataTable.emptyCell}>
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-arena-button" />
                </td>
              </tr>
            ) : summaries.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className={arenaDataTable.emptyCell}>
                  Nenhum atleta para os filtros selecionados.
                </td>
              </tr>
            ) : (
              <>
                {summaries.map((s) => {
                  const sc = statusConfig[s.status]
                  return (
                    <tr key={s.key} className={arenaDataTable.tbodyRow}>
                      <td className={arenaDataTable.tdBold}>{s.atleta}</td>
                      {showHoras && (
                        <td className={cn(arenaDataTable.tdRight, 'whitespace-nowrap text-arena-navy-800/60')}>
                          {s.horas > 0 ? formatHoras(s.horas) : '—'}
                        </td>
                      )}
                      <td className={cn(arenaDataTable.tdRight, 'whitespace-nowrap text-arena-navy-800/60')}>
                        {formatCurrency(s.devido)}
                      </td>
                      <td className={cn(arenaDataTable.tdRight, 'whitespace-nowrap text-green-700')}>
                        {formatCurrency(s.pago)}
                      </td>
                      <td className={cn(arenaDataTable.tdRight, 'whitespace-nowrap font-black text-arena-button')}>
                        {formatCurrency(s.emAberto)}
                      </td>
                      <td className={arenaDataTable.tdRight}>
                        <Badge variant="outline" className={sc.className}>
                          {sc.label}
                        </Badge>
                      </td>
                      <td className={arenaDataTable.tdRight}>
                        <div className="flex items-center justify-end gap-1">
                          <SendTemplateMessageButton
                            arenaId={arenaId}
                            competencia={competencia}
                            athlete={
                              s.atletaId
                                ? { id: s.atletaId, nome: s.atleta, telefone: s.telefone }
                                : null
                            }
                          />
                          {s.atletaId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-arena-navy-800/40 hover:bg-arena-navy-800/5 hover:text-arena-navy-800"
                              title="Extrato de uso deste atleta (PDF)"
                              disabled={exportingAthleteId === s.atletaId}
                              onClick={() => onExportPdf(s.atletaId as string, s.atleta)}
                            >
                              {exportingAthleteId === s.atletaId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr className="border-t border-slate-200 bg-slate-50/60">
                  <td className={arenaDataTable.tdBold}>
                    Total ({summaries.length} atleta{summaries.length !== 1 ? 's' : ''})
                  </td>
                  {showHoras && (
                    <td className={cn(arenaDataTable.tdRight, 'whitespace-nowrap font-bold')}>
                      {formatHoras(totais.horas)}
                    </td>
                  )}
                  <td className={cn(arenaDataTable.tdRight, 'whitespace-nowrap font-bold')}>
                    {formatCurrency(totais.devido)}
                  </td>
                  <td className={cn(arenaDataTable.tdRight, 'whitespace-nowrap font-bold text-green-700')}>
                    {formatCurrency(totais.pago)}
                  </td>
                  <td className={cn(arenaDataTable.tdRight, 'whitespace-nowrap font-black text-arena-button')}>
                    {formatCurrency(totais.emAberto)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function StatusPagamentosPageClient({
  arenaId,
  initialRows,
  initialSummary,
  initialAthleteSummaries,
  initialCourts,
  initialSports,
  initialStartDate,
  arenaInfo,
}: Props) {
  const now = new Date()
  const currentMonth = format(now, 'yyyy-MM')

  const [rows, setRows] = useState<PaymentStatusRow[]>(initialRows)
  const [summary, setSummary] = useState<PaymentStatusSummary>(initialSummary)
  const [athleteDebt, setAthleteDebt] = useState<AthleteDebtSummary | null>(null)
  const [athleteSummaries, setAthleteSummaries] =
    useState<PaymentStatusAthleteSummary[]>(initialAthleteSummaries)
  const [courts] = useState<CourtFilter[]>(initialCourts)
  const [sports] = useState<SportFilter[]>(initialSports)

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [tipo, setTipo] = useState<'todos' | 'avulso' | 'mensal'>('todos')
  const [courtId, setCourtId] = useState<string>('todos')
  const [sportId, setSportId] = useState<string>('todos')
  const [atleta, setAtleta] = useState<{ id: string; nome_perfil: string } | null>(null)
  const [perfilFiltro, setPerfilFiltro] = useState<PerfilAtleta | 'todos'>('todos')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | PaymentStatusRow['status']>('todos')
  const [rateio, setRateio] = useState(false)
  const [detalharPorHora, setDetalharPorHora] = useState(false)
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [exportingAthleteId, setExportingAthleteId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [agruparPorAtleta, setAgruparPorAtleta] = useState(false)
  const [summarySortKey, setSummarySortKey] = useState<SummarySortKey | null>(null)
  const [secoesRecolhidas, alternarSecao] = useSecoesRecolhidas()
  const [summarySortDir, setSummarySortDir] = useState<'asc' | 'desc'>('asc')

  // Extrato de uso: o dia da semana é o que o atleta confere ("toda quarta"),
  // seja qual for o Tipo de Jogo.
  const showDiaSemanaColumn = detalharPorHora

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  function handleSummarySort(key: SummarySortKey) {
    if (summarySortKey === key) {
      setSummarySortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSummarySortKey(key)
      setSummarySortDir('asc')
    }
  }

  const monthOptions = generateMonthOptions()

  type FilterState = {
    month: string
    tipo: typeof tipo
    courtId: string
    sportId: string
    atletaId: string | null
    perfil: PerfilAtleta | 'todos'
    rateio: boolean
    detalharPorHora: boolean
  }

  function applyFilters(overrides: Partial<FilterState> = {}) {
    const state: FilterState = {
      month: selectedMonth,
      tipo,
      courtId,
      sportId,
      atletaId: atleta?.id ?? null,
      perfil: perfilFiltro,
      rateio,
      detalharPorHora,
      ...overrides,
    }
    const { startDate, endDate } = getMonthRange(state.month)
    startTransition(async () => {
      const result = await getPaymentStatusReportAction(arenaId, {
        startDate,
        endDate,
        tipo: state.tipo === 'todos' ? undefined : state.tipo,
        courtId: state.courtId === 'todos' ? undefined : state.courtId,
        sportId: state.sportId === 'todos' ? undefined : state.sportId,
        atletaId: state.atletaId ?? undefined,
        perfil: state.perfil === 'todos' ? undefined : state.perfil,
        rateio: state.tipo === 'mensal' ? state.rateio : undefined,
        detalharPorHora: state.detalharPorHora || undefined,
      })
      if (result.success) {
        setRows(result.rows ?? [])
        setSummary(result.summary ?? EMPTY_SUMMARY)
        setAthleteDebt(result.athleteDebt ?? null)
        setAthleteSummaries(result.athleteSummaries ?? [])
        setPage(1)
      }
    })
  }

  function handleDetalharChange(checked: boolean) {
    setDetalharPorHora(checked)
    if (!checked) setAgruparPorAtleta(false)
    // A coluna Horas do resumo só existe no detalhamento.
    if (!checked && summarySortKey === 'horas') setSummarySortKey(null)
    applyFilters({ detalharPorHora: checked })
  }

  function handleAgruparChange(checked: boolean) {
    setAgruparPorAtleta(checked)
    setPage(1)
  }

  function handleMonthChange(v: string) {
    setSelectedMonth(v)
    applyFilters({ month: v })
  }

  function handleTipoChange(v: string) {
    const t = v as typeof tipo
    setTipo(t)
    // Rateio só faz sentido com Tipo = Mensal — sai do ar (e some do filtro) nos outros.
    if (t !== 'mensal' && rateio) setRateio(false)
    applyFilters({ tipo: t, rateio: t === 'mensal' ? rateio : false })
  }

  function handleCourtChange(v: string) {
    setCourtId(v)
    applyFilters({ courtId: v })
  }

  function handleSportChange(v: string) {
    setSportId(v)
    applyFilters({ sportId: v })
  }

  function handleAtletaSelect(a: { id: string; nome_perfil: string }) {
    setAtleta(a)
    applyFilters({ atletaId: a.id })
  }

  function handleAtletaClear() {
    setAtleta(null)
    applyFilters({ atletaId: null })
  }

  function handlePerfilChange(v: string) {
    const p = v as PerfilAtleta | 'todos'
    setPerfilFiltro(p)
    applyFilters({ perfil: p })
  }

  function handleRateioChange(checked: boolean) {
    setRateio(checked)
    applyFilters({ rateio: checked })
  }

  function handleStatusFiltroChange(v: string) {
    setStatusFiltro(v as typeof statusFiltro)
    setPage(1)
  }

  async function handleExportExcel() {
    const { default: writeExcelFile } = await import('write-excel-file/browser')
    const sheetData = buildPaymentStatusSheetData(sortedRows, formatDate, formatHorario, {
      diaSemana: showDiaSemanaColumn ? formatDiaSemana : undefined,
    })
    const { startDate, endDate } = getMonthRange(selectedMonth)
    await writeExcelFile([
      { data: sheetData, sheet: 'Status Pagamentos' },
      {
        data: buildAthleteSummarySheetData(visibleAthleteSummaries, { horas: detalharPorHora }),
        sheet: 'Resumo por atleta',
      },
    ]).toFile(`status-pagamentos-${startDate}-${endDate}.xlsx`)
  }

  async function handleExportPdf() {
    setIsExportingPdf(true)
    try {
      const { generatePaymentStatusPdf } = await import('@/modules/reports/payment-status-pdf')
      const { startDate, endDate } = getMonthRange(selectedMonth)
      await generatePaymentStatusPdf({
        rows: sortedRows,
        summary,
        arena: arenaInfo,
        filtros: {
          monthLabel,
          tipo,
          courtName: courtId !== 'todos' ? (courts.find((c) => c.id === courtId)?.name ?? null) : null,
          sportName: sportId !== 'todos' ? (sports.find((s) => s.id === sportId)?.name ?? null) : null,
          atletaNome: atleta?.nome_perfil ?? null,
          perfilLabel: perfilFiltro !== 'todos' ? PERFIL_LABEL[perfilFiltro] : null,
          rateio,
          detalharPorHora,
        },
        athleteDebt: atleta && athleteDebt ? { nome: atleta.nome_perfil, ...athleteDebt } : null,
        athleteSummaries: visibleAthleteSummaries,
        formatDate,
        formatHorario,
        formatDiaSemana: showDiaSemanaColumn ? formatDiaSemana : undefined,
        formatCurrency,
        fileName: `status-pagamentos-${startDate}-${endDate}`,
      })
    } finally {
      setIsExportingPdf(false)
    }
  }

  /**
   * Extrato de uso do atleta — o PDF que vai para ele conferir e pagar. Busca
   * de novo no servidor com os filtros atuais da tela (Período, Tipo, Espaço,
   * Esporte, Perfil, Rateio) mais `atletaId`, sem mexer nos filtros visíveis.
   *
   * Sai sempre hora a hora e com todos os status: o atleta precisa ver tudo o
   * que jogou no mês (inclusive o que já pagou) e o rodapé com quanto falta —
   * um filtro "Pendente" herdado da tela esconderia metade do extrato.
   */
  async function handleExportPdfForAthlete(atletaId: string, atletaNome: string) {
    setExportingAthleteId(atletaId)
    try {
      const { startDate, endDate } = getMonthRange(selectedMonth)
      const result = await getPaymentStatusReportAction(arenaId, {
        startDate,
        endDate,
        tipo: tipo === 'todos' ? undefined : tipo,
        courtId: courtId === 'todos' ? undefined : courtId,
        sportId: sportId === 'todos' ? undefined : sportId,
        atletaId,
        perfil: perfilFiltro === 'todos' ? undefined : perfilFiltro,
        rateio: tipo === 'mensal' ? rateio : undefined,
        detalharPorHora: true,
      })
      if (!result.success) throw new Error(result.error)

      const athleteRows = deriveDisplayRows(result.rows ?? [], 'todos', agruparPorAtleta, sortKey ?? 'data', sortKey ? sortDir : 'asc')
      const resumoDoAtleta = (result.athleteSummaries ?? []).find((s) => s.atletaId === atletaId) ?? null
      const { generatePaymentStatusPdf } = await import('@/modules/reports/payment-status-pdf')
      await generatePaymentStatusPdf({
        rows: athleteRows,
        summary: result.summary ?? EMPTY_SUMMARY,
        arena: arenaInfo,
        filtros: {
          monthLabel,
          tipo,
          courtName: courtId !== 'todos' ? (courts.find((c) => c.id === courtId)?.name ?? null) : null,
          sportName: sportId !== 'todos' ? (sports.find((s) => s.id === sportId)?.name ?? null) : null,
          atletaNome,
          perfilLabel: perfilFiltro !== 'todos' ? PERFIL_LABEL[perfilFiltro] : null,
          rateio,
          detalharPorHora: true,
        },
        extratoDoAtleta: { nome: atletaNome, resumo: resumoDoAtleta },
        formatDate,
        formatHorario,
        formatDiaSemana,
        formatCurrency,
        fileName: `extrato-${slugify(atletaNome)}-${startDate}-${endDate}`,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar PDF do atleta')
    } finally {
      setExportingAthleteId(null)
    }
  }

  const sortedRows = useMemo(
    () => deriveDisplayRows(rows, statusFiltro, agruparPorAtleta, sortKey, sortDir),
    [rows, statusFiltro, agruparPorAtleta, sortKey, sortDir]
  )

  // Filtro de status → ordenação da tela. Alimenta a tabela e as exportações
  // (Excel/PDF), que saem na mesma ordem que o gestor está vendo.
  const visibleAthleteSummaries = useMemo(
    () =>
      sortAthleteSummaries(
        statusFiltro === 'todos'
          ? athleteSummaries
          : athleteSummaries.filter((s) => s.status === statusFiltro),
        summarySortKey,
        summarySortDir
      ),
    [athleteSummaries, statusFiltro, summarySortKey, summarySortDir]
  )

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const paginatedRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const monthLabel = monthOptions.find((m) => m.value === selectedMonth)?.label ?? selectedMonth

  const filtrosAplicadosTexto = [
    ...buildAppliedFiltersDescription({
      monthLabel,
      tipo,
      courtName: courtId !== 'todos' ? (courts.find((c) => c.id === courtId)?.name ?? null) : null,
      sportName: sportId !== 'todos' ? (sports.find((sp) => sp.id === sportId)?.name ?? null) : null,
      atletaNome: atleta?.nome_perfil ?? null,
      perfilLabel: perfilFiltro !== 'todos' ? PERFIL_LABEL[perfilFiltro] : null,
      rateio,
      detalharPorHora,
    }),
    ...(statusFiltro !== 'todos' ? [{ label: 'Status', value: statusFiltro }] : []),
  ]
    .map((f) => `${f.label}: ${f.value}`)
    .join(' · ')

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Acompanhe pagamentos de reservas, comandas e rotativos da sua arena
        </p>
      </div>

      {/* Summary cards — os 4 numa linha só a partir de lg; empilham em 2 no tablet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pagamentos Confirmados</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(summary.totalPago)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{summary.countPago} lançamento{summary.countPago !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pagamentos Pendentes</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(summary.totalPendente)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{summary.countPendente} lançamento{summary.countPendente !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-2 bg-red-50 rounded-lg">
              <XCircle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cancelados</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(summary.totalCancelado)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{summary.countCancelado} lançamento{summary.countCancelado !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>

        {/* Fechamento do mês: o que cobrar (cancelado fica de fora) e quanto tempo de espaço isso representa */}
        <Card>
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-2 bg-arena-button/10 rounded-lg">
              <Receipt className="h-6 w-6 text-arena-button" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total a cobrar</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(summary.totalACobrar)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Pago + pendente, sem cancelados
                {summary.totalHoras > 0 && ` · ${formatHoras(summary.totalHoras)} ocupadas`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quanto o atleta filtrado deve no mês — só aparece com Atleta selecionado */}
      {atleta && athleteDebt && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 flex items-start gap-4">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <CalendarClock className="h-6 w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {atleta.nome_perfil} deve de Mensal
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(athleteDebt.mensal)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{monthLabel}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-start gap-4">
              <div className="p-2 bg-teal-50 rounded-lg">
                <Wallet className="h-6 w-6 text-teal-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {atleta.nome_perfil} deve de Avulso
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(athleteDebt.avulso)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{monthLabel}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <SectionToggle
              aberta={!secoesRecolhidas.filtros}
              onToggle={() => alternarSecao('filtros')}
              controla="filtros-pagamentos"
            >
              <Filter className="h-4 w-4 shrink-0 text-arena-button" />
              <h2 className="text-base font-bold text-arena-navy-800">Filtros</h2>
            </SectionToggle>
            {/* Minimizado, mostra o que está aplicado — senão o gestor perde o contexto do recorte. */}
            {secoesRecolhidas.filtros && (
              <p className="min-w-0 text-xs text-arena-navy-800/50">{filtrosAplicadosTexto}</p>
            )}
          </div>

          <div
            id="filtros-pagamentos"
            className={cn('mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4', secoesRecolhidas.filtros && 'hidden')}
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Período</label>
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
                <SelectTrigger className="h-9">
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

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Perfil de Atleta</label>
              <Select value={perfilFiltro} onValueChange={handlePerfilChange}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {PERFIS_ATLETA.map((perfil) => (
                    <SelectItem key={perfil} value={perfil}>
                      {PERFIL_LABEL[perfil]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AthleteFilterField
              arenaId={arenaId}
              selected={atleta}
              onSelect={handleAtletaSelect}
              onClear={handleAtletaClear}
            />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Status Pagamento</label>
              <Select value={statusFiltro} onValueChange={handleStatusFiltroChange}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Tipo de Jogo</label>
              <Select value={tipo} onValueChange={handleTipoChange}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="avulso">Avulso</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Ocupação</label>
              <div className="flex h-9 items-center gap-2">
                <Checkbox
                  id="detalhar-por-hora"
                  checked={detalharPorHora}
                  onCheckedChange={(checked) => handleDetalharChange(checked === true)}
                  className="data-[state=checked]:border-arena-button data-[state=checked]:bg-arena-button"
                />
                <label
                  htmlFor="detalhar-por-hora"
                  className="cursor-pointer text-xs font-medium whitespace-nowrap text-arena-navy-800/60"
                >
                  Detalhar por hora
                </label>
              </div>
            </div>

            {detalharPorHora && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Agrupamento</label>
                <div className="flex h-9 items-center gap-2">
                  <Checkbox
                    id="agrupar-por-atleta"
                    checked={agruparPorAtleta}
                    onCheckedChange={(checked) => handleAgruparChange(checked === true)}
                    className="data-[state=checked]:border-arena-button data-[state=checked]:bg-arena-button"
                  />
                  <label
                    htmlFor="agrupar-por-atleta"
                    className="cursor-pointer text-xs font-medium whitespace-nowrap text-arena-navy-800/60"
                  >
                    Agrupar por atleta
                  </label>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label
                className={cn(
                  "text-xs font-medium",
                  tipo === 'mensal' ? "text-gray-500" : "text-gray-300"
                )}
              >
                Rateio
              </label>
              <div className="flex h-9 items-center gap-2">
                <Checkbox
                  id="rateio-filtro"
                  checked={rateio}
                  disabled={tipo !== 'mensal'}
                  onCheckedChange={(checked) => handleRateioChange(checked === true)}
                  className="data-[state=checked]:border-arena-button data-[state=checked]:bg-arena-button"
                />
                <label
                  htmlFor="rateio-filtro"
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    tipo === 'mensal' ? "text-arena-navy-800/60 cursor-pointer" : "text-arena-navy-800/25"
                  )}
                >
                  Ver linha a linha
                </label>
              </div>
            </div>

            {courts.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Espaço</label>
                <Select value={courtId} onValueChange={handleCourtChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os espaços</SelectItem>
                    {courts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sports.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Esporte</label>
                <Select value={sportId} onValueChange={handleSportChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os esportes</SelectItem>
                    {sports.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className={cn('mt-4 flex justify-end', secoesRecolhidas.filtros && 'hidden')}>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              disabled={isPending}
            >
              <Filter className="h-4 w-4" />
              {isPending ? 'Filtrando...' : 'Filtrar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AthleteSummaryCard
        arenaId={arenaId}
        competencia={selectedMonth}
        monthLabel={monthLabel}
        summaries={visibleAthleteSummaries}
        showHoras={detalharPorHora}
        isPending={isPending}
        exportingAthleteId={exportingAthleteId}
        onExportPdf={handleExportPdfForAthlete}
        sortKey={summarySortKey}
        sortDir={summarySortDir}
        onSort={handleSummarySort}
        recolhido={secoesRecolhidas.resumo}
        onToggle={() => alternarSecao('resumo')}
      />

      {/* Table */}
      <Card className="rounded-lg border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 px-6 py-4',
            !secoesRecolhidas.lancamentos && 'border-b border-slate-100'
          )}
        >
          <SectionToggle
            aberta={!secoesRecolhidas.lancamentos}
            onToggle={() => alternarSecao('lancamentos')}
            controla="lancamentos-pagamentos"
          >
            <div className="min-w-0">
              <h2 className="text-base font-bold text-arena-navy-800">Lançamentos</h2>
              <p className="text-xs text-arena-navy-800/40">
                {monthLabel}
                {!isPending && ` · ${sortedRows.length} lançamento${sortedRows.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </SectionToggle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExportExcel}
              disabled={rows.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExportPdf}
              disabled={rows.length === 0 || isExportingPdf}
            >
              {isExportingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin text-red-600" />
              ) : (
                <FileText className="h-4 w-4 text-red-600" />
              )}
              Exportar PDF
            </Button>
          </div>
        </div>

        <div id="lancamentos-pagamentos" className={cn(secoesRecolhidas.lancamentos && 'hidden')}>
          <div className="overflow-x-auto px-6">
            <table className={arenaDataTable.table}>
              <thead>
                <tr className={arenaDataTable.theadRow}>
                  <SortableTh label="Data" sortKey="data" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                  <SortableTh label="Horário" sortKey="horario" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                  {showDiaSemanaColumn && (
                    <SortableTh label="Dia da Semana" sortKey="diaSemana" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                  )}
                  <SortableTh label="Atleta" sortKey="atleta" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                  <SortableTh label="Serviço" sortKey="servico" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                  <SortableTh label="Espaço" sortKey="espaco" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                  <SortableTh label="Esporte" sortKey="esporte" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                  <SortableTh
                    label="Valor"
                    sortKey="valor"
                    activeKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                    className="text-arena-button"
                  />
                  <SortableTh
                    label="Status"
                    sortKey="status"
                    activeKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                    align="right"
                    className="w-28"
                  />
                  <th className={cn(arenaDataTable.thRight, "w-14")}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {isPending ? (
                  <tr>
                    <td colSpan={showDiaSemanaColumn ? 10 : 9} className={arenaDataTable.emptyCell}>
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-arena-button" />
                        Carregando lançamentos...
                      </div>
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={showDiaSemanaColumn ? 10 : 9} className={arenaDataTable.emptyCell}>
                      Nenhum lançamento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => {
                    const sc = statusConfig[row.status]
                    return (
                      <tr key={row.id} className={arenaDataTable.tbodyRow}>
                        <td className={cn(arenaDataTable.td, "whitespace-nowrap text-arena-navy-800/60")}>
                          {formatDataCell(row)}
                        </td>
                        <td className={cn(arenaDataTable.td, "whitespace-nowrap text-arena-navy-800/60")}>
                          {formatHorario(row)}
                        </td>
                        {showDiaSemanaColumn && (
                          <td className={cn(arenaDataTable.td, "whitespace-nowrap text-arena-navy-800/60")}>
                            {formatDiaSemana(row)}
                          </td>
                        )}
                        <td className={arenaDataTable.tdBold}>
                          {row.atleta ?? (
                            <span className="font-medium text-arena-navy-800/45">Avulsa</span>
                          )}
                        </td>
                        <td className={arenaDataTable.td}>
                          <span className="inline-flex items-center rounded-full bg-arena-navy-800/5 px-2.5 py-0.5 text-xs font-medium text-arena-navy-800">
                            {row.servico}
                          </span>
                        </td>
                        <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                          {row.espaco ?? <span className="text-arena-navy-800/30">—</span>}
                        </td>
                        <td className={cn(arenaDataTable.td, "text-arena-navy-800/60")}>
                          {row.esporte ?? <span className="text-arena-navy-800/30">—</span>}
                        </td>
                        <td className={cn(arenaDataTable.td, "whitespace-nowrap text-arena-button font-black")}>
                          {row.valor != null ? formatCurrency(row.valor) : <span className="text-arena-navy-800/30 font-medium">—</span>}
                        </td>
                        <td className={arenaDataTable.tdRight}>
                          <Badge variant="outline" className={sc.className}>
                            {sc.label}
                          </Badge>
                        </td>
                        <td className={arenaDataTable.tdRight}>
                          <div className="flex items-center justify-end gap-1">
                            <SendTemplateMessageButton
                              arenaId={arenaId}
                              competencia={selectedMonth}
                              athlete={
                                row.atletaId
                                  ? { id: row.atletaId, nome: row.atleta ?? "Atleta", telefone: row.telefone ?? null }
                                  : null
                              }
                            />
                            {row.atletaId && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-arena-navy-800/40 hover:bg-arena-navy-800/5 hover:text-arena-navy-800"
                                title="Extrato de uso deste atleta (PDF)"
                                disabled={exportingAthleteId === row.atletaId}
                                onClick={() => handleExportPdfForAthlete(row.atletaId as string, row.atleta ?? "Atleta")}
                              >
                                {exportingAthleteId === row.atletaId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FileText className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <p className="text-xs text-arena-navy-800/40">
              {sortedRows.length === 0
                ? '0 resultados'
                : `Exibindo ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sortedRows.length)} de ${sortedRows.length}`}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-white"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === 'ellipsis' ? (
                    <span key={`e-${i}`} className="px-1 text-xs text-arena-navy-800/30">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-8 w-8 text-xs font-bold",
                        page === p
                          ? "border-transparent bg-arena-navy-800 text-white hover:bg-arena-navy-800/90 hover:text-white"
                          : "bg-white text-arena-navy-800/60"
                      )}
                      onClick={() => setPage(p as number)}
                    >
                      {p}
                    </Button>
                  )
                )}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-white"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
