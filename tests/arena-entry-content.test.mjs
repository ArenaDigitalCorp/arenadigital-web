import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

function collect(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(item => collect(item, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...collect(node.props?.children, predicate)]
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ')
  if (!node || typeof node !== 'object') return String(node ?? '')
  return text(node.props?.children)
}
test('arena highlights explain automatic entry and no longer offer manual publication controls', () => {
  const states = []; let cursor = 0
  const { MobileContentPageClient } = loadTypescriptModule('src/modules/mobile-content/components/MobileContentPageClient.tsx', {
    react: { ...realReact, useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = initial
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
    }, useTransition: () => [false, fn => fn()] },
    '@/modules/mobile-content/actions/mobileContentActions': {},
  })
  const props = { arenaId: 'arena', arenaName: 'Test', courts: [], sports: [], athletes: [], initialPromotions: [], initialOpenGames: [] }
  const render = () => { cursor = 0; return MobileContentPageClient(props) }
  const tabs = collect(render(), node => node.type?.name === 'DashboardTabs')[0]
  tabs.props.onChange('highlights')
  const node = render()
  assert.match(text(node), /Destaque automático de nova arena/)
  assert.match(text(node), /ativas e visíveis no app/)
  assert.match(text(node), /não tem prazo de expiração/)
  assert.equal(collect(node, node => node.type === 'form').length, 0)
  assert.equal(collect(node, node => node.type === 'input').length, 0)
})
