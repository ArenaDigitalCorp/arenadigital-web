import { z } from "zod"
import type { Database } from "@/types/supabase.types"

export type ContentReport = Database["public"]["Functions"]["list_athlete_content_reports"]["Returns"][number]
export const statusSchema = z.enum(["pending", "hidden", "dismissed"])
export const statusLabels = {
  pending: "Pendentes",
  hidden: "Conteúdo ocultado",
  dismissed: "Arquivadas",
} as const
export const decisionSchema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(["dismiss", "hide"]),
  note: z.string().trim().min(1).max(500),
})

export const targetLabels: Record<string, string> = {
  athlete: "Perfil de atleta",
  team_message: "Mensagem da Resenha",
  team: "Time",
  open_game: "Jogo do Game Match",
  open_game_request: "Solicitação no Game Match",
  publication: "Publicação",
}
export const reasonLabels: Record<string, string> = {
  harassment: "Assédio ou abuso",
  inappropriate: "Conteúdo impróprio",
  spam: "Spam",
  other: "Outro motivo",
}

export function reportMediaLink(raw: string | null) {
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol === "https:" && !url.username && !url.password) return url.href
  } catch {
    /* Older content may contain a storage path instead of a URL. */
  }
  return null
}
