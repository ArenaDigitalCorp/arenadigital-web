import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements)
  return node && typeof node === 'object' ? [node, ...elements(node.props?.children)] : []
}

function text(node) {
  if (Array.isArray(node)) return node.map(text).join('')
  return node && typeof node === 'object' ? text(node.props?.children) : String(node ?? '')
}

function harness({ draft = '100,00', quote = async () => ({ success: true, valor: 30 }), launch = async () => ({ success: false, error: 'test-stop' }) } = {}) {
  const state = [[{ quantidade: '1', valor_reais: draft }]], refs = [], effects = []
  let stateIndex, refIndex, effectIndex, dirty, tree, submit, uuidCounter = 0
  let fields = { athleteId: 'athlete', quantidade: '1', validityDays: '30', modo_pagamento_id: 'payment' }
  let props = { arenaId: 'arena-a', initialPacotes: [{ quantidade: 1, valor_reais: 30 }], initialMovements: [], initialMovementsTotal: 0, initialTopAthletes: [] }
  const pendingEffects = [], requests = [], launches = [], notices = [], movementReads = []
  const { CreditosTab } = loadTypescriptModule('src/modules/rotativos/components/CreditosTab.tsx', {
    react: { ...realReact,
      useState(initial) {
        const i = stateIndex++
        if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial
        return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; dirty = true }]
      },
      useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial } },
      useEffect(effect, deps) {
        const i = effectIndex++, previous = effects[i]
        if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) {
          pendingEffects.push(() => { previous?.cleanup?.(); effects[i] = { deps, cleanup: effect() } })
        }
      },
      useTransition: () => [false, fn => fn()],
    },
    'react-hook-form': { useForm: () => ({ control: {}, watch: key => fields[key],
      handleSubmit: fn => { submit = fn; return fn }, reset: next => { fields = next; dirty = true }, setValue: (key, value) => { fields[key] = value; dirty = true } }) },
    '@/modules/rotativos/actions/rotativoActions': {
      previewCreditPurchaseValueAction: (arena, quantity) => { requests.push({ arena, quantity }); return quote(arena, quantity, requests.length) },
      launchRotativoCreditAction: async input => { launches.push(input); return launch(input) },
      getRotativoCreditMovementsAction: async arena => { movementReads.push(arena); return { success: true, data: [], total: 0 } },
      getTopRotativoAthletesAction: async () => ({ success: true, data: [] }),
    },
    '@/modules/athletes/actions/athleteActions': {},
    '@/modules/finance/actions/financeActions': { getModoPagamentoAction: async () => ({ success: true, data: [] }) },
    sonner: { toast: { error: message => notices.push(['error', message]), success: message => notices.push(['success', message]) } },
  }, { crypto: { randomUUID: () => `d2000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}` } })

  function render(nextProps) {
    if (nextProps) props = { ...props, ...nextProps }
    stateIndex = refIndex = effectIndex = 0
    dirty = false
    tree = CreditosTab(props)
    while (pendingEffects.length) pendingEffects.shift()()
    return tree
  }
  async function flush() {
    for (let i = 0; i < 12; i++) { await Promise.resolve(); if (dirty) render() }
    return tree
  }
  function button(label) { return elements(tree).find(node => typeof node.props?.onClick === 'function' && text(node).trim() === label) }
  function finalButton() { return elements(tree).find(node => node.props?.type === 'submit') }
  function dialogChange() { return elements(tree).find(node => typeof node.props?.onOpenChange === 'function').props.onOpenChange }
  render()
  return { requests, launches, notices, movementReads, render, flush, button, finalButton, dialogChange,
    text: () => text(tree),
    modalOpen: () => elements(tree).find(node => typeof node.props?.onOpenChange === 'function').props.open,
    async open() { await button('Lançar crédito').props.onClick(); render(); await flush() },
    quantity(value) { fields.quantidade = value; render() },
    fields: () => ({ ...fields }),
    locked: () => elements(tree).find(node => node.type === 'fieldset').props.disabled,
    submit: (overrides = {}) => submit({ ...fields, athleteId: 'athlete', validityDays: '30', modo_pagamento_id: 'payment', ...overrides }),
  }
}

test('credit estimate uses persisted packages rather than edited or invalid package drafts, including zero', async () => {
  for (const draft of ['100,00', '12abc']) {
    const h = harness({ draft })
    await h.open()
    assert.equal(h.requests[0].quantity, 1)
    assert.match(h.text(), /Valor estimado:.*R\$\s30,00/u)
    assert.equal(h.finalButton().props.disabled, false)
  }
  const free = harness({ quote: async () => ({ success: true, valor: 0 }), launch: async () => ({ success: true, valorPago: 0 }) })
  await free.open()
  assert.equal(free.finalButton().props.disabled, false)
  await free.submit()
  await free.flush()
  assert.equal(free.launches.length, 1)
  assert.match(free.notices.find(([kind]) => kind === 'success')[1], /Valor pago: R\$\s0,00/u)
})

test('unknown purchases preserve their exact operation across retries and close/reopen, even after the price changes', async () => {
  for (const rejected of [false, true]) {
    const committed = new Map()
    const h = harness({ quote: async (_arena, _quantity, index) => ({ success: true, valor: index <= 2 ? 30 : 90 }),
      launch: async input => {
        committed.set(input.operationId, input)
        if (rejected) throw new Error('response lost after commit')
        return { success: false, error: 'transport error captured by action' }
      } })
    await h.open()
    await h.submit(); await h.flush()
    const original = h.launches[0]
    assert.equal(h.locked(), true)
    assert.match(h.text(), /lançamento aguardando confirmação/u)
    await h.submit({ athleteId: 'different', quantidade: '4', validityDays: '90', modo_pagamento_id: 'other' }); await h.flush()
    assert.deepEqual(h.launches[1], original)
    h.dialogChange()(false); h.render(); await h.flush()
    await h.open()
    assert.equal(h.fields().athleteId, original.athleteId)
    assert.equal(h.fields().quantidade, String(original.quantidade))
    assert.equal(h.fields().validityDays, String(original.validityDays))
    assert.equal(h.fields().modo_pagamento_id, original.modo_pagamento_id)
    assert.equal(h.locked(), true)
    await h.submit(); await h.flush()
    assert.deepEqual(h.launches[2], original)
    assert.equal(committed.size, 1, 'A committed purchase with a lost receipt must not be duplicated')
    assert.equal(h.requests.length, 2, 'Retry must recover the original receipt without a new price preflight')
  }
})

test('a first definitive rejection releases editing, while later rejection cannot discard an unknown purchase', async () => {
  const rejected = harness({ launch: async () => ({ success: false, outcome: 'rejected', error: 'invalid athlete' }) })
  await rejected.open(); await rejected.submit(); await rejected.flush()
  assert.equal(rejected.locked(), false)
  assert.doesNotMatch(rejected.text(), /lançamento aguardando confirmação/u)
  await rejected.submit({ athleteId: 'corrected' }); await rejected.flush()
  assert.equal(rejected.launches[1].athleteId, 'corrected')
  assert.notEqual(rejected.launches[1].operationId, rejected.launches[0].operationId)

  let attempts = 0
  const uncertain = harness({ launch: async () => ++attempts === 1
    ? { success: false, outcome: 'unknown', error: 'connection lost' }
    : { success: false, outcome: 'rejected', error: 'athlete removed before recovery' } })
  await uncertain.open(); await uncertain.submit(); await uncertain.flush()
  await uncertain.submit(); await uncertain.flush()
  assert.equal(uncertain.locked(), true)
  uncertain.dialogChange()(false); uncertain.render(); await uncertain.flush(); await uncertain.open()
  await uncertain.submit({ athleteId: 'other' }); await uncertain.flush()
  assert.deepEqual(uncertain.launches[2], uncertain.launches[0])
})

test('invalid quantity, loading, failed estimates and missing quotes cannot submit; retry obtains a new estimate', async () => {
  const pending = deferred()
  const h = harness({ quote: () => pending.promise })
  await h.open()
  assert.match(h.text(), /Consultando valor/u)
  assert.equal(h.finalButton().props.disabled, true)
  await h.submit()
  assert.equal(h.launches.length, 0)
  h.quantity('1.5'); await h.flush()
  assert.equal(h.finalButton().props.disabled, true)
  await h.submit()
  assert.equal(h.requests.length, 1)

  const failed = harness({ quote: async (_arena, _qty, index) => index === 1 ? { success: false, valor: null } : { success: true, valor: 30 } })
  await failed.open()
  assert.match(failed.text(), /Não foi possível consultar/u)
  await failed.submit()
  assert.equal(failed.launches.length, 0)
  failed.button('Consultar novamente').props.onClick(); failed.render(); await failed.flush()
  assert.equal(failed.finalButton().props.disabled, false)
  for (const amount of [null, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    const invalid = harness({ quote: async () => ({ success: true, valor: amount }) })
    await invalid.open(); await invalid.submit()
    assert.equal(invalid.launches.length, 0)
    assert.equal(invalid.finalButton().props.disabled, true)
  }
  const unavailable = harness({ quote: async () => { throw new Error('network unavailable') } })
  await unavailable.open(); await unavailable.submit()
  assert.equal(unavailable.launches.length, 0)
  assert.match(unavailable.text(), /Não foi possível consultar/u)
})

test('late estimates cannot overwrite a newer quantity, another arena, or a closed modal', async () => {
  const queue = []
  const h = harness({ quote: () => { const next = deferred(); queue.push(next); return next.promise } })
  await h.open()
  h.quantity('2'); await h.flush()
  queue[1].resolve({ success: true, valor: 60 }); await h.flush()
  queue[0].resolve({ success: true, valor: 30 }); await h.flush()
  assert.match(h.text(), /Valor estimado:.*R\$\s60,00/u)
  h.render({ arenaId: 'arena-b' }); await h.flush()
  assert.equal(h.finalButton().props.disabled, true)
  h.dialogChange()(false); h.render(); await h.flush()
  queue[2].resolve({ success: true, valor: 90 }); await h.flush()
  assert.doesNotMatch(h.text(), /Valor estimado:/u)
  assert.equal(h.launches.length, 0)
})

test('changed persisted price requires another confirmation and preflight failures block launch', async () => {
  const changed = harness({ quote: async (_arena, _qty, index) => ({ success: true, valor: index === 1 ? 30 : 45 }) })
  await changed.open()
  await changed.submit(); await changed.flush()
  assert.equal(changed.launches.length, 0)
  assert.match(changed.text(), /Valor estimado:.*R\$\s45,00/u)
  assert.ok(changed.notices.some(([, value]) => value.includes('confirme novamente')))
  await changed.submit()
  assert.equal(changed.launches.length, 1)

  const failed = harness({ quote: async (_arena, _qty, index) => index === 1 ? { success: true, valor: 30 } : { success: false, valor: null } })
  await failed.open(); await failed.submit(); await failed.flush()
  assert.equal(failed.launches.length, 0)
  assert.equal(failed.finalButton().props.disabled, true)
  const unavailable = harness({ quote: async (_arena, _qty, index) => {
    if (index === 1) return { success: true, valor: 30 }
    throw new Error('network unavailable')
  } })
  await unavailable.open(); await unavailable.submit(); await unavailable.flush()
  assert.equal(unavailable.launches.length, 0)
  assert.equal(unavailable.finalButton().props.disabled, true)
})

test('preflight context and in-flight ref reject stale or duplicate submissions before generating another purchase', async () => {
  const refresh = deferred()
  const h = harness({ quote: async (_arena, _qty, index) => index === 1 ? { success: true, valor: 30 } : refresh.promise,
    launch: async () => ({ success: true, valorPago: 35 }) })
  await h.open()
  const first = h.submit(), second = h.submit()
  await h.flush()
  assert.equal(h.requests.length, 2, 'Only one preflight may run')
  assert.equal(h.finalButton().props.disabled, true)
  refresh.resolve({ success: true, valor: 30 })
  await Promise.all([first, second]); await h.flush()
  assert.equal(h.launches.length, 1)
  assert.match(h.notices.find(([kind]) => kind === 'success')[1], /Valor pago: R\$\s35,00/u)

  const staleRefresh = deferred()
  const stale = harness({ quote: async (_arena, _qty, index) => index === 1 ? { success: true, valor: 30 } : staleRefresh.promise })
  await stale.open()
  const closeBeforeRerender = stale.dialogChange()
  const submitting = stale.submit()
  closeBeforeRerender(false); stale.render(); await stale.flush()
  staleRefresh.resolve({ success: true, valor: 30 })
  await submitting; await stale.flush()
  assert.equal(stale.launches.length, 0)
  for (const change of ['quantity', 'arena']) {
    const changedRefresh = deferred()
    const changing = harness({ quote: async (_arena, _qty, index) => index === 1 ? { success: true, valor: 30 } : changedRefresh.promise })
    await changing.open()
    const pendingSubmit = changing.submit()
    if (change === 'quantity') changing.quantity('2')
    else changing.render({ arenaId: 'arena-b' })
    await changing.flush()
    changedRefresh.resolve({ success: true, valor: 30 })
    await pendingSubmit; await changing.flush()
    assert.equal(changing.launches.length, 0, change)
  }
})

test('an already submitted purchase cannot close a reopened modal or overwrite another arena when its response arrives late', async () => {
  for (const change of ['reopen', 'arena']) {
    const purchase = deferred()
    const h = harness({ launch: () => purchase.promise })
    await h.open()
    const closeBeforeRerender = h.dialogChange()
    const pending = h.submit()
    await h.flush()
    assert.equal(h.launches.length, 1)
    if (change === 'reopen') {
      closeBeforeRerender(false); h.render(); await h.flush()
      await h.open()
    } else {
      h.render({ arenaId: 'arena-b' }); await h.flush()
    }
    assert.equal(h.modalOpen(), true)
    purchase.resolve({ success: true, valorPago: 30 })
    await pending; await h.flush()
    assert.equal(h.modalOpen(), true, change)
    assert.equal(h.movementReads.length, 0, change)
    assert.equal(h.notices.filter(([kind]) => kind === 'success').length, 0, change)
    if (change === 'arena') {
      h.dialogChange()(false); h.render(); await h.flush()
      h.render({ arenaId: 'arena-a' }); await h.flush(); await h.open()
      assert.equal(h.locked(), false, 'A receipt received in another arena still clears its original pending operation')
      await h.submit(); await h.flush()
      assert.notEqual(h.launches[1].operationId, h.launches[0].operationId)
    }
  }
})


test('late successful receipts clear only their original arena pending operation without closing the reopened modal', async () => {
  const receipt = deferred()
  let attempts = 0
  const h = harness({ launch: () => ++attempts === 1 ? receipt.promise : Promise.resolve({ success: false, outcome: 'rejected', error: 'stop' }) })
  await h.open()
  const pending = h.submit(); await h.flush()
  const original = h.launches[0]
  h.dialogChange()(false); h.render(); await h.flush()
  await h.open()
  assert.equal(h.locked(), true)
  receipt.resolve({ success: true, valorPago: 30 }); await pending; await h.flush()
  assert.equal(h.modalOpen(), true)
  assert.equal(h.locked(), false)
  assert.doesNotMatch(h.text(), /lançamento aguardando confirmação/u)
  await h.submit(); await h.flush()
  assert.notEqual(h.launches[1].operationId, original.operationId)
})

test('pending purchase payloads are isolated by arena and are recovered when returning to their arena', async () => {
  const h = harness()
  await h.open(); await h.submit(); await h.flush()
  const original = h.launches[0]
  h.dialogChange()(false); h.render(); await h.flush()
  h.render({ arenaId: 'arena-b' }); await h.flush(); await h.open()
  assert.equal(h.locked(), false)
  await h.submit(); await h.flush()
  assert.equal(h.launches[1].arenaId, 'arena-b')
  assert.notEqual(h.launches[1].operationId, original.operationId)
  h.dialogChange()(false); h.render(); await h.flush()
  h.render({ arenaId: 'arena-a' }); await h.flush(); await h.open()
  await h.submit(); await h.flush()
  assert.deepEqual(h.launches[2], original)
})

test('credit action distinguishes pre-mutation rejection, definitive SQL rejection and unknown transport outcomes', async () => {
  const id = 'b3000000-0000-4000-8000-000000000001'
  const input = { operationId: id, arenaId: id, athleteId: id, quantidade: 1, validityDays: 30, modo_pagamento_id: id }
  function action({ authError, missingAthlete = false, rpcError = null, rpcThrows = false, revalidateThrows = false } = {}) {
    let rpcCalls = 0
    const db = {
      from() { return { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: missingAthlete ? null : {}, error: null }) } },
      async rpc() {
        rpcCalls++
        if (rpcThrows) throw new Error('network unavailable')
        return { data: rpcError ? null : { valor_pago: 30 }, error: rpcError }
      },
    }
    const { launchRotativoCreditAction } = loadTypescriptModule('src/modules/rotativos/actions/rotativoActions.ts', {
      '@/lib/supabase-server': { getSupabaseAdmin: () => db },
      '@/lib/server-auth': {
        requireAuthenticatedDbUser: async () => { if (authError) throw new Error(authError); return { dbUserId: id } },
        assertArenaBackofficeAccess: async () => {},
      },
      'next/cache': { revalidatePath: () => { if (revalidateThrows) throw new Error('cache failed after commit') } },
    })
    return { launch: launchRotativoCreditAction, calls: () => rpcCalls }
  }
  for (const config of [{ authError: 'session expired' }, { missingAthlete: true }]) {
    const h = action(config)
    assert.equal((await h.launch(input)).outcome, 'rejected')
    assert.equal(h.calls(), 0, 'Known rejection occurs before any purchase mutation')
  }
  const invalid = action()
  assert.equal((await invalid.launch({ ...input, quantidade: 0 })).outcome, 'rejected')
  assert.equal(invalid.calls(), 0)
  for (const code of ['22023', '23503', '23514', '42501']) {
    const h = action({ rpcError: { code, message: 'SQL transaction rejected' } })
    assert.equal((await h.launch(input)).outcome, 'rejected', code)
    assert.equal(h.calls(), 1)
  }
  for (const config of [
    { rpcError: { message: 'connection lost' } },
    { rpcError: { code: '23505', message: 'operation already exists' } },
    { rpcError: { code: 'PGRST000', message: 'database unreachable' } },
    { rpcThrows: true },
    { revalidateThrows: true },
  ]) {
    const h = action(config)
    assert.equal((await h.launch(input)).outcome, 'unknown', JSON.stringify(config))
    assert.equal(h.calls(), 1)
  }
  assert.equal((await action().launch(input)).success, true)
})
