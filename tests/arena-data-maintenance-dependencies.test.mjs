import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'
const { includableDependencies, selectionOwnership } = loadTypescriptModule('src/modules/data-maintenance/dependencies.ts')
const { DependencyReview } = loadTypescriptModule('src/modules/data-maintenance/components/DependencyReview.tsx')
const edge=(overrides={})=>({from:'financial_transactions',to:'bookings',label:'Reservas',kind:'financial_source',count:2,includedCount:0,missingCount:2,blockedCount:0,canInclude:true,...overrides})
const operation=(edges,modules=['financial_transactions'])=>({modules,summary:{dependencies:edges,moduleCounts:[{module:'financial_transactions',label:'Todos os lançamentos locais',count:2}],transactionCount:2,sessionCount:0}})
const render=(edges,modules)=>renderToStaticMarkup(realReact.createElement(DependencyReview,{operation:operation(edges,modules),pending:false,onRefresh(){throw Error('Rendering must not select or delete anything')}}))

test('only explicit eligible missing groups can be included, once per group',()=>{
  const result=includableDependencies([edge(),edge({kind:'foreign_key'}),edge({to:null,canInclude:false,blockedCount:1})],['financial_transactions'])
  assert.deepEqual(Array.from(result),['bookings'])
  assert.deepEqual(Array.from(includableDependencies([edge()],['financial_transactions','bookings'])),[])
})
test('a foreign or protected link prevents including that group even when another edge permits it',()=>{
  const edges=[edge(),edge({from:'monthly_plans',canInclude:false,missingCount:0,blockedCount:1})]
  assert.deepEqual(Array.from(includableDependencies(edges,['financial_transactions','monthly_plans'])),[])
  const html=render(edges,['financial_transactions','monthly_plans'])
  assert.match(html,/Preservado/);assert.doesNotMatch(html,/Incluir grupo|Incluir 1 grupo/)
})
test('selected A visibly leads to missing B with a direct inclusion action and whole-group scope',()=>{
  const html=render([edge()])
  assert.match(html,/O que precisa sair junto/);assert.match(html,/Atualizar vínculos/)
  assert.match(html,/2 vínculos/)
  assert.match(html,/Os vínculos mudaram desde a seleção/)
  assert.ok(html.indexOf('Todos os lançamentos locais')<html.indexOf('Reservas'))
})
test('reciprocal financial links and cycles are summarized without recursive expansion',()=>{
  const html=render([edge({includedCount:2,missingCount:0,canInclude:false}),edge({from:'bookings',to:'financial_transactions',includedCount:2,missingCount:0,canInclude:false})],['financial_transactions','bookings'])
  assert.match(html,/Incluído automaticamente/);assert.match(html,/vínculos já incluídos/)
  assert.ok(html.length<12000);assert.doesNotMatch(html,/Incluir grupo/)
})
test('multiple database relationships render one group card, with link counts kept separate from record totals',()=>{
  const html=render([edge(),edge({kind:'foreign_key',count:1,missingCount:1})])
  assert.equal((html.match(/<span>Reservas<\/span>/g)??[]).length,1)
  assert.match(html,/3 vínculos/)
})
test('a group already selected but missing later rows is protected, not offered as a larger deletion',()=>{
  const html=render([edge({canInclude:false})],['financial_transactions','bookings'])
  assert.match(html,/fora do corte/)
  assert.doesNotMatch(html,/Incluir grupo/)
})
test('an empty dependency set does not invent pending groups',()=>{
  const html=render([],['financial_transactions','arena_users'])
  assert.match(html,/Vínculos incluídos na seleção automaticamente/);assert.doesNotMatch(html,/Incluir grupo/)
})

test('ownership follows explicit roots through cycles and shared children',()=>{
 const links=[edge({from:'bookings',to:'open_games',includedCount:2,missingCount:0,canInclude:false}),edge({from:'open_games',to:'bookings',includedCount:2,missingCount:0,canInclude:false}),edge({from:'monthly_plans',to:'open_games',includedCount:2,missingCount:0,canInclude:false})]
 const first=selectionOwnership(['bookings'],['bookings','open_games'],links)
 assert.deepEqual(Array.from(first.requiredBy('bookings')),[])
 assert.deepEqual(Array.from(first.requiredBy('open_games')),['bookings'])
 const shared=selectionOwnership(['bookings','monthly_plans'],['bookings','open_games','monthly_plans'],links)
 assert.deepEqual(Array.from(shared.requiredBy('open_games')),['bookings','monthly_plans'])
 assert.equal(shared.fullyExplained,true)
 assert.equal(selectionOwnership(['bookings'],['bookings','arena_users'],[]).fullyExplained,false)
})
