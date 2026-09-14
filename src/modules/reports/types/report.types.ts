export type PaymentStatusRow = {
  id: string
  data: string
  /**
   * Fim da ocupação (ISO). Só linhas que vêm de reserva têm — é o que permite
   * mostrar "16:00 às 17:00" e somar horas. Comanda, rotativo e lançamento
   * manual não ocupam espaço por um intervalo, então vêm sem.
   */
  fim?: string | null
  /** Duração em horas da linha (mesma origem de `fim`). */
  horas?: number | null
  /**
   * Rótulo pronto para a coluna Horário, quando a linha não tem instante de
   * início/fim mas tem um horário a mostrar — é o caso do pagamento de
   * mensalidade, que exibe a faixa da recorrência ("20:00 às 21:00").
   *
   * - ausente → a tela deriva de `data`/`fim` (linhas com instante real);
   * - `string` → usa o rótulo;
   * - `null`  → **não existe horário** (lançamento de caixa, competência do mês);
   *   a tela mostra "—" em vez de inventar uma hora a partir de uma data.
   */
  horario?: string | null
  atleta: string | null
  servico:
    | 'Avulso'
    | 'Mensal'
    | 'Comanda'
    | 'Rotativo'
    | 'Crédito rotativo'
    | 'Mensalista'
    | 'Entrada Manual'
    | 'Recorrência'
    | 'Rateio'
  espaco: string | null
  esporte: string | null
  valor: number | null
  status: 'Pago' | 'Pendente' | 'Cancelado'
}

/**
 * Linhas `servico: 'Recorrência'` são só contexto (mostram a mensalidade do
 * plano na visão "Rateio") — o valor de cada cobrança já vem na linha
 * `'Rateio'` correspondente. Somar as duas contaria o mesmo dinheiro 2x.
 */
export const PAYMENT_STATUS_SUMMARY_EXCLUDED_SERVICOS: PaymentStatusRow['servico'][] = [
  'Recorrência',
]

export type PaymentStatusSummary = {
  totalPago: number
  totalPendente: number
  totalCancelado: number
  countPago: number
  countPendente: number
  countCancelado: number
  /** Pago + Pendente (cancelado fica de fora) — "quanto cobrar" no fechamento do mês. */
  totalACobrar: number
  /** Horas ocupadas nas linhas não canceladas. */
  totalHoras: number
}

export type CourtFilter = { id: string; name: string }
export type SportFilter = { id: string; name: string }
export type AthleteFilter = { id: string; nome_perfil: string }

export type PaymentStatusFilters = {
  tipo?: 'avulso' | 'mensal' | 'todos'
  startDate?: string
  endDate?: string
  courtId?: string
  sportId?: string
  /** Casa o atleta como responsável OU como participante (rateio/comanda/convidado). */
  atletaId?: string
  /**
   * Só tem efeito com `tipo: 'mensal'`. Troca as linhas agregadas de
   * "Mensalista" (uma por transação) pela quebra linha a linha: uma
   * "Recorrência" por plano + uma "Rateio" por cobrança ativa da mensalidade
   * do mês, para todo responsável do período (ou só o de `atletaId`, se informado).
   */
  rateio?: boolean
  /**
   * Extrato de ocupação: cada reserva vira uma linha por hora ocupada, em vez
   * de uma linha por reserva. Nesse modo as linhas agregadas de "Mensalista"
   * (dinheiro da mensalidade) saem, senão o mesmo mês seria contado duas vezes
   * — uso + pagamento. Vale para Mensal e Avulso.
   */
  detalharPorHora?: boolean
}

/** "Quanto um atleta deve" no mês, para os cards exibidos quando `atletaId` está setado. */
export type AthleteDebtSummary = {
  mensal: number
  avulso: number
}
