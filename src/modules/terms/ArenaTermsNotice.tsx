'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useArena } from '@/contexts/ArenaContext'
import { useArenaTerms } from './use-arena-terms'
import { ArenaTermsPanel } from './ArenaTermsPanel'
import { ARENA_TERMS_CHANGE_SUMMARY, ARENA_TERMS_VERSION } from './arena-terms'

export function ArenaTermsNotice() {
    const pathname = usePathname()
    const { selectedArenaDetails: arena } = useArena()
    const query = useArenaTerms(arena?.isOwner ? arena.id : undefined)
    const status = query.data
    const [deferred, setDeferred] = useState<string[]>([])
    if (!arena?.isOwner) return null
    if (query.isError && !status) return <aside aria-label="Termos de Uso" className="mb-4 mt-12 rounded-lg border bg-white p-3 text-sm md:mt-0">
        Não foi possível consultar os termos de {arena.name}. <button type="button" className="underline" onClick={() => void query.refetch()}>Tentar novamente</button>
    </aside>
    if (!status?.is_owner) return null
    const key = arena.id + '/' + status.version
    // The billing gate can restrict a lapsed arena to this page. Its owner can
    // still review the agreement, request removal and consult receipts here.
    if (pathname === `/dashboard/settings/subscription/${arena.id}`) {
        return (
            <details key={key} className="mb-5 mt-12 rounded-xl border bg-white p-4 text-sm text-arena-navy-800 md:mt-0">
                <summary className="cursor-pointer font-semibold">
                    {status.accepted_at ? 'Consultar comprovantes dos Termos de Uso' : `Os Termos de Uso de ${arena.name} mudaram. Revisar termos`}
                </summary>
                <div className="mt-4">
                    <ArenaTermsPanel arenaId={arena.id} arenaName={arena.name} />
                </div>
            </details>
        )
    }
    if (status.accepted_at) return null
    if (deferred.includes(key)) return null
    return (
        <aside aria-label="Atualização dos Termos de Uso" className="mb-5 mt-12 flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-arena-navy-800 sm:flex-row sm:items-center md:mt-0">
            <FileText aria-hidden="true" className="hidden size-5 shrink-0 sm:block" />
            <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">Os Termos de Uso de {arena.name} mudaram</p>
                <p>{status.version === ARENA_TERMS_VERSION ? ARENA_TERMS_CHANGE_SUMMARY : 'Há uma nova versão dos termos para revisar.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button asChild size="sm"><Link href={`/dashboard/arenas/${arena.id}/edit?tab=arena#termos-da-arena`}>Revisar termos</Link></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDeferred(previous => [...previous, key])}>Lembrar depois</Button>
            </div>
        </aside>
    )
}
