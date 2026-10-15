import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const { athleteFormSchema, linkAthleteSchema } = loadTypescriptModule('src/modules/athletes/schemas/athlete.schema.ts')
const { registerCustomerSchema } = loadTypescriptModule('src/modules/stations/schemas/customer.schema.ts')
const { arenaSchema, arenaUpdateSchema } = loadTypescriptModule('src/modules/arenas/schemas/arena.schema.ts')
const { publicArenaListingInputSchema } = loadTypescriptModule('src/modules/platform-admin/schemas/public-arena-listing.schema.ts')
const contact = { cpf: '529.982.247-25', phone: '(48) 99642-6091', email: '  Contact@Example.COM ', cep: '88037-395' }

test('athlete and arena writes canonicalize the same contacts and retain optional fields', () => {
  const athlete = athleteFormSchema.parse({ ...contact, name: 'Teste', sport: 'tennis' })
  assert.equal(athlete.cpf, '52998224725')
  assert.equal(athlete.phone, '+5548996426091')
  assert.equal(athlete.email, 'contact@example.com')
  assert.equal(athlete.cep, '88037395')
  const arena = arenaSchema.parse({ name: 'Teste', status: 'ativo', address: 'Rua Teste', id_municipio: 4205407,
    cpf_cnpj: '26.472.629/0001-28', legal_name: 'Empresa Ltda', phone: contact.phone, email: contact.email, zip_code: contact.cep })
  assert.equal(arena.cpf_cnpj, '26472629000128')
  assert.equal(arena.phone, athlete.phone)
  assert.equal(arena.zip_code, athlete.cep)
  assert.deepEqual(Object.keys(arenaUpdateSchema.parse({ name: 'Outra' })), ['name'])
  assert.equal(registerCustomerSchema.parse({ name: 'Teste' }).cpf, undefined)
})

test('invalid characters, excess digits and partial contacts are rejected rather than silently shortened', () => {
  for (const cpf of ['529982247250', 'ABC52998224725']) {
    assert.equal(registerCustomerSchema.safeParse({ name: 'Teste', cpf }).success, false)
  }
  for (const phone of ['(48) 99642-60912', '4899', 'abc48996426091', '+554899642609100000']) {
    assert.equal(registerCustomerSchema.safeParse({ name: 'Teste', phone }).success, false)
  }
  for (const cep of ['880373950', 'ABC88037395']) {
    assert.equal(athleteFormSchema.safeParse({ ...contact, name: 'Teste', sport: 'tennis', cep }).success, false)
  }
})

test('international numbers remain international and public listings use the same canonical values', () => {
  const input = { name: 'Arena', address: 'Rua Teste', stateCode: 42, municipalityId: 4205407,
    sportIds: ['f97a5110-f96f-4686-966f-6908033251b3'], reason: 'Cadastro manual teste',
    phone: '+1 (415) 555-2671', email: contact.email, zipCode: contact.cep }
  const listing = publicArenaListingInputSchema.parse(input)
  assert.equal(listing.phone, '+14155552671')
  assert.equal(listing.email, 'contact@example.com')
  assert.equal(listing.zipCode, '88037395')
  assert.equal(linkAthleteSchema.parse({ ...contact, name: 'Teste', arenaId: 'arena', sportId: 'tennis', phone: input.phone }).phone, listing.phone)
})

test('station customer server action validates and canonicalizes before writing', async () => {
  let inserted
  const { createCustomerAction } = loadTypescriptModule('src/modules/stations/actions/orderActions.ts', {
    '@/lib/supabase-server': { getSupabaseAdmin: () => ({ from: () => ({ insert: rows => {
      inserted = rows[0]
      return { select: () => ({ single: async () => ({ data: rows[0], error: null }) }) }
    } }) }) },
    '@/lib/server-auth': { assertArenaAccess: async () => {} },
    '@/modules/arenas/usecases/get-arena-billing-address.usecase': {},
  })
  const valid = await createCustomerAction('arena', { name: ' Teste ', cpf: contact.cpf, phone: contact.phone, email: contact.email })
  assert.equal(valid.success, true)
  assert.equal(inserted.cpf, '52998224725')
  assert.equal(inserted.phone, '+5548996426091')
  assert.equal(inserted.email, 'contact@example.com')
  inserted = undefined
  const invalid = await createCustomerAction('arena', { name: 'Teste', cpf: 'invalid' })
  assert.equal(invalid.success, false)
  assert.equal(inserted, undefined)
})

test('Asaas accepts stored +55 without changing the DDD or truncating international numbers', () => {
  const { createArenaAsaasSubaccountSchema: schema, normalizeAsaasSubaccountInput: normalize } = loadTypescriptModule('src/modules/arenas/schemas/asaas-baas.schema.ts')
  const input = { name: 'Empresa Ltda', email: contact.email, cpfCnpj: '26.472.629/0001-28', companyType: 'LIMITED',
    mobilePhone: '+55 (48) 99642-6091', incomeValue: 1000, address: 'Rua Teste', addressNumber: 'S/N', province: 'Centro', postalCode: contact.cep }
  const result = normalize(schema.parse(input))
  assert.equal(result.mobilePhone, '48996426091')
  assert.equal(result.cpfCnpj, '26472629000128')
  assert.equal(result.postalCode, '88037395')
  assert.equal(schema.safeParse({ ...input, mobilePhone: '+14155552671' }).success, false)
})

test('Pix keys normalize according to their selected type and reject mismatches', () => {
  const { normalizePixKey } = loadTypescriptModule('src/modules/finance/lib/pix-key.ts')
  assert.equal(normalizePixKey('CPF', contact.cpf), '52998224725')
  assert.equal(normalizePixKey('CNPJ', '26.472.629/0001-28'), '26472629000128')
  assert.equal(normalizePixKey('PHONE', contact.phone), '+5548996426091')
  assert.equal(normalizePixKey('EMAIL', contact.email), 'contact@example.com')
  assert.equal(normalizePixKey('EVP', '11111111-1111-4111-8111-111111111111'), '11111111-1111-4111-8111-111111111111')
  for (const [type, value] of [['CPF', '123'], ['CNPJ', contact.cpf], ['PHONE', '+14155552671'], ['EVP', contact.email], ['EMAIL', 'abc']]) {
    assert.equal(normalizePixKey(type, value), null)
  }
})

test('decimal field formats complete values on blur and leaves invalid pasted text visible', () => {
  const { DecimalInput } = loadTypescriptModule('src/components/ui/decimal-input.tsx')
  let changed
  const element = DecimalInput({ onChange: event => { changed = event.target.value } })
  const target = { value: '1234.56' }
  element.props.onBlur({ currentTarget: target, target })
  assert.equal(changed, '1.234,56')
  changed = undefined
  target.value = '12oops'
  element.props.onBlur({ currentTarget: target, target })
  assert.equal(changed, undefined)
  assert.equal(target.value, '12oops')
})
