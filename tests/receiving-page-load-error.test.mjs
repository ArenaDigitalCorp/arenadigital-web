import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

function collect(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(item => collect(item, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...collect(node.props?.children, predicate)]
}
async function page({ paymentSuccess = true, policySuccess = true, setupSuccess = true, role = 'Gestor', resources = ['settings.receiving', 'settings.arena'], tab = 'receiving', reads = [] } = {}) {
  const { default: EditArenaPage } = loadTypescriptModule('src/app/dashboard/arenas/[id]/edit/page.tsx', {
    '@/lib/server-auth': { assertArenaResourceAccess: async (id, key, alternative) => { assert.deepEqual([id, key, alternative], ['arena-a', 'settings.arena', 'settings.receiving']); return { dbUserId: 'operator', resources, role, isOwner: false } }, requireAuthenticatedDbUser: async () => ({dbUserId:'owner'}) },
    '@/lib/supabase-server': { getSupabaseAdmin: () => ({ from: table => ({
      select: fields => ({ eq: (column,id) => ({ single: async () => {
        assert.deepEqual([table,column,id], ['arenas','id','arena-a']); assert.ok(!fields.includes('*'))
        reads.push('receiving registration')
        return { data: {name:'Arena A',app_booking_mode:'disabled'},error:null }
      } }) })
    }) }) },
    '@/modules/arenas/repositories/SupabaseArenaRepository': { SupabaseArenaRepository: class { async findRegistrationById(id) { reads.push('registration'); return {id,name:'Arena A',app_booking_mode:'disabled'} } } },
    '@/modules/arenas/actions/arenaActions': { getArenaPixSplitSettingsAction: async () => { reads.push('payments'); return ({success:paymentSuccess,data:{onboardingStarted:false}}) } },
    '@/modules/arenas/actions/cancellationPolicyActions': { getArenaCancellationPolicySettingsAction: async () => { reads.push('policies'); return ({success:policySuccess,data:{currentPolicy:null}}) } },
    '@/modules/arenas/actions/receivingSetupActions': { getArenaReceivingSetupAction: async () => { reads.push('setup'); return setupSuccess ? ({success:true,data:{active_mode:'disabled'}}) : ({success:false,error:'Status unavailable'}) } },
    '@/modules/arenas/components/ArenaForm': { ArenaForm:'ArenaForm' },
    '@/modules/arenas/components/ArenaBookingOperationsPanel': { ArenaBookingOperationsPanel:'OperationsPanel' },
    '@/modules/finance/components/ArenaFinancialAccountCard': { ArenaFinancialAccountCard:'Wallet' },
    'next/navigation': { redirect: destination => { throw Error(`Unexpected redirect: ${destination}`) } },
  })
  return EditArenaPage({ params:Promise.resolve({id:'arena-a'}), searchParams:Promise.resolve({tab}) })
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

test('ordinary registration never loads or serializes the receiving tab, including a direct tab URL', async () => {
  for (const [role, resources] of [['Gestor',['settings.arena']], ['Atendente',['settings.arena','settings.receiving']]]) {
    const reads = []
    const tree = await page({role, resources, reads, tab:'receiving'})
    assert.deepEqual(reads, ['registration'])
    assert.equal(collect(tree,n => n.type === 'ArenaForm').length, 1)
    assert.equal(collect(tree,n => n.type === 'Wallet' || n.type === 'OperationsPanel').length, 0)
    assert.equal(collect(tree,n => n.props?.defaultValue === 'arena').length, 1)
  }
})

test('receiving-only manager opens receiving from both the plain edit URL and the direct tab URL', async () => {
  for (const tab of ['', 'receiving']) {
    const reads = []
    const tree = await page({resources:['settings.receiving'],reads,tab})
    assert.deepEqual(reads.sort(), ['payments','policies','receiving registration','setup'])
    assert.equal(collect(tree,n => n.type === 'ArenaForm').length, 0)
    assert.equal(collect(tree,n => n.type === 'Wallet').length, 1)
    assert.equal(collect(tree,n => n.props?.defaultValue === 'receiving').length, 1)
  }
})

test('non-manager with just a receiving grant and user with no grant cannot load either tab', async () => {
  for (const [role,resources] of [['Atendente',['settings.receiving']],['Gestor',[]]]) {
    const reads = []
    await assert.rejects(page({role,resources,reads}), /Unexpected redirect: \/dashboard/)
    assert.deepEqual(reads, [])
  }
})
