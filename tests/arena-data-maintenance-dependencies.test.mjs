import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'
const { includableDependencies, selectionOwnership, dependencyGroups } = loadTypescriptModule('src/modules/data-maintenance/dependencies.ts')
const { DependencyReview } = loadTypescriptModule('src/modules/data-maintenance/components/DependencyReview.tsx')
const edge=(overrides={})=>({from:'financial_transactions',to:'bookings',label:'Reservas',kind:'financial_source',count:2,includedCount:0,missingCount:2,blockedCount:0,canInclude:true,...overrides})
const operation=(edges,modules=['financial_transactions'],summary={})=>({modules,summary:{dependencies:edges,moduleCounts:[{module:'financial_transactions',label:'Todos os lançamentos locais',count:2}],transactionCount:2,sessionCount:0,blockers:[],...summary}})
const render=(edges,modules,summary)=>renderToStaticMarkup(realReact.createElement(DependencyReview,{operation:operation(edges,modules,summary),pending:false,onRefresh(){throw Error('Rendering must not select or delete anything')}}))

test('only explicit eligible missing groups can be included, once per group',()=>{
  const result=includableDependencies([edge(),edge({kind:'foreign_key'}),edge({to:null,canInclude:false,blockedCount:1})],['financial_transactions'])
  assert.deepEqual(Array.from(result),['bookings'])
  assert.deepEqual(Array.from(includableDependencies([edge()],['financial_transactions','bookings'])),[])
})
test('a foreign or protected link prevents including that group even when another edge permits it',()=>{
  const edges=[edge(),edge({from:'monthly_plans',canInclude:false,missingCount:0,blockedCount:1})]
  assert.deepEqual(Array.from(includableDependencies(edges,['financial_transactions','monthly_plans'])),[])
  const html=render(edges,['financial_transactions','monthly_plans'])
  assert.match(html,/Bloqueia a limpeza/);assert.doesNotMatch(html,/Incluir grupo|Incluir 1 grupo/)
  assert.doesNotMatch(html,/Os vínculos necessários estão na seleção|Vínculos incluídos na seleção automaticamente/)
})
test('selected A visibly leads to missing B with a direct inclusion action and whole-group scope',()=>{
  const html=render([edge()])
  assert.match(html,/Vínculos e impedimentos/);assert.match(html,/Atualizar vínculos/)
  assert.match(html,/2 vínculos/)
  assert.match(html,/Os vínculos mudaram desde a seleção/)
  assert.ok(html.indexOf('Todos os lançamentos locais')<html.indexOf('Reservas'))
})
test('reciprocal financial links and cycles are summarized without recursive expansion',()=>{
  const html=render([edge({includedCount:2,missingCount:0,canInclude:false}),edge({from:'bookings',to:'financial_transactions',includedCount:2,missingCount:0,canInclude:false})],['financial_transactions','bookings'])
  assert.match(html,/Incluído na seleção/);assert.match(html,/vínculos já incluídos/)
  assert.ok(html.length<12000);assert.doesNotMatch(html,/Incluir grupo/)
})
test('multiple database relationships render one group card, with link counts kept separate from record totals',()=>{
  const html=render([edge(),edge({kind:'foreign_key',count:1,missingCount:1})])
  assert.equal((html.match(/<span>Reservas<\/span>/g)??[]).length,1)
  assert.match(html,/3 vínculos/)
})
test('a group already selected but missing later rows is protected, not offered as a larger deletion',()=>{
  const html=render([edge({canInclude:false,reasons:['after_cutoff']})],['financial_transactions','bookings'])
  assert.match(html,/depois da data de corte/)
  assert.doesNotMatch(html,/Incluir grupo/)
})
test('an empty dependency set does not invent pending groups',()=>{
  const html=render([],['financial_transactions','arena_users'])
  assert.match(html,/Nenhum vínculo adicional precisa ser incluído/);assert.doesNotMatch(html,/Incluir grupo/)
})

test('separate protected record types are not merged into a generic total',()=>{
  const edges=[edge({to:null,label:'Cobranças de reservas em grupo',missingCount:0,blockedCount:8,canInclude:false,reasons:['financial']}),edge({to:null,label:'Outros contratos vinculados',missingCount:0,blockedCount:7,canInclude:false,reasons:['protected_reference']})]
  const groups=dependencyGroups(edges,['financial_transactions'])
  assert.equal(groups.length,2)
  const html=render(edges)
  assert.match(html,/Cobranças de reservas em grupo/);assert.match(html,/Outros contratos vinculados/)
  assert.match(html,/Histórico financeiro preservado/)
  assert.match(html,/Um mesmo registro pode ter mais de uma relação/)
})
test('financial or in-flight blockers never show an all-included success message',()=>{
  const html=render([],['bookings'],{blockers:[{code:'group_financial_history',message:'Histórico financeiro preservado',count:1}],bookingGroups:{groups:1,items:2,policySnapshots:2}})
  assert.match(html,/A seleção tem impedimentos/)
  assert.doesNotMatch(html,/Os vínculos necessários estão na seleção|Vínculos incluídos na seleção automaticamente|Nenhum vínculo adicional/)
  assert.match(html,/Reservas em grupo do app na seleção/)
  assert.match(html,/1 grupo · 2 reservas · 2 registros de regras de cancelamento/)
})
test('foreign arena and cutoff are distinct explanations with no automatic inclusion action',()=>{
  const html=render([edge({to:null,label:'Contratos vinculados',missingCount:0,blockedCount:2,canInclude:false,reasons:['other_arena','after_cutoff']})])
  assert.match(html,/pertence a outra arena/);assert.match(html,/depois da data de corte/)
  assert.doesNotMatch(html,/Atualizar vínculos|Incluído na seleção/)
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

test('group reservations visibly include provider charges, webhooks and completed refunds',()=>{
 const edges=[edge({from:'bookings',to:'group_payment_history',label:'Cobranças de reservas em grupo pelo app',count:4,includedCount:4,missingCount:0,canInclude:false}),edge({from:'group_payment_history',to:'bookings',count:12,includedCount:12,missingCount:0,canInclude:false})]
 const html=render(edges,['bookings','group_payment_history'],{groupPaymentHistory:{payments:4,webhooks:8,refundDecisions:1,refundAttempts:1}})
 assert.match(html,/Também será excluído junto das reservas/)
 assert.match(html,/Cobranças de reservas em grupo pelo app/)
 assert.match(html,/Cobranças incluídas na limpeza/)
 assert.match(html,/Eventos/);assert.match(html,/Decisões de estorno/);assert.match(html,/Tentativas de estorno/)
 assert.match(html,/não cancela cobranças nem envia estornos ao Asaas/)
 assert.doesNotMatch(html,/Bloqueia a limpeza|Histórico financeiro preservado/)
 const owned=selectionOwnership(['bookings'],['bookings','group_payment_history'],edges)
 assert.deepEqual(Array.from(owned.requiredBy('group_payment_history')),['bookings'])
 assert.deepEqual(Array.from(owned.requiredBy('bookings')),[])
 assert.equal(owned.fullyExplained,true)
 const inverse=selectionOwnership(['group_payment_history'],['bookings','group_payment_history'],edges)
 assert.deepEqual(Array.from(inverse.requiredBy('bookings')),['group_payment_history'])
})
test('including the payment module never turns in-flight finance into a success state',()=>{
 const html=render([],['bookings','group_payment_history'],{blockers:[{code:'group_finance_in_progress',message:'Conciliação em andamento',count:1}],groupPaymentHistory:{payments:1,webhooks:0,refundDecisions:0,refundAttempts:0}})
 assert.match(html,/A seleção tem impedimentos/)
 assert.doesNotMatch(html,/Os vínculos necessários estão na seleção|Nenhum vínculo adicional/)
})
