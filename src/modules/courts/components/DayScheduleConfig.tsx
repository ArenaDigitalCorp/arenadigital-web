"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Copy } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface CustomPrice {
    start: string
    end: string
    price: number
}

export interface DayConfig {
    day: string
    enabled: boolean
    startTime: string
    endTime: string
    price: number
    customPrices: CustomPrice[]
    slotShiftTime?: string | null
}

interface DayScheduleConfigProps {
    day: string
    config: DayConfig
    onChange: (config: DayConfig) => void
    onReplicate?: () => void
}

function parseHHMM(t: string): number {
    const [h, m] = (t || "00:00").split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
}

function minsToHHMM(mins: number): string {
    const h = Math.floor(mins / 60) % 24
    const m = mins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function countSlots(config: DayConfig): number {
    if (!config.enabled || !config.startTime || !config.endTime) return 0
    const startMins = parseHHMM(config.startTime)
    let endMins = parseHHMM(config.endTime)
    if (endMins <= startMins) endMins += 24 * 60

    let firstShiftMins: number | null = null
    if (config.slotShiftTime) {
        const sm = parseHHMM(config.slotShiftTime)
        firstShiftMins = sm % 60 === 30 ? sm : sm + (30 - sm % 60) % 60
    }

    let count = 0
    let cur = startMins
    let shifted = false
    while (cur < endMins) {
        if (!shifted && firstShiftMins !== null && cur + 60 > firstShiftMins) {
            if (firstShiftMins > cur) cur = firstShiftMins
            shifted = true
        }
        count++
        cur += 60
    }
    return count
}

// Internal band representation: only "from" + price (end is derived)
interface PriceBand { from: string; price: number }

function bandsFromCustomPrices(customPrices: CustomPrice[]): PriceBand[] {
    return [...customPrices]
        .sort((a, b) => parseHHMM(a.start) - parseHHMM(b.start))
        .map(cp => ({ from: cp.start, price: cp.price }))
}

function customPricesFromBands(bands: PriceBand[], endTime: string): CustomPrice[] {
    const sorted = [...bands].sort((a, b) => parseHHMM(a.from) - parseHHMM(b.from))
    return sorted.map((band, i) => ({
        start: band.from,
        end: sorted[i + 1]?.from ?? endTime,
        price: band.price,
    }))
}

export function DayScheduleConfig({ day, config, onChange, onReplicate }: DayScheduleConfigProps) {
    const isOvernight =
        !!config.startTime && !!config.endTime &&
        parseHHMM(config.endTime) < parseHHMM(config.startTime)

    const slotCount = countSlots(config)
    const bands = bandsFromCustomPrices(config.customPrices)

    const handleToggle = (checked: boolean) => onChange({ ...config, enabled: checked })

    const handleChange = (field: keyof DayConfig, value: any) =>
        onChange({ ...config, [field]: value })

    const handleEndTimeChange = (newEndTime: string) =>
        onChange({ ...config, endTime: newEndTime, customPrices: customPricesFromBands(bands, newEndTime) })

    const addBand = () => {
        const lastMins = bands.length > 0
            ? parseHHMM(bands[bands.length - 1].from) + 60
            : parseHHMM(config.startTime) + 60
        const newBands = [...bands, { from: minsToHHMM(lastMins), price: config.price || 0 }]
        onChange({ ...config, customPrices: customPricesFromBands(newBands, config.endTime) })
    }

    const removeBand = (index: number) => {
        const newBands = bands.filter((_, i) => i !== index)
        onChange({ ...config, customPrices: customPricesFromBands(newBands, config.endTime) })
    }

    const updateBand = (index: number, field: keyof PriceBand, value: any) => {
        const newBands = bands.map((b, i) => i === index ? { ...b, [field]: value } : b)
        onChange({ ...config, customPrices: customPricesFromBands(newBands, config.endTime) })
    }

    // Label for the end of a band: next band's "from", or the operating end time
    const bandUntilLabel = (index: number): string => {
        const sorted = [...bands].sort((a, b) => parseHHMM(a.from) - parseHHMM(b.from))
        const next = sorted[index + 1]
        if (next) return next.from
        return isOvernight ? `${config.endTime} (+1 dia)` : config.endTime
    }

    // Example text for the slot-shift setting
    const shiftExample = config.slotShiftTime
        ? (() => {
            const sm = parseHHMM(config.slotShiftTime)
            const first = sm % 60 === 30 ? sm : sm + (30 - sm % 60) % 60
            const a = minsToHHMM(first), b = minsToHHMM(first + 60), c = minsToHHMM(first + 120)
            return `ex: ${a}–${b}, ${b}–${c}…`
        })()
        : null

    return (
        <div
            className={`rounded-lg border border-border p-4 transition-colors ${config.enabled ? "bg-white" : "bg-muted/40"}`}
        >

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id={`enable-${day}`}
                        checked={config.enabled}
                        onCheckedChange={handleToggle}
                        className="data-[state=checked]:bg-arena-button data-[state=checked]:border-arena-button"
                    />
                    <Label htmlFor={`enable-${day}`} className="font-semibold text-lg cursor-pointer select-none">
                        {day}
                    </Label>
                </div>
                <div className="flex items-center gap-2">
                    {config.enabled && slotCount > 0 && (
                        <span className="text-[11px] text-arena-navy-800/40 font-medium bg-arena-navy-800/5 px-2 py-0.5 rounded-full">
                            {slotCount} {slotCount === 1 ? 'slot' : 'slots'}
                            {bands.length > 0 && ` · ${bands.length + 1} faixa${bands.length + 1 > 1 ? 's' : ''} de preço`}
                        </span>
                    )}
                    {config.enabled && onReplicate && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onReplicate}
                            className="h-7 text-xs border-border text-muted-foreground hover:bg-muted/50 hover:text-muted-foreground [&_svg]:text-muted-foreground"
                            title="Replicar para todos os dias"
                        >
                            <Copy className="h-3 w-3 mr-1" />
                            Replicar
                        </Button>
                    )}
                    {config.enabled && (
                        <Badge className="border-transparent bg-arena-status-active px-2.5 font-medium text-white hover:bg-arena-status-active">
                            Ativo
                        </Badge>
                    )}
                </div>
            </div>

            {config.enabled && (
                <div className="space-y-5 border-l-2 border-border pl-6">

                    {/* ── Horário de funcionamento ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Início</Label>
                            <Input
                                type="time"
                                value={config.startTime}
                                onChange={(e) => handleChange("startTime", e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                Fim
                                {isOvernight && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full leading-none">
                                        +1 dia
                                    </span>
                                )}
                            </Label>
                            <Input
                                type="time"
                                value={config.endTime}
                                onChange={(e) => handleEndTimeChange(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Valor padrão / hora</Label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-2 text-muted-foreground text-xs">R$</span>
                                <Input
                                    type="number"
                                    value={config.price || 0}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value)
                                        handleChange("price", isNaN(val) ? 0 : val)
                                    }}
                                    className="pl-7 h-9"
                                    step="0.01"
                                    min="0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Virada de meia hora ── */}
                    <div className="space-y-1 pt-1">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id={`shift-${day}`}
                                checked={!!config.slotShiftTime}
                                onCheckedChange={(checked) =>
                                    handleChange("slotShiftTime", checked ? "17:00" : null)
                                }
                                className="data-[state=checked]:bg-arena-button data-[state=checked]:border-arena-button"
                            />
                            <Label htmlFor={`shift-${day}`} className="text-xs text-muted-foreground cursor-pointer select-none">
                                Slots passam para o :30 a partir de
                            </Label>
                            {config.slotShiftTime && (
                                <Input
                                    type="time"
                                    value={config.slotShiftTime}
                                    onChange={(e) => handleChange("slotShiftTime", e.target.value)}
                                    className="h-8 w-24 text-xs"
                                />
                            )}
                        </div>
                        {shiftExample && (
                            <p className="text-[11px] text-arena-navy-800/40 pl-6 italic">
                                {shiftExample}
                            </p>
                        )}
                    </div>

                    {/* ── Faixas de preço ── */}
                    <div className="pt-1">
                        <div className="flex items-center justify-between mb-3">
                            <Label className="text-sm font-medium text-gray-700">Faixas de preço</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={addBand}
                                className="h-7 text-xs text-arena-button hover:text-arena-button-hover hover:bg-orange-50"
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Adicionar faixa
                            </Button>
                        </div>

                        <div className="space-y-1.5">
                            {/* Faixa padrão — sempre visível */}
                            <div className="flex items-center gap-2 bg-arena-navy-800/[0.03] border border-arena-navy-800/10 px-3 py-2 rounded-md text-xs">
                                <span className="text-arena-navy-800/50 w-6">Das</span>
                                <span className="font-semibold text-arena-navy-800">{config.startTime}</span>
                                <span className="text-arena-navy-800/40">até</span>
                                <span className="font-semibold text-arena-navy-800">
                                    {bands.length > 0
                                        ? [...bands].sort((a, b) => parseHHMM(a.from) - parseHHMM(b.from))[0].from
                                        : isOvernight ? `${config.endTime} (+1 dia)` : config.endTime}
                                </span>
                                <span className="flex-1" />
                                <span className="text-arena-navy-800/40">Valor padrão</span>
                                <span className="font-bold text-arena-button ml-1">R$ {(config.price || 0).toFixed(2)}/h</span>
                            </div>

                            {/* Faixas adicionais */}
                            {[...bands]
                                .sort((a, b) => parseHHMM(a.from) - parseHHMM(b.from))
                                .map((band, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-orange-50/60 border border-orange-100 px-3 py-2 rounded-md">
                                        <span className="text-xs text-arena-navy-800/50 w-6 shrink-0">Das</span>
                                        <Input
                                            type="time"
                                            value={band.from}
                                            onChange={(e) => updateBand(index, 'from', e.target.value)}
                                            className="h-8 w-24 text-xs bg-white shrink-0"
                                        />
                                        <span className="text-xs text-arena-navy-800/40 shrink-0">até</span>
                                        <span className="text-xs font-semibold text-arena-navy-800/60 min-w-[72px] shrink-0">
                                            {bandUntilLabel(index)}
                                        </span>
                                        <div className="relative w-28 shrink-0">
                                            <span className="absolute left-2 top-[9px] text-muted-foreground text-xs">R$</span>
                                            <Input
                                                type="number"
                                                value={band.price || 0}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value)
                                                    updateBand(index, 'price', isNaN(val) ? 0 : val)
                                                }}
                                                className="h-8 pl-7 text-xs bg-white"
                                                step="0.01"
                                                min="0"
                                            />
                                        </div>
                                        <span className="text-xs text-arena-navy-800/40 shrink-0">/h</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeBand(index)}
                                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 ml-auto shrink-0"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}

                            {bands.length === 0 && (
                                <p className="text-xs text-muted-foreground italic pt-0.5">
                                    Mesmo preço em todos os horários. Use "Adicionar faixa" para criar preços diferenciados.
                                </p>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
