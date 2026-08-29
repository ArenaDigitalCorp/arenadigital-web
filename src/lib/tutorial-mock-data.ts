import type { Booking, PlanoMensalistaComDetalhes } from '@/modules/bookings/types/booking.types'
import type { Product, ProductCategory } from '@/modules/products/types/product.types'
import type { Athlete } from '@/modules/athletes/components/AthletesTable'
import type { LoyaltyTransaction } from '@/modules/loyalty/types/loyalty.types'
import type { ArenaFinanceDailyRow, ArenaFinanceSummary, Transaction } from '@/modules/finance/types/finance.types'
import type { BarCategory } from '@/modules/reports/actions/clientesOverviewActions'
import type { Rotativo } from '@/modules/rotativos/types/rotativo.types'

const NOW = '2026-05-30T12:00:00.000Z'
const TODAY = '2026-05-30'

export const tutorialDashboardStats = {
  receita: 18420,
  receitaChange: 14.8,
  reservas: 18,
  quadras: 10,
  ativos: 246,
}

export const tutorialDashboardOccupancy = [
  { courtName: 'Beach 01', percentage: 88, booked: 7, total: 8 },
  { courtName: 'Beach 02', percentage: 75, booked: 6, total: 8 },
  { courtName: 'Futevolei', percentage: 62, booked: 5, total: 8 },
  { courtName: 'Gourmet', percentage: 38, booked: 3, total: 8 },
]

export const tutorialRecentActivity = [
  { title: 'Reserva confirmada', description: 'Quadra Beach 01 - 18:00', time: 'Ha 5 min' },
  { title: 'Novo atleta cadastrado', description: 'Marina Costa', time: 'Ha 18 min' },
  { title: 'Pagamento recebido', description: 'Mensalidade - R$ 320,00', time: 'Ha 34 min' },
]

export function buildTutorialCourts(arenaId: string) {
  return [
    {
      id: 'tutorial-court-1',
      arena_id: arenaId,
      name: 'Quadra Beach 01',
      status: 'active',
      image_url: null,
      booking_type: 'hourly',
      type: 'court',
      capacity: 4,
      available_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      day_config: [],
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: 'tutorial-court-2',
      arena_id: arenaId,
      name: 'Quadra Beach 02',
      status: 'active',
      image_url: null,
      booking_type: 'hourly',
      type: 'court',
      capacity: 4,
      available_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      day_config: [],
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: 'tutorial-court-3',
      arena_id: arenaId,
      name: 'Espaco Gourmet',
      status: 'active',
      image_url: null,
      booking_type: 'hourly',
      type: 'social',
      capacity: 30,
      available_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      day_config: [],
      created_at: NOW,
      updated_at: NOW,
    },
  ]
}

export function buildTutorialBookings(arenaId: string) {
  const counts = [7, 9, 3]
  return counts.flatMap((count, courtIndex) =>
    Array.from({ length: count }, (_, index) => ({
      id: `tutorial-booking-${courtIndex}-${index}`,
      arena_id: arenaId,
      court_id: `tutorial-court-${courtIndex + 1}`,
      start_time: `${TODAY}T${String(8 + index).padStart(2, '0')}:00:00.000Z`,
      end_time: `${TODAY}T${String(9 + index).padStart(2, '0')}:00:00.000Z`,
      status: 'confirmed',
      created_at: NOW,
      updated_at: NOW,
    })),
  ) as unknown as Booking[]
}

export const tutorialAthletes: Athlete[] = [
  {
    id: 'tutorial-athlete-1',
    name: 'Marina Costa',
    email: 'marina@email.com',
    telefone: '(11) 98888-1020',
    cpf: '123.456.789-00',
    sport: 'Beach Tennis',
  },
  {
    id: 'tutorial-athlete-2',
    name: 'Lucas Martins',
    email: 'lucas@email.com',
    telefone: '(11) 97777-3040',
    cpf: '987.654.321-00',
    sport: 'Futevolei',
  },
  {
    id: 'tutorial-athlete-3',
    name: 'Ana Ribeiro',
    email: 'ana@email.com',
    telefone: '(11) 96666-5060',
    cpf: '456.789.123-00',
    sport: 'Beach Tennis',
  },
] as Athlete[]

export function buildTutorialStations(arenaId: string) {
  return [
    {
      id: 'tutorial-station-1',
      arena_id: arenaId,
      name: 'Bar Principal',
      status: 'ativo',
      station_type_id: 'tutorial-station-type-1',
      station_type: { name: 'Bar' },
      metrics: { pending: 4, closedToday: 18, openedToday: 22 },
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: 'tutorial-station-2',
      arena_id: arenaId,
      name: 'Recepcao',
      status: 'ativo',
      station_type_id: 'tutorial-station-type-2',
      station_type: { name: 'Recepcao' },
      metrics: { pending: 2, closedToday: 11, openedToday: 13 },
      created_at: NOW,
      updated_at: NOW,
    },
  ]
}

export function buildTutorialProductCategories(arenaId: string): ProductCategory[] {
  return [
    ['tutorial-category-1', 'Bebidas'],
    ['tutorial-category-2', 'Acessorios'],
  ].map(([id, name], index) => ({
    id: String(id),
    arena_id: arenaId,
    name: String(name),
    kind: 'product',
    sort_order: index,
    active: true,
    created_by: null,
    created_at: NOW,
    updated_at: NOW,
  }))
}

export function buildTutorialProducts(arenaId: string): Product[] {
  return [
    ['tutorial-product-1', 'Agua mineral', 5, 48, 'Bebidas', 'tutorial-category-1', 'Bebidas'],
    ['tutorial-product-2', 'Isotonico', 9, 24, 'Bebidas', 'tutorial-category-1', 'Bebidas'],
    ['tutorial-product-3', 'Bola Beach Tennis', 18, 12, 'Loja', 'tutorial-category-2', 'Acessorios'],
  ].map(([id, name, price, stock, stationType, categoryId, categoryName]) => ({
    id: String(id),
    arena_id: arenaId,
    name: String(name),
    price: Number(price),
    stock_quantity: Number(stock),
    catalog_kind: 'product',
    item_type: String(categoryName),
    category_id: String(categoryId),
    category: { id: String(categoryId), name: String(categoryName) },
    station_id: null,
    station_type_id: null,
    status: 'Ativo',
    created_at: NOW,
    updated_at: NOW,
    created_by: null,
    updated_by: null,
    station_type: { id: `tutorial-${stationType}`, name: String(stationType) },
  })) as Product[]
}

export function buildTutorialMonthlyPlans(arenaId: string): PlanoMensalistaComDetalhes[] {
  return [
    ['tutorial-plan-1', 'Marina Costa', 'Beach Tennis', 'Quadra Beach 01', 2, '19:00', '20:00', 320],
    ['tutorial-plan-2', 'Lucas Martins', 'Beach Tennis', 'Quadra Beach 02', 1, '20:00', '21:00', 280],
    ['tutorial-plan-3', 'Ana Ribeiro', 'Futevolei', 'Quadra Beach 01', 6, '09:00', '10:00', 180],
  ].map(([id, athlete, sport, court, weekDay, start, end, value], index) => ({
    id: String(id),
    arena_id: arenaId,
    athlete_id: `tutorial-athlete-${index + 1}`,
    athlete_name: String(athlete),
    sport_id: `tutorial-sport-${index + 1}`,
    court_id: `tutorial-court-${index + 1}`,
    status: 'ativo',
    dia_semana: Number(weekDay),
    horario_inicio: String(start),
    horario_fim: String(end),
    sessoes_por_mes: 4,
    data_inicio: TODAY,
    valor_mensal: Number(value),
    creation_fingerprint: null,
    created_at: NOW,
    data_encerramento_prevista: null,
    data_encerramento_efetiva: null,
    encerramento_observacao: null,
    dia_vencimento: null,
    atleta: { id: `tutorial-athlete-${index + 1}`, nome_perfil: String(athlete), telefone: '(11) 98888-1020' },
    sports: { id: `tutorial-sport-${index + 1}`, name: String(sport) },
    court: { id: `tutorial-court-${index + 1}`, name: String(court) },
    proximo_mes_reservado: '2026-06-01T12:00:00.000Z',
  }))
}

export function buildTutorialRotativos(arenaId: string): Rotativo[] {
  return [
    ['tutorial-rotativo-1', 'Beach Tennis', '2026-06-02', '19:00', '20:30', 45, 10],
    ['tutorial-rotativo-2', 'Futevolei', '2026-06-03', '20:00', '21:30', 35, 7],
    ['tutorial-rotativo-3', 'Beach Tennis', '2026-06-05', '18:00', '19:30', 45, 8],
  ].map(([id, sport, date, start, end, value, count], index) => ({
    id: String(id),
    id_arena: arenaId,
    id_esporte: `tutorial-sport-${index + 1}`,
    data: String(date),
    hora_inicio: String(start),
    hora_fim: String(end),
    valor: Number(value),
    limitado: true,
    limite_participantes: 12,
    status: 'ativo',
    created_at: NOW,
    updated_at: NOW,
    esporte: { name: String(sport) },
    courts: [{ id: `tutorial-court-${index + 1}`, name: `Quadra Beach ${index + 1}` }],
    inscricoes_count: Number(count),
  }))
}

export function buildTutorialLoyalty(arenaId: string) {
  const transaction = (
    id: string,
    athleteId: string,
    athlete: string,
    type: string,
    value: number,
    description: string,
  ): LoyaltyTransaction => ({
    id,
    id_arena: arenaId,
    id_atleta: athleteId,
    tipo: type,
    valor: value,
    descricao: description,
    data_registro: NOW,
    data_vencimento: null,
    created_at: NOW,
    created_by: null,
    operation_id: null,
    validity_code: null,
    atleta: { nome_perfil: athlete },
  })
  return {
    credits: [
      transaction('tutorial-loyalty-1', 'tutorial-athlete-1', 'Marina Costa', 'credito', 80, 'Bonus de recorrencia'),
      transaction('tutorial-loyalty-2', 'tutorial-athlete-2', 'Lucas Martins', 'credito', 50, 'Reserva confirmada'),
    ],
    redemptions: [
      transaction('tutorial-loyalty-3', 'tutorial-athlete-3', 'Ana Ribeiro', 'resgate', 35, 'Desconto em reserva'),
    ],
    topAthletes: [
      { name: 'Marina Costa', balance: 240 },
      { name: 'Lucas Martins', balance: 185 },
      { name: 'Ana Ribeiro', balance: 120 },
    ],
  }
}

export function buildTutorialFinance(arenaId: string): {
  summary: ArenaFinanceSummary
  recentEntradas: Transaction[]
  recentSaidas: Transaction[]
  chartSeries: ArenaFinanceDailyRow[]
} {
  const transaction = (
    id: string,
    category: string,
    description: string,
    value: number,
    type: string,
  ): Transaction => ({
    id,
    arena_id: arenaId,
    atleta_id: null,
    category,
    description,
    discount: 0,
    launch_date: TODAY,
    modo_pagamento_id: null,
    quantity: 1,
    registered_by: null,
    registration_date: NOW,
    source_id: null,
    source_type: null,
    total_value: value,
    type,
    unit_value: value,
    created_at: NOW,
  })
  return {
    summary: {
      lifetime_entradas: 18420,
      lifetime_saidas: 4680,
      current_month_entradas: 6420,
      current_month_saidas: 1680,
      prev_month_entradas: 5580,
      prev_month_saidas: 1920,
    },
    recentEntradas: [
      transaction('tutorial-finance-1', 'Mensalidade', 'Marina Costa', 320, 'entrada'),
      transaction('tutorial-finance-2', 'Reserva', 'Quadra Beach 02', 180, 'entrada'),
    ],
    recentSaidas: [
      transaction('tutorial-finance-3', 'Manutencao', 'Equipamentos esportivos', 460, 'saida'),
    ],
    chartSeries: [
      { bucket_date: '2026-05-24', entradas: 1720, saidas: 420 },
      { bucket_date: '2026-05-25', entradas: 2280, saidas: 680 },
      { bucket_date: '2026-05-26', entradas: 1940, saidas: 360 },
      { bucket_date: '2026-05-27', entradas: 2860, saidas: 920 },
      { bucket_date: '2026-05-28', entradas: 2420, saidas: 740 },
      { bucket_date: '2026-05-29', entradas: 3180, saidas: 560 },
      { bucket_date: '2026-05-30', entradas: 4020, saidas: 1000 },
    ],
  }
}

export function buildTutorialUsers() {
  return [
    {
      arenaUserId: 'tutorial-arena-user-1',
      id: 'tutorial-user-1',
      name: 'Anderson Martins',
      email: 'anderson@email.com',
      role: 'owner',
      status: 'active',
      stationId: null,
    },
    {
      arenaUserId: 'tutorial-arena-user-2',
      id: 'tutorial-user-2',
      name: 'Carla Souza',
      email: 'carla@email.com',
      role: 'manager',
      status: 'active',
      stationId: 'tutorial-station-1',
    },
  ]
}

export const tutorialReportCategories: BarCategory[] = [
  ['sem_reserva', 'Cadastrados sem reserva', 18, 'var(--arena-button)', 'Atletas cadastrados que ainda nao fizeram reserva'],
  ['uma_reserva', 'Somente 1 reserva', 34, '#3B82F6', 'Atletas que realizaram exatamente uma reserva'],
  ['recentes', 'Ativos recentes', 126, '#10B981', 'Atletas com reserva nos ultimos 30 dias'],
  ['frequentes', 'Clientes frequentes', 68, '#8B5CF6', 'Atletas com cinco ou mais reservas'],
  ['inativos', 'Clientes inativos', 22, '#94A3B8', 'Atletas sem atividade nos ultimos 90 dias'],
].map(([id, label, count, color, description]) => ({
  id: String(id),
  label: String(label),
  count: Number(count),
  color: String(color),
  description: String(description),
  athletes: Array.from({ length: Number(count) }, (_, index) => ({
    id: `tutorial-report-athlete-${index + 1}`,
    nome: ['Marina Costa', 'Lucas Martins', 'Ana Ribeiro'][index] ?? `Atleta demonstrativo ${index + 1}`,
    cpf: String(12345678900 + index),
    data_nascimento: '1994-03-12',
    telefone: `1198888${String(1020 + index).padStart(4, '0')}`,
    esportes: [index % 2 === 0 ? 'Beach Tennis' : 'Futevolei'],
    total_reservas: Number(count),
    ultima_reserva: NOW,
  })),
}))
