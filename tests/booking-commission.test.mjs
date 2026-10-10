import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTypescriptModule, realReact as React } from './helpers/load-typescript-module.mjs'

const { updateArenaPixSplitSettingsSchema: schema } = loadTypescriptModule('src/modules/arenas/schemas/asaas-baas.schema.ts')
const { ArenaCommissionFields } = loadTypescriptModule('src/modules/arenas/components/ArenaCommissionFields.tsx')
const percentage = { enabled: true, commissionMode: 'percentage_net', commissionFixedCents: 0, platformFeeBasisPoints: 200 }
const fixed = { ...percentage, commissionMode: 'fixed', commissionFixedCents: 200, platformFeeBasisPoints: 0 }

test('admin contract accepts either net percentage or fixed commission, including zero', () => {
  for (const value of [percentage, fixed, { ...percentage, platformFeeBasisPoints: 0 }, { ...fixed, commissionFixedCents: 0 }]) {
    assert.equal(schema.safeParse(value).success, true)
  }
  for (const value of [{ ...fixed, platformFeeBasisPoints: 200 }, { ...percentage, commissionFixedCents: 200 },
    { ...percentage, platformFeeBasisPoints: 10001 }, { ...fixed, commissionFixedCents: -1 },
    { ...fixed, commissionFixedCents: 1.5 }, { ...percentage, commissionMode: 'legacy_gross' }]) {
    assert.equal(schema.safeParse(value).success, false)
  }
})

test('percentage example removes Asaas fees before showing platform commission', () => {
  const html = renderToStaticMarkup(React.createElement(ArenaCommissionFields, { value: percentage, onChange() {} }))
  assert.ok(html.includes('Percentual sobre o líquido'))
  for (const amount of ['98,00', '1,96', '96,04']) assert.ok(html.includes(amount), amount)
  assert.ok(html.includes('tarifa hipotética'))
  assert.ok(html.includes('Alterações valem apenas para novas cobranças'))
})

test('fixed example charges once per Pix including multiple dates and times', () => {
  const html = renderToStaticMarkup(React.createElement(ArenaCommissionFields, { value: fixed, onChange() {} }))
  assert.ok(html.includes('Comissão por cobrança (R$)'))
  assert.ok(html.includes('Uma comissão por Pix'))
  for (const amount of ['98,00', '2,00', '96,00']) assert.ok(html.includes(amount), amount)
  const excessive = renderToStaticMarkup(React.createElement(ArenaCommissionFields, { value: { ...fixed, commissionFixedCents: 9900 }, onChange() {} }))
  assert.ok(excessive.includes('Comissão acima do líquido deste exemplo'))
  assert.ok(!excessive.includes('-1,00'))
})

function actionHarness({ denied = false, rpcError = false } = {}) {
  const state = { calls: [], credentials: [], auth: 0 }
  const account = { commission_mode: 'percentage_net', commission_fixed_cents: 0, platform_fee_basis_points: 200,
    onboarding_status: 'APPROVED', webhook_token_hash: 'test-hash', asaas_account_id: 'test-account',
    asaas_wallet_id: 'test-wallet', pix_key: 'test-key', activated_at: '2026-10-01', status: 'active' }
  const query = { select() { return query }, eq() { return query }, async maybeSingle() { return { data: account, error: null } } }
  const { updateArenaPixSplitSettingsAction } = loadTypescriptModule('src/modules/arenas/actions/arenaActions.ts', {
    'server-only': {}, 'next/cache': { revalidatePath() {} },
    '@/lib/server-auth': { async assertPlatformSuperAdminAccess() { state.auth++; if (denied) throw new Error('Denied'); return { dbUserId: 'superadmin-test' } } },
    '@/lib/geocoding': {},
    '@/modules/arenas/repositories/SupabaseArenaRepository': {},
    '@/modules/arenas/services/asaas-baas.service': {
      async assertArenaAsaasRuntimeCredentials(id) { state.credentials.push(id) },
      async ensureArenaAsaasPixKey() { return 'test-key' },
    },
    '@/lib/supabase-server': { getSupabaseAdmin() { return {
      from(table) { assert.equal(table, 'arena_payment_accounts'); return query },
      async rpc(name, args) { state.calls.push({ name, args }); return rpcError
        ? { data: null, error: { message: 'Test failure' } }
        : { data: { ...account, commission_mode: args.p_mode, commission_fixed_cents: args.p_fixed_cents,
          platform_fee_basis_points: args.p_basis_points }, error: null } },
    } } },
  })
  return { update: updateArenaPixSplitSettingsAction, state }
}

test('superadmin save persists mode, cents and actor through the atomic audited RPC', async () => {
  const { update, state } = actionHarness()
  const result = await update('arena-test', fixed)
  assert.equal(result.success, true)
  assert.equal(result.data.commissionMode, 'fixed')
  assert.equal(result.data.commissionFixedCents, 200)
  assert.deepEqual(JSON.parse(JSON.stringify(state.calls)), [{ name: 'update_arena_booking_commission', args: {
    p_arena_id: 'arena-test', p_actor_id: 'superadmin-test', p_enabled: true,
    p_mode: 'fixed', p_basis_points: 0, p_fixed_cents: 200, p_pix_key: 'test-key',
  } }])
  assert.deepEqual(state.credentials, ['arena-test'])
})

test('unauthorized or mixed-mode configuration cannot reach the payment provider or save RPC', async () => {
  for (const options of [{ denied: true }, {}]) {
    const { update, state } = actionHarness(options)
    const result = await update('arena-test', options.denied ? fixed : { ...fixed, platformFeeBasisPoints: 200 })
    assert.equal(result.success, false)
    assert.equal(state.calls.length, 0)
    assert.equal(state.credentials.length, 0)
  }
  const { update } = actionHarness({ rpcError: true })
  assert.equal((await update('arena-test', fixed)).success, false)
})
