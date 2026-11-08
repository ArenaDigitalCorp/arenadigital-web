import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTypescriptModule, realReact } from './helpers/load-typescript-module.mjs'

const { ArenaCancellationPolicyCard } = loadTypescriptModule('src/modules/arenas/components/ArenaCancellationPolicyCard.tsx', {
  '@/modules/arenas/actions/cancellationPolicyActions': {},
})

function render(tiers) {
  const currentPolicy = { id: 'published', version: 1, publishedAt: '2026-11-08T12:00:00.000Z', tiers }
  return renderToStaticMarkup(realReact.createElement(ArenaCancellationPolicyCard, {
    arenaId: 'arena',
    initialSettings: { currentPolicy, draftPolicy: null, publishedVersions: [currentPolicy] },
  }))
}

test('published refund ranges display nonoverlapping intervals, including the implicit fallback', () => {
  const html = render([
    { minimumHoursBeforeStart: 4, refundPercentage: 50 },
    { minimumHoursBeforeStart: 0, refundPercentage: 0 },
    { minimumHoursBeforeStart: 24, refundPercentage: 100 },
  ])
  assert.match(html, /24h ou mais antes do início<\/p><p[^>]*>100% de reembolso/)
  assert.match(html, /De 4h até menos de 24h antes do início<\/p><p[^>]*>50% de reembolso/)
  assert.match(html, /Menos de 4h: sem reembolso/)
  assert.doesNotMatch(html, />4h ou mais/)
})

test('a legacy explicit zero-hour refund has a bounded interval without an implicit zero refund', () => {
  const html = render([
    { minimumHoursBeforeStart: 0, refundPercentage: 25 },
    { minimumHoursBeforeStart: 4, refundPercentage: 100 },
  ])
  assert.match(html, /4h ou mais antes do início<\/p><p[^>]*>100% de reembolso/)
  assert.match(html, /Menos de 4h antes do início<\/p><p[^>]*>25% de reembolso/)
  assert.doesNotMatch(html, /sem reembolso/)
})

test('a sole explicit zero-hour rule covers the period before the booking without an invented upper boundary', () => {
  const html = render([{ minimumHoursBeforeStart: 0, refundPercentage: 50 }])
  assert.match(html, /Até o início da reserva<\/p><p[^>]*>50% de reembolso/)
  assert.doesNotMatch(html, /Menos de|De 0h|sem reembolso/)
})
