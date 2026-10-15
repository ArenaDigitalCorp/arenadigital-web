import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

const { agentConfigSchema } = loadTypescriptModule('src/modules/ai-agent/schemas/agent-config.schema.ts')

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements)
  return node && typeof node === 'object' ? [node, ...elements(node.props?.children)] : []
}

function harness() {
  const states = [], requests = [], errors = []
  let cursor = 0, tree
  const initialSettings = { channel: null, agent: {
    enabled: false, personaPrompt: null, fallbackMessage: null, monthlyTokenCap: null,
    model: 'fixture', temperature: 0.3, maxOutputTokens: 500,
  } }
  const { ArenaAiAgentSettingsCard } = loadTypescriptModule('src/modules/ai-agent/components/ArenaAiAgentSettingsCard.tsx', {
    react: { ...realReact, useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
    } },
    '@/modules/ai-agent/actions/agentActions': { async updateAgentConfigAction(arenaId, input) {
      assert.equal(agentConfigSchema.safeParse(input).success, true)
      requests.push({ arenaId, input })
      return { success: true, data: { ...initialSettings.agent, ...input } }
    } },
    sonner: { toast: { error: value => errors.push(value), success() {} } },
  })
  const render = () => { cursor = 0; tree = ArenaAiAgentSettingsCard({ arenaId: 'arena', initialSettings }); return tree }
  const input = () => elements(tree).find(node => node.props?.id === 'agent-cap')
  render()
  return { requests, errors, input,
    edit(value) { input().props.onChange({ target: { value } }); render() },
    submit() { return elements(tree).find(node => node.type === 'form' && elements(node).some(child => child.props?.id === 'agent-cap')).props.onSubmit({ preventDefault() {} }) },
  }
}

test('token cap preserves malformed text and rejects it before updating configuration', async () => {
  for (const raw of ['10,5', '10.5', '-500', '1e3', '12tokens', '2147483648', '9007199254740991', '9007199254740992', '0']) {
    const h = harness()
    h.edit(raw)
    assert.equal(h.input().props.value, raw, 'Typing must not invent another token limit')
    await h.submit()
    assert.equal(h.requests.length, 0, raw)
    assert.equal(h.errors.length, 1, raw)
  }
})

test('optional token cap keeps explicit complete integers and permits clearing it', async () => {
  for (const [raw, expected] of [['500000', 500000], [' 500 ', 500], ['0005', 5], ['2147483647', 2147483647], ['', null], [' ', null]]) {
    const h = harness()
    h.edit(raw)
    await h.submit()
    assert.equal(h.requests.length, 1, raw)
    assert.equal(h.requests[0].input.monthlyTokenCap, expected)
    assert.equal(h.errors.length, 0)
  }
})

test('server token cap validation matches the database integer range', () => {
  for (const monthlyTokenCap of [null, undefined, 1, 2_147_483_647]) {
    assert.equal(agentConfigSchema.safeParse({ monthlyTokenCap }).success, true)
  }
  for (const monthlyTokenCap of [0, -1, 1.5, 2_147_483_648, Number.MAX_SAFE_INTEGER, true, '500']) {
    assert.equal(agentConfigSchema.safeParse({ monthlyTokenCap }).success, false, String(monthlyTokenCap))
  }
})
