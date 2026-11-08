import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'
const arena='f9300000-0000-4000-8000-000000000008'
const setup={draft:null,desired_mode:null,intent_status:null,intent_revision:0,cancellation_reason:null,active_mode:'disabled',ready:false,missing:['account_missing','policy_missing']}
function subject({deny=false,error=null,data=setup,cacheFailure=false}={}) {
  const calls=[]
  const loaded=loadTypescriptModule('src/modules/arenas/actions/receivingSetupActions.ts',{
    '@/lib/server-auth':{assertArenaAdminAccess:async id=>{calls.push(['auth',id]);if(deny)throw Error('Forbidden')}},
    '@/lib/supabase/server':{createSupabaseServerClient:async()=>({rpc:async(name,args)=>{calls.push([name,args]);return{data,error}}})},
    'next/cache':{revalidatePath:()=>{if(cacheFailure)throw Error('Cache unavailable')}},
  })
  return {...loaded,calls}
}
test('receiving setup denies cross-arena requests before authenticated RPC',async()=>{
 const s=subject({deny:true});assert.equal((await s.getArenaReceivingSetupAction(arena)).success,false);assert.equal(s.calls.length,1)
})
test('incomplete receiving draft persists through draft-only RPC without provisioning account',async()=>{
 const draft={data:{name:'Rascunho'},revision:1,updated_at:'2026-11-08T12:00:00Z'}
 const s=subject({data:{...setup,draft}})
 const result=await s.saveArenaReceivingDraftAction(arena,{name:'Rascunho'},0)
 assert.equal(result.success,true);assert.equal(result.data.revision,1)
 assert.equal(s.calls[1][0],'save_arena_receiving_draft');assert.equal(s.calls[1][1].p_revision,0)
 assert.deepEqual(JSON.parse(JSON.stringify(s.calls[1][1].p_payload)),{name:'Rascunho'})
})
test('draft forbids client-supplied activation, foreign scope and credential fields',async()=>{
 for(const field of ['enabled','status','arena_id','apiKey','desired_mode']){
  const s=subject();assert.equal((await s.saveArenaReceivingDraftAction(arena,{[field]:'forged'},0)).success,false);assert.equal(s.calls.length,0)
 }
})
test('online request sends expected intent revision and trusts server pending mode',async()=>{
 const s=subject({data:{...setup,desired_mode:'online_payment',intent_status:'pending',intent_revision:1,active_mode:'pre_booking'}})
 const result=await s.setArenaReceivingBookingModeAction(arena,'online_payment',0)
 assert.equal(result.success,true);assert.equal(result.data.active_mode,'pre_booking')
 assert.equal(s.calls[1][0],'set_arena_receiving_booking_mode');assert.equal(s.calls[1][1].p_mode,'online_payment');assert.equal(s.calls[1][1].p_revision,0)
})
test('mode cancellation uses same atomic RPC instead of direct arena updates',async()=>{
 const s=subject({data:{...setup,intent_status:'cancelled',intent_revision:3}})
 const result=await s.setArenaReceivingBookingModeAction(arena,'disabled',1,true)
 assert.equal(result.success,true);assert.equal(s.calls[1][1].p_mode,'disabled')
})
test('RPC conflict is returned as failure with no fake activation',async()=>{
 const s=subject({error:{message:'Solicitação alterada. Atualize.'}})
 const result=await s.setArenaReceivingBookingModeAction(arena,'online_payment',0)
 assert.equal(result.success,false);assert.match(result.error,/Atualize/)
})
test('cache invalidation does not turn a confirmed mode mutation into failure',async()=>{
 const s=subject({cacheFailure:true});assert.equal((await s.setArenaReceivingBookingModeAction(arena,'disabled',0)).success,true)
})
test('invalid response never implies activation or saved draft',async()=>{
 const s=subject({data:{ready:true}});assert.equal((await s.getArenaReceivingSetupAction(arena)).success,false)
 assert.equal((await subject().saveArenaReceivingDraftAction(arena,{},0)).success,false)
})

test('receiving draft mirrors database field limits and rejects unsafe control characters before RPC', async () => {
  for (const value of ['a'.repeat(255), 'Arena' + String.fromCharCode(0) + 'A', 'Arena' + String.fromCharCode(11) + 'A', 'Arena' + String.fromCharCode(31) + 'A']) {
    const s = subject()
    assert.equal((await s.saveArenaReceivingDraftAction(arena, {name:value}, 0)).success, false)
    assert.equal(s.calls.length, 0)
  }
  for (const value of ['a'.repeat(254), 'Arena\tA\nSala\rB']) {
    const draft = {data:{name:value},revision:1,updated_at:'2026-11-08T12:00:00Z'}
    const s = subject({data:{...setup,draft}})
    assert.equal((await s.saveArenaReceivingDraftAction(arena, {name:value}, 0)).success, true)
    assert.equal(s.calls[1][1].p_payload.name, value)
  }
})

test('normal mode changes preserve pending intent and explicit cancellation opts out',async()=>{
 const s=subject();await s.setArenaReceivingBookingModeAction(arena,'pre_booking',1);assert.equal(s.calls[1][1].p_preserve_pending,true);
 const c=subject();await c.setArenaReceivingBookingModeAction(arena,'disabled',1,true);assert.equal(c.calls[1][1].p_preserve_pending,false);
})
