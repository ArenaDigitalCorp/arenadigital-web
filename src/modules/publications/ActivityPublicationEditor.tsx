"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, type FormEvent } from "react";
import { CalendarDays, Eye, ImagePlus, Megaphone, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  upsertArenaPromotionAction,
  upsertOpenGameAction,
} from "@/modules/mobile-content/actions/mobileContentActions";
import type {
  MobileContentOption,
  MobileOpenGame,
  MobilePromotion,
} from "@/modules/mobile-content/types/mobile-content.types";
import { PublicationDateField, PublicationSelect } from "./PublicationFields";
import { kinds } from "./model";

export type ActivityKind = "availability" | "open_game";

type Props = {
  kind: ActivityKind;
  arenaId: string;
  author: string;
  sports: MobileContentOption[];
  athletes: MobileContentOption[];
  promotion?: MobilePromotion;
  game?: MobileOpenGame;
  onTypeChange: (value: string) => void;
  onSaved: () => void;
  onCancel: () => void;
};

const field = "block space-y-2 text-sm font-medium text-arena-navy-800";
const primary = "bg-arena-button text-white hover:bg-arena-button-hover";
const typeOptions = [
  ...Object.entries(kinds).map(([value, label]) => ({ value, label })),
  { value: "availability", label: "Horário disponível" },
  { value: "open_game", label: "Jogo aberto" },
];

function localInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseDate(value: string, label: string) {
  const date = new Date(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    localInput(date.toISOString()) !== value
  ) {
    throw new Error(`Informe uma data e um horário válidos para ${label}.`);
  }
  return date;
}

function dateForSave(value: string, previous: string | null | undefined, label: string) {
  const date = parseDate(value, label);
  return previous && localInput(previous) === value ? previous : date.toISOString();
}

function withCurrentOption(options: MobileContentOption[], id: string, label: string) {
  return id && !options.some((option) => option.id === id)
    ? [...options, { id, name: label }]
    : options;
}

function ActivityImage({ url, alt, className }: { url: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div role="img" aria-label="Imagem indisponível" className="grid h-24 place-items-center bg-slate-100 text-sm text-slate-500">
      Imagem indisponível
    </div>
  ) : (
    <img src={url} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}

export function ActivityPublicationEditor(props: Props) {
  const id = props.kind === "availability" ? props.promotion?.id : props.game?.id;
  return <ActivityEditorForm key={`${props.arenaId}:${props.kind}:${id ?? "new"}`} {...props} />;
}

function ActivityEditorForm({
  kind, arenaId, author, sports, athletes, promotion, game,
  onTypeChange, onSaved, onCancel,
}: Props) {
  const availability = kind === "availability";
  const editing = Boolean(availability ? promotion : game);
  const [draft, setDraft] = useState(() => {
    const today = localInput(new Date().toISOString()).slice(0, 10);
    return {
      title: promotion?.title ?? "",
      description: promotion?.description ?? "",
      imageUrl: promotion?.image_url ?? "",
      sportId: (availability ? promotion?.sport_id : game?.sport_id) ?? "",
      ownerId: game?.owner_atleta_id ?? "",
      startsAt: availability
        ? localInput(promotion?.starts_at ?? new Date().toISOString())
        : `${game?.date ?? today}T${game?.start_time.slice(0, 5) ?? "19:00"}`,
      endsAt: availability
        ? localInput(promotion?.ends_at)
        : `${game?.date ?? today}T${game?.end_time.slice(0, 5) ?? "20:00"}`,
      neededPlayers: String(game?.needed_players ?? 1),
      notes: game?.notes ?? "",
    };
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = busy || uploading;
  const update = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const sportOptions = withCurrentOption(
    sports,
    draft.sportId,
    (availability ? promotion?.sports?.name : game?.sports?.name) ?? "Modalidade atual",
  );
  const athleteOptions = withCurrentOption(athletes, game?.owner_atleta_id ?? "", game?.atleta?.name ?? "Responsável atual");
  const sportName = sportOptions.find((sport) => sport.id === draft.sportId)?.name;
  const ownerName = athleteOptions.find((athlete) => athlete.id === draft.ownerId)?.name;
  const previewDate = new Date(draft.startsAt);
  const previewDay = Number.isFinite(previewDate.getTime())
    ? previewDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : "Selecione a data";

  async function upload(file: File | undefined) {
    if (!file || disabled) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Escolha uma imagem JPG, PNG ou WebP de até 5 MB.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("context", "arena");
      data.append("arenaId", arenaId);
      const response = await fetch("/api/publications/upload", { method: "POST", body: data });
      const result = await response.json().catch(() => null) as { error?: string; url?: string } | null;
      if (!response.ok || !result?.url) {
        setError(result?.error || "Não foi possível enviar a imagem. Tente novamente.");
        return;
      }
      update("imageUrl", result.url);
    } catch {
      setError("Não foi possível enviar a imagem. Verifique sua conexão e tente novamente.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setError("");
    setBusy(true);
    try {
      if (availability) {
        if (!draft.title.trim()) throw new Error("Informe o título da divulgação de horário.");
        if (!draft.imageUrl) throw new Error("Escolha uma imagem para a divulgação de horário.");
        const startsAt = dateForSave(draft.startsAt, promotion?.starts_at, "o início");
        const endsAt = draft.endsAt ? dateForSave(draft.endsAt, promotion?.ends_at, "o fim") : null;
        if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
          throw new Error("O fim da exibição deve ser posterior ao início.");
        }
        const result = await upsertArenaPromotionAction(arenaId, {
          ...(promotion ? { id: promotion.id } : {}),
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          image_url: draft.imageUrl,
          sport_id: draft.sportId || null,
          starts_at: startsAt,
          ends_at: endsAt,
          court_id: promotion?.court_id ?? null,
          price: promotion?.price ?? null,
          original_price: promotion?.original_price ?? null,
          weekday: promotion?.weekday ?? null,
          start_time: promotion?.start_time ?? null,
          end_time: promotion?.end_time ?? null,
          active: promotion?.active ?? true,
          priority: promotion?.priority ?? 0,
        });
        if (!result.success) throw new Error(result.error);
      } else {
        if (!draft.sportId) throw new Error("Selecione a modalidade do jogo.");
        if (!draft.ownerId) throw new Error("Selecione o atleta responsável pelo jogo.");
        parseDate(draft.startsAt, "o início");
        parseDate(draft.endsAt, "o fim");
        if (draft.startsAt.slice(0, 10) !== draft.endsAt.slice(0, 10)) {
          throw new Error("O início e o fim do jogo devem estar no mesmo dia.");
        }
        const date = draft.startsAt.slice(0, 10);
        const startTime = game && draft.startsAt.slice(11) === game.start_time.slice(0, 5) ? game.start_time : draft.startsAt.slice(11);
        const endTime = game && draft.endsAt.slice(11) === game.end_time.slice(0, 5) ? game.end_time : draft.endsAt.slice(11);
        if (new Date(`${date}T${endTime}`).getTime() <= new Date(`${date}T${startTime}`).getTime()) {
          throw new Error("O horário de término deve ser posterior ao início do jogo.");
        }
        const neededPlayers = Number(draft.neededPlayers);
        if (!Number.isInteger(neededPlayers) || neededPlayers < 1 || neededPlayers > 100) {
          throw new Error("Informe entre 1 e 100 vagas para o jogo.");
        }
        const result = await upsertOpenGameAction(arenaId, {
          ...(game ? { id: game.id } : {}),
          sport_id: draft.sportId,
          owner_atleta_id: draft.ownerId,
          date,
          start_time: startTime,
          end_time: endTime,
          needed_players: neededPlayers,
          notes: draft.notes.trim() || null,
        });
        if (!result.success) throw new Error(result.error);
      }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a publicação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Editor de publicação" className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={save} aria-busy={disabled} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
          <h2 className="text-lg font-semibold text-arena-navy-950">{editing ? "Editar publicação" : "Nova publicação"}</h2>
          <p className="mt-1 text-sm text-slate-500">Publicado por <strong className="font-medium text-arena-navy-800">{author}</strong></p>
        </div>
        {error && <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:mx-7">{error}</div>}
        <fieldset disabled={disabled} className="divide-y divide-slate-100">
          <section className="space-y-5 p-5 sm:p-7">
            <div>
              <h3 className="font-semibold text-arena-navy-950">{availability ? "Conteúdo" : "Detalhes do jogo"}</h3>
              <p className="mt-1 text-sm text-slate-500">{availability ? "Divulgue os horários disponíveis da sua arena." : "Convide atletas para completar um jogo na sua arena."}</p>
            </div>
            <div className="max-w-xs">
              <label className={field}>
                Tipo de publicação
                <PublicationSelect label="Tipo de publicação" value={kind} onChange={onTypeChange} options={typeOptions} disabled={disabled || editing} />
              </label>
            </div>
            {availability ? (
              <>
                <label className={field}>Título
                  <Input autoFocus required maxLength={160} placeholder="Ex.: Horários livres nesta semana" value={draft.title} onChange={(event) => update("title", event.target.value)} />
                </label>
                <label className={field}>Descrição
                  <Textarea maxLength={2000} rows={4} placeholder="Conte quais horários estão disponíveis e convide os atletas a reservar." className="min-h-28 resize-y" value={draft.description} onChange={(event) => update("description", event.target.value)} />
                </label>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-arena-navy-800">Imagem da publicação</span>
                  <input ref={fileRef} aria-label="Arquivo da imagem" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
                  <button
                    type="button" disabled={disabled} aria-busy={uploading}
                    aria-label={draft.imageUrl ? "Trocar imagem da publicação" : "Selecionar imagem da publicação"}
                    className="group flex min-h-40 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-5 text-center transition hover:border-arena-button hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arena-button disabled:cursor-wait disabled:opacity-60"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => { event.preventDefault(); if (!disabled) void upload(event.dataTransfer.files?.[0]); }}
                  >
                    {draft.imageUrl
                      ? <ActivityImage key={draft.imageUrl} url={draft.imageUrl} alt="Imagem selecionada" className="max-h-40 max-w-full rounded-lg object-contain" />
                      : <span className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-arena-button"><ImagePlus className="size-5" /></span>}
                    <span className="text-sm font-semibold text-arena-navy-800">{uploading ? "Enviando imagem…" : draft.imageUrl ? "Clique para trocar a imagem" : "Clique para escolher ou arraste uma imagem"}</span>
                    <span className="text-xs font-normal text-slate-500">JPG, PNG ou WebP · até 5 MB</span>
                  </button>
                  {draft.imageUrl && <Button type="button" variant="ghost" size="sm" onClick={() => update("imageUrl", "")} className="text-slate-500"><X />Remover imagem</Button>}
                </div>
              </>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <label className={field}>Modalidade
                  <PublicationSelect label="Modalidade" value={draft.sportId} onChange={(value) => update("sportId", value)} options={[{ value: "", label: "Selecione a modalidade" }, ...sportOptions.map((sport) => ({ value: sport.id, label: sport.name }))]} disabled={disabled} />
                </label>
                <label className={field}>Responsável pelo jogo
                  <PublicationSelect label="Responsável pelo jogo" value={draft.ownerId} onChange={(value) => update("ownerId", value)} options={[{ value: "", label: "Selecione um atleta" }, ...athleteOptions.map((athlete) => ({ value: athlete.id, label: athlete.name }))]} disabled={disabled} />
                </label>
                {!athleteOptions.length && <p className="text-sm text-slate-500 sm:col-span-2">Cadastre um atleta na arena para selecioná-lo como responsável pelo jogo.</p>}
              </div>
            )}
          </section>
          <section className="space-y-5 p-5 sm:p-7">
            <div>
              <h3 className="font-semibold text-arena-navy-950">{availability ? "Período de exibição" : "Quando será o jogo"}</h3>
              <p className="mt-1 text-sm text-slate-500">{availability ? "Defina quando a divulgação poderá aparecer no app." : "Escolha o início e o fim do jogo no mesmo dia."}</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <PublicationDateField label="Início" value={draft.startsAt} onChange={(value) => update("startsAt", value)} disabled={disabled} />
              <PublicationDateField label="Fim" value={draft.endsAt} onChange={(value) => update("endsAt", value)} disabled={disabled} optional={availability} />
            </div>
            <p className="text-xs text-slate-400">{availability ? "Horários no fuso do seu dispositivo." : "Informe os horários locais da arena."}</p>
          </section>
          <section className="space-y-5 p-5 sm:p-7">
            {availability ? (
              <label className={field}>Modalidade
                <PublicationSelect label="Modalidade" value={draft.sportId} onChange={(value) => update("sportId", value)} options={[{ value: "", label: "Todas as modalidades" }, ...sportOptions.map((sport) => ({ value: sport.id, label: sport.name }))]} disabled={disabled} />
              </label>
            ) : (
              <>
                <label className={`${field} max-w-xs`}>Vagas para atletas
                  <Input type="number" inputMode="numeric" min={1} max={100} step={1} required value={draft.neededPlayers} onChange={(event) => update("neededPlayers", event.target.value)} />
                </label>
                <label className={field}>Observações
                  <Textarea rows={4} maxLength={2000} className="min-h-28 resize-y" placeholder="Conte os detalhes para quem quer participar." value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
                </label>
              </>
            )}
          </section>
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/60 p-5 sm:px-7">
            <p className="max-w-sm text-xs leading-relaxed text-slate-500">{editing ? "As alterações mantêm a situação atual da publicação." : availability ? "A divulgação aparecerá no app durante o período definido." : "O jogo será publicado para os atletas encontrarem e participarem."}</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>Cancelar</Button>
              <Button className={primary} type="submit" disabled={disabled || (availability ? !draft.imageUrl : !draft.sportId || !draft.ownerId)}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Publicar"}</Button>
            </div>
          </div>
        </fieldset>
      </form>
      <aside className="space-y-4 xl:sticky xl:top-6">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Eye className="size-4" />Prévia no app</div>
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-arena-navy-950 text-white">{availability ? <Megaphone className="size-4" /> : <UsersRound className="size-4" />}</span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-arena-navy-950">{author}</p><p className="text-xs text-slate-400">{availability ? "Horário disponível" : "Jogo aberto"}</p></div>
          </div>
          {availability && (draft.imageUrl
            ? <ActivityImage key={draft.imageUrl} url={draft.imageUrl} alt="Prévia da imagem da publicação" className="aspect-[375/176] w-full object-cover" />
            : <div className="grid aspect-[375/176] place-items-center bg-slate-100 text-slate-300"><ImagePlus className="size-10" /></div>)}
          <div className="space-y-3 p-5">
            <h3 className="break-words font-semibold text-arena-navy-950">{availability ? draft.title || "Título da publicação" : sportName ? `Jogo de ${sportName}` : "Seu próximo jogo"}</h3>
            {!availability && <>
              <p className="flex items-center gap-2 text-sm text-slate-500"><CalendarDays className="size-4 shrink-0" />{previewDay} · {draft.startsAt.slice(11)} às {draft.endsAt.slice(11)}</p>
              <p className="flex items-center gap-2 text-sm text-slate-500"><UsersRound className="size-4 shrink-0" />{draft.neededPlayers || "0"} {draft.neededPlayers === "1" ? "vaga para atleta" : "vagas para atletas"}</p>
              <p className="text-xs text-slate-400">Responsável: {ownerName || "Selecione um atleta"}</p>
            </>}
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500">{availability ? draft.description || "Sua mensagem aparecerá aqui." : draft.notes || "Os detalhes do jogo aparecerão aqui."}</p>
          </div>
        </article>
        <p className="text-xs leading-relaxed text-slate-400">Prévia aproximada. A exibição respeita as informações e o período definidos.</p>
      </aside>
    </section>
  );
}
