import Link from "next/link"
import { ExternalLink, Flag } from "lucide-react"
import { DashboardPage, DashboardPageHeader } from "@/components/dashboard/DashboardPageShell"
import { EmptyState } from "@/modules/super-admin/components/admin-ui"
import { listContentReports } from "@/modules/athlete-moderation/actions"
import {
  reasonLabels,
  reportMediaLink,
  statusLabels,
  statusSchema,
  targetLabels,
} from "@/modules/athlete-moderation/model"
import { ReviewDecision } from "@/modules/athlete-moderation/ReviewDecision"
import { cn } from "@/lib/utils"

const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
})

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; before?: string }>
}) {
  const query = await searchParams
  const status = statusSchema.safeParse(query.status).data ?? "pending"
  const cursor = Number(query.before)
  const before = Number.isSafeInteger(cursor) && cursor > 0 ? cursor : undefined
  const { rows, next } = await listContentReports(status, before)
  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Denúncias"
        icon={Flag}
        description="Analise o conteúdo sinalizado pelos atletas."
      />
      <section className="overflow-hidden rounded-2xl border border-slate-900/10 bg-white">
        <nav
          aria-label="Filtrar denúncias por situação"
          className="flex flex-wrap gap-1 border-b border-slate-200 p-3"
        >
          {statusSchema.options.map((key) => (
            <Link
              key={key}
              href={`/admin/moderation?status=${key}`}
              aria-current={status === key ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold",
                status === key ? "bg-arena-navy-950 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {statusLabels[key]}
            </Link>
          ))}
        </nav>
        {rows.length === 0 && (
          <EmptyState
            icon={Flag}
            title={status === "pending" ? "Nenhuma denúncia pendente" : "Nenhuma denúncia nesta página"}
            description={
              status === "pending"
                ? "Novas denúncias dos atletas aparecerão aqui."
                : "As decisões registradas ficam neste histórico."
            }
          />
        )}
        <ul className="divide-y divide-slate-100">
          {rows.map((report) => {
            const media = reportMediaLink(report.media_url)
            return (
              <li key={report.report_id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-arena-navy-950">
                      {targetLabels[report.target_type] ?? report.target_type}
                    </h2>
                    <p className="text-sm text-slate-600">
                      {reasonLabels[report.reason] ?? report.reason} ·{" "}
                      <time dateTime={report.created_at}>{date.format(new Date(report.created_at))}</time>
                    </p>
                  </div>
                  {report.status === "pending" && (
                    <ReviewDecision
                      reportId={report.report_id}
                      isProfile={report.target_type === "athlete"}
                    />
                  )}
                </div>
                {report.content_preview && (
                  <blockquote className="whitespace-pre-wrap break-words border-l-2 border-slate-200 pl-3 text-sm">
                    {report.content_preview}
                  </blockquote>
                )}
                {media && (
                  <a
                    href={media}
                    rel="noopener noreferrer"
                    target="_blank"
                    className="inline-flex items-center gap-1 text-sm text-orange-800 underline"
                  >
                    Abrir imagem denunciada
                    <ExternalLink size={13} />
                  </a>
                )}
                {report.details && (
                  <p className="whitespace-pre-wrap break-words text-sm">
                    <strong>Relato do atleta</strong>
                    <br />
                    {report.details}
                  </p>
                )}
                {report.review_note && (
                  <p className="whitespace-pre-wrap break-words text-sm">
                    <strong>Motivo da decisão</strong>
                    {report.reviewed_at && <> · {date.format(new Date(report.reviewed_at))}</>}
                    <br />
                    {report.review_note}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
        {(before || next) && (
          <nav
            aria-label="Paginação de denúncias"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm font-semibold text-orange-800"
          >
            {before && <Link href={`/admin/moderation?status=${status}`}>Voltar ao início</Link>}
            {next && (
              <Link className="ml-auto" href={`/admin/moderation?status=${status}&before=${next}`}>
                Ver mais antigas
              </Link>
            )}
          </nav>
        )}
      </section>
    </DashboardPage>
  )
}
