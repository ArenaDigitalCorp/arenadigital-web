import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

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
      getPlatformAccessLevel: async () => platform ? 'platform_admin' : null,
      assertArenaAdminAccess: async id => { calls.push(['authorize',id]); if(denied) throw new Error('Acesso negado') },
    },
    '@/lib/supabase-server': {getSupabaseAdmin: () => ({from: table => {
      calls.push(['query',table])
      return {select: () => ({eq: () => ({single:async()=>({data:{id:'arena-a',name:'Arena A'}})}),order: async()=>({data:[]})})}
    }})},
    '@/modules/publications/actions': {listPublications: async id => {calls.push(['list',id]); return []}},
    '@/modules/publications/PublicationsManager': {PublicationsManager:'Editor'},
  })
  return {Page,calls}
}
test('manager direct entry uses the complete shared editor scoped to the authorized arena', async () => {
  const s=pageSubject()
  const tree=await s.Page({params:Promise.resolve({arenaId:'arena-a'})})
  assert.deepEqual(s.calls[0],['authorize','arena-a'])
  assert.equal(tree.type,'Editor')
  assert.equal(tree.props.arenaId,'arena-a')
  assert.equal(tree.props.platform,false)
})
test('unauthorized direct links do not load publications or arena data', async () => {
  const s=pageSubject({denied:true})
  await assert.rejects(s.Page({params:Promise.resolve({arenaId:'other-arena'})}),/Acesso negado/)
  assert.deepEqual(s.calls,[['authorize','other-arena']])
})
test('platform accounts use their own publication panel instead of arena authorship', async () => {
  const s=pageSubject({platform:true})
  await assert.rejects(s.Page({params:Promise.resolve({arenaId:'arena-a'})}),/\/admin\/publications/)
  assert.deepEqual(s.calls,[])
})
