"use client"

import { useState, useTransition } from "react"
import { Eye, EyeOff, Save, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { updatePlatformArenaProfileAction } from "@/modules/platform-admin/actions/platformAdminActions"
import type { PlatformArena, PlatformArenaKind } from "@/modules/platform-admin/types/platform-admin.types"

const KIND_LABEL: Record<PlatformArenaKind, string> = {
  customer: "Cliente",
  public_listing: "Catálogo público",
  demo: "Demo / pitch",
}

export function PlatformArenaProfileCard({ arena }: { arena: PlatformArena }) {
  const [pending, startTransition] = useTransition()
  const [platformKind, setPlatformKind] = useState<PlatformArenaKind>(arena.platformKind)
  const [appDiscoverable, setAppDiscoverable] = useState(arena.appDiscoverable)
  const [platformNotes, setPlatformNotes] = useState(arena.platformNotes ?? "")
  const [reason, setReason] = useState("")

  const isDemo = platformKind === "demo"
  const effectiveDiscoverable = isDemo ? false : appDiscoverable

  function kindTransitionDisabled(kind: PlatformArenaKind) {
    if (kind === "customer" && arena.ownerId === null) return true
    if (kind === "public_listing" && arena.ownerId !== null && arena.platformKind !== "public_listing") return true
    return false
  }

  function save() {
    if (reason.trim().length < 8) {
      toast.error("Informe um motivo de auditoria com pelo menos 8 caracteres.")
      return
    }
    startTransition(async () => {
      const result = await updatePlatformArenaProfileAction({
        arenaId: arena.id,
        platformKind,
        appDiscoverable: effectiveDiscoverable,
        platformNotes,
        reason,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Classificação da arena atualizada.")
      setReason("")
    })
  }

  return (
    <section className="rounded-2xl border border-slate-900/10 bg-white p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <p className="font-heading text-xl font-black">Classificação da plataforma</p>
          <p className="mt-1 text-sm text-slate-500">Controla governança interna e descoberta no aplicativo.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
          Tipo da arena
          <select
            value={platformKind}
            onChange={(event) => setPlatformKind(event.target.value as PlatformArenaKind)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-950"
          >
            {(Object.keys(KIND_LABEL) as PlatformArenaKind[]).map((kind) => (
              <option key={kind} value={kind} disabled={kindTransitionDisabled(kind)}>{KIND_LABEL[kind]}</option>
            ))}
          </select>
          {arena.ownerId === null && (
            <span className="mt-2 block text-xs font-normal normal-case tracking-normal text-slate-500">
              Para virar cliente, este local precisa passar pelo fluxo de vínculo com uma conta proprietária.
            </span>
          )}
        </label>

        <button
          type="button"
          disabled={isDemo}
          onClick={() => setAppDiscoverable((value) => !value)}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-65"
        >
          <span>
            <span className="block text-sm font-bold text-slate-950">Aparece na busca do app</span>
            <span className="mt-1 block text-xs text-slate-500">
              Arenas demo ficam sempre ocultas da busca, Home e Game Match públicos.
            </span>
          </span>
          {effectiveDiscoverable ? <Eye className="h-5 w-5 text-emerald-600" /> : <EyeOff className="h-5 w-5 text-slate-400" />}
        </button>

        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
          Observações internas
          <Textarea
            value={platformNotes}
            onChange={(event) => setPlatformNotes(event.target.value)}
            className="mt-2 min-h-24 normal-case tracking-normal"
            placeholder="Contexto comercial, uso em pitch, origem do cadastro ou restrições operacionais."
          />
        </label>

        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
          Motivo para auditoria
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 min-h-20 normal-case tracking-normal"
            placeholder="Ex.: arena cadastrada manualmente para Game Match público."
          />
        </label>

        <Button onClick={save} disabled={pending} className="bg-slate-950 text-white hover:bg-slate-800">
          <Save className="mr-2 h-4 w-4" />
          Salvar classificação
        </Button>
      </div>
    </section>
  )
}
