"use client";
import { useId } from "react";
export function PublicationReach({value,onChange,disabled=false}:{value:number;onChange:(value:number)=>void;disabled?:boolean}) {
 const id=useId();
 return <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
  <label htmlFor={id} className="flex justify-between text-sm font-semibold text-arena-navy-800"><span>Alcance da publicação</span><span>{value===0 ? "Somente favoritos" : `${value} km`}</span></label>
  <input id={id} type="range" min={0} max={30} step={1} value={value} disabled={disabled} onChange={e=>onChange(Number(e.target.value))} className="w-full accent-orange-600" />
  <p className="text-xs leading-relaxed text-slate-600">Pessoas próximas à arena podem ver esta publicação. Quem favoritou a arena recebe mesmo fora do raio. Em 0 km, somente favoritos. Sem localização disponível, a publicação aparece apenas para quem favoritou.</p>
 </div>;
}
