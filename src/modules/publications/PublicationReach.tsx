"use client";

import { useId } from "react";

export function PublicationReach({ value, onChange, disabled = false }: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const label = value === 0 ? "Somente favoritos" : `${value} km`;
  return <div className="space-y-3 rounded-lg border border-slate-200 p-4">
    <label htmlFor={id} className="flex flex-wrap justify-between gap-2 text-sm font-medium text-arena-navy-800">
      <span>Alcance da publicação</span><span className="font-semibold">{label}</span>
    </label>
    <input id={id} type="range" min={0} max={30} step={1} value={value} aria-valuetext={label} aria-describedby={`${id}-hint`} disabled={disabled} onChange={event => onChange(Number(event.target.value))} className="w-full accent-arena-button disabled:opacity-50" />
    <p id={`${id}-hint`} className="text-xs leading-relaxed text-slate-500">{value === 0 ? "Visível apenas para quem favoritou a arena." : "Quem favoritou a arena recebe mesmo fora do raio."}</p>
    <details className="text-xs text-slate-500">
      <summary className="w-fit cursor-pointer underline-offset-4 hover:underline">Como funciona o alcance?</summary>
      <p className="mt-2 leading-relaxed">A distância é calculada a partir da arena, até 30 km. Em 0 km ou sem localização disponível, a publicação aparece apenas para quem favoritou.</p>
    </details>
  </div>;
}
