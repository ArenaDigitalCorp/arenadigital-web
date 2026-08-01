"use client"

import { FormEvent, ReactNode, useState, useTransition } from "react"
import { CalendarPlus, Megaphone, Plus, Sparkles, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DashboardTabs } from "@/components/dashboard/DashboardTabs"
import {
  listArenaHighlightsAction,
  listArenaOpenGamesAction,
  listArenaPromotionsAction,
  setArenaHighlightActiveAction,
  setArenaPromotionActiveAction,
  upsertArenaHighlightAction,
  upsertArenaPromotionAction,
  upsertOpenGameAction,
} from "@/modules/mobile-content/actions/mobileContentActions"
import type {
  MobileContentOption,
  MobileHighlight,
  MobileOpenGame,
  MobilePromotion,
} from "@/modules/mobile-content/types/mobile-content.types"

type TabValue = "promotions" | "highlights" | "open-games"

interface Props {
  arenaId: string
  arenaName: string
  courts: MobileContentOption[]
  sports: MobileContentOption[]
  athletes: MobileContentOption[]
  initialPromotions: MobilePromotion[]
  initialHighlights: MobileHighlight[]
  initialOpenGames: MobileOpenGame[]
}

const NONE_VALUE = "__none__"

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function toOptionalValue(value: string) {
  return value === NONE_VALUE || value.trim() === "" ? null : value
}

function toOptionalNumber(value: string) {
  if (value.trim() === "") return null
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function formatMoney(value: number | null) {
  if (value == null) return "Sem preço"
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sem prazo"
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</Label>
      {children}
    </div>
  )
}

function OptionSelect({
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: {
  value: string
  onChange: (value: string) => void
  options: MobileContentOption[]
  placeholder: string
  required?: boolean
}) {
  return (
    <select
      value={value}
      required={required}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value={required ? "" : NONE_VALUE}>{placeholder}</option>
      {options.map((option) => (
        <option value={option.id} key={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  )
}

export function MobileContentPageClient({
  arenaId,
  arenaName,
  courts,
  sports,
  athletes,
  initialPromotions,
  initialHighlights,
  initialOpenGames,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>("promotions")
  const [promotions, setPromotions] = useState(initialPromotions)
  const [highlights, setHighlights] = useState(initialHighlights)
  const [openGames, setOpenGames] = useState(initialOpenGames)
  const [isPending, startTransition] = useTransition()

  const [promotionDraft, setPromotionDraft] = useState({
    title: "",
    description: "",
    image_url: "",
    price: "",
    original_price: "",
    court_id: NONE_VALUE,
    sport_id: NONE_VALUE,
    priority: "0",
    active: true,
  })

  const [highlightDraft, setHighlightDraft] = useState({
    title: "",
    description: "",
    image_url: "",
    sport_id: NONE_VALUE,
    priority: "0",
    active: true,
  })

  const [openGameDraft, setOpenGameDraft] = useState({
    sport_id: "",
    owner_atleta_id: "",
    date: todayKey(),
    start_time: "19:00",
    end_time: "20:00",
    needed_players: "1",
    notes: "",
  })

  const refreshPromotions = async () => {
    const result = await listArenaPromotionsAction(arenaId)
    if (result.success) setPromotions(result.data)
  }

  const refreshHighlights = async () => {
    const result = await listArenaHighlightsAction(arenaId)
    if (result.success) setHighlights(result.data)
  }

  const refreshOpenGames = async () => {
    const result = await listArenaOpenGamesAction(arenaId)
    if (result.success) setOpenGames(result.data)
  }

  const savePromotion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await upsertArenaPromotionAction(arenaId, {
        title: promotionDraft.title.trim(),
        description: promotionDraft.description.trim() || null,
        image_url: promotionDraft.image_url.trim() || null,
        price: toOptionalNumber(promotionDraft.price),
        original_price: toOptionalNumber(promotionDraft.original_price),
        court_id: toOptionalValue(promotionDraft.court_id),
        sport_id: toOptionalValue(promotionDraft.sport_id),
        priority: Number(promotionDraft.priority || 0),
        active: promotionDraft.active,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Promoção salva para o app.")
      setPromotionDraft((draft) => ({ ...draft, title: "", description: "", image_url: "", price: "", original_price: "" }))
      await refreshPromotions()
    })
  }

  const saveHighlight = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await upsertArenaHighlightAction(arenaId, {
        title: highlightDraft.title.trim(),
        description: highlightDraft.description.trim() || null,
        image_url: highlightDraft.image_url.trim() || null,
        sport_id: toOptionalValue(highlightDraft.sport_id),
        priority: Number(highlightDraft.priority || 0),
        active: highlightDraft.active,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Destaque salvo para o app.")
      setHighlightDraft((draft) => ({ ...draft, title: "", description: "", image_url: "" }))
      await refreshHighlights()
    })
  }

  const saveOpenGame = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      const neededPlayers = Math.max(1, Number(openGameDraft.needed_players || 1))
      const result = await upsertOpenGameAction(arenaId, {
        sport_id: openGameDraft.sport_id,
        owner_atleta_id: openGameDraft.owner_atleta_id,
        date: openGameDraft.date,
        start_time: openGameDraft.start_time,
        end_time: openGameDraft.end_time,
        needed_players: neededPlayers,
        notes: openGameDraft.notes.trim() || null,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Jogo aberto publicado para o app.")
      setOpenGameDraft((draft) => ({ ...draft, notes: "", needed_players: "1" }))
      await refreshOpenGames()
    })
  }

  const togglePromotion = (promotion: MobilePromotion, active: boolean) => {
    startTransition(async () => {
      const result = await setArenaPromotionActiveAction(arenaId, promotion.id, active)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setPromotions((rows) => rows.map((row) => (row.id === promotion.id ? { ...row, active } : row)))
    })
  }

  const toggleHighlight = (highlight: MobileHighlight, active: boolean) => {
    startTransition(async () => {
      const result = await setArenaHighlightActiveAction(arenaId, highlight.id, active)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setHighlights((rows) => rows.map((row) => (row.id === highlight.id ? { ...row, active } : row)))
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900">Conteúdo do app</h1>
        <p className="text-sm text-gray-500">
          Publique promoções, destaques e vagas abertas da {arenaName}.
        </p>
      </div>

      <DashboardTabs
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { label: "Promoções", value: "promotions" },
          { label: "Destaques", value: "highlights" },
          { label: "Jogos abertos", value: "open-games" },
        ]}
      />

      {activeTab === "promotions" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <Card className="h-fit p-5">
            <form className="space-y-4" onSubmit={savePromotion}>
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-arena-orange" />
                <h2 className="font-bold text-gray-900">Nova promoção</h2>
              </div>
              <Field label="Título">
                <Input required value={promotionDraft.title} onChange={(event) => setPromotionDraft((draft) => ({ ...draft, title: event.target.value }))} />
              </Field>
              <Field label="Descrição">
                <Textarea value={promotionDraft.description} onChange={(event) => setPromotionDraft((draft) => ({ ...draft, description: event.target.value }))} />
              </Field>
              <Field label="Imagem URL">
                <Input value={promotionDraft.image_url} onChange={(event) => setPromotionDraft((draft) => ({ ...draft, image_url: event.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço">
                  <Input inputMode="decimal" value={promotionDraft.price} onChange={(event) => setPromotionDraft((draft) => ({ ...draft, price: event.target.value }))} />
                </Field>
                <Field label="Preço original">
                  <Input inputMode="decimal" value={promotionDraft.original_price} onChange={(event) => setPromotionDraft((draft) => ({ ...draft, original_price: event.target.value }))} />
                </Field>
              </div>
              <Field label="Espaço">
                <OptionSelect value={promotionDraft.court_id} onChange={(court_id) => setPromotionDraft((draft) => ({ ...draft, court_id }))} options={courts} placeholder="Todos os espaços" />
              </Field>
              <Field label="Esporte">
                <OptionSelect value={promotionDraft.sport_id} onChange={(sport_id) => setPromotionDraft((draft) => ({ ...draft, sport_id }))} options={sports} placeholder="Todos os esportes" />
              </Field>
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <Field label="Prioridade">
                  <Input type="number" value={promotionDraft.priority} onChange={(event) => setPromotionDraft((draft) => ({ ...draft, priority: event.target.value }))} />
                </Field>
                <div className="flex h-10 items-center gap-2">
                  <Switch checked={promotionDraft.active} onCheckedChange={(active) => setPromotionDraft((draft) => ({ ...draft, active }))} />
                  <span className="text-sm font-medium text-gray-600">Ativa</span>
                </div>
              </div>
              <Button type="submit" disabled={isPending} className="w-full bg-arena-navy-800 text-white hover:bg-[#001D2C]">
                <Plus className="h-4 w-4" />
                Salvar promoção
              </Button>
            </form>
          </Card>

          <div className="space-y-3">
            {promotions.map((promotion) => (
              <Card key={promotion.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-900">{promotion.title}</h3>
                    <Badge variant={promotion.active ? "default" : "secondary"}>{promotion.active ? "Ativa" : "Pausada"}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">{promotion.description || "Sem descrição"} · {formatMoney(promotion.price)}</p>
                  <p className="text-xs text-gray-400">{promotion.courts?.name ?? "Todos os espaços"} · {promotion.sports?.name ?? "Todos os esportes"} · expira {formatDateTime(promotion.ends_at)}</p>
                </div>
                <Switch checked={promotion.active} onCheckedChange={(active) => togglePromotion(promotion, active)} />
              </Card>
            ))}
            {promotions.length === 0 && <Card className="p-8 text-center text-sm text-gray-500">Nenhuma promoção publicada.</Card>}
          </div>
        </div>
      )}

      {activeTab === "highlights" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <Card className="h-fit p-5">
            <form className="space-y-4" onSubmit={saveHighlight}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-arena-orange" />
                <h2 className="font-bold text-gray-900">Novo destaque</h2>
              </div>
              <Field label="Título">
                <Input required value={highlightDraft.title} onChange={(event) => setHighlightDraft((draft) => ({ ...draft, title: event.target.value }))} />
              </Field>
              <Field label="Descrição">
                <Textarea value={highlightDraft.description} onChange={(event) => setHighlightDraft((draft) => ({ ...draft, description: event.target.value }))} />
              </Field>
              <Field label="Imagem URL">
                <Input value={highlightDraft.image_url} onChange={(event) => setHighlightDraft((draft) => ({ ...draft, image_url: event.target.value }))} />
              </Field>
              <Field label="Esporte">
                <OptionSelect value={highlightDraft.sport_id} onChange={(sport_id) => setHighlightDraft((draft) => ({ ...draft, sport_id }))} options={sports} placeholder="Todos os esportes" />
              </Field>
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <Field label="Prioridade">
                  <Input type="number" value={highlightDraft.priority} onChange={(event) => setHighlightDraft((draft) => ({ ...draft, priority: event.target.value }))} />
                </Field>
                <div className="flex h-10 items-center gap-2">
                  <Switch checked={highlightDraft.active} onCheckedChange={(active) => setHighlightDraft((draft) => ({ ...draft, active }))} />
                  <span className="text-sm font-medium text-gray-600">Ativo</span>
                </div>
              </div>
              <Button type="submit" disabled={isPending} className="w-full bg-arena-navy-800 text-white hover:bg-[#001D2C]">
                <Plus className="h-4 w-4" />
                Salvar destaque
              </Button>
            </form>
          </Card>

          <div className="space-y-3">
            {highlights.map((highlight) => (
              <Card key={highlight.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-900">{highlight.title}</h3>
                    <Badge variant={highlight.active ? "default" : "secondary"}>{highlight.active ? "Ativo" : "Pausado"}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">{highlight.description || "Sem descrição"}</p>
                  <p className="text-xs text-gray-400">{highlight.sports?.name ?? "Todos os esportes"} · prioridade {highlight.priority}</p>
                </div>
                <Switch checked={highlight.active} onCheckedChange={(active) => toggleHighlight(highlight, active)} />
              </Card>
            ))}
            {highlights.length === 0 && <Card className="p-8 text-center text-sm text-gray-500">Nenhum destaque publicado.</Card>}
          </div>
        </div>
      )}

      {activeTab === "open-games" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <Card className="h-fit p-5">
            <form className="space-y-4" onSubmit={saveOpenGame}>
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-arena-orange" />
                <h2 className="font-bold text-gray-900">Novo jogo aberto</h2>
              </div>
              <Field label="Esporte">
                <OptionSelect required value={openGameDraft.sport_id} onChange={(sport_id) => setOpenGameDraft((draft) => ({ ...draft, sport_id }))} options={sports} placeholder="Selecione o esporte" />
              </Field>
              <Field label="Atleta responsável">
                <OptionSelect required value={openGameDraft.owner_atleta_id} onChange={(owner_atleta_id) => setOpenGameDraft((draft) => ({ ...draft, owner_atleta_id }))} options={athletes} placeholder="Selecione o atleta" />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Data">
                  <Input required type="date" value={openGameDraft.date} onChange={(event) => setOpenGameDraft((draft) => ({ ...draft, date: event.target.value }))} />
                </Field>
                <Field label="Início">
                  <Input required type="time" value={openGameDraft.start_time} onChange={(event) => setOpenGameDraft((draft) => ({ ...draft, start_time: event.target.value }))} />
                </Field>
                <Field label="Fim">
                  <Input required type="time" value={openGameDraft.end_time} onChange={(event) => setOpenGameDraft((draft) => ({ ...draft, end_time: event.target.value }))} />
                </Field>
              </div>
              <Field label="Vagas necessárias">
                <Input type="number" min={1} value={openGameDraft.needed_players} onChange={(event) => setOpenGameDraft((draft) => ({ ...draft, needed_players: event.target.value }))} />
              </Field>
              <Field label="Observações">
                <Textarea value={openGameDraft.notes} onChange={(event) => setOpenGameDraft((draft) => ({ ...draft, notes: event.target.value }))} />
              </Field>
              <Button type="submit" disabled={isPending || sports.length === 0 || athletes.length === 0} className="w-full bg-arena-navy-800 text-white hover:bg-[#001D2C]">
                <UsersRound className="h-4 w-4" />
                Publicar jogo aberto
              </Button>
              {(sports.length === 0 || athletes.length === 0) && (
                <p className="text-xs text-gray-500">
                  Para publicar, a arena precisa ter pelo menos um esporte e um atleta vinculado.
                </p>
              )}
            </form>
          </Card>

          <div className="space-y-3">
            {openGames.map((game) => (
              <Card key={game.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-900">{game.sports?.name ?? "Esporte"}</h3>
                      <Badge variant={game.status === "open" ? "default" : "secondary"}>{game.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(`${game.date}T12:00:00`).toLocaleDateString("pt-BR")} · {game.start_time.slice(0, 5)} às {game.end_time.slice(0, 5)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Responsável: {game.atleta?.name ?? "Atleta"} · vagas {game.current_players}/{game.needed_players}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
            {openGames.length === 0 && <Card className="p-8 text-center text-sm text-gray-500">Nenhum jogo aberto publicado.</Card>}
          </div>
        </div>
      )}
    </div>
  )
}
