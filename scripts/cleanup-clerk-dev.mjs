import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path) {
  const content = readFileSync(path, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const dryRun = process.argv.includes('--dry-run')

function uniq(values) {
  return [...new Set(values.filter(Boolean))]
}

function chunk(values, size = 100) {
  const chunks = []
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size))
  return chunks
}

async function selectAll(table, columns = '*', apply = (query) => query) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const query = apply(supabase.from(table).select(columns).range(from, from + pageSize - 1))
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

async function selectByIn(table, columns, column, values) {
  if (!values.length) return []
  const rows = []
  for (const part of chunk(values)) {
    rows.push(...await selectAll(table, columns, (query) => query.in(column, part)))
  }
  return rows
}

async function countByIn(table, column, values) {
  if (!values.length) return 0
  let total = 0
  for (const part of chunk(values)) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in(column, part)
    if (error) throw new Error(`${table}: ${error.message}`)
    total += count ?? 0
  }
  return total
}

async function deleteByIn(table, column, values) {
  if (!values.length) return 0
  let total = 0
  for (const part of chunk(values)) {
    const { count, error } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in(column, part)
    if (error) throw new Error(`${table}: ${error.message}`)
    total += count ?? 0
  }
  return total
}

async function updateNullByIn(table, columns, filterColumn, values) {
  if (!values.length) return 0
  let total = 0
  const payload = Object.fromEntries(columns.map((column) => [column, null]))
  for (const part of chunk(values)) {
    const { count, error } = await supabase
      .from(table)
      .update(payload, { count: 'exact' })
      .in(filterColumn, part)
    if (error) throw new Error(`${table}: ${error.message}`)
    total += count ?? 0
  }
  return total
}

async function safeCount(table, column, values) {
  try {
    return await countByIn(table, column, values)
  } catch (error) {
    console.warn(`Skipping count for ${table}: ${error.message}`)
    return 0
  }
}

async function safeDelete(table, column, values) {
  try {
    return await deleteByIn(table, column, values)
  } catch (error) {
    console.warn(`Skipping delete for ${table}: ${error.message}`)
    return 0
  }
}

async function safeUpdateNull(table, columns, filterColumn, values) {
  try {
    return await updateNullByIn(table, columns, filterColumn, values)
  } catch (error) {
    console.warn(`Skipping update for ${table}: ${error.message}`)
    return 0
  }
}

const legacyUsers = await selectAll(
  'users',
  'id,email,clerk_user_id',
  (query) => query.not('clerk_user_id', 'is', null),
)

const legacyUserIds = uniq(legacyUsers.map((user) => user.id))
const legacyClerkIds = uniq(legacyUsers.map((user) => user.clerk_user_id))
const legacyEmails = uniq(legacyUsers.map((user) => user.email?.toLowerCase()))

const ownedArenas = await selectByIn('arenas', 'id', 'owner_id', legacyUserIds)
const ownedArenaIds = uniq(ownedArenas.map((arena) => arena.id))

const legacyAthletes = await selectByIn('atleta', 'id,id_users', 'id_users', legacyUserIds)
const arenaAthleteLinks = await selectByIn('arenas_atleta', 'id_atleta', 'id_arena', ownedArenaIds)
const athleteIds = uniq([
  ...legacyAthletes.map((athlete) => athlete.id),
  ...arenaAthleteLinks.map((link) => link.id_atleta),
])

const courts = await selectByIn('courts', 'id', 'arena_id', ownedArenaIds)
const courtIds = uniq(courts.map((court) => court.id))

const plansByArena = await selectByIn('planos_mensalista', 'id', 'arena_id', ownedArenaIds)
const plansByAthlete = await selectByIn('planos_mensalista', 'id', 'athlete_id', athleteIds)
const plansByCourt = await selectByIn('planos_mensalista', 'id', 'court_id', courtIds)
const planIds = uniq([...plansByArena, ...plansByAthlete, ...plansByCourt].map((plan) => plan.id))

const bookingsByArena = await selectByIn('bookings', 'id', 'arena_id', ownedArenaIds)
const bookingsByAthlete = await selectByIn('bookings', 'id', 'athlete_id', athleteIds)
const bookingsByPlan = await selectByIn('bookings', 'id', 'plano_mensalista_id', planIds)
const bookingIds = uniq([...bookingsByArena, ...bookingsByAthlete, ...bookingsByPlan].map((booking) => booking.id))

const rotativos = await selectByIn('rotativos', 'id', 'id_arena', ownedArenaIds)
const rotativoIds = uniq(rotativos.map((rotativo) => rotativo.id))

const stationOrdersByArena = await selectByIn('station_orders', 'id,customer_id', 'arena_id', ownedArenaIds)
const stationOrdersByAthlete = await selectByIn('station_orders', 'id,customer_id', 'atleta_id', athleteIds)
const stationOrderIds = uniq([...stationOrdersByArena, ...stationOrdersByAthlete].map((order) => order.id))
const stationCustomerIds = uniq([...stationOrdersByArena, ...stationOrdersByAthlete].map((order) => order.customer_id))

const products = await selectByIn('products', 'id', 'arena_id', ownedArenaIds)
const productIds = uniq(products.map((product) => product.id))

const teamsByOwner = await selectByIn('times', 'id', 'id_atleta_dono', athleteIds)
const teamAthleteLinks = await selectByIn('times_atletas', 'id_time', 'id_atleta', athleteIds)
const teamInviteLinks = await selectByIn('times_atletas', 'id_time', 'convidado_por', athleteIds)
const teamIds = uniq([
  ...teamsByOwner.map((team) => team.id),
  ...teamAthleteLinks.map((link) => link.id_time),
  ...teamInviteLinks.map((link) => link.id_time),
])

const authUsersToDelete = []
for (const page of Array.from({ length: 20 }, (_, index) => index + 1)) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw new Error(`auth.users: ${error.message}`)
  const users = data.users ?? []
  authUsersToDelete.push(
    ...users.filter((user) => legacyUserIds.includes(user.id) || legacyEmails.includes(user.email?.toLowerCase())),
  )
  if (users.length < 1000) break
}

const summary = {
  legacyUsers: legacyUserIds.length,
  ownedArenas: ownedArenaIds.length,
  athletes: athleteIds.length,
  bookings: bookingIds.length,
  monthlyPlans: planIds.length,
  rotativos: rotativoIds.length,
  stationOrders: stationOrderIds.length,
  products: productIds.length,
  teams: teamIds.length,
  authUsers: authUsersToDelete.length,
}

const extraCounts = {
  arenaUsers: await safeCount('arena_users', 'user_id', legacyUserIds),
  loyalty: await safeCount('programa_fidelidade_extrato', 'id_atleta', athleteIds),
  transactions: await safeCount('transactions', 'arena_id', ownedArenaIds),
  stockEntries: await safeCount('product_stock_entries', 'arena_id', ownedArenaIds),
  stockMovements: await safeCount('product_stock_movements', 'arena_id', ownedArenaIds),
}

console.log(JSON.stringify({ dryRun, summary, extraCounts }, null, 2))

if (dryRun) {
  process.exit(0)
}

const deleted = {}
const updated = {}

updated.productsCreatedBy = await safeUpdateNull('products', ['created_by'], 'created_by', legacyUserIds)
updated.productsUpdatedBy = await safeUpdateNull('products', ['updated_by'], 'updated_by', legacyUserIds)

deleted.bookingServicesByBooking = await safeDelete('booking_services', 'booking_id', bookingIds)
deleted.bookingServicesByProduct = await safeDelete('booking_services', 'product_id', productIds)
deleted.timesAtletasByTeam = await safeDelete('times_atletas', 'id_time', teamIds)
deleted.timesAtletasByAthlete = await safeDelete('times_atletas', 'id_atleta', athleteIds)
deleted.timesAtletasByInviter = await safeDelete('times_atletas', 'convidado_por', athleteIds)
deleted.stationPayments = await safeDelete('station_payments', 'order_id', stationOrderIds)
deleted.stationOrderItemsByOrder = await safeDelete('station_order_items', 'order_id', stationOrderIds)
deleted.stationOrderItemsByProduct = await safeDelete('station_order_items', 'product_id', productIds)
deleted.rotativoInscricoesByRotativo = await safeDelete('rotativo_inscricoes', 'id_rotativo', rotativoIds)
deleted.rotativoInscricoesByAthlete = await safeDelete('rotativo_inscricoes', 'id_atleta', athleteIds)
deleted.loyaltyByArena = await safeDelete('programa_fidelidade_extrato', 'id_arena', ownedArenaIds)
deleted.loyaltyByAthlete = await safeDelete('programa_fidelidade_extrato', 'id_atleta', athleteIds)
deleted.loyaltyByCreator = await safeDelete('programa_fidelidade_extrato', 'created_by', legacyUserIds)
deleted.atletaEsportes = await safeDelete('atleta_esportes', 'id_atleta', athleteIds)
deleted.arenasAtletaByArena = await safeDelete('arenas_atleta', 'id_arena', ownedArenaIds)
deleted.arenasAtletaByAthlete = await safeDelete('arenas_atleta', 'id_atleta', athleteIds)
deleted.productStockEntriesByArena = await safeDelete('product_stock_entries', 'arena_id', ownedArenaIds)
deleted.productStockEntriesByProduct = await safeDelete('product_stock_entries', 'product_id', productIds)
deleted.productStockEntriesByUser = await safeDelete('product_stock_entries', 'registered_by', legacyUserIds)
deleted.productStockMovementsByArena = await safeDelete('product_stock_movements', 'arena_id', ownedArenaIds)
deleted.productStockMovementsByProduct = await safeDelete('product_stock_movements', 'product_id', productIds)
deleted.productStockMovementsByUser = await safeDelete('product_stock_movements', 'registered_by', legacyUserIds)
deleted.transactionsByArena = await safeDelete('transactions', 'arena_id', ownedArenaIds)
deleted.transactionsByUser = await safeDelete('transactions', 'registered_by', legacyUserIds)
deleted.stationOrders = await safeDelete('station_orders', 'id', stationOrderIds)
deleted.stationCustomers = await safeDelete('station_customers', 'id', stationCustomerIds)
deleted.bookings = await safeDelete('bookings', 'id', bookingIds)
deleted.monthlyPlans = await safeDelete('planos_mensalista', 'id', planIds)
deleted.teams = await safeDelete('times', 'id', teamIds)
deleted.courtSports = await safeDelete('court_sports', 'court_id', courtIds)
deleted.courts = await safeDelete('courts', 'id', courtIds)
deleted.rotativos = await safeDelete('rotativos', 'id', rotativoIds)
deleted.products = await safeDelete('products', 'id', productIds)
deleted.stations = await safeDelete('stations', 'arena_id', ownedArenaIds)
deleted.arenaComodidades = await safeDelete('arena_comodidades', 'arena_id', ownedArenaIds)
deleted.arenaSports = await safeDelete('arena_sports', 'arena_id', ownedArenaIds)
deleted.arenaSubscriptions = await safeDelete('arena_subscriptions', 'arena_id', ownedArenaIds)
deleted.auditLogs = await safeDelete('audit_logs', 'actor_id', legacyClerkIds)
deleted.arenaUsersByArena = await safeDelete('arena_users', 'arena_id', ownedArenaIds)
deleted.arenaUsersByUser = await safeDelete('arena_users', 'user_id', legacyUserIds)
deleted.athletes = await safeDelete('atleta', 'id', athleteIds)
deleted.arenas = await safeDelete('arenas', 'id', ownedArenaIds)
deleted.organizations = await safeDelete('organizations', 'owner_id', legacyUserIds)
deleted.users = await safeDelete('users', 'id', legacyUserIds)

let authDeleted = 0
for (const user of authUsersToDelete) {
  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error) {
    console.warn(`Skipping auth user ${user.id}: ${error.message}`)
    continue
  }
  authDeleted += 1
}
deleted.authUsers = authDeleted

const remainingLegacyUsers = await selectAll(
  'users',
  'id,email,clerk_user_id',
  (query) => query.not('clerk_user_id', 'is', null),
)

console.log(JSON.stringify({ updated, deleted, remainingLegacyUsers: remainingLegacyUsers.length }, null, 2))
