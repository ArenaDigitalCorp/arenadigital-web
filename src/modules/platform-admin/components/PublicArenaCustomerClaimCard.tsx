"use client"

import { useEffect, useState, useTransition } from "react"
import { LoaderCircle, Search, UserRoundCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  claimPublicArenaAsCustomerAction,
  searchEligibleArenaOwnersAction,
} from "@/modules/platform-admin/actions/platformAdminActions"
import type { PlatformArena, PlatformEligibleOwner } from "@/modules/platform-admin/types/platform-admin.types"

export function PublicArenaCustomerClaimCard({ arena }: { arena: PlatformArena }) {
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PlatformEligibleOwner[]>([])
  const [selected, setSelected] = useState<PlatformEligibleOwner | null>(null)
  const [reason, setReason] = useState("")
  const [keepDiscoverable, setKeepDiscoverable] = useState(arena.appDiscoverable)

  useEffect(() => {
    const term = query.trim()
    if (term.length < 3) return
    let active = true
    const timeout = setTimeout(() => {
      void searchEligibleArenaOwnersAction(term).then((result) => {
        if (!active) return
        if (result.success) setResults(result.users)
        else toast.error(result.error ?? "Não foi possível buscar contas.")
      })
    }, 300)
    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [query])

  const visibleResults = query.trim().length >= 3 ? results : []

  function claim() {
    if (!selected) {
      toast.error("Selecione uma conta proprietária.")
      return
    }
    if (reason.trim().length < 8) {
      toast.error("Informe um motivo de auditoria com ao menos 8 caracteres.")
      return
    }
    startTransition(async () => {
      const result = await claimPublicArenaAsCustomerAction({
        arenaId: arena.id,
        ownerUserId: selected.id,
        reason,
        keepDiscoverable,
      })
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível converter o local.")
        return
      }
      toast.success("Local convertido em cliente e conta proprietária vinculada.")
    })
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
      <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-white"><UserRoundCheck className="h-5 w-5" /></div><div><p className="font-heading text-xl font-black">Transformar em cliente</p><p className="mt-1 text-sm text-slate-600">Vincula uma conta web existente sem trocar o arena_id.</p></div></div>
      <div className="mt-5 space-y-4">
        <label className="block"><Label>Buscar conta por nome ou e-mail</Label><div className="relative mt-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null) }} className="bg-white pl-10" placeholder="Digite ao menos 3 caracteres" /></div></label>
        {visibleResults.length > 0 && !selected && <div className="max-h-48 overflow-y-auto rounded-xl border bg-white p-2">{visibleResults.map((user) => <button key={user.id} type="button" onClick={() => { setSelected(user); setQuery(user.email) }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"><span className="block text-sm font-bold">{user.name || "Sem nome"}</span><span className="block text-xs text-slate-500">{user.email}</span></button>)}</div>}
        {selected && <div className="rounded-xl border border-emerald-200 bg-white p-3"><p className="text-sm font-bold">{selected.name || selected.email}</p><p className="text-xs text-slate-500">{selected.email} · {selected.role}</p></div>}
        <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-white p-3"><Checkbox checked={keepDiscoverable} onCheckedChange={(checked) => setKeepDiscoverable(checked === true)} /><span><span className="block text-sm font-bold">Manter visível no aplicativo</span><span className="block text-xs text-slate-500">A reserva continuará indisponível até existir uma quadra ativa.</span></span></label>
        <label className="block"><Label>Motivo para auditoria</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 bg-white" placeholder="Ex.: contrato assinado e conta gestora confirmada." /></label>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Este passo cria o vínculo proprietário e o acesso Gestor. Não cria assinatura, quadra, agenda, Pix ou split.</div>
        <Button onClick={claim} disabled={pending || !selected} className="w-full bg-emerald-700 text-white hover:bg-emerald-600">{pending ? <LoaderCircle className="animate-spin" /> : <UserRoundCheck />}Confirmar conversão em cliente</Button>
      </div>
    </section>
  )
}
