import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule,realReact } from './helpers/load-typescript-module.mjs'
const arenaA={id:'f9200000-0000-4000-8000-000000000001',name:'Arena A',document:'12.345.678/0001-90',kind:'customer'}
const arenaB={...arenaA,id:'f9200000-0000-4000-8000-000000000002',name:'Arena B'}
const op={id:'f9300000-0000-4000-8000-000000000001',arenaId:arenaA.id,arenaName:arenaA.name,reason:'Testing finished',modules:['manual_transactions'],cutoff:'2026-10-28T12:00:00Z',status:'preview',createdAt:'2026-10-28T12:00:00Z',expiresAt:'2026-10-28T12:15:00Z',completedAt:null,restoredAt:null,summary:{transactionCount:2,sessionCount:0,openSessionCount:0,incomingTotal:'10',outgoingTotal:'5',preservedAutomaticCount:1,preservedTransactionCount:1,blockers:[],canExecute:true}}
const settle=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
function collect(node,predicate) {
  if(Array.isArray(node))return node.flatMap(n=>collect(n,predicate))
  if(!node||typeof node!=='object')return []
  return [...(predicate(node)?[node]:[]),...collect(node.props?.children,predicate)]
}
function text(node) {if(Array.isArray(node))return node.map(text).join(' ');if(!node||typeof node!=='object')return String(node??'');return text(node.props?.children)}
function harness({previewPromise,executeFailure=false,unavailable=false,initialHistory=[]}={}) {
  const states=[],refs=[],effects=[],callbacks=[],pending=[],calls=[];let si,ri,ei,ci,history=initialHistory
  const imports={react:{...realReact,useState(initial){const i=si++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next}]},useRef(initial){return refs[ri++]??={current:initial}},useEffect(fn,deps){const i=ei++,old=effects[i];if(!old||deps.some((v,n)=>v!==old.deps[n])){old?.cleanup?.();effects[i]={deps,fn,run:true}}},useTransition:()=>[false,fn=>{pending.push(fn())}]},
    '../actions':{listArenaCleanups:async(id,cursor)=>{if(unavailable)return {success:false,unavailable:true,error:'Banco aguarda atualização'};const rows=history.filter(item=>item.arenaId===id),start=cursor?rows.findIndex(item=>item.id===cursor.id)+1:0;return {success:true,data:rows.slice(start,start+20)}},
      previewArenaCleanup:async input=>{calls.push({name:'preview',input});return previewPromise?previewPromise.promise:{success:true,data:op}},
      executeArenaCleanup:async input=>{calls.push({name:'execute',input});if(executeFailure)return {success:false,error:'Os dados mudaram. Gere outra prévia.'};history=[{...op,status:'completed'}];return {success:true,data:history[0]}},
      restoreArenaCleanup:async input=>{calls.push({name:'restore',input});history=[{...op,status:'restored'}];return {success:true,data:history[0]}},
    }}
  imports.react.useCallback=(fn,deps)=>{const i=ci++,old=callbacks[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))callbacks[i]={fn,deps};return callbacks[i].fn}
  const {MaintenanceSection}=loadTypescriptModule('src/modules/data-maintenance/components/MaintenanceSection.tsx',imports)
  const api={calls,render(){si=ri=ei=ci=0;const node=MaintenanceSection({arenas:[arenaA,arenaB],environment:'Local',initialArenaId:arenaA.id});for(const effect of effects)if(effect.run){effect.run=false;effect.cleanup=effect.fn()}return node},
    input(label){return collect(api.render(),n=>n.props?.['aria-label']===label)[0]},
    button(label){return collect(api.render(),n=>n.props?.onClick&&text(n).trim()===label)[0]},
    checkboxes(){return collect(api.render(),n=>n.type==='input'&&n.props.type==='checkbox')},
    async flush(){await Promise.all(pending.splice(0));await settle()},
    prepare(){api.input('Lançamentos manuais').props.onChange({target:{checked:true}});api.input('Motivo da limpeza').props.onChange({target:{value:'Trial period finished'}})},
  }
  return api
}
test('initial view requires explicit modules and reason, and exposes the preserved data',async()=>{
  const h=harness();h.render();await h.flush()
  assert.equal(h.button('Gerar prévia').props.disabled,true)
  assert.match(text(h.render()),/contas globais dos atletas e usuários/)
  h.prepare();assert.equal(h.button('Gerar prévia').props.disabled,false)
  h.input('Caixas completos').props.onChange({target:{checked:true}})
  h.button('Gerar prévia').props.onClick();await h.flush()
  assert.deepEqual(Array.from(h.calls[0].input.modules),['manual_transactions','cash_sessions'])
})
test('confirmation requires the exact arena and acknowledgement, then shows committed history',async()=>{
  const h=harness();h.render();await h.flush();h.prepare();h.button('Gerar prévia').props.onClick();await h.flush()
  assert.equal(h.button('Confirmar limpeza').props.disabled,true)
  h.input('Nome da arena para confirmar limpeza').props.onChange({target:{value:'Arena B'}})
  h.input('Confirmação dos dados selecionados').props.onChange({target:{checked:true}})
  assert.equal(h.button('Confirmar limpeza').props.disabled,true)
  h.input('Nome da arena para confirmar limpeza').props.onChange({target:{value:'Arena A'}})
  assert.equal(h.button('Confirmar limpeza').props.disabled,false)
  h.button('Confirmar limpeza').props.onClick();await h.flush()
  assert.match(text(h.render()),/Limpeza concluída/);assert.match(text(h.render()),/Concluída/)
  assert.equal(h.calls.at(-1).input.operationId,op.id)
  assert.equal(h.calls.at(-1).input.arenaId,arenaA.id)
})
test('changing any reviewed scope discards confirmation and prevents stale preview responses',async()=>{
  const job=deferred(),h=harness({previewPromise:job});h.render();await h.flush();h.prepare();h.button('Gerar prévia').props.onClick()
  h.input('Arena para manutenção').props.onChange({target:{value:arenaB.id}});h.render()
  job.resolve({success:true,data:op});await h.flush()
  assert.equal(h.input('Nome da arena para confirmar limpeza'),undefined)
  assert.equal(h.button('Confirmar limpeza'),undefined)
})
test('a database failure cannot turn into a completed banner or clear the error',async()=>{
  const h=harness({executeFailure:true});h.render();await h.flush();h.prepare();h.button('Gerar prévia').props.onClick();await h.flush()
  h.input('Nome da arena para confirmar limpeza').props.onChange({target:{value:'Arena A'}});h.input('Confirmação dos dados selecionados').props.onChange({target:{checked:true}})
  h.button('Confirmar limpeza').props.onClick();await h.flush()
  assert.match(text(h.render()),/Os dados mudaram/);assert.doesNotMatch(text(h.render()),/Limpeza concluída/)
})
test('missing backend is visible and disables destructive preparation',async()=>{
  const h=harness({unavailable:true});h.render();await h.flush();h.prepare()
  // Editing resets a reviewed plan, but does not make an absent backend ready.
  assert.equal(h.button('Gerar prévia').props.disabled,true)
  assert.match(text(h.render()),/aguarda a atualização do banco/)
})
test('restoring from history requires its own typed confirmation and reason',async()=>{
  const h=harness({initialHistory:[{...op,status:'completed'}]});h.render();await h.flush()
  h.button('Restaurar…').props.onClick()
  assert.equal(h.button('Confirmar restauração').props.disabled,true)
  h.input('Nome da arena para restaurar').props.onChange({target:{value:'Arena A'}})
  h.input('Motivo da restauração').props.onChange({target:{value:'Restore reviewed QA records'}})
  assert.equal(h.button('Confirmar restauração').props.disabled,false)
  h.button('Confirmar restauração').props.onClick();await h.flush()
  assert.match(text(h.render()),/Registros restaurados/);assert.equal(h.calls.at(-1).name,'restore')
  assert.equal(h.calls.at(-1).input.arenaId,arenaA.id)
})

test('any operational group can be selected without selecting manual finance',async()=>{
  const h=harness();h.render();await h.flush()
  h.input('Reservas').props.onChange({target:{checked:true}})
  h.input('Motivo da limpeza').props.onChange({target:{value:'Reset test bookings only'}})
  assert.equal(h.button('Gerar prévia').props.disabled,false)
  h.button('Gerar prévia').props.onClick();await h.flush()
  assert.deepEqual(Array.from(h.calls[0].input.modules),['bookings'])
})
test('the complete catalog is selectable, and searching bulk-selects only visible results',async()=>{
  const h=harness();h.render();await h.flush()
  h.button('Selecionar todas as opções').props.onClick()
  assert.match(text(h.render()),/37\s+de\s+37/)
  h.button('Limpar seleção').props.onClick()
  h.input('Buscar grupo de dados').props.onChange({target:{value:'estoque'}})
  h.button('Selecionar resultados').props.onClick()
  h.input('Motivo da limpeza').props.onChange({target:{value:'Reset selected stock data'}})
  h.button('Gerar prévia').props.onClick();await h.flush()
  assert.ok(h.calls[0].input.modules.includes('inventory'))
  assert.ok(!h.calls[0].input.modules.includes('arena_users'))
  assert.ok(!h.calls[0].input.modules.includes('financial_transactions'))
})
test('switching arenas requires choosing the scope again',async()=>{
  const h=harness();h.render();await h.flush();h.prepare()
  h.input('Arena para manutenção').props.onChange({target:{value:arenaB.id}});h.render();await h.flush()
  assert.equal(h.input('Lançamentos manuais').props.checked,false)
  assert.equal(h.button('Gerar prévia').props.disabled,true)
})
test('older completed operations stay reachable through history pagination',async()=>{
  const previews=Array.from({length:20},(_,index)=>({...op,id:`f9300000-0000-4000-8000-${String(index+10).padStart(12,'0')}`}))
  const h=harness({initialHistory:[...previews,{...op,status:'completed'}]});h.render();await h.flush()
  assert.equal(h.button('Restaurar…'),undefined)
  h.button('Carregar operações anteriores').props.onClick();await h.flush()
  assert.ok(h.button('Restaurar…'))
  assert.equal(h.button('Carregar operações anteriores'),undefined)
})
