export type PaymentStatusRow = {
  id: string
  data: string
  atleta: string | null
  servico: 'Avulso' | 'Mensal'
  espaco: string | null
  esporte: string | null
  valor: number | null
  status: 'Pago' | 'Pendente' | 'Cancelado'
}

export type PaymentStatusSummary = {
  totalPago: number
  totalPendente: number
  totalCancelado: number
  countPago: number
  countPendente: number
  countCancelado: number
}

export type CourtFilter = { id: string; name: string }
export type SportFilter = { id: string; name: string }

export type PaymentStatusFilters = {
  tipo?: 'avulso' | 'mensal' | 'todos'
  startDate?: string
  endDate?: string
  courtId?: string
  sportId?: string
}
