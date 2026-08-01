import type { PaymentStatusRow } from '@/modules/reports/types/report.types'

export const PAYMENT_STATUS_EXPORT_HEADERS = [
  'Data',
  'Atleta',
  'Serviço',
  'Espaço',
  'Esporte',
  'Valor',
  'Status',
] as const

export function buildPaymentStatusSheetData(
  rows: PaymentStatusRow[],
  formatDateTime: (iso: string) => string,
): Array<Array<string | number>> {
  return [
    [...PAYMENT_STATUS_EXPORT_HEADERS],
    ...rows.map((row) => [
      formatDateTime(row.data),
      row.atleta ?? '—',
      row.servico,
      row.espaco ?? '—',
      row.esporte ?? '—',
      row.valor ?? '',
      row.status,
    ]),
  ]
}
