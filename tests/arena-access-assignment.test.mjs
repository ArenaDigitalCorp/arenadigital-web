import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const arena = 'arena-a', user = 'pessoa', memberId = 'vinculo-atual'
const input = {name:'Maria Silva', email:'maria@example.invalid', profileId:'recepcao', status:'Ativo', role:'Gestor'}
function harness({ denied = false, members = [] } = {}) {
  const calls = []
  const {createArenaUserAction, updateArenaUserAction, deleteArenaUserAction} = loadTypescriptModule('src/modules/users/actions/userActions.ts', {
    '@/lib/server-auth': {
      assertArenaAdminAccess: async (id, key) => {
        assert.equal(id, arena); assert.equal(key, 'settings.users')
        if (denied) throw Error('Acesso revogado')
      },
    },
    '@/modules/access/server': {
      loadAccessManagement: async id => { assert.equal(id, arena); return { profiles: [{id:'recepcao',base_role:'Atendente'}], members } },
      accessRpc: async (name,args) => { calls.push([name, JSON.parse(JSON.stringify(args))]) },
    },
    '@/lib/supabase-server': { getSupabaseAdmin: () => ({}) },
    '@/lib/account-identity': { normalizeEmail: s => s.toLowerCase(), findUserByEmail: async () => ({id:user,auth_user_id:'auth-existente'}) },
    'next/cache': { revalidatePath() {} },
  })
  return {createArenaUserAction, updateArenaUserAction, deleteArenaUserAction, calls}
}

test('creating access for an existing identity delegates only the profile in its arena', async () => {
  const h = harness()
  assert.equal((await h.createArenaUserAction(arena,input)).success,true)
  assert.deepEqual(h.calls, [['set_arena_member_access', { p_arena_id:arena, p_user_id:user, p_profile_id:'recepcao', p_status:'Ativo', p_station_id:null, p_expected_member_id:null }]])
})

test('unassignable profiles, revoked managers and stale member IDs cannot write memberships', async () => {
  const member = {id:memberId,user_id:user,email:input.email}
  const h = harness({members:[member]})
  assert.equal((await h.createArenaUserAction(arena, {...input,profileId:'another-arena-profile'})).success,false)
  assert.equal((await h.createArenaUserAction(arena,input)).success,false)
  assert.equal((await h.updateArenaUserAction(arena,'old',user,input)).success,false)
  assert.equal((await h.deleteArenaUserAction(arena,memberId,'another-person')).success,false)
  assert.equal(h.calls.length,0)
  const revoked = harness({denied:true,members:[member]})
  assert.equal((await revoked.deleteArenaUserAction(arena,memberId,user)).success,false)
  assert.equal(revoked.calls.length,0)
})

test('deactivation and removal bind the current member ID and leave identity intact', async () => {
  const h = harness({members:[{id:memberId,user_id:user,email:input.email}]})
  assert.equal((await h.updateArenaUserAction(arena,memberId,user,{...input,status:'Inativo'})).success,true)
  assert.equal((await h.deleteArenaUserAction(arena,memberId,user)).success,true)
  assert.deepEqual(h.calls.map(([fn,args])=>[fn,args.p_arena_id,args.p_user_id,args.p_expected_member_id,args.p_status]),[
    ['set_arena_member_access',arena,user,memberId,'Inativo'],['remove_arena_member_access',arena,user,memberId,undefined],
  ])
})
