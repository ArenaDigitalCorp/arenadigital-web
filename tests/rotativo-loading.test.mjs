import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'
import { rotativoFixture, fixtureArena as arenaId, fixtureOtherArena as otherArenaId, fixtureAthlete as athleteId } from './helpers/rotativo-fixture-client.mjs'

const { SupabaseRotativoRepository: Repository } = loadTypescriptModule('src/modules/rotativos/repositories/SupabaseRotativoRepository.ts')
const tick = () => new Promise(resolve => setImmediate(resolve))

test('concurrent credit reads reconcile once, wait for expiry, and return the correct movements/ranking/balance', async () => {
  const h = rotativoFixture({ gated: true }), repo = new Repository(h.client)
  const pending = Promise.all([repo.getCreditMovements(arenaId), repo.getTopAthletesByCredit(arenaId), repo.getAthleteCreditBalance(arenaId, athleteId)])
  await tick()
  assert.equal(h.rpcCalls.length, 1)
  assert.equal(h.events.some(event => event.type === 'read'), false)
  h.release()
  const [movements, ranking, balance] = await pending
  assert.equal(balance, 3)
  assert.deepEqual(JSON.parse(JSON.stringify(ranking)), [{ arena_id: arenaId, atleta_id: athleteId, saldo: 3, atleta: { id: athleteId, nome_perfil: 'Fixture Athlete' } }])
  assert.equal(movements.total, 1)
  assert.equal(movements.rows[0].tipo, 'vencimento')
  assert.equal(movements.rows[0].quantidade, -5)
  assert.equal(movements.rows[0].lote.data_vencimento, '2000-01-01')
  assert.equal(movements.rows[0].atleta.nome_perfil, 'Fixture Athlete')
  assert.equal(h.state.lots.find(lot => lot.id === 'valid').quantidade_restante, 3)
  assert.equal(h.state.movements.length, 1)
})

test('completed reconciliation is never cached: a later standalone read reconciles newly expired credits again', async () => {
  const h = rotativoFixture(), repo = new Repository(h.client)
  assert.equal(await repo.getAthleteCreditBalance(arenaId, athleteId), 3)
  h.state.lots.push({ id: 'new-expired', arena_id: arenaId, atleta_id: athleteId, quantidade_restante: 2, data_vencimento: '2000-01-01' })
  assert.equal(await repo.getAthleteCreditBalance(arenaId, athleteId), 3)
  assert.equal(h.rpcCalls.length, 2)
  assert.equal(h.state.movements.length, 2)
})

test('simultaneous reads of different arenas do not share reconciliation or balances', async () => {
  const h = rotativoFixture({ gated: true }), repo = new Repository(h.client)
  const pending = Promise.all([repo.getAthleteCreditBalance(arenaId, athleteId), repo.getAthleteCreditBalance(otherArenaId, athleteId)])
  await tick()
  assert.equal(h.rpcCalls.length, 2)
  assert.deepEqual(new Set(h.rpcCalls), new Set([arenaId, otherArenaId]))
  h.release()
  assert.deepEqual(await pending, [3, 4])
})

test('repository instances do not share expiry state between requests or users', async () => {
  const h = rotativoFixture({ gated: true })
  const pending = Promise.all([new Repository(h.client).getAthleteCreditBalance(arenaId, athleteId), new Repository(h.client).getAthleteCreditBalance(arenaId, athleteId)])
  await tick()
  assert.equal(h.rpcCalls.length, 2)
  h.release()
  assert.deepEqual(await pending, [3, 3])
})

for (const failure of ['error', 'throw']) {
  test(`expiry ${failure} blocks dependent reads, is shared by concurrent callers, and remains retryable`, async () => {
    const h = rotativoFixture(), repo = new Repository(h.client)
    h.state.failure = failure
    const results = await Promise.allSettled([repo.getCreditMovements(arenaId), repo.getTopAthletesByCredit(arenaId)])
    assert.ok(results.every(result => result.status === 'rejected' && /Fixture expiry unavailable/.test(result.reason.message)))
    assert.equal(h.rpcCalls.length, 1)
    assert.equal(h.events.some(event => event.type === 'read'), false)
    h.state.failure = null
    assert.equal(await repo.getAthleteCreditBalance(arenaId, athleteId), 3)
    assert.equal(h.rpcCalls.length, 2)
  })
}

function pageFixture({ denied = false, gated = false } = {}) {
  const h = rotativoFixture({ gated })
  const { default: Page } = loadTypescriptModule('src/app/dashboard/rotativo/[arenaId]/page.tsx', {
    '@/lib/server-auth': { async assertArenaBackofficeAccess(id) {
      assert.equal(id, arenaId)
      if (denied) throw new Error('Forbidden')
    } },
    '@/lib/supabase-server': { getSupabaseAdmin: () => h.client },
    '@/modules/arenas/repositories/SupabaseArenaRepository': { SupabaseArenaRepository: class {
      async findById(id) { assert.equal(id, arenaId); return { sports: [{ id: 'fixture-sport', name: 'Fixture Sport' }] } }
    } },
    '@/modules/rotativos/repositories/SupabaseRotativoRepository': { SupabaseRotativoRepository: Repository },
    '@/modules/rotativos/components/RotativoCreditsError': { RotativoCreditsError: 'RotativoCreditsError' },
    '@/modules/rotativos/components/CreditosTab': { CreditosTab: 'CreditosTab' },
    '@/modules/rotativos/components/RotativoPageClient': { RotativoPageClient: 'RotativoPageClient' },
    '@/lib/tutorial-mock-data': { buildTutorialRotativos: () => [{ id: 'tutorial-rotativo' }] },
    'next/navigation': { redirect(path) { throw new Error(`Redirect:${path}`) } },
  })
  return { ...h, render: searchParams => Page({ params: Promise.resolve({ arenaId }), searchParams: Promise.resolve(searchParams ?? {}) }) }
}

test('the page contract keeps both tabs populated with reconciled movements and ranking, without duplicate expiry', async () => {
  const h = pageFixture(), tree = await h.render()
  assert.equal(tree.type, 'RotativoPageClient')
  const credit = tree.props.creditContent.props.children
  const creditTree = await credit.type(credit.props)
  const props = { ...JSON.parse(JSON.stringify(tree.props)), ...JSON.parse(JSON.stringify(creditTree.props)) }
  assert.equal(props.arenaId, arenaId)
  assert.deepEqual(props.sports, [{ id: 'fixture-sport', name: 'Fixture Sport' }])
  assert.deepEqual(props.initialRotativos, [])
  assert.equal(props.initialRotativosTotal, 0)
  assert.deepEqual(props.courts, [])
  assert.deepEqual(props.initialPacotes, [])
  assert.equal(props.initialMovementsTotal, 1)
  assert.equal(props.initialMovements[0].quantidade, -5)
  assert.equal(props.initialTopAthletes[0].saldo, 3)
  assert.equal(h.rpcCalls.length, 1)
})

test('a denied page request never reads or reconciles arena data', async () => {
  const h = pageFixture({ denied: true })
  await assert.rejects(h.render(), /Redirect:\/dashboard\/settings\/arenas/)
  assert.equal(h.events.length, 0)
})

test('tutorial still populates its local sessions without credit reconciliation or database reads', async () => {
  const h = pageFixture(), tree = await h.render({ tutorial: '1' })
  assert.equal(tree.props.initialRotativos[0].id, 'tutorial-rotativo')
  assert.equal(tree.props.initialRotativosTotal, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(tree.props.creditContent.props.initialMovements)), [])
  assert.equal(h.events.length, 0)
})

test('a streamed expiry failure renders an explicit retry without a successful empty or stale credit view', async () => {
  const h = pageFixture()
  h.state.failure = 'error'
  const tree = await h.render()
  const credit = tree.props.creditContent.props.children
  const content = await credit.type(credit.props)
  assert.equal(content.type, 'RotativoCreditsError')
  assert.equal(h.rpcCalls.length, 1)
  assert.equal(h.events.some(event => event.type === 'read' && ['rotativo_credito_movimentos', 'rotativo_credito_saldo'].includes(event.table)), false)
})

test('retrying the route error requests fresh server data as well as resetting the error boundary', () => {
  const events = []
  const { default: RouteError } = loadTypescriptModule('src/app/dashboard/rotativo/[arenaId]/error.tsx', {
    react: { useTransition: () => [false, callback => { events.push('transition'); callback() }] },
    'next/navigation': { useRouter: () => ({ refresh() { events.push('refresh') } }) },
    '@/components/dashboard/DashboardErrorState': { DashboardErrorState: 'DashboardErrorState' },
  })
  const error = new Error('Fixture failure')
  const tree = RouteError({ error, reset() { events.push('reset') } })
  assert.equal(tree.props.error, error)
  tree.props.reset()
  assert.deepEqual(events, ['transition', 'refresh', 'reset'])
})


test('the sessions table is ready while expiry is still pending, and streamed credits wait for reconciled data', async () => {
  const h = pageFixture({ gated: true })
  const tree = await h.render()
  assert.equal(tree.type, 'RotativoPageClient')
  assert.equal(h.rpcCalls.length, 1)
  assert.equal(h.events.some(event => event.type === 'read' && event.table === 'rotativo_credito_saldo'), false)
  const credit = tree.props.creditContent.props.children
  const pending = credit.type(credit.props)
  h.release()
  const content = await pending
  assert.equal(content.props.initialTopAthletes[0].saldo, 3)
  assert.equal(content.props.initialMovements[0].quantidade, -5)
})


test('retrying streamed credit failures requests a fresh server read without resetting the parent route', () => {
  const events = []
  const { RotativoCreditsError } = loadTypescriptModule('src/modules/rotativos/components/RotativoCreditsError.tsx', {
    react: { useTransition: () => [false, callback => callback()] },
    'next/navigation': { useRouter: () => ({ refresh() { events.push('refresh') } }) },
    '@/components/ui/button': { Button: 'Button' },
  })
  const tree = RotativoCreditsError()
  tree.props.children[1].props.onClick()
  assert.deepEqual(events, ['refresh'])
})
