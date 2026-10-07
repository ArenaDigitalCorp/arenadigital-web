import assert from 'node:assert/strict'
import test from 'node:test'
import { sportInputSchema, levelInputSchema, sportSchema } from '../src/modules/sport-catalog/schema.ts'
const sport = { id: null, name: 'Pilates', category: 'sport', is_active: true, requires_level: true, reason: 'Configuração de modalidade' }
test('catalog preserves explicit level requirement and validates classification', () => {
  assert.equal(sportInputSchema.parse(sport).requires_level, true)
  assert.equal(sportInputSchema.safeParse({ ...sport, category: 'unknown' }).success, false)
  assert.equal(sportInputSchema.safeParse({ ...sport, requires_level: undefined }).success, false)
})
test('catalog allows reversible deactivation and configured optional levels', () => {
  const result = sportInputSchema.parse({ ...sport, name: '  Atividade teste  ', is_active: false, requires_level: false })
  assert.equal(result.name, 'Atividade teste')
  assert.equal(result.is_active, false)
  assert.equal(result.requires_level, false)
})
test('catalog edits require a meaningful reason', () => {
  assert.equal(sportInputSchema.safeParse({ ...sport, reason: 'curta' }).success, false)
  assert.equal(sportInputSchema.safeParse({ ...sport, reason: ' '.repeat(20) }).success, false)
})
test('level payload validates sport reference and display order', () => {
  const level = { id: null, sport_id: '61006150-0000-4000-8000-000000000001', name: 'Nível teste', is_active: true, sort_order: 0, reason: 'Cadastro de nível teste' }
  assert.equal(levelInputSchema.safeParse(level).success, true)
  assert.equal(levelInputSchema.safeParse({ ...level, sort_order: -1 }).success, false)
  assert.equal(levelInputSchema.safeParse({ ...level, sport_id: 'invalid' }).success, false)
})
test('catalog response supports a pending modality without fabricated levels', () => {
  const parsed = sportSchema.parse({ ...sport, id: 'cd9fd5a0-b8d3-428b-8e8f-cde03684cf9f', levels: [] })
  assert.deepEqual(parsed.levels, [])
  assert.equal(parsed.requires_level, true)
})
