import type { PaymentStatusRow } from '@/modules/reports/types/report.types'

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
): Array<Array<string | number>> {
  return [
    [...PAYMENT_STATUS_EXPORT_HEADERS],
    ...rows.map((row) => [
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
    ]),
  ]
}
