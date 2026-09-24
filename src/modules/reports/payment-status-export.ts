import type {
  PaymentStatusAthleteSummary,
  PaymentStatusRow,
} from '@/modules/reports/types/report.types'

export const PAYMENT_STATUS_EXPORT_HEADERS = [
  'Data',
  'Horário',
  'Horas',
  'Atleta',
  'Serviço',
  'Espaço',
  'Esporte',
  'Valor',
  'Status',
] as const

export function buildPaymentStatusSheetData(
  rows: PaymentStatusRow[],
  formatData: (iso: string) => string,
  formatHorario: (row: PaymentStatusRow) => string = (row) => formatData(row.data),
  options: {
    /** Presente no extrato por hora: acrescenta a coluna "Dia" logo depois da Data. */
    diaSemana?: (row: PaymentStatusRow) => string
  } = {},
): Array<Array<string | number>> {
  const { diaSemana } = options
  const headers: string[] = [...PAYMENT_STATUS_EXPORT_HEADERS]
  if (diaSemana) headers.splice(1, 0, 'Dia')

  return [
    headers,
    ...rows.map((row) => {
      const linha: Array<string | number> = [
        formatData(row.data),
        formatHorario(row),
        row.horas ?? '',
        // Sem atleta cadastrado (participante avulso do rateio, comanda de balcão…):
        // "Avulsa" diz o que é; um travessão só parecia dado faltando.
        row.atleta ?? 'Avulsa',
        row.servico,
        row.espaco ?? '—',
        row.esporte ?? '—',
        row.valor ?? '',
        row.status,
      ]
      if (diaSemana) linha.splice(1, 0, diaSemana(row))
      return linha
    }),
  ]
}

/** Aba "Resumo por atleta" — a mesma tabela da tela, com a linha de total no fim. */
export function buildAthleteSummarySheetData(
  summaries: PaymentStatusAthleteSummary[],
  options: { horas?: boolean } = {},
): Array<Array<string | number>> {
  const comHoras = options.horas === true
  const headers = ['Atleta', ...(comHoras ? ['Horas'] : []), 'Total do mês', 'Pago', 'Em aberto', 'Status']

  const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
  const total = summaries.reduce(
    (acc, s) => ({
      horas: acc.horas + s.horas,
      devido: acc.devido + s.devido,
      pago: acc.pago + s.pago,
      emAberto: acc.emAberto + s.emAberto,
    }),
    { horas: 0, devido: 0, pago: 0, emAberto: 0 },
  )

  return [
    headers,
    ...summaries.map((s) => [
      s.atleta,
      ...(comHoras ? [s.horas] : []),
      s.devido,
      s.pago,
      s.emAberto,
      s.status,
    ]),
    [
      'Total',
      ...(comHoras ? [round2(total.horas)] : []),
      round2(total.devido),
      round2(total.pago),
      round2(total.emAberto),
      '',
    ],
  ]
}
