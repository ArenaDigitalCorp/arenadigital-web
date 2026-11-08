import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

function collect(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(item => collect(item, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...collect(node.props?.children, predicate)]
}
async function page({ paymentSuccess = true, policySuccess = true, setupSuccess = true } = {}) {
  const { default: EditArenaPage } = loadTypescriptModule('src/app/dashboard/arenas/[id]/edit/page.tsx', {
    '@/lib/server-auth': { assertArenaAdminAccess: async () => {}, requireAuthenticatedDbUser: async () => ({dbUserId:'owner'}) },
    '@/lib/supabase-server': { getSupabaseAdmin: () => ({}) },
    '@/modules/arenas/repositories/SupabaseArenaRepository': { SupabaseArenaRepository: class { async findById(id) { return {id,name:'Arena A',app_booking_mode:'disabled'} } } },
    '@/modules/arenas/actions/arenaActions': { getArenaPixSplitSettingsAction: async () => ({success:paymentSuccess,data:{onboardingStarted:false}}) },
    '@/modules/arenas/actions/cancellationPolicyActions': { getArenaCancellationPolicySettingsAction: async () => ({success:policySuccess,data:{currentPolicy:null}}) },
    '@/modules/arenas/actions/receivingSetupActions': { getArenaReceivingSetupAction: async () => setupSuccess ? ({success:true,data:{active_mode:'disabled'}}) : ({success:false,error:'Status unavailable'}) },
    '@/modules/arenas/components/ArenaForm': { ArenaForm:'ArenaForm' },
    '@/modules/arenas/components/ArenaBookingOperationsPanel': { ArenaBookingOperationsPanel:'OperationsPanel' },
    '@/modules/finance/components/ArenaFinancialAccountCard': { ArenaFinancialAccountCard:'Wallet' },
    'next/navigation': { redirect: destination => { throw Error(`Unexpected redirect: ${destination}`) } },
  })
  return EditArenaPage({ params:Promise.resolve({id:'arena-a'}), searchParams:Promise.resolve({tab:'receiving'}) })
}

test('payment or policy read failure is shown as an error instead of an absent configuration', async () => {
  for (const options of [{paymentSuccess:false},{policySuccess:false},{paymentSuccess:false,policySuccess:false}]) {
    const tree = await page(options)
    assert.equal(collect(tree, node => node.type === 'OperationsPanel').length, 0)
    assert.equal(collect(tree, node => node.type === 'Wallet').length, 1)
    assert.equal(collect(tree, node => node.props?.role === 'alert').length, 1)
    const retry = collect(tree, node => node.type === 'a')[0]
    assert.equal(retry.props.href, '/dashboard/arenas/arena-a/edit?tab=receiving')
  }
})

test('successful configuration reads mount the arena-keyed panel, including recoverable status failures', async () => {
  for (const setupSuccess of [true,false]) {
    const tree = await page({setupSuccess})
    const panels = collect(tree, node => node.type === 'OperationsPanel')
    assert.equal(panels.length, 1)
    assert.equal(panels[0].key, 'arena-a')
    assert.equal(panels[0].props.arenaId, 'arena-a')
    if (!setupSuccess) {
      assert.equal(panels[0].props.initialSetup, null)
      assert.equal(panels[0].props.initialSetupError, 'Status unavailable')
    }
  }
})
