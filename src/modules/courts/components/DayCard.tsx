"use client"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { summarizeDay, type DayConfig } from "@/modules/courts/lib/day-schedule"

interface DayCardProps {
    /** Rótulo curto do card ("Seg", "Ter"…). */
    short: string
    /** Nome completo, usado nos rótulos de acessibilidade. */
    full: string
    config: DayConfig
    selected: boolean
    onSelect: () => void
    onToggle: (enabled: boolean) => void
}

const brl = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/**
 * Um dia da semana resumido: liga/desliga, horário, faixas e preço — sem abrir
 * o painel. A barra mostra cada faixa proporcional à sua duração, com o tom
 * acompanhando o preço, para comparar a semana inteira de relance.
 */
export function DayCard({ short, full, config, selected, onSelect, onToggle }: DayCardProps) {
    const { slots, tierCount, minPrice, maxPrice, overnight, segments } = summarizeDay(config)
    const spread = maxPrice - minPrice

    return (
        <div
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${full}, ${config.enabled ? 'aberto' : 'fechado'}`}
            onClick={onSelect}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect()
                }
            }}
            className={cn(
                'grid cursor-pointer content-start gap-1.5 rounded-xl border-[1.5px] p-2.5 text-left transition-colors',
                config.enabled ? 'bg-white' : 'border-dashed bg-muted/40',
                selected
                    ? 'border-arena-button bg-arena-button/[0.07]'
                    : 'border-border hover:border-muted-foreground/50'
            )}
        >
            <div className="flex items-center justify-between gap-1.5">
                <span
                    className={cn(
                        'text-sm font-bold',
                        config.enabled ? 'text-arena-navy-800' : 'text-muted-foreground'
                    )}
                >
                    {short}
                </span>
                <Switch
                    checked={config.enabled}
                    onCheckedChange={onToggle}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={config.enabled ? `Fechar ${full}` : `Abrir ${full}`}
                    title={config.enabled ? `Fechar ${full}` : `Abrir ${full}`}
                    className="scale-[0.7] data-[state=checked]:bg-arena-status-active"
                />
            </div>

            {config.enabled ? (
                <>
                    <div className="flex items-center gap-1 text-[11px] font-medium tabular-nums text-muted-foreground">
                        {config.startTime}–{config.endTime}
                        {overnight && (
                            <span
                                className="rounded bg-amber-50 px-1 text-[9px] font-bold leading-tight text-amber-600"
                                title="Fecha no dia seguinte"
                            >
                                +1
                            </span>
                        )}
                    </div>

                    <div
                        className="flex h-1.5 gap-px overflow-hidden rounded-full"
                        title={segments.map((s) => `${s.start}–${s.end} · ${brl(s.price)}`).join('  |  ')}
                    >
                        {segments.map((s) => (
                            <span
                                key={s.id}
                                className="block bg-arena-button"
                                style={{
                                    flex: s.share,
                                    opacity: spread === 0 ? 1 : 0.34 + ((s.price - minPrice) / spread) * 0.66,
                                }}
                            />
                        ))}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums text-muted-foreground">
                        <span>
                            {slots}h · {tierCount}
                            {tierCount === 1 ? ' faixa' : ' faixas'}
                        </span>
                        <span className="font-semibold text-arena-navy-800/70">
                            {minPrice === maxPrice ? brl(minPrice) : `${brl(minPrice)}–${maxPrice}`}
                        </span>
                    </div>
                </>
            ) : (
                <p className="py-0.5 text-[11px] italic text-muted-foreground">Fechado</p>
            )}
        </div>
    )
}
