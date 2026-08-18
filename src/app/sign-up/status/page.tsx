import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CircleAlert, Clock3, LogOut, ShieldCheck, XCircle } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { resolveAuthenticatedDbUser } from '@/lib/account-identity'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getSelfServiceArenaSignupStatus } from '@/modules/users/services/resolve-self-service-arena-signup'

const statusContent = {
  claim_pending: {
    icon: Clock3,
    eyebrow: 'Validação de propriedade',
    title: 'Sua solicitação está em análise',
    description:
      'Encontramos este local no catálogo público. Para proteger os dados da arena, nossa equipe precisa confirmar o vínculo antes de liberar o painel.',
    tone: 'border-amber-300 bg-amber-50 text-amber-950',
    iconTone: 'bg-amber-500 text-slate-950',
  },
  access_conflict: {
    icon: CircleAlert,
    eyebrow: 'Acesso existente',
    title: 'Esta arena precisa de uma revisão manual',
    description:
      'O documento informado já possui um cadastro ou encontrou mais de um local possível. Não criamos uma cópia. Nossa equipe vai orientar a recuperação ou a vinculação correta.',
    tone: 'border-orange-300 bg-orange-50 text-orange-950',
    iconTone: 'bg-orange-500 text-slate-950',
  },
  rejected: {
    icon: XCircle,
    eyebrow: 'Solicitação revisada',
    title: 'Não foi possível aprovar o vínculo',
    description:
      'A solicitação foi revisada, mas o vínculo com a arena não pôde ser confirmado. Entre em contato com o suporte se quiser enviar novas informações.',
    tone: 'border-rose-300 bg-rose-50 text-rose-950',
    iconTone: 'bg-rose-600 text-white',
  },
  none: {
    icon: ShieldCheck,
    eyebrow: 'Cadastro protegido',
    title: 'O acesso ao painel ainda não está disponível',
    description:
      'Não encontramos uma solicitação ativa para esta conta. Entre em contato com o suporte para que a equipe confira o cadastro.',
    tone: 'border-slate-300 bg-slate-50 text-slate-950',
    iconTone: 'bg-slate-950 text-white',
  },
} as const

export default async function ArenaSignupStatusPage() {
  const session = await createSupabaseServerClient()
  const { data, error } = await session.auth.getUser()
  if (error || !data.user) redirect('/sign-in?redirect_to=%2Fsign-up%2Fstatus')

  const dbUser = await resolveAuthenticatedDbUser(getSupabaseAdmin(), data.user.id)
  if (!dbUser?.id) redirect('/auth/sign-out?error=Usu%C3%A1rio%20n%C3%A3o%20provisionado')

  const signup = await getSelfServiceArenaSignupStatus(dbUser.id)
  if (signup.status === 'provisioned') redirect('/dashboard')

  const content = statusContent[signup.status]
  const Icon = content.icon
  const location = [signup.arenaName, signup.municipalityName].filter(Boolean).join(' · ')

  return (
    <main className="flex min-h-screen bg-[#F0E6D2] p-4 py-10">
      <section className="m-auto w-full max-w-2xl rounded-3xl bg-arena-navy-800 p-6 text-white shadow-2xl sm:p-10">
        <Link href="/" className="inline-flex">
          <Logo className="mb-10 transition-opacity hover:opacity-80" />
        </Link>

        <div className={`rounded-2xl border p-6 ${content.tone}`}>
          <div className={`grid h-12 w-12 place-items-center rounded-2xl ${content.iconTone}`}>
            <Icon className="h-6 w-6" />
          </div>
          <p className="mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.22em] opacity-70">
            {content.eyebrow}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-black tracking-tight">{content.title}</h1>
          <p className="mt-3 text-sm leading-6 opacity-80">{content.description}</p>

          {location && (
            <div className="mt-5 rounded-xl border border-current/15 bg-white/60 px-4 py-3">
              <p className="text-xs font-semibold opacity-65">Arena localizada</p>
              <p className="mt-1 font-bold">{location}</p>
            </div>
          )}

        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-xs leading-5 text-white/65">
            Você pode voltar a esta página depois de entrar. O painel será liberado automaticamente após a aprovação.
          </p>
          <Link
            href="/auth/sign-out"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold transition hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" /> Sair
          </Link>
        </div>
      </section>
    </main>
  )
}
