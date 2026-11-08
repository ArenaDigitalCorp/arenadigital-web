"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  Pause,
  Play,
  Archive,
  ShieldAlert,
  History,
  ImagePlus,
  RefreshCw,
  Pencil,
  X,
  ArrowLeft,
  ArrowRight,
  Eye,
  Search,
  Building2,
  CalendarDays,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PublicationSelect, PublicationDateField } from "./PublicationFields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  changePublication,
  listPublications,
  publicationHistory,
  searchPublicationCities,
} from "./actions";
import {
  kinds,
  publicationStatus,
  type Publication,
  type PublicationAction,
  type PublicationEvent,
} from "./model";

type Props = {
  initialItems: Publication[];
  arenaId: string | null;
  platform: boolean;
  arenas: { id: string; name: string }[];
  sports?: { id: string; name: string }[];
};
const actions: Record<string, string> = {
  save: "Salvou alterações",
  publish: "Publicou",
  pause: "Retirou do ar",
  archive: "Arquivou",
  restore: "Restaurou pausada",
  block: "Removeu do app",
  unblock: "Liberou, mantendo pausada",
};
const localInput = (value: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const newDraft = (arenaId: string | null) => ({
  id: null as string | null,
  revision: null as number | null,
  arena_id: arenaId,
  kind: "ad" as Publication["kind"],
  title: "",
  description: "",
  image_url: "",
  cta_kind: arenaId ? "go_to_arena" : "none",
  cta_label: arenaId ? "Conhecer arena" : "",
  cta_url: "",
  starts_at: localInput(new Date().toISOString()),
  ends_at: "",
  priority: 0,
  city_id: null as number | null,
  sport_id: "",
});
function PublicationImage({
  url,
  alt,
  className,
}: {
  url: string;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div
      role="img"
      aria-label="Imagem indisponível"
      className="grid h-24 place-items-center bg-slate-100 text-sm text-slate-500"
    >
      Imagem indisponível
    </div>
  ) : (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
export function PublicationsManager({
  initialItems,
  arenaId,
  platform,
  arenas,
  sports = [],
}: Props) {
  const context = platform ? "platform" : "arena";
  const [items, setItems] = useState(initialItems),
    [draft, setDraft] = useState<ReturnType<typeof newDraft> | null>(null);
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Todas"),
    [now, setNow] = useState(Date.now());
  const [history, setHistory] = useState<{
      title: string;
      events: PublicationEvent[];
    } | null>(null),
    [block, setBlock] = useState<Publication | null>(null),
    [reason, setReason] = useState("");
  const [scope, setScope] = useState("platform");
  const fileRef = useRef<HTMLInputElement>(null);
  const [cities, setCities] = useState<{ id: number; name: string }[]>([]),
    [cityQuery, setCityQuery] = useState(""),
    [cityLoading, setCityLoading] = useState(false),
    [cityError, setCityError] = useState("");
  useEffect(() => {
    if (!platform || cityQuery.trim().length < 2) {
      setCities([]);
      setCityLoading(false);
      return;
    }
    let cancelled = false;
    setCityLoading(true);
    const timer = setTimeout(() => {
      searchPublicationCities(cityQuery)
        .then((rows) => {
          if (!cancelled) {
            setCities(rows);
            setCityError("");
          }
        })
        .catch(() => {
          if (!cancelled) setCityError("Não foi possível buscar cidades.");
        })
        .finally(() => {
          if (!cancelled) setCityLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [platform, cityQuery]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setItems(await listPublications(arenaId, context));
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setBusy(false);
    }
  }
  function edit(item: Publication) {
    if (platform && item.arena_id) return;
    setDraft({
      ...newDraft(item.arena_id),
      ...item,
      description: item.description ?? "",
      image_url: item.image_url ?? "",
      cta_label: item.cta_label ?? "",
      cta_url: item.cta_url ?? "",
      sport_id: item.sport_id ?? "",
      starts_at: localInput(item.starts_at),
      ends_at: localInput(item.ends_at),
    });
    setError("");
    setNotice("");
  }
  async function run(
    action: PublicationAction,
    item: Publication,
    payload: Record<string, unknown> = {},
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await changePublication({
        context,
        action,
        id: item.id,
        revision: item.revision,
        arenaId: item.arena_id,
        payload,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setItems((rows) =>
        rows.map((row) =>
          row.id === item.id
            ? { ...result.data, arena_name: row.arena_name }
            : row,
        ),
      );
      setBlock(null);
      if (draft?.id === item.id) setDraft(null);
      setNotice(
        action === "pause"
          ? "Publicação retirada do ar. O feed será atualizado na próxima sincronização."
          : {
              publish:
                publicationStatus(result.data) === "Agendada"
                  ? "Publicação agendada."
                  : "Publicação no ar.",
              archive: "Publicação arquivada e fora do ar.",
              restore:
                "Publicação restaurada e pausada. Revise antes de publicar.",
              block:
                "Publicação removida do app. O motivo ficará visível para a arena.",
              unblock: "Bloqueio removido. A publicação continua pausada.",
              save: "Conteúdo salvo e pausado.",
            }[action],
      );
    } catch {
      setError(
        "Não foi possível confirmar a operação. Atualize a lista antes de tentar novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const original = items.find((item) => item.id === draft.id);
      const dateValue = (value: string, old: string | null | undefined) =>
        !value
          ? null
          : old && localInput(old) === value
            ? old
            : new Date(value).toISOString();
      const result = await changePublication({
        context,
        action: "save",
        id: draft.id,
        revision: draft.revision,
        arenaId: draft.arena_id,
        payload: {
          ...draft,
          starts_at: dateValue(draft.starts_at, original?.starts_at),
          ends_at: dateValue(draft.ends_at, original?.ends_at),
          sport_id: draft.sport_id || null,
        },
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const row = {
        ...result.data,
        arena_name:
          arenas.find((a) => a.id === result.data.arena_id)?.name ?? null,
      };
      setItems((rows) => [row, ...rows.filter((r) => r.id !== row.id)]);
      setDraft(null);
      setNotice(
        row.blocked_reason
          ? "Alterações salvas. A publicação continua bloqueada; aguarde a revisão da plataforma."
          : row.archived
            ? "Alterações salvas. Restaure a publicação arquivada antes de publicar."
            : "Conteúdo salvo e pausado. Revise e clique em Publicar quando estiver pronto.",
      );
    } catch {
      setError(
        "Não foi possível salvar. Confira as datas ou atualize a lista.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file || !draft) return;
    setUploading(true);
    setError("");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("context", context);
      if (draft.arena_id) data.append("arenaId", draft.arena_id);
      const response = await fetch("/api/publications/upload", {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Falha no upload.");
      setDraft((d) => (d ? { ...d, image_url: result.url } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar imagem.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const disabled = busy || uploading;
  const primary = "bg-arena-button text-white hover:bg-arena-button-hover";
  const author = platform ? "Arena Digital" : (arenas[0]?.name ?? "Sua arena");
  const moderating = platform && scope === "arenas";
  const scopedItems = items.filter(
    (item) =>
      !platform || (scope === "arenas" ? !!item.arena_id : !item.arena_id),
  );
  const visible = scopedItems.filter(
    (item) =>
      (filter === "Todas" || publicationStatus(item, now) === filter) &&
      `${item.title} ${item.arena_name ?? "Arena Digital"}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const update = (key: string, value: unknown) =>
    setDraft((d) => (d ? { ...d, [key]: value } : null));
  const field = "block space-y-2 text-sm font-medium text-arena-navy-800";
  const ctaOptions = [
    { value: "none", label: "Sem botão" },
    ...(!platform
      ? [
          { value: "go_to_arena", label: "Conhecer arena" },
          { value: "go_to_reserva", label: "Reservar horário" },
        ]
      : []),
    { value: "external_url", label: "Abrir link" },
    { value: "go_to_jogos", label: "Ir para jogos" },
    { value: "go_to_buscar", label: "Ir para busca" },
    { value: "go_to_perfil", label: "Ir para perfil" },
  ];
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 pb-8 pt-14 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {platform ? "Área admin" : "Painel da arena"} · {author}
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-arena-navy-950 sm:text-3xl">
            Publicações
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
            {platform
              ? "Crie conteúdos da Arena Digital e acompanhe as publicações das arenas."
              : "Crie comunicados, promoções, publicidades e novidades da sua arena para a Home dos atletas."}
          </p>
        </div>
        {!draft && !moderating && (
          <Button
            className={primary}
            disabled={disabled}
            onClick={() => {
              setDraft(newDraft(platform ? null : arenaId));
              setError("");
              setNotice("");
            }}
          >
            <Plus />
            Nova publicação
          </Button>
        )}
        {draft && (
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => setDraft(null)}
          >
            <ArrowLeft />
            Voltar às publicações
          </Button>
        )}
      </header>
      {!platform && !draft && (
        <p className="text-sm text-slate-500">
          Para divulgar uma vaga ou disponibilidade específica, acesse{" "}
          <Link className="font-medium text-arena-navy-800 underline underline-offset-4" href={`/dashboard/arenas/${arenaId}/mobile-content/scheduling`}>
            horários e jogos
          </Link>.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          {notice}
        </div>
      )}
      {draft ? (
        <section
          aria-label="Editor de publicação"
          className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
        >
          <form
            onSubmit={save}
            className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
              <h2 className="text-lg font-semibold text-arena-navy-950">
                {draft.id ? "Editar publicação" : "Nova publicação"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Publicado por{" "}
                <strong className="font-medium text-arena-navy-800">
                  {author}
                </strong>
              </p>
            </div>
            <fieldset disabled={disabled} className="divide-y divide-slate-100">
              <section className="space-y-5 p-5 sm:p-7">
                <div>
                  <h3 className="font-semibold text-arena-navy-950">
                    Conteúdo
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Uma imagem e uma mensagem para os atletas.
                  </p>
                </div>
                <div className="max-w-xs">
                  <label className={field}>
                    Tipo de publicação
                    <PublicationSelect
                      label="Tipo de publicação"
                      value={draft.kind}
                      onChange={(v) => update("kind", v)}
                      options={Object.entries(kinds).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                      disabled={disabled}
                    />
                  </label>
                </div>
                <label className={field}>
                  Título
                  <Input
                    autoFocus
                    required
                    maxLength={160}
                    placeholder="O que você quer compartilhar?"
                    value={draft.title}
                    onChange={(e) => update("title", e.target.value)}
                  />
                </label>
                <label className={field}>
                  Descrição
                  <Textarea
                    required
                    maxLength={2000}
                    rows={4}
                    placeholder="Conte os detalhes e convide os atletas a participar."
                    className="min-h-28 resize-y"
                    value={draft.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </label>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-arena-navy-800">
                    Imagem da publicação
                  </span>
                  <input
                    ref={fileRef}
                    aria-label="Arquivo da imagem"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={disabled}
                    className="hidden"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={
                      draft.image_url
                        ? "Trocar imagem da publicação"
                        : "Selecionar imagem da publicação"
                    }
                    aria-busy={uploading}
                    className="group flex min-h-40 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-5 text-center transition hover:border-arena-button hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arena-button disabled:cursor-wait disabled:opacity-60"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!disabled) void upload(e.dataTransfer.files?.[0]);
                    }}
                  >
                    {draft.image_url ? (
                      <PublicationImage
                        key={draft.image_url}
                        url={draft.image_url}
                        alt="Imagem selecionada"
                        className="max-h-40 max-w-full rounded-lg object-contain"
                      />
                    ) : (
                      <span className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-arena-button">
                        <ImagePlus className="size-5" />
                      </span>
                    )}
                    <span className="text-sm font-semibold text-arena-navy-800">
                      {uploading
                        ? "Enviando imagem…"
                        : draft.image_url
                          ? "Clique para trocar a imagem"
                          : "Clique para escolher ou arraste uma imagem"}
                    </span>
                    <span className="text-xs font-normal text-slate-500">
                      JPG, PNG ou WebP · até 5 MB
                    </span>
                  </button>
                  {draft.image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => update("image_url", "")}
                      className="text-slate-500"
                    >
                      <X />
                      Remover imagem
                    </Button>
                  )}
                </div>
              </section>
              <section className="space-y-5 p-5 sm:p-7">
                <div>
                  <h3 className="font-semibold text-arena-navy-950">
                    Período de exibição
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Defina quando o conteúdo poderá aparecer no app.
                  </p>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <PublicationDateField
                    label="Início"
                    value={draft.starts_at}
                    onChange={(v) => update("starts_at", v)}
                    disabled={disabled}
                  />
                  <PublicationDateField
                    label="Fim"
                    value={draft.ends_at}
                    onChange={(v) => update("ends_at", v)}
                    disabled={disabled}
                    optional
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Horários no fuso do seu dispositivo. O conteúdo só entra no ar
                  após publicar.
                </p>
              </section>
              <section className="space-y-5 p-5 sm:p-7">
                <div>
                  <h3 className="font-semibold text-arena-navy-950">
                    Botão e público
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Escolha o próximo passo de quem visualizar a publicação.
                  </p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className={field}>
                    Ação do botão
                    <PublicationSelect
                      label="Ação do botão"
                      value={draft.cta_kind}
                      onChange={(v) => update("cta_kind", v)}
                      options={ctaOptions}
                      disabled={disabled}
                    />
                  </label>
                  {draft.cta_kind !== "none" && (
                    <label className={field}>
                      Texto do botão
                      <Input
                        required
                        maxLength={120}
                        placeholder="Ex.: Saiba mais"
                        value={draft.cta_label}
                        onChange={(e) => update("cta_label", e.target.value)}
                      />
                    </label>
                  )}
                </div>
                {draft.cta_kind === "external_url" && (
                  <label className={field}>
                    Link de destino
                    <Input
                      type="url"
                      required
                      pattern="https://.*"
                      placeholder="https://"
                      value={draft.cta_url}
                      onChange={(e) => update("cta_url", e.target.value)}
                    />
                  </label>
                )}
                <label className={field}>
                  Modalidade
                  <PublicationSelect
                    label="Modalidade"
                    value={draft.sport_id}
                    onChange={(v) => update("sport_id", v)}
                    options={[
                      { value: "", label: "Todas as modalidades" },
                      ...sports.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                    disabled={disabled}
                  />
                </label>
                {platform && (
                  <details className="rounded-xl border border-slate-200 p-4">
                    <summary className="cursor-pointer text-sm font-medium text-arena-navy-800">
                      Segmentação e prioridade{" "}
                      <span className="ml-1 font-normal text-slate-400">
                        · opcional
                      </span>
                    </summary>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label className={field}>
                        Buscar cidade
                        <Input
                          value={cityQuery}
                          placeholder="Digite ao menos 2 letras"
                          onChange={(e) => setCityQuery(e.target.value)}
                        />
                      </label>
                      <label className={field}>
                        Público por cidade
                        <PublicationSelect
                          label="Público por cidade"
                          value={draft.city_id?.toString() ?? ""}
                          onChange={(v) =>
                            update("city_id", v ? Number(v) : null)
                          }
                          disabled={disabled}
                          options={[
                            { value: "", label: "Todas as cidades" },
                            ...(draft.city_id &&
                            !cities.some((c) => c.id === draft.city_id)
                              ? [
                                  {
                                    value: String(draft.city_id),
                                    label: "Cidade já definida",
                                  },
                                ]
                              : []),
                            ...cities.map((c) => ({
                              value: String(c.id),
                              label: c.name,
                            })),
                          ]}
                        />
                      </label>
                      <label className={field}>
                        Prioridade
                        <Input
                          type="number"
                          min={-100000}
                          max={100000}
                          value={draft.priority}
                          onChange={(e) =>
                            update("priority", Number(e.target.value))
                          }
                        />
                      </label>
                    </div>
                    {cityLoading && (
                      <p role="status" className="mt-2 text-xs text-slate-500">
                        Buscando cidades…
                      </p>
                    )}
                    {cityError && (
                      <p role="alert" className="mt-2 text-xs text-red-700">
                        {cityError}
                      </p>
                    )}
                  </details>
                )}
              </section>
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/60 p-5 sm:px-7">
                <p className="max-w-sm text-xs leading-relaxed text-slate-500">
                  Salvar mantém a publicação fora do ar. Revise o conteúdo e
                  publique quando estiver pronto.
                </p>
                <Button
                  className={primary}
                  type="submit"
                  disabled={disabled || !draft.image_url}
                >
                  {busy ? "Salvando…" : "Salvar publicação"}
                </Button>
              </div>
            </fieldset>
          </form>
          <aside className="space-y-4 xl:sticky xl:top-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Eye className="size-4" />
              Prévia no app
            </div>
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-arena-navy-950 text-white">
                  <Megaphone className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-arena-navy-950">
                    {author}
                  </p>
                  <p className="text-xs text-slate-400">{kinds[draft.kind]}</p>
                </div>
              </div>
              {draft.image_url ? (
                <PublicationImage
                  key={draft.image_url}
                  url={draft.image_url}
                  alt="Prévia da imagem da publicação"
                  className="aspect-[375/176] w-full object-cover"
                />
              ) : (
                <div className="grid aspect-[375/176] place-items-center bg-slate-100 text-slate-300">
                  <ImagePlus className="size-10" />
                </div>
              )}
              <div className="space-y-3 p-5">
                <h3 className="break-words font-semibold text-arena-navy-950">
                  {draft.title || "Título da publicação"}
                </h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500">
                  {draft.description || "Sua mensagem aparecerá aqui."}
                </p>
                {draft.cta_kind !== "none" && (
                  <span className="inline-flex text-sm font-semibold text-arena-button">
                    {draft.cta_label || "Ação do botão"}{" "}
                    <ArrowRight className="ml-1 size-4" />
                  </span>
                )}
              </div>
            </article>
            <p className="text-xs leading-relaxed text-slate-400">
              Prévia aproximada. A exibição respeita o período e o público
              selecionados.
            </p>
          </aside>
        </section>
      ) : (
        <>
          {platform && (
            <Tabs
              value={scope}
              onValueChange={(v) => {
                setScope(v);
                setFilter("Todas");
                setSearch("");
                setNotice("");
              }}
            >
              <TabsList
                variant="line"
                aria-label="Origem das publicações"
                className="h-auto w-full justify-start border-b border-slate-200 pb-0"
              >
                <TabsTrigger
                  id="publications-platform-tab"
                  aria-controls="publications-panel"
                  value="platform"
                  className="gap-2 px-4 py-3"
                >
                  <Megaphone className="size-4" />
                  Arena Digital
                  <span className="rounded-md bg-slate-100 px-1.5 text-xs text-slate-500">
                    {items.filter((i) => !i.arena_id).length}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  id="publications-arenas-tab"
                  aria-controls="publications-panel"
                  value="arenas"
                  className="gap-2 px-4 py-3"
                >
                  <Building2 className="size-4" />
                  Publicações das arenas
                  <span className="rounded-md bg-slate-100 px-1.5 text-xs text-slate-500">
                    {items.filter((i) => i.arena_id).length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <section
            id="publications-panel"
            role={platform ? "tabpanel" : undefined}
            tabIndex={platform ? 0 : undefined}
            aria-labelledby={platform ? `publications-${scope}-tab` : undefined}
            aria-label={platform ? undefined : "Publicações da autoria"}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-arena-navy-950">
                  {moderating ? "Moderação das arenas" : "Suas publicações"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {moderating
                    ? "As arenas criam seus conteúdos. Aqui você pode remover do app quando necessário."
                    : "Gerencie o que está no ar, agendado ou pausado."}
                </p>
              </div>
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() => void refresh()}
                className="text-slate-500"
              >
                <RefreshCw className={busy ? "animate-spin" : ""} />
                Atualizar
              </Button>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
                <Input
                  className="h-10 border-0 bg-slate-50 pl-9 shadow-none"
                  aria-label="Buscar publicações"
                  placeholder={
                    moderating
                      ? "Buscar por título ou arena…"
                      : "Buscar por título…"
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="sm:w-48">
                <PublicationSelect
                  label="Filtrar por situação"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    "Todas",
                    "Publicada",
                    "Agendada",
                    "Pausada",
                    "Encerrada",
                    "Bloqueada",
                    "Arquivada",
                  ].map((s) => ({
                    value: s,
                    label: s === "Todas" ? "Todas as situações" : s,
                  }))}
                />
              </div>
            </div>
            <div className="space-y-3">
              {visible.map((item) => {
                const state = publicationStatus(item, now);
                const moderationOnly = platform && !!item.arena_id;
                return (
                  <article
                    key={item.id}
                    className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 sm:flex-row"
                  >
                    <div className="aspect-[375/176] w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:aspect-auto sm:h-28 sm:w-40">
                      {item.image_url && (
                        <PublicationImage
                          key={item.image_url}
                          url={item.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${state === "Bloqueada" ? "bg-red-50 text-red-700" : state === "Publicada" ? "bg-emerald-50 text-emerald-700" : state === "Agendada" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}
                        >
                          {moderationOnly && item.blocked_reason
                            ? "Removida do app"
                            : state}
                        </span>
                        <span className="text-xs text-slate-400">
                          {kinds[item.kind]} ·{" "}
                          {item.arena_name ?? "Arena Digital"}
                        </span>
                      </div>
                      <h3 className="break-words font-semibold text-arena-navy-950">
                        {item.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 break-words text-sm text-slate-500">
                        {item.description}
                      </p>
                      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <CalendarDays className="size-3.5" />
                        {new Date(item.starts_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                        <span>—</span>
                        {item.ends_at
                          ? new Date(item.ends_at).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "Sem data final"}
                      </p>
                      {item.blocked_reason && (
                        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                          Removida pela plataforma: {item.blocked_reason}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!moderationOnly && (
                          <>
                            {item.active ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-200 text-red-700 hover:bg-red-50"
                                disabled={disabled}
                                onClick={() => void run("pause", item)}
                              >
                                <Pause />
                                Retirar do ar
                              </Button>
                            ) : (
                              !item.archived &&
                              !item.blocked_reason && (
                                <Button
                                  size="sm"
                                  className={primary}
                                  disabled={
                                    disabled ||
                                    publicationStatus(
                                      { ...item, active: true },
                                      now,
                                    ) === "Encerrada"
                                  }
                                  onClick={() => void run("publish", item)}
                                >
                                  <Play />
                                  Publicar
                                </Button>
                              )
                            )}
                            {!item.archived && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={disabled}
                                onClick={() => edit(item)}
                              >
                                <Pencil />
                                Editar
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={disabled}
                              onClick={() =>
                                void run(
                                  item.archived ? "restore" : "archive",
                                  item,
                                )
                              }
                              className="text-slate-500"
                            >
                              <Archive />
                              {item.archived ? "Restaurar pausada" : "Arquivar"}
                            </Button>
                          </>
                        )}
                        {moderationOnly &&
                          (item.blocked_reason ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={disabled}
                              onClick={() => void run("unblock", item)}
                            >
                              <ShieldAlert />
                              Liberar para a arena
                            </Button>
                          ) : (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={disabled}
                              onClick={() => {
                                setBlock(item);
                                setReason("");
                                setError("");
                              }}
                            >
                              <Trash2 />
                              Remover do app
                            </Button>
                          ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          className="text-slate-500"
                          onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                              const result = await publicationHistory(
                                item.id,
                                item.arena_id,
                                context,
                              );
                              if (result.success)
                                setHistory({
                                  title: item.title,
                                  events: result.data,
                                });
                              else setError(result.error);
                            } catch {
                              setError("Falha ao carregar histórico.");
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <History />
                          Histórico
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {!visible.length && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-14 text-center">
                <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-slate-50 text-slate-400">
                  <Megaphone className="size-5" />
                </span>
                <h3 className="font-medium text-arena-navy-800">
                  {search || filter !== "Todas"
                    ? "Nenhuma publicação encontrada"
                    : moderating
                      ? "Nenhuma publicação das arenas"
                      : "Sua primeira publicação começa aqui"}
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                  {search || filter !== "Todas"
                    ? "Tente outro título ou altere o filtro de situação."
                    : moderating
                      ? "Os conteúdos criados pelas arenas aparecerão aqui para acompanhamento."
                      : "Compartilhe novidades, campanhas e comunicados com os atletas."}
                </p>
              </div>
            )}
          </section>
        </>
      )}
      <Dialog
        open={!!block}
        onOpenChange={(open) => {
          if (!open && !disabled) setBlock(null);
        }}
      >
        <DialogContent className="rounded-2xl" showCloseButton={!disabled}>
          <DialogHeader>
            <DialogTitle>Remover publicação do app?</DialogTitle>
            <DialogDescription>
              O conteúdo ficará fora do ar e a arena não poderá republicá-lo até
              a liberação da plataforma. O histórico será preservado.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-medium text-arena-navy-950">{block?.title}</p>
            <p className="mt-1 text-slate-500">{block?.arena_name}</p>
          </div>
          <label className={field}>
            Motivo da remoção
            <Textarea
              autoFocus
              maxLength={1000}
              rows={3}
              placeholder="Explique o que precisa ser corrigido. A arena verá este motivo."
              disabled={disabled}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => setBlock(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={disabled || !reason.trim()}
              onClick={() => {
                if (block) void run("block", block, { reason });
              }}
            >
              <Trash2 />
              {busy ? "Removendo…" : "Remover do app"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!history}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Histórico da publicação</DialogTitle>
            <DialogDescription>{history?.title}</DialogDescription>
          </DialogHeader>
          {history?.events.length ? (
            <ol className="space-y-5 py-2">
              {history.events.map((event) => (
                <li
                  key={event.id}
                  className="border-l-2 border-slate-200 pl-4 text-sm"
                >
                  <strong className="font-medium text-arena-navy-950">
                    {actions[event.action] ?? event.action}
                  </strong>
                  <p className="mt-1 text-xs text-slate-500">
                    {event.actor} ·{" "}
                    {new Date(event.created_at).toLocaleString("pt-BR")}
                  </p>
                  {event.reason && (
                    <p className="mt-2 rounded-lg bg-slate-50 p-2 text-slate-600">
                      {event.reason}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">
              Publicação anterior ao histórico de ações. Novas alterações serão
              registradas.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
