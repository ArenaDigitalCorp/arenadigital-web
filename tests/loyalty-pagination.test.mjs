import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'
const { SupabaseLoyaltyRepository: Repository }=loadTypescriptModule('src/modules/loyalty/repositories/SupabaseLoyaltyRepository.ts')
function fixture({total=0,code='PGRST103',countError=false,unknownCount=false}={}){
 const calls=[]
 const client={from(table){const call={table,filters:[]};calls.push(call)
  const q={select(s,options){call.select=s;call.head=options?.head;return q},eq(k,v){call.filters.push(['eq',k,v]);return q},ilike(k,v){call.filters.push(['ilike',k,v]);return q},gte(k,v){call.filters.push(['gte',k,v]);return q},lte(k,v){call.filters.push(['lte',k,v]);return q},order(){return q},range(a,b){call.range=[a,b];return q},then(resolve){
   return Promise.resolve(call.head?{data:null,error:countError?{message:'Count unavailable'}:null,count:unknownCount?null:total}:{data:null,error:{code,message:'Requested range not satisfiable'},count:null}).then(resolve)
  }};return q
 }}
 return {calls,repo:new Repository(client)}
}
for(const kind of ['statement','ranking']){
 const run=(h)=>kind==='statement'?h.repo.getStatement('arena',4,15,{athleteName:'Ana',startDate:'2026-10-01T03:00:00Z',endDate:'2026-11-01T02:59:59Z'}):h.repo.getAthletesWithBalance('arena',4,10,'Ana')
 for(const total of [0,17])test(`${kind}: out-of-range returns an empty page with the exact filtered total ${total}, never a guessed zero`,async()=>{
  const h=fixture({total}),r=await run(h);assert.deepEqual(JSON.parse(JSON.stringify(r)),{data:[],total,totalPages:Math.ceil(total/(kind==='statement'?15:10))});assert.equal(h.calls.length,2);assert.equal(h.calls[1].head,true);assert.equal(h.calls[1].range,undefined);assert.deepEqual(h.calls[0].filters,h.calls[1].filters);assert.ok(h.calls[1].filters.some(([op,k,v])=>op==='eq'&&k==='id_arena'&&v==='arena'));assert.ok(h.calls[1].filters.some(([op,k,v])=>op==='ilike'&&k==='atleta.nome_perfil'&&v==='%Ana%'))
 })
 test(`${kind}: count failures or unknown counts stay explicit, and other database errors are never converted to an empty result`,async()=>{
  for(const settings of [{countError:true},{unknownCount:true},{code:'42501'}]){const h=fixture(settings);await assert.rejects(run(h),/Count unavailable|count unavailable|Requested range/);assert.equal(h.calls.length,settings.code?1:2)}
 })
}
