import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTypescriptModule, realReact as React } from './helpers/load-typescript-module.mjs'

const actions = new Proxy({}, { get: () => async () => { throw new Error('Unexpected action during SSR') } })
const { ArenaPixSplitSettingsCard } = loadTypescriptModule(
  'src/modules/arenas/components/ArenaPixSplitSettingsCard.tsx',
  { '@/modules/arenas/actions/arenaActions': actions },
)
const { ArenaAsaasDocumentList } = loadTypescriptModule('src/modules/arenas/components/ArenaAsaasDocumentsPanel.tsx')
const { parseAsaasDocumentGroups } = loadTypescriptModule('src/modules/arenas/domain/asaas-documents.ts')

const pending = {
  enabled: false,
  hasPaymentAccount: true,
  onboardingStarted: true,
  webhookConfigured: true,
  credentialRecoveryRequired: false,
  paymentFlow: 'arena_subaccount_split',
  asaasWalletId: '',
  asaasAccountId: '',
  holderName: 'Arena de teste',
  holderDocument: '',
  pixKey: '',
  status: 'pending',
  onboardingStatus: 'PENDING',
  commercialInfoStatus: 'APPROVED',
  bankAccountInfoStatus: 'PENDING',
  documentationStatus: 'PENDING',
  onboardingUrl: null,
  lastStatusCheckedAt: '2026-10-08T12:00:00.000Z',
  activatedAt: null,
  platformFeeBasisPoints: 200,
  updatedAt: '2026-10-08T12:00:00.000Z',
}

function render(overrides = {}, accessMode = 'arena') {
  return renderToStaticMarkup(React.createElement(ArenaPixSplitSettingsCard, {
    arenaId: '11111111-1111-4111-8111-111111111111',
    arenaName: 'Arena de teste',
    initialSettings: { ...pending, ...overrides },
    registration: {
      email: 'cadastro@arena.example', phone: '', document: '', address: '',
      addressNumber: '', complement: '', province: '', postalCode: '',
    },
    accessMode,
  }))
}

test('manager receives document guidance without exposing the redacted provider account ID', () => {
  const html = render()
  assert.ok(html.includes('link de envio'), 'The pending document guidance must be visible to the manager with a redacted account ID')
  assert.ok(!html.includes('Enviar documentos solicitados'), 'No hosted upload button may be invented without a provider URL')
})

test('platform onboarding badge does not claim BaaS habilitation merely from account creation', () => {
  const html = render({ asaasAccountId: 'account-test' }, 'platform')
  assert.ok(!html.includes('Subconta BaaS'), 'Account creation is not proof of BaaS homologation or habilitation')
})

test('manager can open a provider-issued onboarding link even when the provider account ID is redacted', () => {
  const html = render({ onboardingUrl: 'https://www.asaas.com/onboarding/test-only' })
  assert.ok(html.includes('Enviar documentos solicitados'))
  assert.ok(html.includes('href="https://www.asaas.com/onboarding/test-only"'))
  assert.ok(!html.includes('Não há um link de envio nesta consulta.'))
})

test('approved documents do not show the pending-without-link warning', () => {
  const html = render({ documentationStatus: 'APPROVED' })
  assert.ok(!html.includes('Não há um link de envio nesta consulta.'))
})

function renderDocuments(overrides = {}, disabled = false) {
  const [parsed] = parseAsaasDocumentGroups({ data: [{
    id: 'group-test', type: 'IDENTIFICATION', title: 'Documento solicitado de teste',
    status: 'NOT_SENT', description: 'Orientação de teste do Asaas.', onboardingUrl: null,
    ...overrides,
  }] })
  return renderToStaticMarkup(React.createElement(ArenaAsaasDocumentList, {
    arenaId: '11111111-1111-4111-8111-111111111111',
    groups: [{ ...parsed, ...(Object.hasOwn(overrides, 'attemptStatus') ? { attemptStatus: overrides.attemptStatus } : {}) }],
    disabled,
    onUploaded: async () => {},
  }))
}

test('an API-eligible document has a labeled file chooser and an initially disabled send button', () => {
  const html = renderDocuments()
  assert.ok(html.includes('Documento solicitado de teste'))
  assert.ok(html.includes('Não enviado'))
  assert.ok(html.includes('Orientação de teste do Asaas.'))
  assert.ok(html.includes('type="file"'))
  assert.ok(html.includes('accept="image/jpeg,image/png,application/pdf"'))
  assert.match(html, /<label[^>]*for="([^"]+)"[^>]*>Arquivo do documento<\/label>/u)
  assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""/u)
})

test('selfie file chooser presents only supported image formats', () => {
  const html = renderDocuments({ type: 'IDENTIFICATION_SELFIE' })
  assert.ok(html.includes('accept="image/jpeg,image/png"'))
  assert.ok(html.includes('JPG ou PNG'))
  assert.ok(!html.includes('application/pdf'))
})

test('hosted onboarding document offers the provider URL instead of a file chooser', () => {
  const html = renderDocuments({ onboardingUrl: 'https://www.asaas.com/onboarding/test-only' })
  assert.ok(html.includes('Enviar pelo Asaas'))
  assert.ok(html.includes('href="https://www.asaas.com/onboarding/test-only"'))
  assert.ok(html.includes('rel="noopener noreferrer"'))
  assert.ok(!html.includes('type="file"'))
})

for (const status of ['PENDING', 'AWAITING_APPROVAL']) {
  test(`a ${status} document is shown in analysis without another upload form`, () => {
    const html = renderDocuments({ status })
    assert.ok(html.includes('Em análise'))
    assert.ok(html.includes('Aguarde a análise do Asaas'))
    assert.ok(!html.includes('type="file"'))
  })
}

for (const status of ['APPROVED', 'IGNORED']) {
  test(`a ${status} document needs no further action`, () => {
    const html = renderDocuments({ status })
    assert.ok(html.includes('Nenhuma ação necessária'))
    assert.ok(!html.includes('type="file"'))
  })
}

for (const attemptStatus of ['processing', 'unknown']) {
  test(`a durable ${attemptStatus} attempt blocks another upload even when the provider still asks for the document`, () => {
    const html = renderDocuments({ attemptStatus })
    assert.ok(html.includes('role="status"'))
    assert.ok(html.includes('Atualize os documentos para conferir'))
    assert.ok(!html.includes('type="file"'))
  })
}

for (const attemptStatus of ['failed', 'submitted']) {
  test(`a new upload after ${attemptStatus} needs explicit retry confirmation`, () => {
    const html = renderDocuments({ status: 'REJECTED', attemptStatus })
    assert.ok(html.includes('type="checkbox"'))
    assert.ok(html.includes('Confirmo o reenvio'))
    assert.ok(html.includes('Reenviar documento'))
    assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""/u)
  })
}

test('unknown type or status shows support guidance and fails closed', () => {
  for (const overrides of [{ type: 'UNKNOWN_TYPE' }, { status: 'NEW_STATUS' }, { onboardingUrl: 'https://outside.example/' }]) {
    const html = renderDocuments(overrides)
    assert.ok(html.includes('suporte financeiro Asaas'))
    assert.ok(!html.includes('type="file"'))
    assert.ok(!html.includes('href="https://outside.example/"'))
  }
})

test('document descriptions are rendered as escaped text and busy state disables the fieldset', () => {
  const html = renderDocuments({ description: '<script>synthetic-test()</script>' }, true)
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>synthetic-test()'))
  assert.match(html, /<fieldset[^>]*disabled=""/u)
})
