'use client'

import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCompetencia } from '@/lib/format'
import type { ReajusteMesLinha } from '../types/mensalista.types'

interface Props {
  open: boolean
  onClose: () => void
  onRetry: () => void
  arenaId: string
  competencia: string
  linhas: ReajusteMesLinha[]
  carregando: boolean
  erro: boolean
}

export function PendenciasMensalistasModal({ open, onClose, onRetry, arenaId, competencia, linhas, carregando, erro }: Props) {
  return <Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Pendências de {formatCompetencia(competencia)}</DialogTitle>
        <DialogDescription>Reservas e cobranças são preparadas automaticamente. Estes casos precisam de uma decisão para concluir o mês.</DialogDescription>
      </DialogHeader>
      {carregando ? <p role="status" className="py-6 text-sm">Verificando as pendências…</p> : erro ?
        <p role="alert" className="py-6 text-sm">Não foi possível verificar as pendências. Tente novamente.</p> : linhas.length === 0 ?
        <p role="status" className="py-6 text-sm">Tudo certo. Não há pendências neste mês.</p> :
        <ul className="divide-y divide-arena-navy-800/10">{linhas.map((linha) => <li key={linha.planoId} className="space-y-3 py-4">
          <div><p className="font-bold text-arena-navy-800">{linha.atleta}</p><p className="text-xs text-arena-navy-800/60">{linha.recorrencia}</p></div>
          <p className="text-sm text-arena-navy-800/80">{linha.calendario?.agendaStatus === 'conflito'
            ? 'Já existe uma reserva nesse horário. Confira a agenda e resolva a sobreposição para concluir a preparação.'
            : linha.calendario?.cobrancaErro}</p>
          <div className="flex flex-wrap gap-2">
            {linha.calendario?.agendaStatus === 'conflito' && <Button variant="outline" size="sm" asChild><Link href={`/dashboard/arenas/${arenaId}`}>Abrir agenda</Link></Button>}
            <Button variant="outline" size="sm" asChild><Link href={`/dashboard/arenas/${arenaId}/mensalistas/${linha.athleteId}?competencia=${competencia}`}>Ver mensalista</Link></Button>
          </div>
        </li>)}</ul>}
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Fechar</Button>
        <Button onClick={onRetry} disabled={carregando}>Verificar novamente</Button>
      </div>
    </DialogContent>
  </Dialog>
}
