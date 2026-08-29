import type { ComponentType, ReactNode } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type {
  PlatformArena,
  PlatformArenaKind,
} from "@/modules/platform-admin/types/platform-admin.types"
import type { SuperAdminSection } from "@/modules/super-admin/sections"

export const STATUS_META: Record<
  PlatformArena["commercialStatus"],
  { label: string; dot: string; badge: string }
> = {
  cliente_ativo: {
    label: "Cliente ativo",
    dot: "bg-emerald-500",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  inadimplente: {
    label: "Inadimplente",
    dot: "bg-rose-500",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
  },
  prospect: {
    label: "Prospect",
    dot: "bg-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-900",
  },
  desativada: {
    label: "Desativada",
    dot: "bg-slate-400",
    badge: "border-slate-200 bg-slate-100 text-slate-700",
  },
  catalogo_publico: {
    label: "Catálogo público",
    dot: "bg-sky-500",
    badge: "border-sky-200 bg-sky-50 text-sky-800",
  },
  demonstracao: {
    label: "Demonstração",
    dot: "bg-violet-500",
    badge: "border-violet-200 bg-violet-50 text-violet-800",
  },
}

export const COMMERCIAL_STATUS_ORDER: PlatformArena["commercialStatus"][] = [
  "cliente_ativo",
  "inadimplente",
  "prospect",
  "catalogo_publico",
  "demonstracao",
  "desativada",
]

export const KIND_META: Record<PlatformArenaKind, { label: string; badge: string }> = {
  customer: {
    label: "Cliente",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  public_listing: {
    label: "Catálogo público",
    badge: "border-sky-200 bg-sky-50 text-sky-800",
  },
  demo: {
    label: "Demo / pitch",
    badge: "border-violet-200 bg-violet-50 text-violet-800",
  },
}

const SECTION_COPY: Record<
  SuperAdminSection,
  { index: string; eyebrow: string; title: string; description: string }
> = {
  overview: {
    index: "01",
    eyebrow: "Comando da operação",
    title: "Visão geral",
    description: "O que está saudável, o que precisa de ação e para onde a plataforma está crescendo.",
  },
  arenas: {
    index: "02",
    eyebrow: "Operação e catálogo",
    title: "Arenas",
    description: "Clientes, prospects e locais públicos com contexto comercial, geográfico e operacional.",
  },
  imports: {
    index: "03",
    eyebrow: "Expansão da cobertura",
    title: "Importação",
    description: "Encontre locais públicos, revise os dados e adicione arenas ao catálogo com segurança.",
  },
  finance: {
    index: "04",
    eyebrow: "Receita e cobrança",
    title: "Financeiro",
    description: "Assinaturas, inadimplência e prontidão das contas de recebimento da plataforma.",
  },
  athletes: {
    index: "05",
    eyebrow: "Comunidade esportiva",
    title: "Atletas",
    description: "Planos, origem, vínculos e frequência recente dos usuários finais do aplicativo.",
  },
  users: {
    index: "06",
    eyebrow: "Identidades e acesso",
    title: "Usuários",
    description: "Contas web, gestores e equipe interna com papéis e identidade de autenticação visíveis.",
  },
  engagement: {
    index: "07",
    eyebrow: "Saúde da base",
    title: "Engajamento",
    description: "Tendências de uso e sinais precoces de arenas que precisam de acompanhamento.",
  },
  settings: {
    index: "08",
    eyebrow: "Governança da plataforma",
    title: "Configurações",
    description: "Pix, split, planos internos e auditoria sem misturar gestão de clientes com operação global.",
  },
}

export function formatMoney(cents: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits,
  }).format(cents / 100)
}

export function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function PageIntro({
  section,
  action,
  signal,
}: {
  section: SuperAdminSection
  action?: ReactNode
  signal?: ReactNode
}) {
  const copy = SECTION_COPY[section]

  return (
    <header className="mb-6 flex flex-col justify-between gap-4 px-0.5 py-1 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold text-orange-700">
            {copy.eyebrow}
          </p>
          {signal}
        </div>
        <h1 className="mt-1.5 font-heading text-3xl font-bold tracking-tight text-arena-navy-950 sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {copy.description}
        </p>
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  )
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "paper",
}: {
  label: string
  value: string
  detail: string
  icon: ComponentType<{ className?: string }>
  tone?: "paper" | "navy" | "orange" | "warning"
}) {
  return (
    <article
      className={cn(
        "relative rounded-2xl border p-4",
        tone === "paper" && "border-slate-900/10 bg-white text-slate-950",
        tone === "navy" && "border-slate-200 bg-slate-950 text-white",
        tone === "orange" && "border-orange-200 bg-orange-50 text-slate-950",
        tone === "warning" && "border-rose-200 bg-rose-50 text-rose-950",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <p
          className={cn(
            "text-[11px] font-semibold",
            tone === "navy" ? "text-slate-400" : "text-slate-600",
          )}
        >
          {label}
        </p>
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
            tone === "navy" && "bg-white/10 text-orange-300",
            tone === "orange" && "bg-orange-100 text-orange-800",
            tone === "paper" && "bg-slate-100 text-slate-600",
            tone === "warning" && "bg-rose-100 text-rose-700",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-heading text-3xl font-bold leading-none tracking-tight">{value}</p>
      <p className={cn("mt-2 text-xs", tone === "navy" ? "text-slate-400" : "text-slate-500")}>{detail}</p>
    </article>
  )
}

export function Panel({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  dark = false,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  dark?: boolean
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border",
        dark ? "border-slate-800 bg-arena-navy-950 text-white" : "border-slate-900/10 bg-white",
        className,
      )}
    >
      <div className={cn("flex flex-col justify-between gap-3 border-b px-5 py-5 sm:flex-row sm:items-end", dark ? "border-white/10" : "border-slate-200")}>
        <div>
          <p className={cn("font-mono text-[9px] font-bold uppercase tracking-[0.2em]", dark ? "text-orange-300" : "text-orange-700")}>{eyebrow}</p>
          <h2 className="mt-1 font-heading text-xl font-black">{title}</h2>
          {description && <p className={cn("mt-1 text-xs leading-5", dark ? "text-slate-400" : "text-slate-500")}>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl border-slate-300 bg-white pl-11 shadow-none"
      />
    </div>
  )
}

export function FilterChip({
  active,
  onClick,
  children,
  accent = false,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  accent?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center justify-center rounded-xl border px-3 text-xs font-bold transition",
        active && !accent && "border-arena-navy-950 bg-arena-navy-950 text-white",
        active && accent && "border-orange-500 bg-orange-500 text-arena-navy-950",
        !active && "border-slate-300 bg-white text-slate-600 hover:border-slate-500 hover:text-slate-950",
      )}
    >
      {children}
    </button>
  )
}

export function StatusBadge({ status }: { status: PlatformArena["commercialStatus"] }) {
  const meta = STATUS_META[status]
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold", meta.badge)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  )
}

export function KindBadge({ kind }: { kind: PlatformArenaKind }) {
  const meta = KIND_META[kind]
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold", meta.badge)}>{meta.label}</span>
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="px-6 py-12 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-bold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
