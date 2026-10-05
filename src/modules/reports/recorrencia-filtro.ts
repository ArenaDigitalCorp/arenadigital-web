/**
 * Opções do filtro "Recorrência" do relatório de Pagamentos: os grupos de
 * mensalista de que o atleta filtrado faz parte — como responsável, no rateio
 * de alguma mensalidade ou como participante das reservas do plano.
 *
 * O módulo é puro: quem consulta é `actions/reportActions.ts`.
 */

import {
  formatRecorrenciaLabel,
  type RecorrenciaParaRotulo,
} from '@/modules/mensalistas/credito-recorrencia'
import type { RecorrenciaFiltro } from '@/modules/reports/types/report.types'

/** Plano com o necessário para o rótulo e para saber de quem é. */
export interface PlanoDoFiltro extends RecorrenciaParaRotulo {
  id: string
  athlete_id: string
  athlete_name: string
  status: string
}

/**
 * Ativas primeiro (o gestor quase sempre procura um grupo que ainda joga),
 * depois as do próprio atleta antes das em que ele só participa, e então por
 * dia da semana e horário — a ordem em que o gestor lê a agenda.
 */
export function buildRecorrenciaOptions(
  planos: PlanoDoFiltro[],
  atletaId: string
): RecorrenciaFiltro[] {
  const unicos = new Map(planos.map((p) => [p.id, p]))
  return [...unicos.values()]
    .sort(
      (a, b) =>
        Number(a.status === 'cancelado') - Number(b.status === 'cancelado') ||
        Number(a.athlete_id !== atletaId) - Number(b.athlete_id !== atletaId) ||
        a.dia_semana - b.dia_semana ||
        a.horario_inicio.localeCompare(b.horario_inicio)
    )
    .map((p) => ({
      id: p.id,
      label: formatRecorrenciaLabel(p),
      responsavel: p.athlete_id === atletaId ? null : p.athlete_name,
      cancelada: p.status === 'cancelado',
    }))
}

/** Texto da opção: rótulo + de quem é o grupo (se não for do atleta) + cancelada. */
export function formatRecorrenciaOption(r: RecorrenciaFiltro): string {
  return [
    r.label,
    r.responsavel ? `grupo de ${r.responsavel}` : null,
    r.cancelada ? 'cancelada' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
