import { z } from "zod";
export const kinds = {
  announcement: "Comunicado",
  ad: "Publicidade",
  promotion: "Promoção",
  news: "Novidade",
} as const;
export const publicationSchema = z.object({
  id: z.string().uuid(),
  arena_id: z.string().uuid().nullable(),
  arena_name: z.string().nullable().optional(),
  kind: z.enum(["announcement", "ad", "promotion", "news"]),
  title: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  cta_kind: z.string(),
  cta_url: z.string().nullable(),
  cta_label: z.string().nullable(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  active: z.boolean(),
  archived: z.boolean(),
  blocked_reason: z.string().nullable(),
  revision: z.number(),
  priority: z.number(),
  city_id: z.number().nullable(),
  sport_id: z.string().nullable(),
  created_at: z.string(),
});
export type Publication = z.infer<typeof publicationSchema>;
export const actionSchema = z.enum([
  "save",
  "publish",
  "pause",
  "archive",
  "restore",
  "block",
  "unblock",
]);
export type PublicationAction = z.infer<typeof actionSchema>;
export const eventSchema = z.object({
  id: z.number(),
  actor: z.string(),
  action: z.string(),
  reason: z.string().nullable(),
  created_at: z.string(),
  revision: z.number(),
});
export type PublicationEvent = z.infer<typeof eventSchema>;
export function publicationStatus(
  item: Pick<
    Publication,
    "blocked_reason" | "archived" | "active" | "starts_at" | "ends_at"
  >,
  now = Date.now(),
) {
  if (item.blocked_reason) return "Bloqueada";
  if (item.archived) return "Arquivada";
  if (!item.active) return "Pausada";
  if (item.ends_at && Date.parse(item.ends_at) <= now) return "Encerrada";
  if (Date.parse(item.starts_at) > now) return "Agendada";
  return "Publicada";
}
