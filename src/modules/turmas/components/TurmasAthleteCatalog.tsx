'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StandardModal } from '@/components/ui/standard-modal'
import { getTurmasAthleteOptionsAction } from '../actions'
import type { Atleta, TurmasCatalogo } from '../types'

export type TurmasAthleteCatalogState = { ready: boolean; feedback: ReactNode }

/** Scoped to one open modal. Closing it releases the catalogue and any pending result. */
export function TurmasAthleteCatalog({ arenaId, catalogo, title, onClose, children }: {
  arenaId: string
  catalogo: TurmasCatalogo
  title: string
  onClose: () => void
  children: (catalogo: TurmasCatalogo, state: TurmasAthleteCatalogState) => ReactNode
}) {
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{
    source: TurmasCatalogo; arenaId: string; retry: number; athletes?: Atleta[]; error?: string
  } | null>(null)
  const [loaded, setLoaded] = useState<{ arenaId: string; athletes: Atleta[] } | null>(null)

  useEffect(() => {
    let active = true
    getTurmasAthleteOptionsAction(arenaId).then(res => {
      if (!active) return
      if (res.success) setLoaded({ arenaId, athletes: res.data })
      setResult({ source: catalogo, arenaId, retry,
        ...(res.success ? { athletes: res.data } : { error: res.error }) })
    }).catch(() => {
      if (active) setResult({ source: catalogo, arenaId, retry, error: 'Não foi possível carregar os atletas.' })
    })
    return () => { active = false }
  }, [arenaId, catalogo, retry])

  const current = result?.source === catalogo && result.arenaId === arenaId && result.retry === retry ? result : null
  const athletes = loaded?.arenaId === arenaId ? loaded.athletes : undefined
  const feedback = current?.error ? (
    <div role="alert" className="space-y-3">
      <p>{current.error}</p>
      <Button variant="outline" onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button>
    </div>
  ) : !current ? (
    <p role="status" className="flex items-center gap-2 py-6 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> {athletes ? 'Atualizando atletas…' : 'Carregando atletas…'}
    </p>
  ) : null
  if (athletes) {
    const ids = new Set(athletes.map(a => a.id))
    // Preserve former members in history; only current members remain selectable.
    const atletas = [...athletes, ...catalogo.atletas.filter(a => !ids.has(a.id)).map(a => ({ ...a, membro: false }))]
    // Keep the same modal mounted through refresh/error/retry. Its draft dates
    // and operation ids survive, but writes wait for the current member list.
    return children({ ...catalogo, atletas }, { ready: !!current?.athletes, feedback })
  }
  return (
    <StandardModal open onOpenChange={open => { if (!open) onClose() }} title={title} size="wide">
      {feedback}
    </StandardModal>
  )
}
