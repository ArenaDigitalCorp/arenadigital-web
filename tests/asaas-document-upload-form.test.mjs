import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact as React } from './helpers/load-typescript-module.mjs'

function findElement(tree, predicate) {
  if (!React.isValidElement(tree)) return null
  if (predicate(tree)) return tree
  for (const child of React.Children.toArray(tree.props.children)) {
    const found = findElement(child, predicate)
    if (found) return found
  }
  return null
}

// State storage is controlled; component code, React elements and event handlers are real.
function formHarness(responses, initialAttemptStatus = null) {
  const slots = []
  let cursor = 0
  let generatedIds = 0
  let refreshed = 0
  const requests = []
  const successes = []
  const group = {
    id: 'group-test', type: 'IDENTIFICATION', title: 'Documento de teste', status: 'NOT_SENT',
    description: null, onboardingUrl: null, canUpload: true,
    attemptStatus: initialAttemptStatus, allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  }
  const controlledReact = {
    ...React,
    useId: () => 'test-file-id',
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
  }
  const { ArenaAsaasDocumentList } = loadTypescriptModule('src/modules/arenas/components/ArenaAsaasDocumentsPanel.tsx', {
    react: controlledReact,
    sonner: { toast: { success: message => successes.push(message) } },
  }, {
    crypto: { randomUUID: () => `22222222-2222-4222-8222-${String(++generatedIds).padStart(12, '0')}` },
    fetch: async (_url, options) => {
      requests.push(options.body)
      const response = responses.shift()
      if (!response) throw new Error('Unexpected extra upload')
      return Response.json(response.body, { status: response.status })
    },
  })

  function render() {
    const list = ArenaAsaasDocumentList({ arenaId: 'arena-test', groups: [group], disabled: false,
      onUploaded: async () => { refreshed++; if (!successes.length) group.attemptStatus = 'failed' },
    })
    const element = findElement(list, candidate => typeof candidate.type === 'function' && candidate.type.name === 'DocumentUploadForm')
    assert.ok(element, 'Eligible document must contain its real upload form')
    cursor = 0
    return element.type(element.props)
  }
  return {
    render, requests, successes, group,
    get generatedIds() { return generatedIds },
    get refreshed() { return refreshed },
    fileInput: tree => findElement(tree, element => element.props.type === 'file'),
    retryCheckbox: tree => findElement(tree, element => element.props.type === 'checkbox'),
    submitButton: tree => findElement(tree, element => element.props.type === 'submit'),
    submit: tree => tree.props.onSubmit({ preventDefault() {} }),
  }
}

const failed = { status: 422, body: { success: false, error: 'Arquivo rejeitado no teste.', data: { status: 'failed' } } }
const submitted = { status: 200, body: { success: true, data: { status: 'submitted' } } }
const syntheticFile = () => new File(['%PDF-synthetic-test-only'], 'synthetic-test.pdf', { type: 'application/pdf' })

test('manual resend after a failed upload creates a new operation ID while preserving the selected file', async () => {
  const h = formHarness([failed, submitted])
  let tree = h.render()
  h.fileInput(tree).props.onChange({ target: { files: [syntheticFile()] } })
  tree = h.render()
  assert.equal(h.submitButton(tree).props.disabled, false)
  await h.submit(tree)
  assert.equal(h.requests.length, 1)
  assert.equal(h.requests[0].get('explicitRetry'), 'false')

  tree = h.render()
  assert.equal(h.retryCheckbox(tree).props.checked, false)
  assert.equal(h.submitButton(tree).props.disabled, true)
  assert.ok(findElement(tree, element => element.props.role === 'alert'))
  h.retryCheckbox(tree).props.onChange({ target: { checked: true } })
  tree = h.render()
  assert.equal(h.submitButton(tree).props.disabled, false)
  await h.submit(tree)

  assert.equal(h.requests.length, 2)
  assert.notEqual(h.requests[0].get('requestId'), h.requests[1].get('requestId'))
  assert.equal(h.requests[1].get('explicitRetry'), 'true')
  assert.equal(await h.requests[0].get('documentFile').text(), await h.requests[1].get('documentFile').text())
  assert.equal(h.successes.length, 1)
  assert.equal(h.refreshed, 2)
  assert.equal(h.submitButton(h.render()).props.disabled, true)
})

test('each subsequent rejection clears resend consent and requires another manual operation ID', async () => {
  const h = formHarness([failed, failed, submitted])
  h.fileInput(h.render()).props.onChange({ target: { files: [syntheticFile()] } })
  await h.submit(h.render())
  for (let index = 0; index < 2; index++) {
    let tree = h.render()
    assert.equal(h.retryCheckbox(tree).props.checked, false)
    assert.equal(h.submitButton(tree).props.disabled, true)
    await h.submit(tree)
    assert.equal(h.requests.length, index + 1, 'Unchecked consent must prevent another upload')
    h.retryCheckbox(tree).props.onChange({ target: { checked: true } })
    tree = h.render()
    await h.submit(tree)
  }
  assert.equal(new Set(h.requests.map(body => body.get('requestId'))).size, 3)
  assert.deepEqual(h.requests.map(body => body.get('explicitRetry')), ['false', 'true', 'true'])
  assert.equal(h.successes.length, 1)
})

test('checking retry without a selected file does not create or send a new operation', async () => {
  const h = formHarness([], 'failed')
  let tree = h.render()
  h.retryCheckbox(tree).props.onChange({ target: { checked: true } })
  tree = h.render()
  await h.submit(tree)
  assert.equal(h.generatedIds, 0)
  assert.equal(h.requests.length, 0)
  h.fileInput(tree).props.onChange({ target: { files: [syntheticFile()] } })
  tree = h.render()
  assert.equal(h.retryCheckbox(tree).props.checked, false)
  assert.equal(h.submitButton(tree).props.disabled, true)
  assert.equal(h.generatedIds, 1)
})
