export type StationMovementPaymentStatus = 'pago' | 'parcial' | 'pendente'

export type StationMovementRow = {
  id: string
  order_number: number
  created_at: string
  customer_name: string | null
  station_id: string
  station_name: string | null
  status: 'open' | 'closed' | 'cancelled'
  payment_method: string | null
  payment_status: StationMovementPaymentStatus
  total_value: number
}

export type StationMovementFilters = {
  startDate?: string
  endDate?: string
  stationId?: string
  customer?: string
  paymentMethod?: string
  status?: 'open' | 'closed' | 'cancelled'
  paymentStatus?: StationMovementPaymentStatus
}

export type StationFilterOption = { id: string; name: string }
