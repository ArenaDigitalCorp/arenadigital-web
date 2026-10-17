import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements)
  return node && typeof node === 'object' ? [node, ...elements(node.props?.children)] : []
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('')
  return node && typeof node === 'object' ? text(node.props?.children) : String(node ?? '')
}

function harness({ expiresAt = '2026-10-15T12:34:56.789Z', status = 'active' } = {}) {
  const states = [], tasks = [], requests = [], errors = []
  let index = 0, tree
  const overview = { currentAccessLevel: 'super_admin', users: [{ id: 'user', name: 'Fixture User', email: 'fixture@example.invalid', role: 'gestor', hasAuthIdentity: true, createdAt: null }],
    principals: [{ userId: 'user', accessLevel: 'super_admin', status, expiresAt }] }
  const { UsersSection } = loadTypescriptModule('src/modules/super-admin/components/sections/UsersSection.tsx', {
    react: { ...realReact, useMemo: fn => fn(), useTransition: () => [false, fn => tasks.push(fn())], useState(initial) {
      const slot = index++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], next => { states[slot] = typeof next === 'function' ? next(states[slot]) : next }]
    } },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/modules/platform-admin/actions/platformAdminActions': { async managePlatformPrincipalAction(input) {
      requests.push(input)
      return { success: true }
    } },
    sonner: { toast: { error: value => errors.push(value), success() {} } },
  })
  const render = () => { index = 0; tree = UsersSection({ overview }); return tree }
  render()
  const expiry = () => elements(tree).find(node => node.props?.type === 'datetime-local')
  return { requests, errors, original: expiresAt, expiry,
    select() { elements(tree).find(node => node.type === 'tr' && typeof node.props?.onClick === 'function').props.onClick(); render() },
    edit(value) { expiry().props.onChange({ target: { value } }); render() },
    async save() {
      elements(tree).find(node => node.props?.placeholder === 'Motivo obrigatório para auditoria').props.onChange({ target: { value: 'Fixture reason for update' } }); render()
      elements(tree).find(node => typeof node.props?.onClick === 'function' && /Salvar acesso|Revogar acesso/.test(text(node))).props.onClick()
      await Promise.all(tasks.splice(0))
    },
  }
}

test('initial and selected principal expiry shows local time and preserves the original instant on unrelated saves', async () => {
  const previous = process.env.TZ
  try {
    for (const [timezone, expected] of [['America/Sao_Paulo', '2026-10-15T09:34'], ['Pacific/Kiritimati', '2026-10-16T02:34'], ['UTC', '2026-10-15T12:34']]) {
      process.env.TZ = timezone
      const h = harness()
      assert.equal(h.expiry().props.value, expected, 'The initially selected account must load its existing expiry')
      await h.save()
      assert.equal(h.requests[0].accessLevel, 'super_admin')
      assert.equal(h.requests[0].expiresAt, h.original, 'Keep seconds and fractional seconds when expiry was not edited')
      h.select()
      assert.equal(h.expiry().props.value, expected, timezone)
      await h.save()
      assert.equal(h.requests[1].expiresAt, h.original)
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})

test('editing or clearing administrative expiry saves the selected local instant and rejects invalid input', async () => {
  const previous = process.env.TZ
  try {
    process.env.TZ = 'America/Sao_Paulo'
    const h = harness()
    h.select(); h.edit('2026-10-16T10:20'); await h.save()
    assert.equal(h.requests[0].expiresAt, '2026-10-16T13:20:00.000Z')
    h.edit(''); await h.save()
    assert.equal(h.requests[1].expiresAt, null)
    for (const invalid of ['not-a-date', '2026-02-30T10:20']) {
      h.edit(invalid); await h.save()
      assert.equal(h.requests.length, 2)
    }
    assert.equal(h.errors.length, 2)
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})

test('database timestamp offsets and fractional seconds survive an unchanged expiry; revoked access stays revoked', async () => {
  const h = harness({ expiresAt: '2026-10-15T12:34:56.789123+00:00' })
  await h.save()
  assert.equal(h.requests[0].expiresAt, h.original)
  h.select(); await h.save()
  assert.equal(h.requests[1].expiresAt, h.original)
  const revoked = harness({ status: 'revoked' })
  await revoked.save()
  assert.equal(revoked.requests[0].enabled, false)
  assert.equal(revoked.requests[0].expiresAt, null)
})

test('the actual principal action accepts stored offset timestamps without truncating fractional seconds', async () => {
  const calls = []
  const userId = 'b4000000-0000-4000-8000-000000000001'
  const db = { async rpc(name, args) {
    if (name === 'list_platform_principals') return { data: [
      { user_id: userId, access_level: 'super_admin', status: 'active' },
      { user_id: 'b4000000-0000-4000-8000-000000000002', access_level: 'super_admin', status: 'active' },
    ], error: null }
    calls.push({ name, args }); return { data: null, error: null }
  } }
  const { managePlatformPrincipalAction } = loadTypescriptModule('src/modules/platform-admin/actions/platformAdminActions.ts', {
    'next/cache': { revalidatePath() {} },
    '@/lib/geocoding': {},
    '@/lib/observability/server': {},
    '@/lib/server-auth': { assertPlatformAdminAccess: async () => ({ accessLevel: 'super_admin', dbUserId: userId }) },
    '@/lib/supabase-server': { getSupabaseAdmin: () => db },
    '@/modules/payments/usecases/ensure-experimental-subscription.usecase': {},
  })
  for (const expiresAt of ['2026-10-15T12:34:56.789123+00:00', '2026-10-15T09:34:56.789123-03:00', '2026-10-15T12:34:56.789Z']) {
    const result = await managePlatformPrincipalAction({ targetUserId: userId, accessLevel: 'super_admin', enabled: true, reason: 'Fixture offset expiry test', expiresAt })
    assert.equal(result.success, true, JSON.stringify(result))
    assert.equal(calls.at(-1).args.p_expires_at, expiresAt)
  }
})
