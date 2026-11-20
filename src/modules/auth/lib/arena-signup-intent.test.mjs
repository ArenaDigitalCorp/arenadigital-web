import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ARENA_SIGNUP_INTENT_KEY,
  consumeArenaSignupIntentMetadata,
  createArenaSignupIntent,
  readArenaSignupIntent,
} from './arena-signup-intent.ts'

const validInput = {
  arenaName: ' Arena Centro ',
  arenaDocument: ' 12.345.678/0001-90 ',
  phone: ' (47) 99999-9999 ',
  cpf: ' 123.456.789-00 ',
  addressData: { id_municipio: 4209102, city: 'Joinville' },
}

test('round-trips the server-issued arena signup intent', () => {
  const intent = createArenaSignupIntent(validInput)
  const parsed = readArenaSignupIntent({ [ARENA_SIGNUP_INTENT_KEY]: intent })

  assert.equal(parsed?.arenaName, 'Arena Centro')
  assert.equal(parsed?.addressData.id_municipio, 4209102)
  assert.equal(parsed?.termsAcceptance, undefined)
})

test('retains the exact accepted version through a delayed callback and rejects malformed evidence', () => {
  const termsAcceptance = { version: '2026-11-20', acceptedAt: '2026-11-20T12:30:00.000Z' }
  const intent = createArenaSignupIntent({ ...validInput, termsAcceptance })
  assert.deepEqual(readArenaSignupIntent({ [ARENA_SIGNUP_INTENT_KEY]: intent }).termsAcceptance, termsAcceptance)
  for (const invalid of [true, {}, { version: termsAcceptance.version }, { ...termsAcceptance, acceptedAt: 'invalid' }]) {
    assert.equal(readArenaSignupIntent({ [ARENA_SIGNUP_INTENT_KEY]: { ...intent, termsAcceptance: invalid } }), null)
  }
})

test('does not treat mutable user metadata as an arena signup intent', () => {
  const parsed = readArenaSignupIntent({
    arenaName: 'Arena controlada pelo cliente',
    addressData: validInput.addressData,
  })

  assert.equal(parsed, null)
})

test('rejects malformed or unsupported intents', () => {
  assert.equal(
    readArenaSignupIntent({
      [ARENA_SIGNUP_INTENT_KEY]: { ...createArenaSignupIntent(validInput), version: 2 },
    }),
    null,
  )
  assert.equal(
    readArenaSignupIntent({
      [ARENA_SIGNUP_INTENT_KEY]: {
        ...createArenaSignupIntent(validInput),
        addressData: { city: 'Joinville' },
      },
    }),
    null,
  )
})

test('consumes only the provisioning intent and preserves provider metadata', () => {
  const metadata = consumeArenaSignupIntentMetadata({
    provider: 'email',
    [ARENA_SIGNUP_INTENT_KEY]: createArenaSignupIntent(validInput),
  })

  assert.deepEqual(metadata, { provider: 'email' })
})
