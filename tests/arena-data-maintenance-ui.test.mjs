import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule,realReact } from './helpers/load-typescript-module.mjs'
const arenaA={id:'f9200000-0000-4000-8000-000000000001',name:'Arena A',document:'12.345.678/0001-90',kind:'customer'}
const arenaB={...arenaA,id:'f9200000-0000-4000-8000-000000000002',name:'Arena B'}
const op={id:'f9300000-0000-4000-8000-000000000001',arenaId:arenaA.id,arenaName:arenaA.name,reason:'Testing finished',modules:['manual_transactions'],cutoff:'2026-10-28T12:00:00Z',status:'preview',createdAt:'2026-10-28T12:00:00Z',expiresAt:'2026-10-28T12:15:00Z',completedAt:null,restoredAt:null,summary:{transactionCount:2,sessionCount:0,openSessionCount:0,incomingTotal:'10',outgoingTotal:'5',preservedAutomaticCount:1,preservedTransactionCount:1,blockers:[],canExecute:true,dependencies:[]}}
const settle=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
function collect(node,predicate) {
  if(Array.isArray(node))return node.flatMap(n=>collect(n,predicate))
  if(!node||typeof node!=='object')return []
  return [...(predicate(node)?[node]:[]),...collect(node.props?.children,predicate)]
}
function text(node) {if(Array.isArray(node))return node.map(text).join(' ');if(!node||typeof node!=='object')return String(node??'');return text(node.props?.children)}
const {CLEANUP_MODULES:catalog}=loadTypescriptModule('src/modules/data-maintenance/catalog.ts')
function harness({previewPromise,executeFailure=false,unavailable=false,initialHistory=[],previewFactory,initialArenaId=arenaA.id,selectionFactory,selectionResolver}={}) {
  const states=[],refs=[],effects=[],callbacks=[],pending=[],calls=[];let si,ri,ei,ci,history=initialHistory
  const imports={react:{...realReact,useState(initial){const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next}]},useRef(initial){return refs[ri++]??={current:initial}},useEffect(fn,deps){const i=ei++,old=effects[i];if(!old||deps.some((v,n)=>v!==old.deps[n])){old?.cleanup?.();effects[i]={deps,fn,run:true}}},useTransition:()=>[false,fn=>{pending.push(fn())}]},
    '../actions':{resolveArenaCleanupSelection:async input=>{
        calls.push({name:'resolve',input});if(selectionResolver)return selectionResolver(input)
        const roots=input.modules,modules=[...roots],dependencies=[]
        if(roots.includes('cash_sessions')&&!roots.includes('manual_transactions')&&!roots.includes('financial_transactions')){modules.push('manual_transactions');dependencies.push({from:'cash_sessions',to:'manual_transactions',label:'Lançamentos manuais',kind:'foreign_key',count:0,includedCount:0,missingCount:0,blockedCount:0,canInclude:false})}
        return {success:true,data:selectionFactory?selectionFactory(input):{arenaId:input.arenaId,requestedModules:roots,modules,cutoff:input.cutoff??op.cutoff,dependencies,resolved:true}}
      },listArenaCleanups:async(id,cursor)=>{if(unavailable)return {success:false,unavailable:true,error:'Banco aguarda atualização'};const rows=history.filter(item=>item.arenaId===id),start=cursor?rows.findIndex(item=>item.id===cursor.id)+1:0;return {success:true,data:rows.slice(start,start+20)}},
      previewArenaCleanup:async input=>{calls.push({name:'preview',input});return previewPromise?previewPromise.promise:{success:true,data:previewFactory?previewFactory(input):{...op,modules:input.modules}}},
      executeArenaCleanup:async input=>{calls.push({name:'execute',input});if(executeFailure)return {success:false,error:'Os dados mudaram. Gere outra prévia.'};history=[{...op,status:'completed'}];return {success:true,data:history[0]}},
      restoreArenaCleanup:async input=>{calls.push({name:'restore',input});history=[{...op,status:'restored'}];return {success:true,data:history[0]}},
    }}
  imports.react.useCallback=(fn,deps)=>{const i=ci++,old=callbacks[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))callbacks[i]={fn,deps};return callbacks[i].fn}
  const {MaintenanceSection}=loadTypescriptModule('src/modules/data-maintenance/components/MaintenanceSection.tsx',imports)
  const api={calls,render(){si=ri=ei=ci=0;const node=MaintenanceSection({arenas:[arenaA,arenaB],environment:'Local',initialArenaId});for(const effect of effects)if(effect.run){effect.run=false;effect.cleanup=effect.fn()}return node},
    input(label){
      let node=collect(api.render(),n=>n.props?.['aria-label']===label)[0]
      if(!node){const entry=catalog.find(item=>item.label===label),area=collect(api.render(),n=>n.props?.['aria-label']==='Área de dados')[0];if(entry&&area){area.props.onChange({target:{value:entry.group}});node=collect(api.render(),n=>n.props?.['aria-label']===label)[0]}}
      return node
    },
    button(label){return collect(api.render(),n=>n.props?.onClick&&text(n).trim()===label)[0]},
    checkboxes(){return collect(api.render(),n=>n.type==='input'&&n.props.type==='checkbox')},
    async flush(){await Promise.all(pending.splice(0));await settle()},
    prepare(){api.input('Lançamentos manuais').props.onChange({target:{checked:true}});api.input('Motivo da limpeza').props.onChange({target:{value:'Trial period finished'}})},
  }
  api.impact=()=>collect(api.render(),n=>n.type?.name==='DependencyReview')[0]
  api.analyze=async()=>{await api.flush();api.button('Analisar seleção').props.onClick();await api.flush()}
  api.confirm=()=>api.button('Revisar confirmação').props.onClick()
  return api
}
const link=(from,to)=>({from,to,label:catalog.find(item=>item.id===to)?.label??to,kind:'foreign_key',count:1,includedCount:1,missingCount:0,blockedCount:0,canInclude:false})
function linkedPlan(input,edges){
  const selected=new Set(input.modules),visit=id=>{for(const edge of edges.filter(edge=>edge.from===id)){if(!selected.has(edge.to)){selected.add(edge.to);visit(edge.to)}}}
  for(const id of input.modules)visit(id)
  return {arenaId:input.arenaId,requestedModules:input.modules,modules:[...selected],cutoff:input.cutoff??'2026-10-28T12:00:00.123456Z',dependencies:edges.filter(edge=>selected.has(edge.from)&&selected.has(edge.to)),resolved:true}
}
test('analysis waits for a validated automatic selection and a reason',async()=>{
  const h=harness();h.render();await h.flush()
  assert.equal(h.button('Analisar seleção').props.disabled,true)
  h.prepare();await h.flush();assert.equal(h.button('Analisar seleção').props.disabled,false)
  assert.equal(h.button('Confirmar limpeza'),undefined)
})
test('choosing A selects C and D and prevents unchecking them until A is removed',async()=>{
  const h=harness({selectionFactory:input=>linkedPlan(input,[link('bookings','booking_results'),link('bookings','open_games')])})
  h.render();await h.flush();h.input('Reservas').props.onChange({target:{checked:true}});await h.flush()
  for(const label of ['Resultados de partidas','GameMatch da arena']){assert.equal(h.input(label).props.checked,true);assert.equal(h.input(label).props.disabled,true)}
  h.input('Resultados de partidas').props.onChange({target:{checked:false}});await h.flush()
  assert.equal(h.input('Resultados de partidas').props.checked,true)
  h.input('Reservas').props.onChange({target:{checked:false}});await h.flush()
  for(const label of ['Resultados de partidas','GameMatch da arena']){assert.equal(h.input(label).props.checked,false);assert.equal(h.input(label).props.disabled,false)}
  assert.equal(h.calls.filter(call=>call.name==='preview'||call.name==='execute').length,0)
})
test('shared dependency remains locked while another explicit root still requires it',async()=>{
  const h=harness({selectionFactory:input=>linkedPlan(input,[link('bookings','booking_results'),link('bookings','open_games'),link('monthly_plans','booking_results')])})
  h.render();await h.flush();h.input('Reservas').props.onChange({target:{checked:true}});await h.flush()
  h.input('Planos de mensalistas').props.onChange({target:{checked:true}});await h.flush()
  h.input('Reservas').props.onChange({target:{checked:false}});await h.flush()
  assert.equal(h.input('GameMatch da arena').props.checked,false)
  assert.equal(h.input('Resultados de partidas').props.checked,true);assert.equal(h.input('Resultados de partidas').props.disabled,true)
  h.input('Planos de mensalistas').props.onChange({target:{checked:false}});await h.flush()
  assert.equal(h.input('Resultados de partidas').props.checked,false)
})
test('a prior explicit choice survives removing the parent that also required it',async()=>{
  const h=harness({selectionFactory:input=>linkedPlan(input,[link('bookings','booking_results')])})
  h.render();await h.flush();h.input('Resultados de partidas').props.onChange({target:{checked:true}});await h.flush()
  h.input('Reservas').props.onChange({target:{checked:true}});await h.flush()
  assert.equal(h.input('Resultados de partidas').props.disabled,true)
  h.input('Reservas').props.onChange({target:{checked:false}});await h.flush()
  assert.equal(h.input('Resultados de partidas').props.checked,true);assert.equal(h.input('Resultados de partidas').props.disabled,false)
})
test('cycles through automatic nodes do not trap the single explicit parent',async()=>{
  const h=harness({selectionFactory:input=>linkedPlan(input,[link('bookings','open_games'),link('open_games','bookings')])})
  h.render();await h.flush();h.input('Reservas').props.onChange({target:{checked:true}});await h.flush()
  assert.equal(h.input('Reservas').props.disabled,false);assert.equal(h.input('GameMatch da arena').props.disabled,true)
  h.input('Reservas').props.onChange({target:{checked:false}});await h.flush()
  assert.equal(h.input('GameMatch da arena').props.checked,false)
})
test('a response arriving after switching arenas cannot repopulate linked groups',async()=>{
  const job=deferred(),h=harness({selectionResolver:()=>job.promise});h.render();await h.flush()
  h.input('Reservas').props.onChange({target:{checked:true}})
  h.input('Arena para manutenção').props.onChange({target:{value:arenaB.id}});h.render()
  job.resolve({success:true,data:linkedPlan({arenaId:arenaA.id,modules:['bookings']},[link('bookings','open_games')])});await h.flush()
  assert.equal(h.input('GameMatch da arena').props.checked,false);assert.equal(h.button('Analisar seleção').props.disabled,true)
})
test('an unexplained automatic group or mismatched arena never enables analysis',async()=>{
  for(const mismatch of ['orphan','arena']){
    const h=harness({selectionFactory:input=>({...linkedPlan(input,[]),arenaId:mismatch==='arena'?arenaB.id:input.arenaId,modules:[...input.modules,'arena_users']})})
    h.render();await h.flush();h.prepare();await h.flush()
    assert.equal(h.button('Analisar seleção').props.disabled,true);assert.match(text(h.render()),/Não foi possível validar/)
  }
})
test('missing resolver leaves explicit choices visible but blocks analysis',async()=>{
  const h=harness({selectionResolver:async()=>({success:false,unavailable:true,error:'Seleção aguarda atualização do banco'})})
  h.render();await h.flush();h.prepare();await h.flush()
  assert.equal(h.input('Lançamentos manuais').props.checked,true)
  assert.equal(h.button('Analisar seleção').props.disabled,true)
})
test('successful retry clears the old resolver error and permits analysis',async()=>{
  let failed=true
  const h=harness({selectionResolver:async input=>failed?{success:false,error:'Falha temporária de leitura'}:{success:true,data:linkedPlan(input,[])}})
  h.render();await h.flush();h.prepare();await h.flush()
  assert.equal(h.button('Analisar seleção').props.disabled,true)
  assert.match(text(h.render()),/Falha temporária de leitura/)
  failed=false;h.button('Tentar conferir os vínculos novamente').props.onClick();await h.flush()
  assert.equal(h.button('Analisar seleção').props.disabled,false)
  assert.doesNotMatch(text(h.render()),/Falha temporária de leitura/)
  assert.equal(h.calls.some(call=>call.name==='preview'||call.name==='execute'),false)
})
test('analysis uses the entire resolved scope and preserves the exact cutoff for reanalysis',async()=>{
  const h=harness({selectionFactory:input=>linkedPlan(input,[link('bookings','open_games'),link('open_games','booking_results')])})
  h.render();await h.flush();h.input('Reservas').props.onChange({target:{checked:true}})
  h.input('Motivo da limpeza').props.onChange({target:{value:'Review automatic scope'}});await h.analyze()
  const preview=h.calls.find(call=>call.name==='preview')
  assert.deepEqual(Array.from(preview.input.modules),['bookings','open_games','booking_results'])
  assert.equal(preview.input.cutoff,'2026-10-28T12:00:00.123456Z')
  h.confirm();assert.equal(h.button('Confirmar limpeza').props.disabled,true)
  h.button('Atualizar análise').props.onClick();await h.flush()
  assert.equal(h.calls.filter(call=>call.name==='resolve').at(-1).input.cutoff,op.cutoff)
})
test('separate confirmation still requires exact arena name and acknowledgement',async()=>{
  const h=harness();h.render();await h.flush();h.prepare();await h.analyze();h.confirm()
  h.input('Nome da arena para confirmar limpeza').props.onChange({target:{value:'Arena B'}})
  h.input('Confirmação dos dados selecionados').props.onChange({target:{checked:true}})
  assert.equal(h.button('Confirmar limpeza').props.disabled,true)
  h.input('Nome da arena para confirmar limpeza').props.onChange({target:{value:'Arena A'}})
  h.button('Confirmar limpeza').props.onClick();await h.flush()
  assert.match(text(h.render()),/Limpeza concluída/)
  assert.equal(h.calls.at(-1).input.arenaId,arenaA.id)
})
test('blocked server preview never enables the confirmation step',async()=>{
  const h=harness({previewFactory:input=>({...op,modules:input.modules,summary:{...op.summary,canExecute:false,blockers:[{code:'protected_source',message:'Registros protegidos',count:1}]}})})
  h.render();await h.flush();h.prepare();await h.analyze()
  assert.equal(h.button('Revisar confirmação').props.disabled,true);assert.equal(h.button('Confirmar limpeza'),undefined)
})
test('failed execution remains an error and never becomes a completed operation',async()=>{
  const h=harness({executeFailure:true});h.render();await h.flush();h.prepare();await h.analyze();h.confirm()
  h.input('Nome da arena para confirmar limpeza').props.onChange({target:{value:'Arena A'}})
  h.input('Confirmação dos dados selecionados').props.onChange({target:{checked:true}})
  h.button('Confirmar limpeza').props.onClick();await h.flush()
  assert.match(text(h.render()),/Os dados mudaram/);assert.doesNotMatch(text(h.render()),/Limpeza concluída/)
})
test('global search keeps manual roots limited to visible results',async()=>{
  const h=harness();h.render();await h.flush();h.input('Buscar grupo de dados').props.onChange({target:{value:'estoque'}})
  h.button('Selecionar resultados').props.onClick();await h.flush()
  const roots=h.calls.filter(call=>call.name==='resolve').at(-1).input.modules
  assert.ok(roots.includes('inventory'));assert.ok(!roots.includes('arena_users'));assert.ok(!roots.includes('financial_transactions'))
})
test('all 37 choices remain reachable and clearing removes automatic dependencies too',async()=>{
  const h=harness();h.render();await h.flush();for(const entry of catalog)assert.ok(h.input(entry.label),entry.label)
  h.button('Selecionar tudo').props.onClick();await h.flush();assert.match(text(h.render()),/37\s+grupos/)
  h.button('Limpar seleção').props.onClick();await h.flush();assert.equal(h.input('Lançamentos manuais').props.checked,false)
})
test('history and restoration retain separately confirmed arena and reason',async()=>{
  const h=harness({initialHistory:[{...op,status:'completed'}]});h.render();await h.flush();h.button('Histórico e restauração').props.onClick()
  h.button('Restaurar…').props.onClick();assert.equal(h.button('Confirmar restauração').props.disabled,true)
  h.input('Nome da arena para restaurar').props.onChange({target:{value:'Arena A'}})
  h.input('Motivo da restauração').props.onChange({target:{value:'Restore reviewed records'}})
  h.button('Confirmar restauração').props.onClick();await h.flush()
  assert.match(text(h.render()),/Registros restaurados/);assert.equal(h.calls.at(-1).input.arenaId,arenaA.id)
})
test('older operations remain reachable through history pagination',async()=>{
  const previews=Array.from({length:20},(_,index)=>({...op,id:`f9300000-0000-4000-8000-${String(index+10).padStart(12,'0')}`}))
  const h=harness({initialHistory:[...previews,{...op,status:'completed'}]});h.render();await h.flush();h.button('Histórico e restauração').props.onClick()
  assert.equal(h.button('Restaurar…'),undefined);h.button('Carregar operações anteriores').props.onClick();await h.flush();assert.ok(h.button('Restaurar…'))
})
