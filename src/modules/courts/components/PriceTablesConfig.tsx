'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Copy, Trash2, Star, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { DayScheduleConfig } from '@/modules/courts/components/DayScheduleConfig'
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
  EDITOR_DAY_ORDER,
  copyDaysFrom,
  courtPriceDayToDayConfig,
  dayConfigToCourtPriceDay,
  priceTableFromLegacyDayConfig,
  toEditorDays,
} from '@/modules/courts/lib/price-table-editor'

interface PriceTablesConfigProps {
  arenaId: string
  /** Modo persistido (edição): o espaço já existe e cada tabela salva sozinha. */
  courtId?: string
  /** `day_config` atual do espaço, usado como fallback enquanto a Padrão não carrega. */
  fallbackDayConfig?: unknown
  /** Modo rascunho (cadastro): o pai é dono do estado e persiste ao salvar o espaço. */
  draftTables?: CourtPriceTable[]
  onDraftChange?: (tables: CourtPriceTable[]) => void
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
}: PriceTablesConfigProps) {
  const isDraft = !!draftTables && !!onDraftChange

  const [loaded, setLoaded] = useState<EditorTable[] | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  const handleDayChange = (
    dow: number,
    nextConfig: Parameters<typeof DayScheduleConfig>[0]['config']
  ) => {
    if (!active) return
    patchActive({
      editorDays: active.editorDays.map((d) =>
        d.diaSemana === dow ? dayConfigToCourtPriceDay(dow, nextConfig) : d
      ),
    })
  }

  const handleReplicate = (sourceDow: number) => {
    if (!active) return
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
    toast.success('Configuração replicada para todos os dias.')
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
  }

  const handleSave = async () => {
    if (!active?.id || !courtId) return
    setSavingId(active.id)
    try {
      const res = await upsertCourtPriceTableAction(arenaId, {
        tableId: active.id,
        courtId,
        nome: active.nome.trim() || defaultPriceTableName(active.tipo),
        tipo: active.tipo,
        isDefault: active.isDefault,
        aplicaA: active.aplicaA,
        ativo: active.ativo,
        ordem: active.ordem,
        days: EDITOR_DAY_ORDER.map((dow) => {
          const d = active.editorDays.find((x) => x.diaSemana === dow)!
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
        toast.error(res.error ?? 'Erro ao salvar a tabela')
        return
      }
      toast.success(`Tabela "${active.nome}" salva.`)
      await load()
    } finally {
      setSavingId(null)
    }
  }

  const handleCreate = async () => {
    if (!courtId) return
    setBusy(true)
    try {
      const res = await createCourtPriceTableAction(arenaId, { courtId, nome: 'Nova tabela' })
      if (!res.success || !res.data) {
        toast.error(res.error ?? 'Erro ao criar tabela')
        return
      }
      await load()
      setActiveKey(res.data.id ?? null)
      toast.success('Tabela criada. Configure as faixas e salve.')
    } finally {
      setBusy(false)
    }
  }

  const handleSetDefault = async () => {
    if (!active?.id || !courtId) return
    setBusy(true)
    try {
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
    if (!confirm(`Excluir a tabela "${active.nome}"? Esta ação não pode ser desfeita.`)) return
    setBusy(true)
    try {
      const res = await deleteCourtPriceTableAction(arenaId, courtId, active.id)
      if (!res.success) {
        toast.error(res.error ?? 'Erro ao excluir')
        return
      }
      setActiveKey(null)
      await load()
      toast.success('Tabela excluída.')
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
  const enabledCount = (t: EditorTable) => t.editorDays.filter((d) => d.enabled).length
  const activeEnabled = active ? enabledCount(active) : 0
  const activeIsEmpty = !!active && activeEnabled === 0
  const padraoEnabled = padrao ? enabledCount(padrao) : 0

  return (
    <div className="space-y-4">
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
                ? `Limite de ${MAX_PRICE_TABLES_PER_COURT} tabelas`
                : 'Nova tabela de preço'
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Nova tabela
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
              A tabela <strong>Padrão</strong> é obrigatória — habilite ao menos um dia
              nela. Mensalista e Professor são opcionais e podem ser preenchidas agora
              (copiando da Padrão) ou depois.
            </>
          ) : (
            <>
              Padrão configurada em {padraoEnabled}{' '}
              {padraoEnabled === 1 ? 'dia' : 'dias'}. Mensalista e Professor são
              opcionais — use <strong>Copiar faixas da tabela Padrão</strong> e ajuste
              só o que muda. Você pode criar outras tabelas depois de salvar o espaço.
            </>
          )}
        </p>
      ) : (
        !persisted && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            Salve o espaço para habilitar a edição das tabelas Mensalista e Professor. A
            tabela Padrão abaixo é a configuração atual de horários e preços.
          </p>
        )
      )}

      {active && (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Input
                value={active.nome}
                onChange={(e) => patchActive({ nome: e.target.value })}
                disabled={!isDraft && !active.id}
                className="h-8 w-48 text-sm font-semibold"
              />
              <Badge variant="outline" className="text-[10px] uppercase">
                {active.tipo}
              </Badge>
              {active.isDefault && (
                <Badge className="bg-arena-button text-[10px] text-white hover:bg-arena-button">
                  Padrão · avulso + app
                </Badge>
              )}
              {isDraft && active.tipo !== 'padrao' && (
                <span className="text-[11px] font-medium text-muted-foreground">
                  opcional
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {!isDraft && active.id && !active.isDefault && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSetDefault}
                  disabled={busy}
                  className="h-7 text-xs"
                >
                  <Star className="mr-1 h-3 w-3" /> Definir como padrão
                </Button>
              )}
              {!isDraft && active.id && !isReservedPriceTableKind(active.tipo) && !active.isDefault && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={busy}
                  className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Excluir
                </Button>
              )}
            </div>
          </div>

          {active.tipo !== 'padrao' && padrao && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyFromPadrao}
                disabled={(!isDraft && !active.id) || padraoEnabled === 0}
                className="h-7 text-xs"
                title={
                  padraoEnabled === 0
                    ? 'Configure a tabela Padrão primeiro'
                    : 'Copia horários, faixas e valores da Padrão'
                }
              >
                <Copy className="mr-1 h-3 w-3" /> Copiar faixas da tabela Padrão
              </Button>
              {activeEnabled > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-7 text-xs text-muted-foreground"
                >
                  Limpar tabela
                </Button>
              )}
            </div>
          )}

          {activeIsEmpty && active.tipo !== 'padrao' && (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
              Tabela vazia — as reservas desse tipo vão sugerir R$ 0 até ela ser
              preenchida. Copie as faixas da Padrão acima ou habilite os dias abaixo.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4">
            {active.editorDays.map((day) => (
              <DayScheduleConfig
                key={`${keyOf(active)}-${day.diaSemana}`}
                day={courtPriceDayToDayConfig(day).day}
                config={courtPriceDayToDayConfig(day)}
                onChange={(next) => handleDayChange(day.diaSemana, next)}
                onReplicate={() => handleReplicate(day.diaSemana)}
              />
            ))}
          </div>

          {!isDraft && (
            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              {active.dirty && (
                <span className="text-[11px] font-medium text-amber-600">
                  Alterações não salvas
                </span>
              )}
              <Button
                type="button"
                onClick={handleSave}
                disabled={!active.id || savingId === active.id}
                className="h-8 bg-arena-button text-white hover:bg-arena-button-hover"
              >
                {savingId === active.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Salvar tabela
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
