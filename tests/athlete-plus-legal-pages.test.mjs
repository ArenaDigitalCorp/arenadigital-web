import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [terms, privacy] = await Promise.all([
  readFile(new URL('../src/app/termos-de-uso/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/politica-de-privacidade/page.tsx', import.meta.url), 'utf8'),
])

test('athlete subscription terms disclose store billing, renewal and cancellation', () => {
  assert.match(terms, /Assinatura Arena Digital Plus no aplicativo/u)
  assert.match(terms, /Apple App Store ou Google Play/u)
  assert.match(terms, /renovação automática mensal/u)
  assert.match(terms, /cancelamento são realizados nas configurações de assinaturas/u)
  assert.match(terms, /exclusão da conta Arena Digital não substitui o cancelamento/u)
  assert.match(terms, /contato@arenadigital\.app/u)
  assert.doesNotMatch(terms, /seuemail@arena\.com/u)
})

test('privacy policy identifies the native subscription metadata received from stores', () => {
  assert.match(privacy, /Apple App Store e Google Play/u)
  assert.match(privacy, /identificadores de produto, compra, transação e assinatura/u)
})
