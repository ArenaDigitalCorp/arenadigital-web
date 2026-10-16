import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'
import {hookController}from './helpers/hook-controller.mjs'
const arena='00000000-0000-4000-8000-000000000001'
const row=(id,extra={})=>({id,nome_perfil:`Atleta ${id}`,cpf:null,telefone:null,users:{email:null},arenas_atleta:[{perfil_definido_em:'2026-10-01T03:30:00Z'}],atleta_esportes:[],...extra})
function fixture({denied=false,fail=false}={}){
 const members=Array.from({length:2005},(_,i)=>row(`member-${String(i).padStart(4,'0')}`))
 const former=row('former',{arenas_atleta:[]}),formerProfessor=row('former-professor',{arenas_atleta:[]})
 const turma={id:'turma',codigo:'BT-001',codigo_prefixo:'BT',codigo_sequencia:1,professor_atleta_id:formerProfessor.id,esporte_id:'sport',data_criacao:'2026-10-01',vagas:10,status:'ativa',plano_mensalista_id:'plan',recorrencia_criada_pela_turma:false,turma_niveis:[],turma_horarios:[]}
 const matriculas=[{id:'mat1',turma_id:'turma',atleta_id:members[1500].id,data_entrada:'2026-10-01',data_saida:null,motivo_saida:null},{id:'mat2',turma_id:'turma',atleta_id:former.id,data_entrada:'2026-10-01',data_saida:'2026-10-02',motivo_saida:'Saiu'}]
 const calls=[]
 function query(table){const call={table,filters:[],ranges:[]};calls.push(call)
 const q={select(s){call.select=s;return q},eq(k,v){call.filters.push([k,v]);return q},in(k,v){call.ids=v;return q},order(){return q},range(a,b){call.range=[a,b];call.ranges.push([a,b]);return q},then(resolve){
  let data=table==='atleta'?[...members,former,formerProfessor]:table==='profiles'?members.map((r,i)=>({atleta_id:r.id,perfil_efetivo:i===2004?'professor':'padrao'})):table==='turmas'?[turma]:table==='turma_alunos'?matriculas:[]
  if(call.ids)data=data.filter(r=>call.ids.includes(r.id))
  if(call.select?.includes('arenas_atleta!inner')){assert.ok(call.filters.some(([k,v])=>k==='arenas_atleta.id_arena'&&v===arena));data=data.filter(r=>r.arenas_atleta.length)}
  for(const[k,v]of call.filters)if(k==='perfil_efetivo')data=data.filter(r=>r[k]===v)
  if(call.range)data=data.slice(call.range[0],call.range[1]+1)
  return Promise.resolve({data,error:fail&&table==='atleta'?{message:'Atletas indisponíveis'}:null}).then(resolve)
 }};return q}
 const client={from:query,rpc(name,args){assert.equal(args.p_arena_id,arena);return query(name==='list_atleta_perfis'?'profiles':'recurrences')}}
 const imports={
  '@/lib/server-auth':{async assertArenaBackofficeAccess(id){assert.equal(id,arena);if(denied)throw Error('Denied')},requireAuthenticatedDbUser:async()=>({dbUserId:'user'})},
  '@/lib/supabase-server':{getSupabaseAdmin:()=>client},'next/cache':{revalidatePath(){}},
 }
 return {actions:loadTypescriptModule('src/modules/turmas/actions.ts',imports),calls,members,former,formerProfessor}
}
test('Turmas loads only professors, enrolled athletes and complete former-member history in its initial catalogue',async()=>{
 const h=fixture(),res=await h.actions.getTurmasPageDataAction(arena);assert.equal(res.success,true)
 const c=res.data.catalogo;assert.equal(c.professores.length,1);assert.equal(c.professores[0].id,h.members[2004].id);assert.equal(c.professores[0].professorDesde,'2026-10-01')
 assert.deepEqual(new Set(c.atletas.map(a=>a.id)),new Set([h.members[2004].id,h.members[1500].id,h.former.id,h.formerProfessor.id]))
 assert.equal(c.atletas.find(a=>a.id===h.former.id).membro,false);assert.equal(c.atletas.find(a=>a.id===h.members[1500].id).membro,true)
 assert.equal(res.data.turmas[0].matriculas.length,2);assert.equal(res.data.turmas[0].professorId,h.formerProfessor.id)
 assert.ok(h.calls.find(c=>c.table==='profiles').filters.some(([k,v])=>k==='perfil_efetivo'&&v==='professor'))
 assert.ok(h.calls.filter(c=>c.table==='atleta').every(c=>c.ids?.length<=200))
})
test('selection still returns ALL current members beyond 1000, with the same details and no former candidates',async()=>{
 const h=fixture(),res=await h.actions.getTurmasAthleteOptionsAction(arena);assert.equal(res.success,true);assert.equal(res.data.length,2005);assert.ok(res.data.every(a=>a.membro));assert.ok(res.data.some(a=>a.id===h.members[2004].id));assert.equal(res.data.some(a=>a.id==='former'),false);assert.equal(h.calls.find(c=>c.table==='atleta').ranges.length,3)
})
test('both Turmas reads authorize first and fail explicitly rather than showing incomplete candidates',async()=>{
 const h=fixture({denied:true});assert.equal((await h.actions.getTurmasPageDataAction(arena)).success,false);assert.equal((await h.actions.getTurmasAthleteOptionsAction(arena)).success,false);assert.equal(h.calls.length,0)
 const f=fixture({fail:true});assert.equal((await f.actions.getTurmasPageDataAction(arena)).success,false);assert.equal((await f.actions.getTurmasAthleteOptionsAction(arena)).success,false)
})
function modalFixture(){
 let resolve;const pending=new Promise(ok=>{resolve=ok});const catalogo={esportes:[],espacos:[],professores:[],recorrencias:[],atletas:[{id:'former',membro:false},{id:'left-since-render',membro:true}]}
 const args=[{arenaId:arena,catalogo,title:'Title',onClose(){},children:catalogo=>catalogo}]
 const h=hookController('src/modules/turmas/components/TurmasAthleteCatalog.tsx','TurmasAthleteCatalog',args,{
  '@/modules/turmas/actions':{},'../actions':{getTurmasAthleteOptionsAction:()=>pending},
  '@/components/ui/standard-modal':{StandardModal:'Modal'},'@/components/ui/button':{Button:'Button'},
 })
 return {...h,resolve}
}
test('selection modal stays in loading until the complete catalogue arrives and preserves former history as non-selectable',async()=>{
 const h=modalFixture();assert.equal(h.render().type,'Modal');h.resolve({success:true,data:[{id:'current',membro:true}]});await new Promise(r=>setImmediate(r));const c=h.render();assert.deepEqual(JSON.parse(JSON.stringify(c.atletas.map(x=>[x.id,x.membro]))),[['current',true],['former',false],['left-since-render',false]])
})
test('closing selection before load completion discards its late result',async()=>{
 const h=modalFixture();h.render();h.unmount();h.resolve({success:true,data:[{id:'current',membro:true}]});await new Promise(r=>setImmediate(r));assert.equal(h.render().type,'Modal')
})
