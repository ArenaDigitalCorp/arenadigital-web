"use client";

import { CalendarDays, Pause, Pencil, Play, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MobileOpenGame, MobilePromotion } from "@/modules/mobile-content/types/mobile-content.types";

type Activity = MobilePromotion | MobileOpenGame;
export function activityStatus(item: Activity, now: number) {
  if ("title" in item) {
    if (item.ends_at && new Date(item.ends_at).getTime() <= now) return "Encerrada";
    if (!item.active) return "Pausada";
    return new Date(item.starts_at).getTime() > now ? "Agendada" : "Publicada";
  }
  if (["cancelled", "finished"].includes(item.status) || new Date(`${item.date}T${item.end_time}`).getTime() <= now) return "Encerrada";
  return item.visibility === "public" ? "Publicada" : "Pausada";
}

export function ActivityPublicationCard({ item, author, now, disabled, onEdit, onToggle }: {
  item: Activity; author: string; now: number; disabled: boolean; onEdit: () => void; onToggle: () => void;
}) {
  const promotion = "title" in item ? item : null;
  const game = "date" in item ? item : null;
  const status = activityStatus(item, now);
  const date = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 sm:flex-row">
      <div className="grid aspect-[375/176] w-full shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 sm:aspect-auto sm:h-28 sm:w-40">
        {promotion?.image_url ? (
          // Existing publication images may come from the arena's external media storage.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promotion.image_url} alt="" className="h-full w-full object-cover" />
        ) : game ? <UsersRound className="size-8" /> : <CalendarDays className="size-8" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${status === "Publicada" ? "bg-emerald-50 text-emerald-700" : status === "Agendada" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
            {game?.status === "cancelled" ? "Cancelada" : status}
          </span>
          <span className="text-xs text-slate-400">{promotion ? "Horário disponível" : "Jogo aberto"} · {author}</span>
        </div>
        <h3 className="break-words font-semibold text-arena-navy-950">{promotion?.title ?? `Jogo de ${game?.sports?.name ?? "esporte"}`}</h3>
        <p className="mt-1 line-clamp-2 break-words text-sm text-slate-500">{promotion?.description ?? game?.notes}</p>
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <CalendarDays className="size-3.5" />
          {promotion ? `${date(promotion.starts_at)} — ${promotion.ends_at ? date(promotion.ends_at) : "Sem data final"}` : game ? `${new Date(`${game.date}T12:00:00`).toLocaleDateString("pt-BR")} · ${game.start_time.slice(0, 5)} às ${game.end_time.slice(0, 5)}` : ""}
        </p>
        {game && <p className="mt-2 text-xs text-slate-500">Responsável: {game.atleta?.name ?? "Atleta"} · {game.current_players}/{game.needed_players} participantes{game.visibility !== "public" ? " · Visibilidade restrita" : ""}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {promotion && (promotion.active || status !== "Encerrada") && (
            <Button variant="outline" size="sm" disabled={disabled} onClick={onToggle}>
              {promotion.active ? <Pause /> : <Play />}{promotion.active ? "Retirar do ar" : "Publicar"}
            </Button>
          )}
          {(promotion || game?.status === "open" || game?.status === "full") && (
            <Button variant="outline" size="sm" disabled={disabled} onClick={onEdit}><Pencil />Editar</Button>
          )}
          {game && status !== "Encerrada" && (
            <Button variant="outline" size="sm" disabled={disabled} onClick={onToggle} className="border-red-200 text-red-700 hover:bg-red-50"><Pause />Cancelar jogo</Button>
          )}
        </div>
      </div>
    </article>
  );
}
