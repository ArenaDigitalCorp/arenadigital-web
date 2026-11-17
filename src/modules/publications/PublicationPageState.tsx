"use client"

import { AlertCircle, Megaphone, RefreshCw } from 'lucide-react'
import { DashboardPage, DashboardPageHeader } from '@/components/dashboard/DashboardPageShell'
import { Button } from '@/components/ui/button'

export function PublicationsLoading() {
  return <DashboardPage className="pt-12 md:pt-0">
    <DashboardPageHeader title="Publicações" icon={Megaphone} description="Novidades, horários e jogos da sua arena no aplicativo." />
    <div role="status" aria-label="Carregando publicações" className="space-y-3 motion-safe:animate-pulse">
      <span className="sr-only">Carregando publicações…</span>
      <div className="h-10 rounded-md bg-slate-200/60" />
      {[0, 1, 2].map(key => <div key={key} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-5"><div className="size-16 shrink-0 rounded-md bg-slate-100" /><div className="flex-1 space-y-3"><div className="h-4 w-1/3 rounded bg-slate-100" /><div className="h-3 w-2/3 rounded bg-slate-100" /><div className="h-3 w-1/4 rounded bg-slate-100" /></div></div>)}
    </div>
  </DashboardPage>
}

export function PublicationsError({ reset }: { reset: () => void }) {
  return <DashboardPage className="pt-12 md:pt-0">
    <DashboardPageHeader title="Publicações" icon={Megaphone} />
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-12 text-center">
      <AlertCircle className="size-6 text-slate-400" />
      <h2 className="text-sm font-bold text-arena-navy-800">Não foi possível carregar as publicações.</h2>
      <p className="text-sm text-slate-500">Confira sua conexão e suas permissões de acesso.</p>
      <Button variant="outline" onClick={reset}><RefreshCw className="size-4" />Tentar novamente</Button>
    </div>
  </DashboardPage>
}
