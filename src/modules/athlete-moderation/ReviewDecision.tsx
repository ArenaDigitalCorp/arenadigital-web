"use client"

import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { StandardModal } from "@/components/ui/standard-modal"
import { Textarea } from "@/components/ui/textarea"
import { decideContentReport } from "./actions"

export function ReviewDecision({ reportId, isProfile }: { reportId: string; isProfile: boolean }) {
  const formId = useId()
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const router = useRouter()
  function show() {
    setAction("")
    setNote("")
    setError("")
    setOpen(true)
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={show}>
        Analisar
      </Button>
      <StandardModal
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value)
        }}
        title="Analisar denúncia"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button form={formId} type="submit" disabled={pending || !action || !note.trim()}>
              {pending ? "Registrando…" : "Registrar decisão"}
            </Button>
          </div>
        }
      >
        <form
          id={formId}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            setError("")
            start(async () => {
              try {
                const result = await decideContentReport(reportId, action, note)
                if (!result.ok) {
                  setError(result.message)
                  return
                }
                toast.success(result.message)
                setOpen(false)
                router.refresh()
              } catch {
                setError("Confira sua conexão e suas permissões antes de tentar novamente.")
              }
            })
          }}
        >
          <fieldset className="space-y-2" disabled={pending}>
            <legend className="mb-2 text-sm font-semibold">Decisão</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="decision"
                value="dismiss"
                checked={action === "dismiss"}
                onChange={(e) => setAction(e.target.value)}
              />
              Arquivar e manter o conteúdo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="decision"
                value="hide"
                checked={action === "hide"}
                onChange={(e) => setAction(e.target.value)}
              />
              {isProfile ? "Ocultar o perfil e seu conteúdo público" : "Ocultar o conteúdo denunciado"}
            </label>
          </fieldset>
          {action === "hide" && (
            <p className="text-sm text-slate-600">
              {isProfile
                ? "O perfil e seu conteúdo deixarão de aparecer para os atletas. Novas interações sociais deste perfil serão restringidas."
                : "O conteúdo deixará de aparecer para os atletas."}
            </p>
          )}
          <label className="block space-y-2 text-sm font-semibold">
            <span>Motivo da decisão</span>
            <Textarea
              required
              maxLength={500}
              value={note}
              disabled={pending}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
        </form>
      </StandardModal>
    </>
  )
}
