export interface CaixaTotalPorModo {
  modo_pagamento_id: string | null;
  nome: string;
  entradas: number;
  saidas: number;
}

interface CaixaLancamento {
  type: string;
  total_value: number;
  modo_pagamento_id?: string | null;
  modo_pagamento?: { nome: string } | null;
}

const ORIGEM_LABELS: Record<string, string> = {
  booking: 'Reserva avulsa',
  booking_participant: 'Reserva avulsa',
  booking_cobranca_pagamento: 'Rateio',
  mensalista_pagamento: 'Mensalidade',
  monthly_plan_month: 'Mensalidade',
  station_payment: 'Comanda',
  rotativo_inscricao: 'Rotativo',
  rotativo_credit_purchase: 'Rotativo',
  estorno: 'Estorno',
};

export function isLancamentoAutomatico(t: { source_type?: string | null }): boolean {
  return t.source_type != null;
}

export function origemDoLancamento(sourceType: string | null | undefined): string | null {
  if (sourceType == null) return null;
  return ORIGEM_LABELS[sourceType] ?? 'Automático';
}

/** Mesmo critério de public.is_modo_pagamento_dinheiro (nome ILIKE 'dinheiro%'). */
export function isModoDinheiro(nome: string | null | undefined): boolean {
  return /^dinheiro/i.test((nome ?? '').trim());
}

export function caixaTotaisPorModo(transactions: CaixaLancamento[]): CaixaTotalPorModo[] {
  const porModo = new Map<string, CaixaTotalPorModo>();
  for (const t of transactions) {
    const key = t.modo_pagamento_id ?? '';
    const atual = porModo.get(key) ?? {
      modo_pagamento_id: t.modo_pagamento_id ?? null,
      nome: t.modo_pagamento?.nome ?? 'Não informado',
      entradas: 0,
      saidas: 0,
    };
    if (t.type === 'entrada') atual.entradas += t.total_value;
    else atual.saidas += t.total_value;
    porModo.set(key, atual);
  }
  return [...porModo.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

/** Saldo físico esperado na gaveta: abertura + entradas em dinheiro - saídas em dinheiro. */
export function saldoEmDinheiro(openingBalance: number, totais: CaixaTotalPorModo[]): number {
  return totais
    .filter((total) => isModoDinheiro(total.nome))
    .reduce((saldo, total) => saldo + total.entradas - total.saidas, openingBalance);
}
