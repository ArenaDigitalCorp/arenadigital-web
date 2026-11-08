import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as flush } from 'node:timers/promises'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTypescriptModule, realReact as React } from './helpers/load-typescript-module.mjs'

const arenaId = '11111111-1111-4111-8111-111111111111'
const registration = { legalName: 'Empresa do cadastro', email: '', phone: '', document: '', address: '', addressNumber: '', complement: '', province: '', postalCode: '' }
const settings = {
  enabled: false, hasPaymentAccount: false, onboardingStarted: false, webhookConfigured: false,
  credentialRecoveryRequired: false, paymentFlow: 'arena_subaccount_split', holderName: '', holderDocument: '',
  onboardingStatus: 'NOT_STARTED', commercialInfoStatus: 'NOT_STARTED', bankAccountInfoStatus: 'NOT_STARTED', documentationStatus: 'NOT_STARTED',
}
function text(children) {
  if (Array.isArray(children)) return children.map(text).join(' ')
  if (children && typeof children === 'object') return text(children.props?.children)
  return typeof children === 'string' ? children : ''
}
function render(initialReceivingDraft = null, options = {}) {
  const elements = [], drafts = [], creations = [], notifications = []
  const { ArenaPixSplitSettingsCard } = loadTypescriptModule('src/modules/arenas/components/ArenaPixSplitSettingsCard.tsx', {
    'react/jsx-runtime': {
      ...jsxRuntime,
      jsx(type, props, key) { elements.push({type, props}); return jsxRuntime.jsx(type, props, key) },
      jsxs(type, props, key) { elements.push({type, props}); return jsxRuntime.jsxs(type, props, key) },
    },
    'sonner': { toast: { success: value => notifications.push(['success', value]), error: value => notifications.push(['error', value]), info() {} } },
    '@/modules/arenas/actions/receivingSetupActions': {
      saveArenaReceivingDraftAction: async (...args) => {
        drafts.push(args)
        return options.failDraft ? { success: false, error: 'Conflito de revisão' } : { success: true, data: { data: args[1], revision: 2, updated_at: '2026-11-08T12:00:00Z' } }
      },
    },
    '@/modules/arenas/actions/arenaActions': {
      createArenaAsaasSubaccountAction: async (...args) => { creations.push(args); return { success: true, data: {...settings, onboardingStarted: true} } },
    },
  })
  const html = renderToStaticMarkup(React.createElement(ArenaPixSplitSettingsCard, { arenaId, arenaName: 'Arena de teste', registration: options.registration ?? registration, initialSettings: settings, initialReceivingDraft, accessMode: 'arena' }))
  const button = label => elements.find(e => e.type === 'button' && text(e.props.children).includes(label))
  const form = elements.find(e => e.type === 'form' && e.props['aria-labelledby'] === 'asaas-onboarding-title')
  return {html, drafts, creations, notifications, button, form}
}

test('receiving draft restores the saved legal registration instead of discarding it on reentry', () => {
  const r = render({data: {name:'Empresa preparada', cpfCnpj:'11222333000181', companyType:'MEI', incomeValue:'1.250,50'}, revision:4, updated_at:'2026-11-08T12:00:00Z'})
  assert.match(r.html, /Empresa preparada/)
  assert.doesNotMatch(r.html, /id="baas-name"/)
  assert.match(r.html, /value="1.250,50"/)
  assert.equal(r.drafts.length,0)
  assert.equal(r.creations.length,0)
})

test('saving incomplete receiving draft passes the revision and never creates a provider account', async () => {
  const r = render({data: {name:'Empresa incompleta'}, revision:4, updated_at:'2026-11-08T12:00:00Z'})
  assert.equal(r.button('Salvar rascunho').props.type,'button')
  await r.button('Salvar rascunho').props.onClick()
  await flush()
  assert.equal(r.drafts.length,1)
  assert.equal(r.drafts[0][0],arenaId)
  assert.equal(r.drafts[0][1].name,'Empresa incompleta')
  assert.equal(r.drafts[0][1].companyType,'')
  assert.equal(r.drafts[0][2],4)
  assert.equal(r.creations.length,0)
  assert.equal(r.notifications[0][0],'success')
})

test('draft failure does not claim a save and cannot fall through to provider creation', async () => {
  const r=render(null,{failDraft:true})
  await r.button('Salvar rascunho').props.onClick()
  await flush()
  assert.equal(r.creations.length,0)
  assert.deepEqual(r.notifications,[['error','Conflito de revisão']])
})

test('only explicit registration submit creates the account and converts the saved revenue', async () => {
  const r=render({data: {companyType:'MEI',incomeValue:'1.250,50'}, revision:4,updated_at:'2026-11-08T12:00:00Z'})
  await r.form.props.onSubmit({preventDefault(){}})
  assert.equal(r.creations.length,1)
  assert.equal(r.creations[0][1].incomeValue,1250.5)
  assert.equal(r.drafts.length,0)
})


test('complete arena registration asks only for financial-specific missing fields', async () => {
 const source={legalName:'Empresa Completa',email:'arena@example.invalid',phone:'47999999999',document:'11222333000181',address:'Rua Teste',addressNumber:'10',complement:'Sala 2',province:'Centro',postalCode:'88301001'}
 const r=render(null,{registration:source})
 for(const field of ['name','document','email','phone','address','address-number','complement','province','postal-code'])assert.doesNotMatch(r.html,new RegExp('id="baas-'+field+'"'))
 assert.match(r.html,/Dados já informados/);assert.match(r.html,/Revisar dados/)
 assert.match(r.html,/id="baas-company-type"/);assert.match(r.html,/id="baas-income"/)
 await r.button('Salvar rascunho').props.onClick()
 assert.equal(r.drafts[0][1].email,source.email);assert.equal(r.drafts[0][1].address,source.address)
})
test('missing base registration fields remain editable',()=>{
 const r=render();assert.match(r.html,/id="baas-email"/);assert.match(r.html,/id="baas-postal-code"/)
})
