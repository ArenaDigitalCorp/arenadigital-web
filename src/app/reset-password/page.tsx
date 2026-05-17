'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/shared/Logo'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

const inputLight =
  'w-full rounded-lg border border-zinc-700 bg-white px-3 py-2.5 text-sm text-black placeholder-zinc-500 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400'

const btnPrimary =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-arena-button py-2.5 text-sm font-semibold text-white transition hover:bg-arena-button-hover active:scale-[.98] disabled:opacity-60 disabled:pointer-events-none'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), [])

  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        toast.error('Sessão inválida. Solicite um novo link de redefinição.')
        router.push('/sign-in')
        return
      }
      setReady(true)
    })
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }
    if (password.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Senha redefinida com sucesso!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F0E6D2] overflow-y-auto">
      <div className="m-auto w-full max-w-[500px] bg-arena-navy-800 rounded-3xl p-6 sm:p-10 md:p-16 shadow-2xl flex flex-col items-center">
        <Logo className="mb-10" />

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold text-white tracking-tight">Nova senha</h1>
            <p className="text-sm text-white/80">Defina uma nova senha para acessar sua conta.</p>
          </div>

          {!ready ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-white" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nova senha"
                className={inputLight}
              />
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar nova senha"
                className={inputLight}
              />
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <>Salvar nova senha <ArrowRight className="size-4" /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
