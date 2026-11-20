"use server"

import { revalidatePath } from "next/cache"
import { assertPlatformSuperAdminAccess } from "@/lib/server-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { decisionSchema, statusSchema } from "./model"

const PAGE_SIZE = 25

export async function listContentReports(status: string, before?: number) {
  await assertPlatformSuperAdminAccess()
  const filter = statusSchema.parse(status)
  if (before !== undefined && (!Number.isSafeInteger(before) || before < 1))
    throw new Error("Página inválida.")
  const client = await createSupabaseServerClient()
  const { data, error } = await client.rpc("list_athlete_content_reports", {
    p_status: filter,
    p_before: before,
    p_limit: PAGE_SIZE + 1,
  })
  if (error || !data) throw new Error("Não foi possível carregar as denúncias.")
  const rows = data.slice(0, PAGE_SIZE)
  return { rows, next: data.length > PAGE_SIZE ? rows[PAGE_SIZE - 1].sequence_id : null }
}

export async function decideContentReport(reportId: string, action: string, note: string) {
  await assertPlatformSuperAdminAccess()
  const parsed = decisionSchema.safeParse({ reportId, action, note })
  if (!parsed.success)
    return { ok: false, message: "Selecione uma decisão e informe o motivo em até 500 caracteres." }
  const client = await createSupabaseServerClient()
  const result = await client.rpc("review_athlete_content_report", {
    p_report_id: parsed.data.reportId,
    p_action: parsed.data.action,
    p_note: parsed.data.note,
  })
  if (result.error)
    return {
      ok: false,
      message: "A decisão não foi registrada. Atualize a fila para conferir a situação da denúncia.",
    }
  revalidatePath("/admin/moderation")
  return { ok: true, message: "Decisão registrada." }
}
