'use client'

import Link from 'next/link'
import { useArenaTerms } from './use-arena-terms'

export function MediaTermsHint({ arenaId }: { arenaId: string }) {
    const query = useArenaTerms(arenaId)
    let message: React.ReactNode = 'Consultando o aceite para envio de imagens…'
    if (query.isError) {
        message = <>Não foi possível consultar o aceite. <button type="button" className="underline" onClick={() => void query.refetch()}>Tentar novamente</button></>
    } else if (query.data?.accepted_at) {
        message = 'Envie apenas imagens que a arena tem autorização para usar.'
    } else if (query.data?.is_owner) {
        message = <>Para adicionar ou trocar a imagem, <Link className="underline" href={`/dashboard/arenas/${arenaId}/edit?tab=arena#termos-da-arena`}>revise os Termos de Uso</Link>.</>
    } else if (query.data) {
        message = 'O titular precisa aceitar os Termos de Uso para a arena publicar novas imagens.'
    }
    return <p className="mt-2 text-sm text-muted-foreground">{message}</p>
}
