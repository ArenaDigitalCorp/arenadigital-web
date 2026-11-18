'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Archive, Copy, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StandardModal } from '@/components/ui/standard-modal'
import { archiveAccessProfile, saveAccessProfile } from '../actions'
import type { AccessBaseRole, AccessManagement, AccessProfile, AuditState, ProfileInput } from '../types'

const roles: Record<AccessBaseRole, string> = { Gestor: 'Administrador', Atendente: 'Usuário comum', Caixa: 'Caixa' }
type EditorState = { source?: AccessProfile; duplicate?: boolean }
const eventLabels: Record<string, string> = {
  'profile.created': 'Perfil criado', 'profile.updated': 'Perfil alterado', 'profile.archived': 'Perfil arquivado',
  'member.created': 'Acesso concedido', 'member.updated': 'Acesso alterado', 'member.removed': 'Acesso removido',
}

function ProfileEditor({ editor, profiles, resources, pending, close, submit }: {
  editor: EditorState
  profiles: AccessProfile[]
  resources: AccessManagement['resources']
  pending: boolean
  close(): void
  submit(input: ProfileInput): void
}) {
  const original = editor.source
  const editing = Boolean(original && !editor.duplicate)
  const defaults = profiles.filter(p => p.is_default)
  const initial = original ?? defaults.find(p => p.base_role === 'Atendente')
  const [name, setName] = useState(original ? (editor.duplicate ? original.name + ' (cópia)' : original.name) : '')
  const [baseRole, setBaseRole] = useState<AccessBaseRole>(initial?.base_role ?? 'Atendente')
  const [keys, setKeys] = useState<string[]>(initial?.resources ?? [])
  const groups = [...new Set(resources.map(r => r.group_name))]
  const added = resources.filter(r => keys.includes(r.key) && !original?.resources.includes(r.key))
  const removed = resources.filter(r => !keys.includes(r.key) && original?.resources.includes(r.key))
  const changeModel = (role: AccessBaseRole) => {
    setBaseRole(role)
    setKeys(defaults.find(p => p.base_role === role)?.resources ?? [])
  }
  return <StandardModal open size="wide" className="p-5 sm:p-8 gap-4" title={editing ? 'Editar perfil' : 'Criar perfil'}
    onOpenChange={open => { if (!open && !pending) close() }} footer={<div className="flex justify-end gap-2">
      <Button variant="outline" disabled={pending} onClick={close}>Cancelar</Button>
      <Button type="submit" form="access-profile-form" disabled={pending || !name.trim()}>{pending ? 'Salvando…' : 'Salvar perfil'}</Button>
    </div>}>
    <form id="access-profile-form" className="space-y-5" onSubmit={e => {
      e.preventDefault()
      submit({ id: editing ? original!.id : null, version: editing ? original!.version : null, name, baseRole, resources: keys })
    }}>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Nome do perfil
        <Input value={name} maxLength={80} required onChange={e => setName(e.target.value)} placeholder="Ex.: Recepção" />
      </label>
        <label className="text-sm font-semibold">Modelo de acesso
          <select className="mt-0.5 h-9 w-full rounded-md border px-3 font-normal" value={baseRole}
            disabled={editing || Boolean(editor.duplicate)} onChange={e => changeModel(e.target.value as AccessBaseRole)}>
            {Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <p className="text-sm text-muted-foreground">Marque as áreas que o perfil poderá consultar e operar. Cada área inclui suas ações habituais. Saques e outras operações sensíveis mantêm suas verificações próprias.</p>
      {baseRole === 'Caixa' && <p className="text-sm">A operação de caixa continua vinculada à estação atribuída.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map(group => <fieldset key={group} className="rounded-lg border px-3 pb-2">
          <legend className="px-1 text-sm font-bold text-arena-navy-800">{group}</legend>
          {resources.filter(r => r.group_name === group).map(r => <label key={r.key} className="flex items-center gap-2 py-1.5 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-arena-button" checked={keys.includes(r.key)}
              disabled={['settings.users', 'settings.receiving', 'settings.subscription'].includes(r.key) && baseRole !== 'Gestor'}
              onChange={e => setKeys(prev => e.target.checked ? [...prev, r.key] : prev.filter(k => k !== r.key))} />{r.label}{['settings.users', 'settings.receiving', 'settings.subscription'].includes(r.key) && baseRole !== 'Gestor' && ' (administrador)'}
          </label>)}
        </fieldset>)}
      </div>
      {editing && original && <div role="status" className="space-y-1 rounded-lg bg-slate-50 p-4 text-sm">
        <p className="font-semibold">{original.member_count === 1 ? '1 pessoa usa' : original.member_count + ' pessoas usam'} este perfil nesta arena.</p>
        {name.trim() !== original.name && <p>Novo nome: {name.trim()}</p>}
        {added.length > 0 && <p>Conceder: {added.map(r => r.label).join(', ')}</p>}
        {removed.length > 0 && <p>Retirar: {removed.map(r => r.label).join(', ')}</p>}
      </div>}
    </form>
  </StandardModal>
}

export function ProfilesPanel({ arenaId, management }: { arenaId: string; management: AccessManagement }) {
  const router = useRouter()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [archive, setArchive] = useState<AccessProfile | null>(null)
  const [pending, startTransition] = useTransition()
  const label = (key: string) => management.resources.find(r => r.key === key)?.label ?? key
  const summary = (snapshot: AuditState | null) => {
    if (!snapshot) return '—'
    const profile = management.profiles.find(p => p.id === snapshot.profile_id)
    const member = management.members.find(m => m.user_id === snapshot.user_id)
    return [snapshot.name ?? snapshot.profile_name ?? profile?.name ?? snapshot.profile_id,
      member?.name ?? snapshot.user_id, snapshot.status,
      Array.isArray(snapshot.resources) ? snapshot.resources.map(k => label(String(k))).join(', ') || 'Sem recursos' : null,
      snapshot.station_id ? 'Estação ' + snapshot.station_id : null].filter(Boolean).join(' · ') || '—'
  }
  const save = (input: ProfileInput) => startTransition(async () => {
    const result = await saveAccessProfile(arenaId, input)
    if (!result.success) { toast.error(result.error); return }
    toast.success('Perfil salvo.')
    setEditor(null)
    router.refresh()
  })
  return <section className="space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4"><div>
      <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><ShieldCheck className="h-8 w-8 text-arena-button" />Perfis e permissões</h1>
      <p className="mt-1 text-sm text-muted-foreground">Escolha o que cada pessoa pode acessar nesta arena.</p>
    </div><Button onClick={() => setEditor({})}><Plus />Criar perfil</Button></header>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{management.profiles.map(p => {
      const members = management.members.filter(m => m.profile_id === p.id)
      return <article key={p.id} className="flex flex-col rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{p.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{roles[p.base_role]} · {p.resources.length} recursos</p>
        <details className="my-4 border-y py-2 text-sm"><summary className="cursor-pointer">{p.member_count === 1 ? '1 pessoa vinculada' : p.member_count + ' pessoas vinculadas'}</summary>
          {members.length ? <ul className="mt-2 space-y-1">{members.map(m => <li key={m.id}>{m.name || m.email} · {m.status}</li>)}</ul>
            : <p className="mt-2 text-muted-foreground">Nenhum vínculo.</p>}
          <Link className="mt-2 inline-block underline" href={'/dashboard/settings/users/' + arenaId}>Gerenciar usuários</Link>
        </details>
        <div className="mt-auto flex flex-wrap gap-1">
          <Button variant="outline" size="sm" onClick={() => setEditor({ source: p })}><Pencil />Editar</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditor({ source: p, duplicate: true })}><Copy />Duplicar</Button>
          {!p.is_default && <Button variant="ghost" size="sm" disabled={p.member_count > 0} onClick={() => setArchive(p)}><Archive />Arquivar</Button>}
        </div>
      </article>
    })}</div>
    <section className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Histórico de acessos</h2><p className="text-sm text-muted-foreground">Últimas 100 alterações.</p>
      {management.history.length ? <ul className="mt-3 divide-y">{management.history.map(h => <li key={h.id} className="py-3">
        <details className="text-sm"><summary className="cursor-pointer"><strong>{eventLabels[h.event] ?? h.event}</strong> · {h.actor_name ?? h.actor_id ?? 'Sistema'} · {new Date(h.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</summary>
          <dl className="mt-2 space-y-1 break-words"><div><dt className="inline font-semibold">Antes: </dt><dd className="inline">{summary(h.before_state)}</dd></div>
            <div><dt className="inline font-semibold">Depois: </dt><dd className="inline">{summary(h.after_state)}</dd></div></dl>
        </details></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">As próximas alterações de perfil e de vínculo aparecerão aqui.</p>}
    </section>
    {editor && <ProfileEditor editor={editor} profiles={management.profiles} resources={management.resources} pending={pending} close={() => setEditor(null)} submit={save} />}
    {archive && <StandardModal open title="Arquivar perfil" onOpenChange={open => { if (!open && !pending) setArchive(null) }}
      footer={<div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={() => setArchive(null)}>Cancelar</Button>
        <Button disabled={pending} onClick={() => startTransition(async () => {
          const result = await archiveAccessProfile(arenaId, archive.id, archive.version)
          if (!result.success) { toast.error(result.error); return }
          toast.success('Perfil arquivado.'); setArchive(null); router.refresh()
        })}>Arquivar</Button></div>}><p>O perfil <strong>{archive.name}</strong> deixará de aparecer na atribuição de novos acessos.</p></StandardModal>}
  </section>
}
