import type { ReajusteMesLinha } from './types/mensalista.types'

export function temPendenciaMensal(linha: ReajusteMesLinha): boolean {
  if (['quitado', 'cancelado'].includes(linha.mensalidadeStatus)) return false
  return linha.calendario?.agendaStatus === 'conflito' || Boolean(linha.calendario?.cobrancaErro)
}
