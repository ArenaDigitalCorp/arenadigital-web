import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'
import { hookController } from './helpers/hook-controller.mjs'

const arenaId='00000000-0000-4000-8000-000000000001', userId='00000000-0000-4000-8000-000000000002'
const query={kind:'ranking',arenaId,userId,page:1,search:''}
const page = name => ({data:[{name,balance:3.125}],total:30,totalPages:3})
const deferred = () => { let resolve; const promise=new Promise(ok=>{resolve=ok});return {promise,resolve} }
function fixture() {
  const requests=[]
  const h=hookController('src/modules/loyalty/lib/use-loyalty-page.ts','useLoyaltyPage',[query,page('SSR')],{fetch(url,options){
    const d=deferred();requests.push({url,options,...d});return d.promise
  }})
  return {...h,requests}
}
const response=(data,status=200)=>Response.json(status===200?{success:true,data}:{success:false,error:'unavailable'},{status})

test('loyalty SSR data is ready immediately with no duplicate request or startup delay',()=>{
 const h=fixture(),s=h.render();assert.equal(s.isLoading,false);assert.equal(s.data.data[0].name,'SSR');assert.equal(h.timers.size,0);assert.equal(h.requests.length,0)
})
test('each page change hides old financial rows immediately and requests a fresh uncached page',async()=>{
 const h=fixture();h.render().setQuery(q=>({...q,page:2}));let s=h.render();assert.equal(s.isLoading,true);assert.equal(s.data,undefined);assert.equal([...h.timers.values()][0].delay,0)
 const pending=h.runTimers();assert.equal(h.requests[0].options.cache,'no-store');assert.equal(JSON.parse(h.requests[0].options.body).page,2)
 h.requests[0].resolve(response(page('second')));await pending;s=h.render();assert.equal(s.data.data[0].name,'second');assert.equal(s.isLoading,false)
})
test('search debounce cancels superseded reads and a late response cannot replace the current result',async()=>{
 const h=fixture();h.render().setQuery(q=>({...q,search:'A'}));h.render();assert.equal([...h.timers.values()][0].delay,300)
 const a=h.runTimers();h.render().setQuery(q=>({...q,search:'B'}));h.render();assert.equal(h.requests[0].options.signal.aborted,true);const b=h.runTimers()
 h.requests[1].resolve(response(page('B')));await b;assert.equal(h.render().data.data[0].name,'B')
 h.requests[0].resolve(response(page('late A')));await a;assert.equal(h.render().data.data[0].name,'B')
})
test('returning to initial filters while a read is pending never reuses the old SSR financial snapshot',async()=>{
 const h=fixture();h.render().setQuery(q=>({...q,search:'other'}));h.render();const a=h.runTimers()
 h.render().setQuery(q=>({...q,search:''}));let s=h.render();assert.equal(s.data,undefined);assert.equal(s.isLoading,true)
 const b=h.runTimers();h.requests[1].resolve(response(page('fresh initial')));await b;h.requests[0].resolve(response(page('late')));await a
 assert.equal(h.render().data.data[0].name,'fresh initial')
})
test('read errors show no previous balance and can be retried with a fresh request',async()=>{
 const h=fixture();h.render().setQuery(q=>({...q,page:2}));h.render();let p=h.runTimers();h.requests[0].resolve(response(null,500));await p
 let s=h.render();assert.equal(s.data,undefined);assert.ok(s.error);assert.equal(s.isLoading,false);s.retry();h.render();p=h.runTimers();h.requests[1].resolve(response(page('retry')));await p;assert.equal(h.render().data.data[0].name,'retry')
})
for(const status of [401,403,409])test(`loyalty ${status} discards balances and blocks further reads until full refresh`,async()=>{
 const h=fixture();h.render().setQuery(q=>({...q,page:2}));h.render();const p=h.runTimers();h.requests[0].resolve(response(null,status));await p
 let s=h.render();assert.equal(s.blocked,true);assert.equal(s.data,undefined);s.setQuery(q=>({...q,search:'x'}));s.retry();h.render();assert.equal(h.timers.size,0)
})
test('unmount aborts the pending financial read and ignores its response',async()=>{
 const h=fixture();h.render().setQuery(q=>({...q,page:2}));h.render();const p=h.runTimers();h.unmount();assert.equal(h.requests[0].options.signal.aborted,true);h.requests[0].resolve(response(page('late')));await p
 assert.equal(h.render().data,undefined)
})

function routeFixture({denied=false,otherUser=false,fail=false}={}){
 const calls=[]
 class AuthorizationError extends Error {status=403}
 const {POST}=loadTypescriptModule('src/app/api/loyalty/read/route.ts',{
  'next/server':{NextResponse:Response},
  '@/lib/server-auth':{AuthorizationError,async assertArenaBackofficeAccess(id){calls.push(['auth',id]);if(denied)throw new AuthorizationError('Forbidden');return {dbUserId:otherUser?arenaId:userId}}},
  '@/lib/supabase-server':{getSupabaseAdmin:()=>({})},
  '@/modules/loyalty/repositories/SupabaseLoyaltyRepository':{SupabaseLoyaltyRepository:class{
   async getStatement(...args){calls.push(['statement',...args]);if(fail)throw Error('internal credentials');return page('statement')}
   async getAthletesWithBalance(...args){calls.push(['ranking',...args]);return page('ranking')}
  }},
 })
 return {calls,read:(input,origin='http://localhost')=>POST(new Request('http://localhost/api/loyalty/read',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(input)}))}
}
test('loyalty read endpoint preserves statement filters and fixed page size with private/no-store',async()=>{
 const h=routeFixture();const input={...query,kind:'statement',page:2,search:'Ana',startDate:'2026-10-01T03:00:00.000Z',endDate:'2026-10-17T02:59:59.000Z'};const r=await h.read(input)
 assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie')
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),[['auth',arenaId],['statement',arenaId,2,15,{athleteName:'Ana',startDate:input.startDate,endDate:input.endDate}]])
})
test('loyalty ranking read keeps original query, pagination and numeric precision',async()=>{
 const h=routeFixture(),r=await h.read({...query,page:3,search:'Ana'});assert.equal((await r.json()).data.data[0].balance,3.125);assert.deepEqual(JSON.parse(JSON.stringify(h.calls[1])),['ranking',arenaId,3,10,'Ana'])
})
for(const [options,status] of [[{denied:true},403],[{otherUser:true},409],[{fail:true},500]])test(`loyalty endpoint handles ${status} without leaking stale results or internal errors`,async()=>{
 const h=routeFixture(options),r=await h.read(options.fail?{...query,kind:'statement'}:query);assert.equal(r.status,status);const b=await r.json();assert.equal(b.success,false);assert.equal(b.data,undefined);assert.doesNotMatch(b.error,/credentials/)
 if(!options.fail)assert.equal(h.calls.length,1)
})
test('invalid or cross-origin loyalty reads never reach authorization or repository',async()=>{
 for(const input of [{...query,page:0},{...query,page:1.5},{...query,arenaId:'bad'},{...query,search:'x'.repeat(201)},{...query,kind:'statement',startDate:'bad'}]){const h=routeFixture();assert.equal((await h.read(input)).status,400);assert.equal(h.calls.length,0)}
 const h=routeFixture();assert.equal((await h.read(query,'http://elsewhere')).status,403);assert.equal(h.calls.length,0)
})
for(const [route,method,size] of [['statement','getStatement',15],['top-athletes','getAthletesWithBalance',10]])test(`${route} server page checks access before reads and delivers initial data`,async()=>{
 for(const denied of [false,true]){
  const calls=[];const {default:Page}=loadTypescriptModule(`src/app/dashboard/loyalty/[arenaId]/${route}/page.tsx`,{
   'next/navigation':{redirect(path){throw Error(`redirect:${path}`)}},
   '@/lib/server-auth':{async assertArenaBackofficeAccess(id){calls.push('auth');assert.equal(id,arenaId);if(denied)throw Error('denied');return{dbUserId:userId}}},
   '@/lib/supabase-server':{getSupabaseAdmin(){calls.push('db');return{}}},
   '@/modules/loyalty/repositories/SupabaseLoyaltyRepository':{SupabaseLoyaltyRepository:class{async [method](...args){calls.push(args);return page('initial')}}},
   [`@/modules/loyalty/components/${route==='statement'?'LoyaltyStatementClient':'LoyaltyTopAthletesClient'}`]:{[route==='statement'?'LoyaltyStatementClient':'LoyaltyTopAthletesClient']:'Client'},
  })
  if(denied){await assert.rejects(Page({params:Promise.resolve({arenaId})}),/redirect:/);assert.deepEqual(calls,['auth'])}
  else {const tree=await Page({params:Promise.resolve({arenaId})});assert.equal(tree.props.initialData.data[0].name,'initial');assert.equal(tree.props.userId,userId);assert.deepEqual(calls,['auth','db',[arenaId,1,size]])}
 }
})

test('an empty page beyond the last page resets to page one and reads it afresh before displaying data',async()=>{
 const h=fixture();h.render().setQuery(q=>({...q,page:2}));h.render();let p=h.runTimers();h.requests[0].resolve(response({data:[],total:0,totalPages:0}));await p
 let s=h.render();assert.equal(s.query.page,1);assert.equal(s.data,undefined);assert.equal(s.isLoading,true);p=h.runTimers();assert.equal(JSON.parse(h.requests[1].options.body).page,1);h.requests[1].resolve(response({data:[],total:0,totalPages:0}));await p;s=h.render();assert.equal(s.isLoading,false);assert.equal(s.data.total,0)
})
test('when rows disappear between requests, the UI reads the last valid page instead of showing data under an invalid page number',async()=>{
 const h=fixture();h.render().setQuery(q=>({...q,page:5}));h.render();let p=h.runTimers();h.requests[0].resolve(response({data:[],total:17,totalPages:2}));await p
 let s=h.render();assert.equal(s.query.page,2);assert.equal(s.data,undefined);p=h.runTimers();h.requests[1].resolve(response({data:[{name:'last page',balance:1.125}],total:17,totalPages:2}));await p;s=h.render();assert.equal(s.query.page,2);assert.equal(s.data.data[0].balance,1.125)
})
