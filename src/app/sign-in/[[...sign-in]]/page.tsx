'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/shared/Logo'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { ensureWebBackofficeAccessAction, provisionAfterSignUpAction } from '@/modules/auth/actions/authActions'
import { trackAction } from '@/lib/telemetry/client'

const inputLight =
  'w-full rounded-lg border border-zinc-700 bg-white px-3 py-2.5 text-sm text-black placeholder-zinc-500 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400'

const btnPrimary =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-arena-button py-2.5 text-sm font-semibold text-white transition hover:bg-arena-button-hover active:scale-[.98] disabled:opacity-60 disabled:pointer-events-none'

type Mode = 'password' | 'otp_request' | 'otp_verify' | 'forgot'

function normalizeRedirectPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard'
  }

  return value
}

export default function SignInPage() {
  const searchParams = useSearchParams()
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), [])
  const redirectTo = normalizeRedirectPath(searchParams.get('redirect_to'))

  const [mode, setMode] = React.useState<Mode>('password')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const errorMessage = searchParams.get('error')
    if (errorMessage) toast.error(errorMessage)
  }, [searchParams])

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      trackAction('signin_password', 'failure', { source: 'auth_provider' })
      setLoading(false)
      toast.error(error.message)
      return
    }

    if (!data.session) {
      trackAction('signin_password', 'failure', { source: 'missing_session' })
      setLoading(false)
      toast.error('Não foi possível iniciar sua sessão. Tente novamente.')
      return
    }

    const provision = await provisionAfterSignUpAction()
    if (!provision.success) {
      console.error('provisionAfterSignUpAction:', provision.error)
    }

    const webAccess = await ensureWebBackofficeAccessAction()
    if (!webAccess.success) {
      trackAction('signin_password', 'failure', { source: 'web_access_denied' })
      await supabase.auth.signOut()
      setLoading(false)
      toast.error(webAccess.error)
      return
    }

    trackAction('signin_password', 'success')
    window.location.replace(redirectTo)
  }

  const handleOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })
    setLoading(false)
    if (error) {
      trackAction('signin_otp', 'failure', { source: 'auth_provider' })
      toast.error(error.message)
      return
    }
    toast.success('Link de acesso enviado para seu e-mail.')
    trackAction('signin_otp', 'success')
    setMode('otp_verify')
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (error) {
      trackAction('password_reset_request', 'failure', { source: 'auth_provider' })
      toast.error(error.message)
      return
    }
    toast.success('Enviamos um e-mail com instruções para redefinir sua senha.')
    trackAction('password_reset_request', 'success')
    setMode('password')
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F0E6D2] overflow-y-auto">
      <div className="m-auto w-full max-w-[500px] bg-arena-navy-800 rounded-3xl p-6 sm:p-10 md:p-16 shadow-2xl flex flex-col items-center">
        <Logo className="mb-10 hover:opacity-80 transition-opacity cursor-pointer" />

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold text-white tracking-tight">Boas vindas!</h1>
            <p className="text-sm text-white/80">
              {mode === 'forgot'
                ? 'Redefina sua senha'
                : mode === 'otp_verify'
                  ? 'Confira seu e-mail'
                  : 'Entre com sua conta'}
            </p>
          </div>

          {(mode === 'password' || mode === 'otp_request' || mode === 'otp_verify') && (
            <div className="flex rounded-lg bg-white/5 p-1 text-xs">
              <button
                type="button"
                onClick={() => setMode('password')}
                className={`flex-1 rounded-md py-2 transition ${mode === 'password' ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
              >
                Senha
              </button>
              <button
                type="button"
                onClick={() => setMode('otp_request')}
                className={`flex-1 rounded-md py-2 transition ${mode === 'otp_request' || mode === 'otp_verify' ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
              >
                Link por e-mail
              </button>
            </div>
          )}

          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="flex flex-col gap-4">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
                className={inputLight}
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputLight} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <>Entrar <ArrowRight className="size-4" /></>}
              </button>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-xs text-white/80 underline underline-offset-2 hover:text-white"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {mode === 'otp_request' && (
            <form onSubmit={handleOtpRequest} className="flex flex-col gap-4">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
                className={inputLight}
              />
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <>Enviar link <ArrowRight className="size-4" /></>}
              </button>
            </form>
          )}

          {mode === 'otp_verify' && (
            <div className="flex flex-col gap-4">
              <p className="text-center text-xs text-white/70">
                Enviamos um link de acesso para <span className="font-semibold text-white">{email}</span>.
                Abra o e-mail e clique no link para entrar automaticamente.
              </p>
              <button
                type="button"
                onClick={() => setMode('otp_request')}
                className={btnPrimary}
              >
                Enviar novamente
              </button>
              <button
                type="button"
                onClick={() => setMode('password')}
                className="text-xs text-white/80 underline underline-offset-2 hover:text-white"
              >
                Entrar com senha
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="flex flex-col gap-4">
              <p className="text-center text-xs text-white/70">
                Informe o e-mail da sua conta para receber o link de redefinição.
              </p>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
                className={inputLight}
              />
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'Enviar link de redefinição'}
              </button>
              <button
                type="button"
                onClick={() => setMode('password')}
                className="text-xs text-white/80 underline underline-offset-2 hover:text-white"
              >
                Voltar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
