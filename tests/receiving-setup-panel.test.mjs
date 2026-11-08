import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function collect(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(item => collect(item, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...collect(node.props?.children, predicate)]
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ')
  if (!node || typeof node !== 'object') return String(node ?? '')
  return text(node.props?.children)
}
const setup = (overrides = {}) => ({ draft: null, desired_mode: 'online_payment', intent_status: 'pending', intent_revision: 1, cancellation_reason: null, active_mode: 'pre_booking', ready: false, missing: ['account'], ...overrides })
const changed = (hook, deps) => !hook || !deps || deps.some((dep, i) => !Object.is(dep, hook.deps?.[i]))

function harness({ initialSetup = setup(), initialSetupError, documentationStatus = 'PENDING' } = {}) {
  const hooks = [], reads = [], mutations = [], timers = new Map(), listeners = new Map()
  let cursor = 0, pendingEffects = [], tree, timerId = 0
  const react = {
    ...realReact,
    useState(initial) {
      const index = cursor++
      if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [hooks[index].value, next => { hooks[index].value = typeof next === 'function' ? next(hooks[index].value) : next }]
    },
    useRef(initial) { const index = cursor++; if (!hooks[index]) hooks[index] = { current: initial }; return hooks[index] },
    useCallback(fn, deps) { const index = cursor++; if (changed(hooks[index], deps)) hooks[index] = { value: fn, deps }; return hooks[index].value },
    useEffect(fn, deps) { const index = cursor++; if (changed(hooks[index], deps)) pendingEffects.push(() => { hooks[index]?.cleanup?.(); hooks[index] = { deps, cleanup: fn() } }) },
  }
  const { ArenaBookingOperationsPanel } = loadTypescriptModule('src/modules/arenas/components/ArenaBookingOperationsPanel.tsx', {
    react,
    './ArenaAppBookingSettingsCard': { ArenaAppBookingSettingsCard: 'ModeCard' },
    './ArenaCancellationPolicyCard': { ArenaCancellationPolicyCard: 'PolicyCard' },
    './ArenaPixSplitSettingsCard': { ArenaPixSplitSettingsCard: 'PaymentCard' },
    '@/components/payments/asaas-provider-notice': { AsaasProviderNotice: 'ProviderNotice' },
    '../actions/receivingSetupActions': {
      getArenaReceivingSetupAction: arenaId => { const request = deferred(); reads.push({ ...request, arenaId }); return request.promise },
      setArenaReceivingBookingModeAction: (arenaId, mode, revision) => { const request = deferred(); mutations.push({ ...request, arenaId, mode, revision }); return request.promise },
    },
  }, {
    setInterval: fn => { const id = ++timerId; timers.set(id, fn); return id },
    clearInterval: id => timers.delete(id),
    document: { visibilityState: 'visible', addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
  })
  const props = {
    arenaId: 'arena-a', arenaName: 'Arena A', initialMode: 'disabled', initialSetup, initialSetupError,
    paymentSettings: { onboardingStarted: true, enabled: false, documentationStatus },
    cancellationPolicySettings: { currentPolicy: { id: 'policy-a' }, draftPolicy: null, publishedVersions: [] }, registration: {},
  }
  function render() {
    cursor = 0; pendingEffects = []
    tree = ArenaBookingOperationsPanel(props)
    pendingEffects.forEach(effect => effect())
    return tree
  }
  const get = type => collect(render(), node => node.type === type)[0]
  const button = label => collect(render(), node => typeof node.props?.onClick === 'function' && text(node).includes(label))[0]
  render()
  return {
    reads, mutations, get, button, render,
    choose: mode => get('ModeCard').props.onSelectionChange(mode),
    save: mode => get('ModeCard').props.onSave(mode),
    tick: () => [...timers.values()].forEach(fn => fn()),
    settle: async () => { await new Promise(resolve => setImmediate(resolve)); return render() },
    unmount: () => hooks.forEach(hook => hook?.cleanup?.()),
  }
}

test('pending activation follows the saved mode and reveals online settings', async () => {
  const h = harness()
  h.tick()
  h.reads[0].resolve({ success: true, data: setup({ intent_status: 'activated', active_mode: 'online_payment', ready: true, intent_revision: 2 }) })
  await h.settle()
  assert.equal(h.get('ModeCard').props.selectedMode, 'online_payment')
  assert.ok(h.get('PaymentCard'))
  assert.match(text(h.render()), /Pagamento online ativado/)
  h.unmount()
})

test('a delayed activation refresh preserves a mode the user selected while it was in flight', async () => {
  const h = harness()
  h.tick()
  h.choose('disabled')
  h.reads[0].resolve({ success: true, data: setup({ intent_status: 'activated', active_mode: 'online_payment', ready: true, intent_revision: 2 }) })
  await h.settle()
  assert.equal(h.get('ModeCard').props.selectedMode, 'disabled')
  assert.equal(h.get('ModeCard').props.savedMode, 'online_payment')
  h.save('disabled')
  assert.equal(h.mutations[0].revision, 2, 'The explicit save uses the newly observed revision')
  h.mutations[0].resolve({ success: true, data: setup({ intent_status: 'cancelled', active_mode: 'disabled', intent_revision: 3 }) })
  await h.settle()
  assert.equal(h.get('ModeCard').props.savedMode, 'disabled')
  h.unmount()
})

test('recovering an initial setup error restores the actual active mode', async () => {
  const h = harness({ initialSetup: null, initialSetupError: 'Servidor indisponível' })
  h.button('Atualizar status').props.onClick()
  h.reads[0].resolve({ success: true, data: setup({ intent_status: 'activated', active_mode: 'online_payment', ready: true }) })
  await h.settle()
  assert.equal(h.get('ModeCard').props.selectedMode, 'online_payment')
  assert.ok(h.get('PaymentCard'))
  assert.equal(collect(h.render(), node => node.props?.role === 'alert').length, 0)
  h.unmount()
})

test('cancellation ignores old activation reads and prevents concurrent reads or duplicate saves', async () => {
  const h = harness()
  h.tick()
  h.choose('disabled')
  h.save('disabled')
  h.tick()
  h.save('disabled')
  assert.equal(h.reads.length, 1, 'No new poll while mutation is in flight')
  assert.equal(h.mutations.length, 1, 'Repeated callback cannot submit another mutation')
  h.mutations[0].resolve({ success: true, data: setup({ intent_status: 'cancelled', active_mode: 'disabled', intent_revision: 2 }) })
  await h.settle()
  h.reads[0].resolve({ success: true, data: setup({ intent_status: 'activated', active_mode: 'online_payment', intent_revision: 1 }) })
  await h.settle()
  assert.equal(h.get('ModeCard').props.setup.intent_status, 'cancelled')
  assert.equal(h.get('ModeCard').props.savedMode, 'disabled')
  assert.equal(h.get('ModeCard').props.busy, false)
  h.unmount()
})

test('a transport failure becomes a visible retryable status error', async () => {
  const h = harness()
  h.tick()
  h.reads[0].reject(new Error('Network failed'))
  await h.settle()
  assert.match(text(collect(h.render(), node => node.props?.role === 'alert')), /Não foi possível atualizar o status/)
  h.button('Atualizar status').props.onClick()
  h.reads[1].resolve({ success: true, data: setup() })
  await h.settle()
  assert.equal(collect(h.render(), node => node.props?.role === 'alert').length, 0)
  h.unmount()
})

test('documents must be sent before requesting and mode switches keep child editors mounted', () => {
  const h = harness({ initialSetup: setup({ desired_mode: null, intent_status: null, intent_revision: 0, active_mode: 'disabled' }) })
  h.choose('online_payment')
  assert.equal(h.button('Solicitar pagamento online').props.disabled, true)
  const paymentBefore = h.get('PaymentCard')
  paymentBefore.props.onDocumentsReadyChange(true)
  assert.equal(h.button('Solicitar pagamento online').props.disabled, false)
  h.choose('disabled')
  assert.ok(h.get('PaymentCard'), 'Editor is hidden rather than removed')
  assert.ok(collect(h.render(), node => node.props?.hidden === true).length)
  h.choose('online_payment')
  assert.equal(h.get('PaymentCard').key, paymentBefore.key)
  assert.equal(h.button('Solicitar pagamento online').props.disabled, false)
  h.get('PaymentCard').props.onDocumentsReadyChange(false)
  assert.equal(h.button('Solicitar pagamento online').props.disabled, true)
  h.unmount()
})

test('external cancellation follows the persisted mode when there is no local selection', async () => {
  const h = harness()
  h.tick()
  h.reads[0].resolve({ success: true, data: setup({ intent_status: 'cancelled', active_mode: 'disabled', intent_revision: 2 }) })
  await h.settle()
  assert.equal(h.get('ModeCard').props.selectedMode, 'disabled')
  h.unmount()
})

test('a failed mutation keeps the saved mode and exposes the error', async () => {
  const h = harness()
  h.choose('disabled')
  h.save('disabled')
  h.mutations[0].resolve({ success: false, error: 'A configuração mudou. Atualize.' })
  await h.settle()
  assert.equal(h.get('ModeCard').props.savedMode, 'pre_booking')
  assert.match(text(collect(h.render(), node => node.props?.role === 'alert')), /A configuração mudou/)
  assert.equal(h.get('ModeCard').props.busy, false)
  h.unmount()
})

test('a status response during cancellation cannot replace pending state or clear busy', async () => {
  const h = harness()
  h.tick()
  h.choose('disabled')
  h.save('disabled')
  h.reads[0].resolve({ success: true, data: setup({ intent_status: 'activated', active_mode: 'online_payment', intent_revision: 2 }) })
  await h.settle()
  assert.equal(h.get('ModeCard').props.savedMode, 'pre_booking')
  assert.equal(h.get('ModeCard').props.busy, true)
  h.mutations[0].resolve({ success: true, data: setup({ intent_status: 'cancelled', active_mode: 'disabled', intent_revision: 3 }) })
  await h.settle()
  assert.equal(h.get('ModeCard').props.savedMode, 'disabled')
  h.unmount()
})
