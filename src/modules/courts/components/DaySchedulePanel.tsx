"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"
import {
    configFromTiers,
    countSlots,
    createBandId,
    isOvernight as isOvernightDay,
    normalizeTiers,
    normalizeTime,
    slotShiftExample,
    splittableTierIndex,
    suggestSplitPoint,
    tiersFromConfig,
    type DayConfig,
    type PriceTier,
} from "@/modules/courts/lib/day-schedule"

interface DaySchedulePanelProps {
    /** Dia em edição (o primeiro selecionado, quando são vários). */
    config: DayConfig
    onChange: (config: DayConfig) => void
    /**
     * Nomes dos demais dias selecionados. Quando há algum, o pai replica esta
     * configuração para todos eles — o painel só avisa o gestor.
     */
    batchDays?: string[]
}

export function DaySchedulePanel({ config, onChange, batchDays = [] }: DaySchedulePanelProps) {
    const isOvernight = isOvernightDay(config)
    const slotCount = countSlots(config)
    const tiers = tiersFromConfig(config)
    const isBatch = batchDays.length > 0

    // Rascunho local para inputs de horário — evita corrigir a cada tecla.
    // O rascunho é descartado quando a config **de fato** muda; a assinatura é
    // por valor (e não pela identidade do objeto, que o pai recria a cada
    // render) para não limpar o que o gestor está digitando.
    const configSignature = [
        config.startTime,
        config.endTime,
        config.defaultTierId ?? '',
        config.customPrices.map((c) => `${c.start}>${c.end}@${c.price}`).join(','),
    ].join('|')

    const [timeDrafts, setTimeDrafts] = useState<Record<string, string>>({})
    const [lastSignature, setLastSignature] = useState(configSignature)

    if (lastSignature !== configSignature) {
        setLastSignature(configSignature)
        setTimeDrafts({})
    }

    const draftKey = (tierId: string, field: 'start' | 'end') => `${tierId}:${field}`

    const displayTime = (tierId: string, field: 'start' | 'end', stored: string) =>
        timeDrafts[draftKey(tierId, field)] ?? stored

    const commitTiers = useCallback((nextTiers: PriceTier[]) => {
        onChange(configFromTiers(config, normalizeTiers(nextTiers, config)))
    }, [config, onChange])

    const handleOperatingChange = (
        field: 'startTime' | 'endTime' | 'price' | 'slotShiftTime',
        value: string | number | null
    ) => {
        const next = { ...config, [field]: value }
        if (field === 'startTime' || field === 'endTime') {
            onChange(configFromTiers(next, normalizeTiers(tiersFromConfig(next), next)))
            return
        }
        onChange(next)
    }

    const updateTierPrice = (tierId: string, price: number) => {
        commitTiers(tiers.map((t) => t.id === tierId ? { ...t, price } : t))
    }

    const setDefaultTier = (tierId: string) => {
        commitTiers(tiers.map((t) => ({ ...t, isDefault: t.id === tierId })))
    }

    const setTierBoundary = (tierIndex: number, field: 'start' | 'end', rawValue: string) => {
        const tier = tiers[tierIndex]
        setTimeDrafts((prev) => ({ ...prev, [draftKey(tier.id, field)]: rawValue }))
    }

    const commitTierBoundary = (tierIndex: number, field: 'start' | 'end', rawValue: string) => {
        const tier = tiers[tierIndex]
        const key = draftKey(tier.id, field)
        setTimeDrafts((prev) => {
            const next = { ...prev }
            delete next[key]
            return next
        })

        const normalized = normalizeTime(rawValue)
        if (!normalized) return

        const next = tiers.map((t) => ({ ...t }))

        if (field === 'end' && tierIndex < next.length - 1) {
            next[tierIndex].end = normalized
            next[tierIndex + 1].start = normalized
        } else if (field === 'start' && tierIndex > 0) {
            next[tierIndex].start = normalized
            next[tierIndex - 1].end = normalized
        } else if (field === 'end' && tierIndex === next.length - 1) {
            next[tierIndex].end = config.endTime
        } else if (field === 'start' && tierIndex === 0) {
            next[0].start = config.startTime
        }

        commitTiers(next)
    }

    const splittableIndex = splittableTierIndex(tiers, config)
    const canAddTier = splittableIndex !== -1

    const addTier = () => {
        if (splittableIndex === -1) return
        const target = tiers[splittableIndex]
        const split = suggestSplitPoint(target)
        if (!split) return

        const next = tiers.map((t) => ({ ...t }))
        next[splittableIndex] = { ...target, end: split }
        next.splice(splittableIndex + 1, 0, {
            id: createBandId(),
            start: split,
            end: target.end,
            price: target.price,
            isDefault: false,
        })
        commitTiers(next)
    }

    const removeTier = (tierIndex: number) => {
        if (tiers.length <= 1) return

        const removedWasDefault = tiers[tierIndex].isDefault
        const next = tiers.filter((_, i) => i !== tierIndex).map((t) => ({ ...t }))

        for (let i = 0; i < next.length - 1; i++) {
            next[i].end = next[i + 1].start
        }
        if (next.length > 0) {
            next[0].start = config.startTime
            next[next.length - 1].end = config.endTime
        }

        if (removedWasDefault) {
            next.forEach((t, i) => { t.isDefault = i === 0 })
        }

        commitTiers(next)
    }

    const shiftExample = slotShiftExample(config.slotShiftTime)

    return (
        <div className="grid grid-cols-1 md:grid-cols-[264px_minmax(0,1fr)]">
            {/* ── Funcionamento ─────────────────────────────────────────── */}
            <div className="space-y-5 border-b border-border p-4 md:border-b-0 md:border-r">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Abre às
                        </Label>
                        <Input
                            type="time"
                            value={config.startTime}
                            onChange={(e) => handleOperatingChange("startTime", e.target.value)}
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Fecha às
                            {isOvernight && (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold leading-none text-amber-600">
                                    +1 dia
                                </span>
                            )}
                        </Label>
                        <Input
                            type="time"
                            value={config.endTime}
                            onChange={(e) => handleOperatingChange("endTime", e.target.value)}
                            className="h-9"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Checkbox
                            id="slot-shift"
                            checked={!!config.slotShiftTime}
                            onCheckedChange={(checked) =>
                                handleOperatingChange("slotShiftTime", checked ? "17:00" : null)
                            }
                            className="data-[state=checked]:border-arena-button data-[state=checked]:bg-arena-button"
                        />
                        <Label
                            htmlFor="slot-shift"
                            className="cursor-pointer select-none text-xs font-normal text-muted-foreground"
                        >
                            Slots passam para o :30 a partir de
                        </Label>
                        {config.slotShiftTime && (
                            <Input
                                type="time"
                                value={config.slotShiftTime}
                                onChange={(e) => handleOperatingChange("slotShiftTime", e.target.value)}
                                className="h-8 w-24 text-xs"
                            />
                        )}
                    </div>
                    {shiftExample && (
                        <p className="pl-6 text-[11px] italic text-arena-navy-800/40">{shiftExample}</p>
                    )}
                </div>

                <p className="border-l-2 border-border pl-3 text-[11px] leading-snug text-muted-foreground">
                    {slotCount} {slotCount === 1 ? 'horário' : 'horários'} de 1h por dia. As faixas de
                    preço ficam sempre dentro do funcionamento.
                </p>

                {isBatch && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-700">
                        Estas configurações valem também para <strong>{batchDays.join(', ')}</strong>.
                        Os dias selecionados ficam com o mesmo funcionamento e os mesmos preços.
                    </p>
                )}
            </div>

            {/* ── Faixas de preço ───────────────────────────────────────── */}
            <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <Label className="text-sm font-medium text-gray-700">Faixas de preço por horário</Label>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Cada faixa cobre um período do dia. Marque qual é a{' '}
                            <strong>faixa padrão</strong> (preço base do espaço).
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={addTier}
                        disabled={!canAddTier}
                        title={
                            canAddTier
                                ? 'Divide a maior faixa em duas'
                                : 'Toda faixa já tem menos de 2h — não há onde dividir'
                        }
                        className="h-7 text-xs text-arena-button hover:bg-orange-50 hover:text-arena-button-hover disabled:opacity-40"
                    >
                        <Plus className="mr-1 h-3 w-3" />
                        Adicionar faixa de horário
                    </Button>
                </div>

                <div className="hidden gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_112px]">
                    <span>Começa às</span>
                    <span>Termina às</span>
                    <span>Valor por hora</span>
                    <span className="text-center">Faixa padrão</span>
                </div>

                <div className="space-y-2">
                    {tiers.map((tier, index) => {
                        const isFirst = index === 0
                        const isLast = index === tiers.length - 1

                        return (
                            <div
                                key={tier.id}
                                className={`grid grid-cols-1 items-center gap-2 rounded-lg border px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_112px] ${
                                    tier.isDefault
                                        ? 'border-arena-navy-800/10 bg-arena-navy-800/[0.03]'
                                        : 'border-orange-100 bg-orange-50/60'
                                }`}
                            >
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground sm:hidden">
                                        Começa às
                                    </span>
                                    <Input
                                        type="time"
                                        value={displayTime(tier.id, 'start', tier.start)}
                                        disabled={isFirst}
                                        title={isFirst ? 'Segue o horário de abertura do dia' : undefined}
                                        onChange={(e) => setTierBoundary(index, 'start', e.target.value)}
                                        onBlur={(e) => commitTierBoundary(index, 'start', e.target.value)}
                                        className="h-9 bg-white text-sm disabled:opacity-60"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground sm:hidden">
                                        Termina às{isOvernight && isLast ? ' (+1 dia)' : ''}
                                    </span>
                                    <Input
                                        type="time"
                                        value={displayTime(tier.id, 'end', tier.end)}
                                        disabled={isLast}
                                        title={isLast ? 'Segue o horário de fechamento do dia' : undefined}
                                        onChange={(e) => setTierBoundary(index, 'end', e.target.value)}
                                        onBlur={(e) => commitTierBoundary(index, 'end', e.target.value)}
                                        className="h-9 bg-white text-sm disabled:opacity-60"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground sm:hidden">
                                        Valor por hora
                                    </span>
                                    <div className="relative">
                                        <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">R$</span>
                                        <Input
                                            type="number"
                                            value={tier.price || 0}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value)
                                                updateTierPrice(tier.id, isNaN(val) ? 0 : val)
                                            }}
                                            className="h-9 bg-white pl-7 text-sm"
                                            step="0.01"
                                            min="0"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setDefaultTier(tier.id)}
                                        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                                            tier.isDefault
                                                ? 'bg-arena-button/10 text-arena-button'
                                                : 'text-muted-foreground hover:bg-muted/60 hover:text-arena-navy-800'
                                        }`}
                                        title="Usar esta faixa como preço base do espaço"
                                    >
                                        <span
                                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${
                                                tier.isDefault ? 'border-arena-button' : 'border-muted-foreground/40'
                                            }`}
                                        >
                                            {tier.isDefault && <span className="h-1.5 w-1.5 rounded-full bg-arena-button" />}
                                        </span>
                                        <span className="hidden sm:inline">Padrão</span>
                                    </button>
                                    {tiers.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeTier(index)}
                                            className="h-9 w-9 text-red-400 hover:bg-red-50 hover:text-red-600"
                                            title="Remover esta faixa de horário"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {!canAddTier && tiers.length === 1 && (
                    <p className="text-xs italic text-muted-foreground">
                        Mesmo preço em todo o horário. Adicione faixas para preços diferenciados
                        (mín. 2h por faixa).
                    </p>
                )}
            </div>
        </div>
    )
}
