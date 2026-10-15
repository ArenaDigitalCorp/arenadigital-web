"use client"

import { FormEvent, useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { ExternalLink, Megaphone, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteAppHomeContentAction,
  listAppHomeContentAction,
  setAppHomeContentActiveAction,
  upsertAppHomeContentAction,
} from "@/modules/mobile-content/actions/mobileContentActions"
import type {
  AppHomeContent,
  AppHomeContentCtaKind,
  AppHomeContentKind,
  MobileContentOption,
} from "@/modules/mobile-content/types/mobile-content.types"

type CityOption = MobileContentOption & { uf?: string | null }

interface Props {
  initialItems: AppHomeContent[]
  sports: MobileContentOption[]
  cities: CityOption[]
}

const NONE_VALUE = "__none__"

const contentKinds: Array<{ value: AppHomeContentKind; label: string }> = [
  { value: "announcement", label: "Comunicado" },
  { value: "promotion", label: "Promoção" },
  { value: "ad", label: "Anúncio" },
  { value: "news", label: "Novidade" },
]

const ctaKinds: Array<{ value: AppHomeContentCtaKind; label: string }> = [
  { value: "none", label: "Sem ação" },
  { value: "external_url", label: "Abrir link" },
  { value: "go_to_jogos", label: "Ir para jogos" },
  { value: "go_to_buscar", label: "Ir para busca" },
  { value: "go_to_perfil", label: "Ir para perfil" },
]

function nowForInput(date = new Date()) {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

function toDateTimeInput(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

function fromDateTimeInput(value: string, original: string | null) {
  if (!value) return null
  // A minute-only input cannot distinguish a repeated DST hour or represent
  // stored seconds. An unchanged field keeps the original instant/precision.
  if (original && value === toDateTimeInput(original)) return original
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || format(date, "yyyy-MM-dd'T'HH:mm") !== value) {
    throw new Error("Informe uma data e horário válidos.")
  }
  return date.toISOString()
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sem prazo"
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function labelFor<T extends string>(items: Array<{ value: T; label: string }>, value: T) {
  return items.find((item) => item.value === value)?.label ?? value
}

function emptyDraft() {
  const now = new Date(Math.floor(Date.now() / 60_000) * 60_000)
  return {
    id: "",
    kind: "announcement" as AppHomeContentKind,
    title: "",
    description: "",
    image_url: "",
    cta_label: "",
    cta_url: "",
    cta_kind: "none" as AppHomeContentCtaKind,
    city_id: NONE_VALUE,
    sport_id: NONE_VALUE,
    priority: "0",
    starts_at: nowForInput(now),
    ends_at: "",
    original_starts_at: now.toISOString() as string | null,
    original_ends_at: null as string | null,
    active: true,
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</Label>
      {children}
    </div>
  )
}

function SelectField<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function OptionSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: MobileContentOption[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value={NONE_VALUE}>{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  )
}

export function AppHomeContentAdminClient({ initialItems, sports, cities }: Props) {
  const [items, setItems] = useState(initialItems)
  const [draft, setDraft] = useState(emptyDraft)
  const [isPending, startTransition] = useTransition()

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.priority - a.priority || +new Date(b.created_at) - +new Date(a.created_at)),
    [items],
  )

  const refreshItems = async () => {
    const result = await listAppHomeContentAction()
    if (result.success) setItems(result.data)
  }

  const resetDraft = () => setDraft(emptyDraft())

  const editItem = (item: AppHomeContent) => {
    setDraft({
      id: item.id,
      kind: item.kind,
      title: item.title,
      description: item.description ?? "",
      image_url: item.image_url ?? "",
      cta_label: item.cta_label ?? "",
      cta_url: item.cta_url ?? "",
      cta_kind: item.cta_kind,
      city_id: item.city_id ? String(item.city_id) : NONE_VALUE,
      sport_id: item.sport_id ?? NONE_VALUE,
      priority: String(item.priority),
      starts_at: toDateTimeInput(item.starts_at) || nowForInput(),
      ends_at: toDateTimeInput(item.ends_at),
      original_starts_at: item.starts_at,
      original_ends_at: item.ends_at,
      active: item.active,
    })
  }

  const saveContent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    let startsAt: string
    let endsAt: string | null
    try {
      startsAt = fromDateTimeInput(draft.starts_at, draft.original_starts_at) ?? new Date().toISOString()
      endsAt = fromDateTimeInput(draft.ends_at, draft.original_ends_at)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Informe uma data e horário válidos.")
      return
    }
    startTransition(async () => {
      const result = await upsertAppHomeContentAction({
        id: draft.id || undefined,
        kind: draft.kind,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        image_url: draft.image_url.trim() || null,
        cta_label: draft.cta_label.trim() || null,
        cta_url: draft.cta_url.trim() || null,
        cta_kind: draft.cta_kind,
        city_id: draft.city_id === NONE_VALUE ? null : Number(draft.city_id),
        sport_id: draft.sport_id === NONE_VALUE ? null : draft.sport_id,
        priority: Number(draft.priority || 0),
        starts_at: startsAt,
        ends_at: endsAt,
        active: draft.active,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(draft.id ? "Conteúdo atualizado." : "Conteúdo publicado.")
      resetDraft()
      await refreshItems()
    })
  }

  const toggleActive = (item: AppHomeContent, active: boolean) => {
    startTransition(async () => {
      const result = await setAppHomeContentActiveAction(item.id, active)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setItems((rows) => rows.map((row) => (row.id === item.id ? { ...row, active } : row)))
    })
  }

  const deleteItem = (item: AppHomeContent) => {
    startTransition(async () => {
      const result = await deleteAppHomeContentAction(item.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Conteúdo removido.")
      setItems((rows) => rows.filter((row) => row.id !== item.id))
      if (draft.id === item.id) resetDraft()
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-arena-orange">
          <Megaphone className="h-4 w-4" />
          Super Admin
        </div>
        <h1 className="text-2xl font-bold text-gray-950">Conteúdo global do app</h1>
        <p className="max-w-3xl text-sm text-gray-500">
          Gerencie comunicados, anúncios e promoções da Arena Digital exibidos na home dos atletas.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[410px_1fr]">
        <Card className="h-fit p-5">
          <form className="space-y-4" onSubmit={saveContent}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-gray-950">{draft.id ? "Editar conteúdo" : "Novo conteúdo"}</h2>
              {draft.id && (
                <Button type="button" variant="outline" size="sm" onClick={resetDraft}>
                  Novo
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <SelectField value={draft.kind} onChange={(kind) => setDraft((state) => ({ ...state, kind }))} options={contentKinds} />
              </Field>
              <Field label="Prioridade">
                <Input type="number" value={draft.priority} onChange={(event) => setDraft((state) => ({ ...state, priority: event.target.value }))} />
              </Field>
            </div>

            <Field label="Título">
              <Input required value={draft.title} onChange={(event) => setDraft((state) => ({ ...state, title: event.target.value }))} />
            </Field>

            <Field label="Descrição">
              <Textarea value={draft.description} onChange={(event) => setDraft((state) => ({ ...state, description: event.target.value }))} />
            </Field>

            <Field label="Imagem URL">
              <Input value={draft.image_url} onChange={(event) => setDraft((state) => ({ ...state, image_url: event.target.value }))} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Início">
                <Input required type="datetime-local" value={draft.starts_at} onChange={(event) => setDraft((state) => ({ ...state, starts_at: event.target.value }))} />
              </Field>
              <Field label="Fim">
                <Input type="datetime-local" value={draft.ends_at} onChange={(event) => setDraft((state) => ({ ...state, ends_at: event.target.value }))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade">
                <OptionSelect value={draft.city_id} onChange={(city_id) => setDraft((state) => ({ ...state, city_id }))} options={cities} placeholder="Todas" />
              </Field>
              <Field label="Esporte">
                <OptionSelect value={draft.sport_id} onChange={(sport_id) => setDraft((state) => ({ ...state, sport_id }))} options={sports} placeholder="Todos" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Ação">
                <SelectField value={draft.cta_kind} onChange={(cta_kind) => setDraft((state) => ({ ...state, cta_kind }))} options={ctaKinds} />
              </Field>
              <Field label="Texto botão">
                <Input value={draft.cta_label} onChange={(event) => setDraft((state) => ({ ...state, cta_label: event.target.value }))} />
              </Field>
            </div>

            {draft.cta_kind === "external_url" && (
              <Field label="URL">
                <Input required type="url" value={draft.cta_url} onChange={(event) => setDraft((state) => ({ ...state, cta_url: event.target.value }))} />
              </Field>
            )}

            <div className="flex h-10 items-center gap-2">
              <Switch checked={draft.active} onCheckedChange={(active) => setDraft((state) => ({ ...state, active }))} />
              <span className="text-sm font-medium text-gray-600">Publicado</span>
            </div>

            <Button type="submit" disabled={isPending} className="w-full bg-arena-navy-800 text-white hover:bg-[#001D2C]">
              <Plus className="h-4 w-4" />
              {draft.id ? "Salvar alterações" : "Publicar na home"}
            </Button>
          </form>
        </Card>

        <div className="space-y-3">
          {sortedItems.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.active ? "default" : "secondary"}>{item.active ? "Publicado" : "Pausado"}</Badge>
                    <Badge variant="outline">{labelFor(contentKinds, item.kind)}</Badge>
                    <span className="text-xs font-medium text-gray-400">prioridade {item.priority}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-950">{item.title}</h3>
                    <p className="line-clamp-2 text-sm text-gray-500">{item.description || "Sem descrição"}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span>{item.municipios ? `${item.municipios.nome}/${item.municipios.estados?.uf ?? ""}` : "Todas as cidades"}</span>
                    <span>{item.sports?.name ?? "Todos os esportes"}</span>
                    <span>até {formatDateTime(item.ends_at)}</span>
                    {item.cta_kind === "external_url" && item.cta_url && (
                      <span className="inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Link externo
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={item.active} onCheckedChange={(active) => toggleActive(item, active)} />
                  <Button type="button" variant="outline" size="icon" onClick={() => editItem(item)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" onClick={() => deleteItem(item)} aria-label="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {sortedItems.length === 0 && (
            <Card className="p-10 text-center text-sm text-gray-500">
              Nenhum conteúdo global publicado ainda.
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
