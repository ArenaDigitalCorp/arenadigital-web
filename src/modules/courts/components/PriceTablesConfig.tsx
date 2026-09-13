'use client'

import { useCallback, useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Copy, Trash2, Star, Eraser, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { DayCard } from '@/modules/courts/components/DayCard'
import { DaySchedulePanel } from '@/modules/courts/components/DaySchedulePanel'
import {
  createCourtPriceTableAction,
  deleteCourtPriceTableAction,
  listCourtPriceTablesAction,
  setDefaultCourtPriceTableAction,
  upsertCourtPriceTableAction,
} from '@/modules/courts/actions/priceTableActions'
import {
  MAX_PRICE_TABLES_PER_COURT,
  defaultPriceTableName,
  isReservedPriceTableKind,
  type CourtPriceTable,
  type CourtPriceDay,
} from '@/modules/courts/types/price-table.types'
import {
  DAY_NAMES,
  DAY_SHORT_NAMES,
  EDITOR_DAY_ORDER,
  copyDaysFrom,
  courtPriceDayToDayConfig,
  dayConfigToCourtPriceDay,
  priceTableFromLegacyDayConfig,
  toEditorDays,
} from '@/modules/courts/lib/price-table-editor'
import type { DayConfig } from '@/modules/courts/lib/day-schedule'

/**
 * O formulário do espaço tem **um** botão de salvar. No modo persistido é ele
 * que dispara a gravação das tabelas, via `ref`.
 */
export type PriceTablesHandle = {
  /** Grava as tabelas alteradas. `false` ⇒ já avisou o gestor por toast. */
  saveAll: () => Promise<boolean>
  hasPendingChanges: () => boolean
}

interface PriceTablesConfigProps {
  arenaId: string
  /** Modo persistido (edição): o espaço já existe; o pai salva pelo `ref`. */
  courtId?: string
  /** `day_config` atual do espaço, usado como fallback enquanto a Padrão não carrega. */
  fallbackDayConfig?: unknown
  /** Modo rascunho (cadastro): o pai é dono do estado e persiste ao salvar o espaço. */
  draftTables?: CourtPriceTable[]
  onDraftChange?: (tables: CourtPriceTable[]) => void
  ref?: Ref<PriceTablesHandle>
}

type EditorTable = CourtPriceTable & { editorDays: CourtPriceDay[]; dirty: boolean }

function toEditor(table: CourtPriceTable): EditorTable {
  return { ...table, editorDays: toEditorDays(table.days), dirty: false }
}

const keyOf = (t: { id?: string; tipo: string }) => t.id ?? t.tipo

export function PriceTablesConfig({
  arenaId,
  courtId,
  fallbackDayConfig,
  draftTables,
  onDraftChange,
  ref,
}: PriceTablesConfigProps) {
  const isDraft = !!draftTables && !!onDraftChange

  const [loaded, setLoaded] = useState<EditorTable[] | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Dias em edição. Um só, ou vários quando o gestor liga a edição em lote. */
  const [selectedDows, setSelectedDows] = useState<number[]>([EDITOR_DAY_ORDER[0]])
  const [batchMode, setBatchMode] = useState(false)
  /** Tabela para a qual já escolhemos um dia automaticamente. */
  const [autoPickedFor, setAutoPickedFor] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (isDraft || !courtId) return
    setLoadError(null)
    const res = await listCourtPriceTablesAction(arenaId, courtId)
    if (!res.success) {
      setLoadError(res.error ?? 'Erro ao carregar tabelas de preço')
      setLoaded([])
      return
    }
    if (res.data.length === 0) {
      const fallback = priceTableFromLegacyDayConfig(courtId, arenaId, fallbackDayConfig)
      setLoaded([toEditor(fallback)])
      return
    }
    const editors = res.data.map(toEditor)
    setLoaded(editors)
    setActiveKey(
      (prev) =>
        prev ?? keyOf(editors.find((t) => t.tipo === 'padrao') ?? editors[0])
    )
  }, [arenaId, courtId, fallbackDayConfig, isDraft])

  useEffect(() => {
    void load()
  }, [load])

  const draftEditors = useMemo(
    () => (draftTables ?? []).map(toEditor),
    [draftTables]
  )
  const tables: EditorTable[] | null = isDraft ? draftEditors : loaded

  const active = useMemo(
    () => tables?.find((t) => keyOf(t) === activeKey) ?? tables?.[0] ?? null,
    [tables, activeKey]
  )
  const padrao = useMemo(() => tables?.find((t) => t.tipo === 'padrao') ?? null, [tables])

  const patchActive = (patch: { nome?: string; editorDays?: CourtPriceDay[] }) => {
    if (!active) return
    if (isDraft) {
      onDraftChange!(
        draftTables!.map((t) => {
          if (t.tipo !== active.tipo) return t
          return {
            ...t,
            ...(patch.nome !== undefined ? { nome: patch.nome } : {}),
            ...(patch.editorDays ? { days: patch.editorDays } : {}),
          }
        })
      )
      return
    }
    setLoaded(
      (prev) =>
        prev?.map((t) =>
          keyOf(t) === keyOf(active) ? { ...t, ...patch, dirty: true } : t
        ) ?? prev
    )
  }

  /**
   * Escreve a configuração do dia líder nos dias selecionados. Com mais de um
   * selecionado eles ficam iguais — é a semântica anunciada no painel, a mesma
   * do "Replicar", só que com alvo escolhido.
   */
  const handleDayChange = (nextConfig: DayConfig) => {
    if (!active) return
    patchActive({
      editorDays: active.editorDays.map((d) =>
        selectedDows.includes(d.diaSemana)
          ? // `enabled` continua sendo do próprio dia: quem abre e fecha é o
            // interruptor do card, nunca um efeito colateral de editar preço.
            { ...dayConfigToCourtPriceDay(d.diaSemana, nextConfig), enabled: d.enabled }
          : d
      ),
    })
  }

  const handleDayToggle = (dow: number, enabled: boolean) => {
    if (!active) return
    patchActive({
      editorDays: active.editorDays.map((d) =>
        d.diaSemana === dow ? { ...d, enabled } : d
      ),
    })
    if (enabled && !selectedDows.includes(dow)) {
      setSelectedDows(batchMode ? [...selectedDows, dow] : [dow])
    }
  }

  const handleSelectDay = (dow: number) => {
    if (!batchMode) {
      setSelectedDows([dow])
      return
    }
    setSelectedDows((prev) => {
      if (prev.includes(dow)) {
        const next = prev.filter((x) => x !== dow)
        return next.length > 0 ? next : prev
      }
      return [...prev, dow]
    })
  }

  const handleReplicate = () => {
    if (!active) return
    const sourceDow = selectedDows[0]
    const src = active.editorDays.find((d) => d.diaSemana === sourceDow)
    if (!src) return
    patchActive({
      editorDays: active.editorDays.map((d) =>
        d.diaSemana === sourceDow
          ? d
          : {
              ...d,
              enabled: true,
              startTime: src.startTime,
              endTime: src.endTime,
              slotShiftTime: src.slotShiftTime,
              basePrice: src.basePrice,
              bands: src.bands.map((b) => ({ ...b, id: undefined })),
            }
      ),
    })
    toast.success(`${DAY_NAMES[sourceDow]} replicada para os outros dias.`)
  }

  const handleCopyFromPadrao = () => {
    if (!active || !padrao) return
    patchActive({ editorDays: copyDaysFrom(padrao) })
    toast.success('Faixas da tabela Padrão copiadas. Ajuste o que for diferente.')
  }

  const handleClear = () => {
    if (!active) return
    patchActive({
      editorDays: active.editorDays.map((d) => ({ ...d, enabled: false, bands: [] })),
    })
    toast.success('Todos os dias desta tabela foram fechados.')
  }

  /**
   * Grava as tabelas com edição pendente. Chamada pelo botão único do formulário
   * e antes das operações estruturais (criar / definir padrão / excluir), que
   * recarregam do servidor e descartariam o que estivesse na tela.
   */
  const saveDirtyTables = useCallback(
    async (skipId?: string): Promise<boolean> => {
      if (isDraft || !courtId) return true
      const pending = (loaded ?? []).filter((t) => t.dirty && t.id && t.id !== skipId)
      if (pending.length === 0) return true

      for (const table of pending) {
        const res = await upsertCourtPriceTableAction(arenaId, {
          tableId: table.id,
          courtId,
          nome: table.nome.trim() || defaultPriceTableName(table.tipo),
          tipo: table.tipo,
          isDefault: table.isDefault,
          aplicaA: table.aplicaA,
          ativo: table.ativo,
          ordem: table.ordem,
          days: EDITOR_DAY_ORDER.map((dow) => {
            const d = table.editorDays.find((x) => x.diaSemana === dow)!
            return {
              diaSemana: dow,
              enabled: d.enabled,
              startTime: d.startTime,
              endTime: d.endTime,
              slotShiftTime: d.slotShiftTime,
              basePrice: d.basePrice,
              bands: d.bands.map((b) => ({ start: b.start, end: b.end, price: b.price })),
            }
          }),
        })
        if (!res.success) {
          toast.error(
            res.error ?? `Erro ao salvar a tabela "${table.nome || defaultPriceTableName(table.tipo)}"`
          )
          return false
        }
      }

      await load()
      return true
    },
    [arenaId, courtId, isDraft, load, loaded]
  )

  useImperativeHandle(
    ref,
    () => ({
      saveAll: () => saveDirtyTables(),
      hasPendingChanges: () => (loaded ?? []).some((t) => t.dirty),
    }),
    [loaded, saveDirtyTables]
  )

  const handleCreate = async () => {
    if (!courtId) return
    setBusy(true)
    try {
      if (!(await saveDirtyTables())) return
      const res = await createCourtPriceTableAction(arenaId, {
        courtId,
        nome: 'Nova tabela de preços',
      })
      if (!res.success || !res.data) {
        toast.error(res.error ?? 'Erro ao criar tabela de preços')
        return
      }
      await load()
      setActiveKey(res.data.id ?? null)
      toast.success('Tabela de preços criada. Dê um nome, configure os dias e salve.')
    } finally {
      setBusy(false)
    }
  }

  const handleSetDefault = async () => {
    if (!active?.id || !courtId) return
    setBusy(true)
    try {
      if (!(await saveDirtyTables())) return
      const res = await setDefaultCourtPriceTableAction(arenaId, courtId, active.id)
      if (!res.success) {
        toast.error(res.error ?? 'Erro ao definir a tabela padrão')
        return
      }
      await load()
      toast.success(`"${active.nome}" agora é a tabela padrão (reserva avulsa e app).`)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!active?.id || !courtId) return
    if (!confirm(`Excluir a tabela de preços "${active.nome}"? Esta ação não pode ser desfeita.`)) return
    setBusy(true)
    try {
      // A tabela que está saindo não precisa ser gravada antes de morrer.
      if (!(await saveDirtyTables(active.id))) return
      const res = await deleteCourtPriceTableAction(arenaId, courtId, active.id)
      if (!res.success) {
        toast.error(res.error ?? 'Erro ao excluir a tabela de preços')
        return
      }
      setActiveKey(null)
      await load()
      toast.success('Tabela de preços excluída.')
    } finally {
      setBusy(false)
    }
  }

  if (tables === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando tabelas de preço…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p>{loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  const persisted = tables.some((t) => t.id)
  const dirtyCount = tables.filter((t) => t.dirty).length
  const enabledCount = (t: EditorTable) => t.editorDays.filter((d) => d.enabled).length
  const activeEnabled = active ? enabledCount(active) : 0
  const padraoEnabled = padrao ? enabledCount(padrao) : 0
  const canEditActive = isDraft || !!active?.id

  const dayOf = (dow: number) =>
    active?.editorDays.find((d) => d.diaSemana === dow) ?? null

  // Ao carregar e ao trocar de tabela, abre num dia que aquela tabela de fato
  // usa — a Professor costuma abrir menos dias que a Padrão, e cair num dia
  // fechado mostraria um painel vazio. O dia escolhido pelo gestor é preservado
  // sempre que continua aberto na tabela nova.
  const activeTableKey = active ? keyOf(active) : null
  if (active && autoPickedFor !== activeTableKey) {
    setAutoPickedFor(activeTableKey)
    if (!dayOf(selectedDows[0])?.enabled) {
      const firstOpen = EDITOR_DAY_ORDER.find((dow) => dayOf(dow)?.enabled)
      if (firstOpen !== undefined) setSelectedDows([firstOpen])
    }
  }

  const leadDow = selectedDows[0]
  const leadDay = dayOf(leadDow)
  const leadConfig = leadDay ? courtPriceDayToDayConfig(leadDay) : null
  const batchNames = selectedDows.slice(1).map((dow) => DAY_NAMES[dow])

  return (
    <div className="space-y-4">
      {/* ── Tabelas de preço do espaço ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {tables.map((t) => {
          const days = enabledCount(t)
          return (
            <button
              key={keyOf(t)}
              type="button"
              onClick={() => setActiveKey(keyOf(t))}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                keyOf(active ?? t) === keyOf(t)
                  ? 'border-arena-button bg-arena-button/10 text-arena-button'
                  : 'border-border text-muted-foreground hover:bg-muted/50'
              )}
            >
              {t.nome || defaultPriceTableName(t.tipo)}
              {t.isDefault && <Star className="h-3 w-3 fill-current" />}
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[10px] font-bold',
                  days > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {days > 0 ? `${days}d` : 'vazia'}
              </span>
              {!t.ativo && <span className="text-[10px] font-medium opacity-60">(inativa)</span>}
              {t.dirty && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                  title="Alterações ainda não salvas"
                />
              )}
            </button>
          )
        })}
        {!isDraft && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCreate}
            disabled={!persisted || busy || tables.length >= MAX_PRICE_TABLES_PER_COURT}
            className="h-7 text-xs text-arena-button hover:bg-orange-50 disabled:opacity-40"
            title={
              tables.length >= MAX_PRICE_TABLES_PER_COURT
                ? `Limite de ${MAX_PRICE_TABLES_PER_COURT} tabelas de preços por espaço`
                : 'Criar uma tabela de preços personalizada'
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Nova tabela de Preços
          </Button>
        )}
      </div>

      {isDraft ? (
        <p
          className={cn(
            'rounded-lg border px-3 py-2 text-[11px]',
            padraoEnabled === 0
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-border bg-muted/40 text-muted-foreground'
          )}
        >
          {padraoEnabled === 0 ? (
            <>
              A tabela <strong>Padrão</strong> é obrigatória — abra ao menos um dia nela.
              Mensalista e Professor são opcionais e podem ser preenchidas agora
              (copiando da Padrão) ou depois.
            </>
          ) : (
            <>
              Padrão configurada em {padraoEnabled}{' '}
              {padraoEnabled === 1 ? 'dia' : 'dias'}. Mensalista e Professor são
              opcionais — use <strong>Copiar faixas da tabela Padrão</strong> e ajuste
              só o que muda. Outras tabelas de preços podem ser criadas depois de salvar o espaço.
            </>
          )}
        </p>
      ) : (
        <>
          {!persisted && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              Salve o espaço para habilitar a edição das tabelas Mensalista e Professor. A
              tabela Padrão abaixo é a configuração atual de horários e preços.
            </p>
          )}
          {dirtyCount > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              {dirtyCount === 1
                ? '1 tabela de preços com alterações ainda não salvas'
                : `${dirtyCount} tabelas de preços com alterações ainda não salvas`}{' '}
              — elas são gravadas junto com o espaço em{' '}
              <strong>Salvar Alterações</strong>, no fim da página.
            </p>
          )}
        </>
      )}

      {active && (
        <div className="space-y-4 rounded-xl border border-border p-4">
          {/* ── Cabeçalho da tabela ativa ────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            {isReservedPriceTableKind(active.tipo) ? (
              // Padrão, Mensalista e Professor são identificadas por `tipo` — é
              // por ele que o perfil do cliente vai apontar para a tabela certa.
              // Renomear daria a impressão de que o papel da tabela mudou junto.
              <span
                className="flex h-8 items-center gap-1.5 rounded-md bg-arena-navy-800/[0.04] px-3 text-sm font-semibold text-arena-navy-800"
                title="As tabelas Padrão, Mensalista e Professor têm nome fixo — elas são vinculadas ao perfil do cliente. Crie uma tabela personalizada para usar um nome próprio."
              >
                <Lock className="h-3 w-3 text-muted-foreground" />
                {active.nome || defaultPriceTableName(active.tipo)}
              </span>
            ) : (
              <Input
                value={active.nome}
                onChange={(e) => patchActive({ nome: e.target.value })}
                disabled={!canEditActive}
                placeholder="Nome da tabela de preços"
                aria-label="Nome da tabela de preços"
                className="h-8 w-48 text-sm font-semibold"
              />
            )}
            <Badge variant="outline" className="text-[10px] uppercase">
              {active.tipo}
            </Badge>
            {active.isDefault && (
              <Badge className="bg-arena-button text-[10px] text-white hover:bg-arena-button">
                Padrão · avulso + app
              </Badge>
            )}
            {isDraft && active.tipo !== 'padrao' && (
              <span className="text-[11px] font-medium text-muted-foreground">opcional</span>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {!isDraft && active.id && !active.isDefault && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSetDefault}
                  disabled={busy}
                  title="Passa a valer na reserva avulsa e no app"
                  className="h-7 text-xs"
                >
                  <Star className="mr-1 h-3 w-3" /> Usar como tabela padrão
                </Button>
              )}
              {active.tipo !== 'padrao' && padrao && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyFromPadrao}
                  disabled={!canEditActive || padraoEnabled === 0}
                  className="h-7 text-xs"
                  title={
                    padraoEnabled === 0
                      ? 'Configure a tabela Padrão primeiro'
                      : 'Copia horários, faixas e valores da Padrão'
                  }
                >
                  <Copy className="mr-1 h-3 w-3" /> Copiar faixas da tabela Padrão
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={!canEditActive || activeEnabled === 0}
                title="Fecha todos os dias desta tabela de preços"
                className="h-7 text-xs text-muted-foreground"
              >
                <Eraser className="mr-1 h-3 w-3" /> Limpar tabela
              </Button>
              {!isDraft && active.id && !isReservedPriceTableKind(active.tipo) && !active.isDefault && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={busy}
                  title="Só tabelas personalizadas podem ser excluídas"
                  className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Excluir tabela
                </Button>
              )}
            </div>

            {activeEnabled === 0 && active.tipo !== 'padrao' && (
              <p className="basis-full rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
                Tabela vazia — as reservas desse tipo vão sugerir R$ 0 até ela ser
                preenchida. Copie as faixas da Padrão acima ou abra os dias abaixo.
              </p>
            )}
          </div>

          {/* ── Tira da semana ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {EDITOR_DAY_ORDER.map((dow) => {
              const day = dayOf(dow)
              if (!day) return null
              return (
                <DayCard
                  key={dow}
                  short={DAY_SHORT_NAMES[dow]}
                  full={DAY_NAMES[dow]}
                  config={courtPriceDayToDayConfig(day)}
                  selected={selectedDows.includes(dow)}
                  onSelect={() => handleSelectDay(dow)}
                  onToggle={(enabled) => handleDayToggle(dow, enabled)}
                />
              )
            })}
          </div>

          {/* ── Modo de edição ───────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              <button
                type="button"
                aria-pressed={!batchMode}
                onClick={() => {
                  setBatchMode(false)
                  setSelectedDows((prev) => prev.slice(0, 1))
                }}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  !batchMode ? 'bg-arena-navy-800 text-white' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                Editar um dia
              </button>
              <button
                type="button"
                aria-pressed={batchMode}
                onClick={() => setBatchMode(true)}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  batchMode ? 'bg-arena-navy-800 text-white' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                Editar vários dias
              </button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {batchMode
                ? `Clique nos cards para incluir ou tirar da seleção — ${selectedDows.length} ${
                    selectedDows.length === 1 ? 'dia selecionado' : 'dias selecionados'
                  }.`
                : 'Clique num card para editar aquele dia.'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReplicate}
              disabled={!canEditActive || batchMode || !leadDay?.enabled}
              title={`Aplica o horário e os preços de ${DAY_NAMES[leadDow]} a todos os outros dias`}
              className="ml-auto h-7 text-xs"
            >
              <Copy className="mr-1 h-3 w-3" /> Replicar para todos os dias
            </Button>
          </div>

          {/* ── Painel do dia ────────────────────────────────────────── */}
          <div className="rounded-xl border border-border">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="text-sm font-semibold text-arena-navy-800">
                {selectedDows.length > 1
                  ? `${selectedDows.length} dias selecionados`
                  : DAY_NAMES[leadDow]}
              </span>
              {leadDay?.enabled ? (
                <Badge className="bg-arena-status-active px-2 text-[10px] font-medium text-white hover:bg-arena-status-active">
                  Aberto
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  Fechado
                </Badge>
              )}
            </div>

            {leadConfig && leadDay?.enabled ? (
              <DaySchedulePanel
                key={`${keyOf(active)}-${leadDow}`}
                config={leadConfig}
                onChange={handleDayChange}
                batchDays={batchNames}
              />
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {DAY_NAMES[leadDow]} está fechado nesta tabela. Ligue o interruptor no card
                para configurar horário e preços.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
