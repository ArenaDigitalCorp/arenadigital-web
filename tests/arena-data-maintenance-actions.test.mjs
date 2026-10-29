import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const actorId='f9100000-0000-4000-8000-000000000001',arenaId='f9200000-0000-4000-8000-000000000001'
const operation={id:'f9300000-0000-4000-8000-000000000001',arenaId,arenaName:'Arena QA',reason:'Trial period finished',modules:['manual_transactions'],cutoff:'2026-10-28T12:00:00Z',status:'preview',createdAt:'2026-10-28T12:00:00Z',expiresAt:'2026-10-28T12:15:00Z',completedAt:null,restoredAt:null,summary:{transactionCount:2,sessionCount:0,openSessionCount:0,incomingTotal:'20.50',outgoingTotal:'1.25',preservedAutomaticCount:1,preservedTransactionCount:1,blockers:[],canExecute:true}}
function harness({denied=false,rpcError=null,cacheError=false}={}) {
  const calls=[],invalidations=[]
  class AuthorizationError extends Error {}
  const actions=loadTypescriptModule('src/modules/data-maintenance/actions.ts',{
    '@/lib/server-auth':{AuthorizationError,assertPlatformSuperAdminAccess:async()=>{if(denied)throw new AuthorizationError('Denied');return {dbUserId:actorId}}},
    '@/lib/supabase-server':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{
      calls.push({name,args});if(rpcError)return {data:null,error:rpcError}
      return {data:name==='list_arena_data_cleanups'?[operation]:{...operation,status:name==='execute_arena_data_cleanup'?'completed':name==='restore_arena_data_cleanup'?'restored':'preview'},error:null}
    }})},
    'next/cache':{revalidatePath:path=>{invalidations.push(path);if(cacheError)throw Error('cache unavailable')}},
  })
  return {...actions,calls,invalidations}
}
test('superadmin authorization runs before any preview, execution, restoration or history RPC',async()=>{
  const subject=harness({denied:true})
  for(const result of [await subject.previewArenaCleanup({}),await subject.executeArenaCleanup({}),await subject.restoreArenaCleanup({}),await subject.listArenaCleanups(arenaId)])assert.equal(result.success,false)
  assert.equal(subject.calls.length,0)
})
test('preview pins the authenticated server actor and rejects extra scope/SQL/actor fields',async()=>{
  const subject=harness(),input={arenaId,modules:['manual_transactions'],reason:'Trial period finished',cutoff:null}
  assert.equal((await subject.previewArenaCleanup(input)).success,true)
  assert.equal(subject.calls[0].args.p_actor_user_id,actorId)
  for(const extra of [{actorUserId:'forged'},{tables:['users']},{sql:'delete from users'}])assert.equal((await subject.previewArenaCleanup({...input,...extra})).success,false)
  assert.equal(subject.calls.length,1)
})
test('execution requires test-data acknowledgement and valid operation id before reaching DB',async()=>{
  const subject=harness()
  assert.equal((await subject.executeArenaCleanup({arenaId,operationId:operation.id,confirmationName:'Arena QA',confirmTestData:false})).success,false)
  assert.equal((await subject.executeArenaCleanup({arenaId,operationId:'not-an-id',confirmationName:'Arena QA',confirmTestData:true})).success,false)
  assert.equal(subject.calls.length,0)
  const result=await subject.executeArenaCleanup({arenaId,operationId:operation.id,confirmationName:'Arena QA',confirmTestData:true})
  assert.equal(result.data.status,'completed')
  assert.equal(subject.calls[0].args.p_actor_user_id,actorId)
  assert.equal(subject.calls[0].args.p_arena_id,arenaId)
})
test('cache invalidation failure cannot report a committed deletion as failed',async()=>{
  const subject=harness({cacheError:true})
  const result=await subject.executeArenaCleanup({arenaId,operationId:operation.id,confirmationName:'Arena QA',confirmTestData:true})
  assert.equal(result.success,true)
  assert.equal(result.data.status,'completed')
  assert.ok(subject.invalidations.includes(`/dashboard/finance/${arenaId}`))
})
test('older backend and concurrent changes return actionable failures with no fake success',async()=>{
  const missing=harness({rpcError:{code:'PGRST202',message:'missing RPC'}})
  const result=await missing.listArenaCleanups(arenaId)
  assert.equal(result.success,false);assert.equal(result.unavailable,true)
  for(const code of ['55P03','40P01','40001','23503','23505']) {
    const subject=harness({rpcError:{code,message:'internal details must stay private'}})
    const failed=await subject.executeArenaCleanup({arenaId,operationId:operation.id,confirmationName:'Arena QA',confirmTestData:true})
    assert.equal(failed.success,false);assert.doesNotMatch(failed.error,/internal details/)
    assert.equal(subject.invalidations.length,0)
  }
})
test('restoration is separately confirmed, reasoned and bound to the server actor',async()=>{
  const subject=harness()
  assert.equal((await subject.restoreArenaCleanup({arenaId,operationId:operation.id,confirmationName:'Arena QA',reason:'x'})).success,false)
  const result=await subject.restoreArenaCleanup({arenaId,operationId:operation.id,confirmationName:'Arena QA',reason:'Restore reviewed test data'})
  assert.equal(result.data.status,'restored');assert.equal(subject.calls[0].args.p_actor_user_id,actorId)
  assert.equal(subject.calls[0].args.p_arena_id,arenaId)
  assert.equal(subject.calls[0].args.p_arena_id,arenaId)
})

test('execution and restore require an explicit arena id even when arena names match',async()=>{
  const subject=harness()
  assert.equal((await subject.executeArenaCleanup({operationId:operation.id,confirmationName:'Arena QA',confirmTestData:true})).success,false)
  assert.equal((await subject.restoreArenaCleanup({operationId:operation.id,confirmationName:'Arena QA',reason:'Restore reviewed test data'})).success,false)
  assert.equal(subject.calls.length,0)
})
test('recovery failures explain restoration instead of asking for another deletion preview',async()=>{
  for(const code of ['40001','55P03']) {
    const subject=harness({rpcError:{code,message:'internal details stay private'}})
    const result=await subject.restoreArenaCleanup({arenaId,operationId:operation.id,confirmationName:'Arena QA',reason:'Restore reviewed test data'})
    assert.equal(result.success,false)
    assert.match(result.error,/restaurar/)
    assert.doesNotMatch(result.error,/prévia|internal details/)
    assert.equal(subject.invalidations.length,0)
  }
})

test('all operational modules are accepted without requiring manual finance',async()=>{
  const subject=harness()
  const result=await subject.previewArenaCleanup({arenaId,modules:['bookings','athlete_links','arena_users','loyalty','inventory'],reason:'Reset selected operational test data',cutoff:null})
  assert.equal(result.success,true)
  assert.deepEqual(Array.from(subject.calls[0].args.p_modules),['bookings','athlete_links','arena_users','loyalty','inventory'])
})
test('history cursor remains validated and bound to the selected arena and server actor',async()=>{
  const subject=harness()
  assert.equal((await subject.listArenaCleanups(arenaId,{createdAt:operation.createdAt,id:operation.id})).success,true)
  assert.equal(subject.calls[0].args.p_arena_id,arenaId)
  assert.equal(subject.calls[0].args.p_before_id,operation.id)
  assert.equal((await subject.listArenaCleanups(arenaId,{createdAt:'invalid',id:operation.id})).success,false)
  assert.equal(subject.calls.length,1)
})
