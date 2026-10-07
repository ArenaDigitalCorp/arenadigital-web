'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { listSportCatalog, saveSportCatalog, saveSportLevel } from './actions'
import type { CatalogSport } from './schema'

type SportDraft = { id: string | null; name: string; category: 'sport' | 'space'; is_active: boolean; requires_level: boolean }
type LevelDraft = { id: string | null; sport_id: string; name: string; is_active: boolean; sort_order: number }
const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-orange-500'
export function SportCatalog({ initialSports, initialError }: { initialSports: CatalogSport[]; initialError?: string }) {
  const [sports, setSports] = useState(initialSports)
  const [error, setError] = useState(initialError ?? '')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<SportDraft | null>(null)
  const [level, setLevel] = useState<LevelDraft | null>(null)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState('')
  const refresh = () => startTransition(async () => { try { setSports(await listSportCatalog()); setError('') } catch { setError('Não foi possível carregar o catálogo. Tente novamente.') } })
  const editSport = (sport: SportDraft) => { setDraft(sport); setLevel(null); setReason(''); setError(''); setNotice('') }
  const editLevel = (item: LevelDraft) => { setLevel(item); setDraft(null); setReason(''); setError(''); setNotice('') }
  const submit = () => startTransition(async () => {
    try {
      const result = draft ? await saveSportCatalog({ ...draft, reason }) : await saveSportLevel({ ...level, reason })
      if (result.error) { setError(result.error); return }
      setSports(await listSportCatalog()); setDraft(null); setLevel(null); setReason(''); setError(''); setNotice('Catálogo atualizado.')
    } catch { setError('Não foi possível concluir. Tente novamente.') }
  })
  const filtered = sports.filter(sport => sport.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
  return <section className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Governança do catálogo</p><h1 className="mt-2 text-3xl font-bold text-arena-navy-800">Esportes e níveis</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Organize modalidades e tipos de espaço. Desativar preserva os cadastros e o histórico existentes.</p></div><Button disabled={pending} onClick={() => editSport({ id: null, name: '', category: 'sport', is_active: true, requires_level: true })}>Nova modalidade</Button></header>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} <button disabled={pending} onClick={refresh} className="ml-3 underline">Tentar novamente</button></div>}
    {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
    {(draft || level) && <form onSubmit={event => { event.preventDefault(); submit() }} className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/40 p-5">
      <h2 className="font-bold text-arena-navy-800">{draft ? (draft.id ? 'Editar modalidade' : 'Nova modalidade') : (level?.id ? 'Editar nível' : 'Novo nível')}</h2>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm">Nome<input autoFocus required maxLength={100} className={fieldClass} value={draft?.name ?? level?.name ?? ''} onChange={event => draft ? setDraft({ ...draft, name: event.target.value }) : level && setLevel({ ...level, name: event.target.value })} /></label>
      {draft ? <label className="space-y-1 text-sm">Classificação<select className={fieldClass} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as 'sport' | 'space' })}><option value="sport">Esporte</option><option value="space">Tipo de espaço</option></select></label> : <label className="space-y-1 text-sm">Ordem<input type="number" min={0} required className={fieldClass} value={level?.sort_order ?? 0} onChange={event => level && setLevel({ ...level, sort_order: Number(event.target.value) })} /></label>}</div>
      <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={draft?.is_active ?? level?.is_active ?? true} onChange={event => draft ? setDraft({ ...draft, is_active: event.target.checked }) : level && setLevel({ ...level, is_active: event.target.checked })} />Disponível para novos cadastros</label>{draft?.category === 'sport' && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.requires_level} onChange={event => setDraft({ ...draft, requires_level: event.target.checked })} />Exige nível no perfil do atleta</label>}</div>
      <label className="block space-y-1 text-sm">Justificativa da alteração<textarea required minLength={8} maxLength={500} className={fieldClass} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <div className="flex gap-3"><Button type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Salvar'}</Button><Button type="button" variant="outline" disabled={pending} onClick={() => { setDraft(null); setLevel(null) }}>Cancelar</Button></div>
    </form>}
    <label className="block max-w-md space-y-1 text-sm">Buscar modalidade<input type="search" className={fieldClass} placeholder="Nome do esporte ou espaço" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {pending && <p role="status" className="text-sm text-slate-500">Atualizando catálogo…</p>}
    {!error && filtered.length === 0 && <p className="rounded-2xl border border-slate-200 p-8 text-center text-slate-500">Nenhuma modalidade encontrada.</p>}
    <div className="grid gap-4 lg:grid-cols-2">{filtered.map(sport => {
      const missingLevels = sport.category === 'sport' && sport.requires_level && !sport.levels.some(item => item.is_active)
      return <article key={sport.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div><h2 className="text-lg font-bold text-arena-navy-800">{sport.name}</h2><p className="mt-1 text-xs text-slate-500">{sport.category === 'sport' ? 'Esporte' : 'Tipo de espaço'} · {sport.is_active ? 'Ativo' : 'Desativado'}{sport.category === 'sport' && <> · {sport.requires_level ? 'Exige nível' : 'Sem nível obrigatório'}</>}</p></div><Button variant="outline" disabled={pending} onClick={() => editSport(sport)}>Editar</Button></div>
      {missingLevels && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Configuração pendente: cadastre os níveis para permitir a inclusão no perfil do atleta.</p>}
      <ul className="mt-4 divide-y divide-slate-100">{sport.levels.map(item => <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{item.nivel}<span className="ml-2 text-xs text-slate-500">Ordem {item.sort_order}{!item.is_active && ' · Desativado'}</span></span><button disabled={pending} className="rounded px-2 py-1 text-orange-700 underline focus-visible:outline-2" aria-label={`Editar nível ${item.nivel} de ${sport.name}`} onClick={() => editLevel({ id: item.id, sport_id: sport.id, name: item.nivel, is_active: item.is_active, sort_order: item.sort_order })}>Editar</button></li>)}</ul>
      {sport.category === 'sport' && <Button className="mt-4" variant="outline" disabled={pending} onClick={() => editLevel({ id: null, sport_id: sport.id, name: '', is_active: true, sort_order: sport.levels.length })}>Adicionar nível</Button>}
    </article>})}</div>
  </section>
}
