"use client"

import { useState } from "react"
import { DecimalInput } from "@/components/ui/decimal-input"
import { parseBrazilianDecimal } from "@/lib/format"
import { Label } from "@/components/ui/label"
import type { ArenaPixSplitSettings } from "@/modules/arenas/types/pix-split.types"

type Commission = Pick<ArenaPixSplitSettings, "commissionMode" | "commissionFixedCents" | "platformFeeBasisPoints">

export function ArenaCommissionFields({ value, onChange }: {
    value: Commission
    onChange: (next: Commission) => void
}) {
    const fixed = value.commissionMode === "fixed"
    const [draft, setDraft] = useState<{ mode: Commission["commissionMode"]; text: string; cents: number } | null>(null)
    const currentCents = fixed ? value.commissionFixedCents : value.platformFeeBasisPoints
    const text = draft?.mode === value.commissionMode && Object.is(draft.cents, currentCents)
        ? draft.text : String(currentCents / 100)
    const invalid = !Number.isFinite(currentCents) || currentCents < 0 || currentCents > (fixed ? 100_000_000 : 10_000)
    const exampleNetCents = 9800
    const fee = fixed ? value.commissionFixedCents : Math.round(exampleNetCents * value.platformFeeBasisPoints / 10_000)
    const money = (cents: number) => Number.isFinite(cents) ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100) : 'Valor inválido'
    return (
        <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="platform-commission-mode">Tipo de comissão</Label>
                    <select id="platform-commission-mode" value={value.commissionMode} onChange={(event) => onChange({
                        commissionMode: event.target.value as Commission["commissionMode"],
                        platformFeeBasisPoints: event.target.value === "fixed" ? 0 : 200,
                        commissionFixedCents: event.target.value === "fixed" ? 200 : 0,
                    })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                        <option value="percentage_net">Percentual sobre o líquido</option>
                        <option value="fixed">Valor fixo por cobrança</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="platform-split-fee">{fixed ? "Comissão por cobrança (R$)" : "Comissão sobre o líquido (%)"}</Label>
                    <DecimalInput id="platform-split-fee" min="0" max={fixed ? "1000000" : "100"} step="0.01" required
                        value={text}
                        onChange={(event) => {
                            const parsed = parseBrazilianDecimal(event.target.value)
                            const cents = parsed !== null && parsed >= 0 && parsed <= (fixed ? 1_000_000 : 100) ? Math.round(parsed * 100) : Number.NaN
                            setDraft({ mode: value.commissionMode, text: event.target.value, cents })
                            onChange({ ...value, [fixed ? "commissionFixedCents" : "platformFeeBasisPoints"]: cents })
                        }} inputMode="decimal" aria-invalid={invalid} aria-describedby="commission-explanation" />
                    {invalid && <p role="alert" className="text-xs text-red-600">Informe uma comissão válida{fixed ? '.' : ' entre 0% e 100%.'}</p>}
                </div>
            </div>
            <p id="commission-explanation" className="text-xs leading-5 text-slate-500">
                {fixed ? "Uma comissão por Pix, mesmo quando o pedido inclui vários dias e horários. O valor precisa caber no líquido após as tarifas do Asaas."
                    : "O Asaas desconta suas tarifas primeiro. A comissão é calculada sobre o valor líquido restante."}
                {" "}Alterações valem apenas para novas cobranças.
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-950">Exemplo ilustrativo</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Reserva de R$ 100,00 com tarifa hipotética de R$ 2,00. A tarifa real será informada pelo Asaas.</p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div><dt className="text-xs text-slate-500">Após tarifas do Asaas</dt><dd className="mt-1 font-semibold text-slate-950">{money(exampleNetCents)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Comissão Arena Digital</dt><dd className="mt-1 font-semibold text-orange-600">{money(fee)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Restante para a arena</dt><dd className="mt-1 font-semibold text-slate-950">{fee > exampleNetCents ? "Comissão acima do líquido deste exemplo" : money(exampleNetCents - fee)}</dd></div>
                </dl>
            </div>
        </div>
    )
}
