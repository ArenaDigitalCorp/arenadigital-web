import test from 'node:test'
import assert from 'node:assert/strict'
import { gamePublicationCopy, updateGamePublicationDescription } from '../src/modules/publications/game-notes.ts'
const prefix = '[arena-gamematch:v1]'
const metadata = { version: 1, title: 'Bora jogar', category: 'Livre', chatEnabled: true, createdAt: '2026-11-16T12:00:00Z', expiresAt: '2026-11-17T12:00:00Z', description: null, futureField: { keep: true } }

test('app game metadata is displayed as readable title and description only', () => {
  assert.deepEqual(gamePublicationCopy(prefix + JSON.stringify(metadata)), { title: 'Bora jogar', description: '' })
  assert.deepEqual(gamePublicationCopy(prefix + JSON.stringify(metadata) + '\nTraga sua bola'), { title: 'Bora jogar', description: 'Traga sua bola' })
  assert.deepEqual(gamePublicationCopy('  Jogo amistoso  '), { title: '', description: 'Jogo amistoso' })
  assert.deepEqual(gamePublicationCopy(prefix + '{broken'), { title: '', description: '' })
})
test('editing the visible description preserves game settings and unknown metadata', () => {
  const original = prefix + JSON.stringify(metadata)
  const result = updateGamePublicationDescription(original, ' Novo texto ')
  assert.deepEqual(JSON.parse(result.slice(prefix.length).split('\n')[0]), { ...metadata, description: 'Novo texto' })
  assert.equal(gamePublicationCopy(result).description, 'Novo texto')
  assert.equal(updateGamePublicationDescription(original, ''), original)
  assert.equal(updateGamePublicationDescription('Texto simples', ''), null)
  assert.throws(() => updateGamePublicationDescription(prefix + '{broken', 'Novo'), /Não foi possível atualizar/)
})
