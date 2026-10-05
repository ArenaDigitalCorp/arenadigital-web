/**
 * Rótulos do crédito de mensalista — compartilhados pela tela do mensalista e
 * pelo relatório de Pagamentos (tela, Excel e PDF), para o mesmo crédito ser
 * descrito do mesmo jeito em todo lugar.
 *
 * Módulo puro (sem React nem Supabase): dá para testar com `node --test`.
 */

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const CREDITO_TIPO_LABEL: Record<string, string> = {
  lancamento: 'Lançamento',
  uso: 'Uso em mensalidade',
  retirada: 'Retirada',
  estorno: 'Estorno',
  ajuste: 'Ajuste',
}

/** O mínimo de `planos_mensalista` (+ blocos) para descrever a recorrência. */
export interface RecorrenciaParaRotulo {
  dia_semana: number
  horario_inicio: string
  horario_fim: string
  court?: { name?: string | null } | null
  blocos?: Array<{
    dia_semana: number
    horario_inicio: string
    horario_fim: string
    court?: { name?: string | null } | null
  }> | null
}

function faixa(b: { horario_inicio: string; horario_fim: string }): string {
  return `${b.horario_inicio.slice(0, 5)} às ${b.horario_fim.slice(0, 5)}`
}

/**
 * "Quadra 04 · Qua · 20:00 às 21:00" — a mesma ordem do cabeçalho da
 * recorrência na tela do mensalista.
 *
 * Recorrência de vários blocos (professor) lista todas as faixas, senão dois
 * planos do mesmo atleta podiam sair com o mesmo rótulo — e o rótulo existe
 * justamente para o gestor saber de QUAL grupo é o crédito:
 * "Quadra 04 · Qua 20:00 às 21:00 / Sex 20:00 às 21:00", ou com a quadra de
 * cada faixa entre parênteses quando elas variam.
 */
export function formatRecorrenciaLabel(p: RecorrenciaParaRotulo): string {
  const blocos = [...(p.blocos ?? [])].sort(
    (a, b) => a.dia_semana - b.dia_semana || a.horario_inicio.localeCompare(b.horario_inicio)
  )

  if (blocos.length > 1) {
    const quadras = new Set(blocos.map((b) => b.court?.name ?? null))
    if (quadras.size === 1) {
      const quadra = [...quadras][0]
      const horarios = blocos.map((b) => `${DIAS[b.dia_semana]} ${faixa(b)}`).join(' / ')
      return quadra ? `${quadra} · ${horarios}` : horarios
    }
    return blocos
      .map((b) => `${DIAS[b.dia_semana]} ${faixa(b)}${b.court?.name ? ` (${b.court.name})` : ''}`)
      .join(' / ')
  }

  return [p.court?.name, DIAS[p.dia_semana], faixa(p)].filter(Boolean).join(' · ')
}

/** Uma subconta do crédito do atleta: a geral (`planoId` null) ou a de uma recorrência. */
export interface SubcontaCredito {
  planoId: string | null
  /** "Geral" ou "Quadra 04 · Qua · 20:00 às 21:00". */
  label: string
  saldo: number
}

export const SUBCONTA_GERAL_LABEL = 'Geral'

/**
 * Subcontas com saldo, a partir de `mensalista_credito_saldo_recorrencia`
 * (o banco grava cada movimento numa subconta e não deixa nenhuma negativa):
 * a geral primeiro, depois as recorrências pelo rótulo.
 */
export function montarSubcontas(
  saldos: { plano_id: string | null; saldo: number | string | null }[],
  labelDoPlano: (planoId: string) => string | undefined
): SubcontaCredito[] {
  return saldos
    .map((s) => ({
      planoId: s.plano_id,
      label: s.plano_id ? labelDoPlano(s.plano_id) ?? 'Recorrência' : SUBCONTA_GERAL_LABEL,
      saldo: Math.round(Number(s.saldo ?? 0) * 100) / 100,
    }))
    .filter((s) => s.saldo >= 0.01)
    .sort(
      (a, b) =>
        Number(a.planoId !== null) - Number(b.planoId !== null) ||
        a.label.localeCompare(b.label, 'pt-BR')
    )
}
