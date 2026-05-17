'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/shared/Logo'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), [])
  const redirectTo = normalizeRedirectPath(searchParams.get('redirect_to'))

  const [mode, setMode] = React.useState<Mode>('password')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [otp, setOtp] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  const handleOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Código enviado para seu e-mail.')
    setMode('otp_verify')
  }

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Enviamos um e-mail com instruções para redefinir sua senha.')
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
              {mode === 'forgot' ? 'Redefina sua senha' : 'Entre com sua conta'}
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
                onClick={() => setMode(mode === 'otp_verify' ? 'otp_verify' : 'otp_request')}
                className={`flex-1 rounded-md py-2 transition ${mode === 'otp_request' || mode === 'otp_verify' ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
              >
                Código por e-mail
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
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputLight}
              />
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
                {loading ? <Loader2 className="size-4 animate-spin" /> : <>Enviar código <ArrowRight className="size-4" /></>}
              </button>
            </form>
          )}

          {mode === 'otp_verify' && (
            <form onSubmit={handleOtpVerify} className="flex flex-col gap-4">
              <p className="text-center text-xs text-white/70">
                Enviamos um código de 6 dígitos para <span className="font-semibold text-white">{email}</span>.
              </p>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className={`${inputLight} text-center text-lg tracking-[0.5em]`}
              />
              <button type="submit" disabled={loading || otp.length < 6} className={btnPrimary}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'Verificar'}
              </button>
              <button
                type="button"
                onClick={() => { setOtp(''); setMode('otp_request') }}
                className="text-xs text-white/80 underline underline-offset-2 hover:text-white"
              >
                Reenviar código
              </button>
            </form>
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

          <p className="text-center text-xs text-white/70">
            Não tem uma conta?{' '}
            <Link href="/sign-up" className="font-semibold text-white underline underline-offset-2 hover:text-zinc-200">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
