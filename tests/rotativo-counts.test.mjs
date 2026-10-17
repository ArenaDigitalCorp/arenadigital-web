import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'
const {SupabaseRotativoRepository:Repository}=loadTypescriptModule('src/modules/rotativos/repositories/SupabaseRotativoRepository.ts')
const rows=[{id:'a',id_arena:'arena',data:'2026-10-01',hora_inicio:'08:00',rotativo_courts:[{court:{id:'court',name:'Court'}}]},
 {id:'b',id_arena:'arena',data:'2026-10-01',hora_inicio:'10:00'},
 {id:'c',id_arena:'arena',data:'2026-10-02',hora_inicio:'08:00'},
 {id:'foreign',id_arena:'other',data:'2026-10-03',hora_inicio:'08:00'}]
function fixture({fail=false}={}){
 const calls=[]
 const client={from(table){assert.equal(table,'rotativos','No separate per-session registration reads')
  const call={table,filters:[],orders:[]};calls.push(call)
  const query={select(select,options){call.select=select;call.options=options;return query},eq(k,v){call.filters.push([k,v]);return query},gte(k,v){call.min=[k,v];return query},lte(k,v){call.max=[k,v];return query},order(k,v){call.orders.push([k,v]);return query},range(a,b){call.range=[a,b];return query},maybeSingle(){call.single=true;return query},then(resolve){
   assert.match(call.select,/rotativo_inscricoes\(count\)/)
   let data=rows.filter(row=>call.filters.every(([k,v])=>row[k]===v)&&(!call.min||row[call.min[0]]>=call.min[1])&&(!call.max||row[call.max[0]]<=call.max[1]))
   const count=data.length
   for(const [k,o]of [...call.orders].reverse())data.sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*(o?.ascending===false?-1:1))
   if(call.range)data=data.slice(call.range[0],call.range[1]+1)
   data=data.map(row=>({...row,rotativo_inscricoes:[{count:row.id==='a'?1205:row.id==='b'?1:0}]}))
   return Promise.resolve({data:call.single?(data[0]??null):data,count,error:fail?{message:'Count unavailable'}:null}).then(resolve)
  }};return query
 }}
 return {repo:new Repository(client),calls}
}
test('session pagination obtains exact embedded counts in one scoped query, even above 1000 registrations',async()=>{
 const h=fixture(),r=await h.repo.list('arena',{page:1,pageSize:2});assert.equal(h.calls.length,1);assert.equal(r.total,3);assert.deepEqual(r.rows.map(x=>[x.id,x.inscricoes_count]),[['c',0],['b',1]])
 const second=await h.repo.list('arena',{page:2,pageSize:2});assert.equal(second.rows[0].inscricoes_count,1205);assert.equal(second.rows[0].rotativo_inscricoes,undefined);assert.deepEqual(JSON.parse(JSON.stringify(second.rows[0].courts)),[{id:'court',name:'Court'}])
})
test('date, detail and month retain arena/date scope, zero-registration sessions and same-day calendar semantics',async()=>{
 const h=fixture();const day=await h.repo.findByDate('arena','2026-10-01');assert.deepEqual(day.map(x=>x.inscricoes_count),[1205,1]);assert.equal(h.calls.length,1)
 assert.equal((await h.repo.findById('arena','a')).inscricoes_count,1205);assert.equal(await h.repo.findById('arena','foreign'),null)
 const month=await h.repo.findByMonth('arena','2026-10-01','2026-10-31');assert.deepEqual(JSON.parse(JSON.stringify(month)),{'2026-10-01':{hasRotativo:true,hasInscriptions:true},'2026-10-02':{hasRotativo:true,hasInscriptions:false}});assert.equal(h.calls.length,4)
})
test('an embedded-count failure fails the read instead of silently showing zero occupied seats',async()=>{
 const h=fixture({fail:true});await assert.rejects(h.repo.list('arena'),/Count unavailable/);await assert.rejects(h.repo.findByMonth('arena','2026-10-01','2026-10-31'),/Count unavailable/)
})
