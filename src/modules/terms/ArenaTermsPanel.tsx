'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ArenaTermsCheckbox } from './ArenaTermsCheckbox'
import { ARENA_TERMS_CHANGE_SUMMARY, ARENA_TERMS_VERSION } from './arena-terms'
import { acceptArenaTerms } from './arena-terms-actions'
import { arenaTermsQueryKey, useArenaTerms } from './use-arena-terms'

const receiptDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function ArenaTermsPanel({ arenaId, arenaName }: {arenaId: string; arenaName: string}) {
    const query = useArenaTerms(arenaId)
    const client = useQueryClient()
    const [checkedDocument, setCheckedDocument] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const status = query.data
    const documentKey = status ? arenaId + '/' + status.version : null
    const checked = documentKey !== null && checkedDocument === documentKey

    async function confirm() {
        if (!checked || saving || status?.version !== ARENA_TERMS_VERSION) return
        setSaving(true)
        setError('')
        try {
            const result = await acceptArenaTerms(arenaId, status.version, checked)
            if (!result.data) {
                setError(result.error)
                void query.refetch()
                return
            }
            client.setQueryData(arenaTermsQueryKey(arenaId), result.data)
            setCheckedDocument(null)
        } catch {
            setError('Não foi possível confirmar o aceite. Tente novamente.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <section id="termos-da-arena" tabIndex={-1} aria-labelledby="termos-da-arena-titulo" className="scroll-mt-16 space-y-3 rounded-xl border bg-white p-5 text-sm text-arena-navy-800">
            <h3 id="termos-da-arena-titulo" className="text-lg font-semibold">Termos de Uso de {arenaName}</h3>
            {query.isPending && <p role="status">Consultando o aceite…</p>}
            {query.isError && <p role="alert">Não foi possível consultar os termos. <button type="button" className="underline" onClick={() => void query.refetch()}>Tentar novamente</button></p>}
            {status?.is_owner && <>
                {status.accepted_at ? <p role="status">O aceite desta versão está registrado.</p> : <>
                    <p>{ARENA_TERMS_CHANGE_SUMMARY}</p>
                    <p>Confira também as imagens que já aparecem no perfil e nos espaços. Se precisar, remova a foto na tela de edição ou <a className="underline underline-offset-2" href="mailto:contato@arenadigital.app?subject=Retirada%20de%20imagem%20da%20arena">solicite a retirada de uma imagem</a>.</p>
                    {status.version === ARENA_TERMS_VERSION ? <>
                        <ArenaTermsCheckbox id="confirmar-termos-da-arena" checked={checked} onCheckedChange={value => setCheckedDocument(value ? documentKey : null)} />
                        <Button type="button" onClick={confirm} disabled={!checked || saving}>{saving ? 'Registrando…' : 'Aceitar termos'}</Button>
                    </> : <p role="alert">Há uma versão mais recente. <button type="button" className="underline" onClick={() => window.location.reload()}>Atualizar painel</button></p>}
                </>}
                {status.receipts.length > 0 && <div className="space-y-1 border-t pt-3">
                    <h4 className="font-semibold">Seus comprovantes de aceite</h4>
                    <ul className="space-y-1">
                        {status.receipts.map(receipt => <li key={receipt.version}>
                            <Link href={`/termos-de-uso/${encodeURIComponent(receipt.version)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Termos de {receipt.version.split('-').reverse().join('/')}</Link>
                            {' · Aceitos em '}<time dateTime={receipt.accepted_at}>{receiptDate.format(new Date(receipt.accepted_at))}</time> (Brasília)
                        </li>)}
                    </ul>
                </div>}
            </>}
            {error && <p role="alert" className="text-destructive">{error}</p>}
        </section>
    )
}
