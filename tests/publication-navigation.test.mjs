import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const arena = 'f9200000-0000-4000-8000-000000000001'

for (const source of ['publications', 'mobile-content']) {
  test(`legacy ${source} link opens the complete publication editor`, async () => {
    const { default: Page } = loadTypescriptModule(`src/app/dashboard/arenas/[id]/${source}/page.tsx`, {
      'next/navigation': { redirect: path => { throw new Error(path) } },
    })
    await assert.rejects(Page({params:Promise.resolve({id:'arena-a'})}), /\/dashboard\/publications\/arena-a/)
  })
}

function pageSubject({ platform = false, denied = false } = {}) {
  const calls = []
  const { default: Page } = loadTypescriptModule('src/app/dashboard/publications/[arenaId]/page.tsx', {
    'next/navigation': { redirect: path => { throw new Error(path) } },
    '@/lib/server-auth': {
      requireAuthenticatedDbUser: async () => ({dbUserId:'manager'}),
      getPlatformAccessLevel: async () => { calls.push(['platform-role']); return platform ? 'platform_admin' : null },
      assertArenaAdminAccess: async () => { throw new Error('Publication membership must use its dedicated guard') },
    },
    '@/modules/publications/authorization': {
      authorizePublicationScope: async (id, operation, context) => {
        calls.push(['authorize', id, operation, context])
        if (denied) throw new Error('Acesso negado')
      },
    },
    '@/lib/supabase-server': {getSupabaseAdmin: () => ({from: table => {
      calls.push(['query',table])
      return {select: () => ({eq: () => ({single:async()=>({data:{id:arena,name:'Arena A'}})}),order: async()=>({data:[]})})}
    }})},
    '@/modules/publications/actions': {listPublications: async (id, context) => {calls.push(['list',id,context]); return []}},
    '@/modules/publications/PublicationsManager': {PublicationsManager:'Editor'},
  })
  return {Page,calls}
}
for (const platform of [false, true]) {
  const role = platform ? 'dual-role platform administrator and arena manager' : 'arena manager'
  test(`${role} enters the arena editor without changing context`, async () => {
    const s=pageSubject({platform})
    const tree=await s.Page({params:Promise.resolve({arenaId:arena})})
    assert.deepEqual(s.calls[0],['authorize',arena,'read','arena'])
    assert.ok(s.calls.some(call => call[0] === 'list' && call[1] === arena && call[2] === 'arena'))
    assert.equal(s.calls.some(call => call[0] === 'platform-role'),false)
    assert.equal(tree.type,'Editor')
    assert.equal(tree.props.arenaId,arena)
    assert.equal(tree.props.platform,false)
    assert.equal(tree.props.arenas[0].id,arena)
  })
  test(`${role} cannot load data through an unauthorized arena link`, async () => {
    const s=pageSubject({platform,denied:true})
    await assert.rejects(s.Page({params:Promise.resolve({arenaId:arena})}),/Acesso negado/)
    assert.deepEqual(s.calls,[['authorize',arena,'read','arena']])
  })
}

test('admin entry retains Arena Digital authorship with no selected arena', async () => {
  const calls=[]
  const {default: Page}=loadTypescriptModule('src/app/admin/publications/page.tsx',{
    '@/lib/server-auth': {assertPlatformAdminAccess:async()=>{calls.push(['platform'])}},
    '@/lib/supabase-server': {getSupabaseAdmin:()=>({from:table=>{
      calls.push(['query',table])
      return {select:()=>({order:async()=>({data:[]})})}
    }})},
    '@/modules/publications/actions': {listPublications:async id=>{calls.push(['list',id]);return []}},
    '@/modules/publications/PublicationsManager': {PublicationsManager:'Editor'},
  })
  const tree=await Page()
  assert.deepEqual(calls[0],['platform'])
  assert.deepEqual(calls[1],['list',null])
  assert.equal(tree.type,'Editor')
  assert.equal(tree.props.platform,true)
  assert.equal(tree.props.arenaId,null)
  assert.equal(tree.props.arenas.length,0)
})
