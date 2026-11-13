'use client'

import { formatCompetencia, formatCurrency } from '@/lib/format'
import type { HistoricoCompetencia } from '../types/mensalista.types'

const eventos: Record<string, string> = {
  previsao_criada: 'Previsão do mês registrada',
  cobranca_confirmada: 'Cobrança confirmada',
  competencia_atualizada: 'Previsão ou agenda atualizada',
  cobranca_atualizada: 'Cobrança ou pagamento atualizado',
}

function dataHora(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value))
}

export function HistoricoCompetencias({ meses }: { meses: HistoricoCompetencia[] }) {
  return <section className="rounded-2xl border border-arena-navy-800/10 bg-white p-5 sm:p-6" aria-label="Histórico por mês">
    <h2 className="text-lg font-bold text-arena-navy-800">Histórico por mês</h2>
    <p className="mt-1 text-sm text-arena-navy-800/60">Previsão, confirmação e recebimentos de cada competência. Abra um mês para conferir as alterações.</p>
    {meses.length === 0 ? <p className="mt-5 text-sm text-arena-navy-800/60">Nenhuma competência registrada.</p> :
      <div className="mt-5 divide-y divide-arena-navy-800/10">
        {meses.map((mes) => <details key={mes.id} className="group py-4">
          <summary className="cursor-pointer rounded-lg outline-offset-4">
            <span className="ml-1 font-bold capitalize text-arena-navy-800">{formatCompetencia(mes.competencia.slice(0, 7))}</span>
            <span className="ml-3 text-xs text-arena-navy-800/60">
              {mes.jogos == null ? 'Registro anterior' : `${mes.jogos} jogos`}
              {' · '}{mes.status === 'quitado' ? 'Quitada' : mes.status === 'cancelado' ? 'Cancelada' : mes.revisado_em ? 'Cobrança confirmada' : 'Aguardando revisão'}
            </span>
            <span className="mt-1 block text-xs text-arena-navy-800/60">{mes.recorrencia}</span>
            <span className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <span><span className="block text-xs text-arena-navy-800/50">Previsão</span>{mes.valor_previsto == null ? '—' : formatCurrency(Number(mes.valor_previsto))}</span>
              <span><span className="block text-xs text-arena-navy-800/50">Cobrança do mês</span>{formatCurrency(Number(mes.valor_total))}</span>
              <span><span className="block text-xs text-arena-navy-800/50">Recebido</span>{formatCurrency(Number(mes.valor_pago))}</span>
              <span><span className="block text-xs text-arena-navy-800/50">Agenda</span>{mes.agenda_status === 'preparada' ? 'Preparada' : mes.agenda_status === 'conflito' ? 'Conciliação pendente' : '—'}</span>
            </span>
          </summary>
          <div className="mt-4 border-l-2 border-arena-navy-800/10 pl-4 text-sm">
            {mes.revisado_em && <p className="mb-3 text-arena-navy-800/70">Confirmada em {dataHora(mes.revisado_em)}{mes.revisado_por_nome ? ` por ${mes.revisado_por_nome}` : ''}.</p>}
            {mes.eventos.length === 0 ? <p className="text-arena-navy-800/60">Os pagamentos e reajustes anteriores continuam nos respectivos históricos.</p> :
              <ol className="space-y-3">{mes.eventos.map((evento) => {
                const anterior = evento.anterior?.valor_total ?? evento.anterior?.valor_previsto
                const atual = evento.atual.valor_total ?? evento.atual.valor_previsto
                return <li key={evento.id}>
                  <p className="font-medium text-arena-navy-800">{eventos[evento.tipo] ?? 'Registro atualizado'}
                    {typeof atual === 'number' && <span className="font-normal"> · {typeof anterior === 'number' && anterior !== atual ? `${formatCurrency(anterior)} → ` : ''}{formatCurrency(atual)}</span>}
                  </p>
                  <p className="text-xs text-arena-navy-800/50">{dataHora(evento.created_at)} · {evento.responsavel ?? 'Sistema'}</p>
                </li>
              })}</ol>}
          </div>
        </details>)}
      </div>}
  </section>
}
