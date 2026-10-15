import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'
const doc = loadTypescriptModule('src/lib/brasil-document.ts')
const { maskEdit } = loadTypescriptModule('src/lib/masked-input-edit.ts')
const { parseBrazilianDecimal, formatDecimalInput } = loadTypescriptModule('src/lib/format.ts')
const { buildWhatsAppWebUrl } = loadTypescriptModule('src/lib/whatsapp-web.ts')

test('CPF preserves leading zeros, supports masks and rejects hidden letters', () => {
  assert.equal(doc.formatCpf('01234567890'), '012.345.678-90')
  assert.equal(doc.normalizeCpf('012.345.678-90'), '01234567890')
  assert.equal(doc.isValidCpf('529.982.247-25'), true)
  assert.equal(doc.isValidCpf('abc52998224725'), false)
  assert.equal(doc.isValidCpf('11111111111'), false)
})

test('numeric and official alphanumeric CNPJ vectors use verified checksums', () => {
  for (const value of ['26.472.629/0001-28', '00.000.000/E08G-12', '12.ABC.345/01DE-35']) {
    assert.equal(doc.isValidCnpj(value), true, value)
    assert.equal(doc.isValidCpfOrCnpj(value), true)
  }
  assert.equal(doc.normalizeCpfCnpj('12.abc.345/01de-35'), '12ABC34501DE35')
  assert.equal(doc.formatCnpj('12abc34501de35'), '12.ABC.345/01DE-35')
  assert.equal(doc.isValidCnpj('12ABC34501DE36'), false)
  assert.equal(doc.isValidCnpj('26@472629000128'), false)
  for (const value of ['12ß34501DE006', '12ı34501DE003', '12ſ34501DE003', '12ﬀ34501DE006']) {
    assert.equal(doc.isValidCnpj(value), false, value)
    assert.equal(doc.normalizeCpfCnpj(value), value, 'Unicode letters must not turn into other document characters')
  }
})

test('CEP is text and never discards leading zeros or overflow', () => {
  assert.equal(doc.formatCep('01001000'), '01001-000')
  assert.equal(doc.normalizeCep('01001-000'), '01001000')
  assert.equal(doc.isValidCep('01001-000'), true)
  assert.equal(doc.normalizeCep('88.037-395'), '88037395')
  assert.equal(doc.isValidCep('CEP01001000'), false)
  assert.equal(doc.maskCep('010010001'), '010010001')
})

test('phone canonicalization preserves Brazil area code 55 and explicit foreign codes', () => {
  const pairs = [
    ['(48) 99642-6091', '+5548996426091'],
    ['+55 48 99642-6091', '+5548996426091'],
    ['+55\u00a048\u202f99642\u20116091', '+5548996426091'],
    ['\u202a+55\u00a048\u00a099642\u20116091\u202c', '+5548996426091'],
    ['+ (55) 48 99642-6091', '+5548996426091'],
    ['5548996426091', '+5548996426091'],
    ['(55) 99999-1234', '+5555999991234'],
    ['(48) 3333-4444', '+554833334444'],
    ['+1 (202) 555-0123', '+12025550123'],
    ['+351 912 345 678', '+351912345678'],
  ]
  for (const [raw, expected] of pairs) {
    assert.equal(doc.normalizePhone(raw), expected, raw)
    assert.equal(doc.normalizePhone(expected), expected)
  }
  assert.equal(doc.formatPhone('+5548996426091'), '+55 (48) 99642-6091')
})

test('ambiguous, malformed or overflowing phone numbers are not silently repaired', () => {
  for (const value of ['996426091', '00996426091', '48996426091 ramal 2', '+554899642609199', '++5548996426091', '+12025550123456789', '+ 55 999999999', '+(55)999999999']) assert.equal(doc.normalizePhone(value), null, value)
  assert.equal(doc.formatPhone('legacy invalid'), 'legacy invalid')
  assert.equal(doc.maskPhone('+12025550123456789'), '+12025550123456789')
  assert.equal(doc.asaasDomesticPhone('+5548996426091'), '48996426091')
  assert.equal(doc.asaasDomesticPhone('+12025550123'), undefined)
})

test('displaying legacy or empty values never changes their meaning', () => {
  assert.equal(doc.formatCpf(null), '')
  assert.equal(doc.formatCpf('malformed'), 'malformed')
  assert.equal(doc.maskCpf('529982247251'), '529982247251')
  assert.equal(doc.maskCpf('529A98224725'), '529A98224725')
  assert.equal(doc.maskCpfCnpj('12ABC34501DE35'), '12.ABC.345/01DE-35')
  assert.equal(doc.normalizeEmail(' Gabriel.Example@Example.invalid '), 'gabriel.example@example.invalid')
})

test('mask editing preserves insertion position and selected-range replacements', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(maskEdit('1239456', 4, doc.maskCpf))), { value: '123.945.6', caret: 5 })
  assert.deepEqual(JSON.parse(JSON.stringify(maskEdit('123456', 3, doc.maskCpf, { value: '123.456', start: 4, end: 4, key: 'Backspace' }))), { value: '124.56', caret: 2 })
  assert.deepEqual(JSON.parse(JSON.stringify(maskEdit('123456', 3, doc.maskCpf, { value: '123.456', start: 3, end: 3, key: 'Delete' }))), { value: '123.56', caret: 3 })
  assert.equal(maskEdit('abc', 3, doc.maskCpf).value, 'abc')
})

test('BRL entry accepts locale grouping and decimal dot without multiplying amounts', () => {
  for (const [raw, expected] of [['12.50',12.5],['12,50',12.5],['1.234,56',1234.56],['R$ 1.234,56',1234.56],['1234',1234],['0,00',0],['-10,50',-10.5]]) assert.equal(parseBrazilianDecimal(raw), expected, raw)
  for (const raw of ['1.234', '12abc', '10,50foo', '1,234.56', '', '1e3', 'Infinity', '0.001']) assert.equal(parseBrazilianDecimal(raw), null, raw)
  assert.equal(formatDecimalInput(1234.56), '1.234,56')
  assert.equal(parseBrazilianDecimal(formatDecimalInput(1234.56)),1234.56)
})

test('WhatsApp uses the same canonical country code and rejects invalid destinations', () => {
  assert.equal(buildWhatsAppWebUrl('(48) 99642-6091', 'Olá'), 'https://wa.me/5548996426091?text=Ol%C3%A1')
  assert.equal(buildWhatsAppWebUrl('+1 (202) 555-0123', 'Test'), 'https://wa.me/12025550123?text=Test')
  assert.throws(() => buildWhatsAppWebUrl('not a phone', 'Test'), /Telefone inválido/)
})

test('Asaas adapter sends domestic DDD intact and preserves alphanumeric CNPJ', async () => {
  const { AsaasGateway } = loadTypescriptModule('src/modules/payments/gateway/asaas.gateway.ts')
  const requests = []
  const gateway = new AsaasGateway({ request: async (...args) => { requests.push(args); return { id: 'customer-test' } } })
  await gateway.createCustomer({ name: 'Example', email: ' Example@Example.invalid ', cpfCnpj: '12.ABC.345/01DE-35', phone: '+55 (48) 99642-6091', postalCode: '88.037-395' })
  assert.equal(requests[0][2].body.phone, '48996426091')
  assert.equal(requests[0][2].body.cpfCnpj, '12ABC34501DE35')
  assert.equal(requests[0][2].body.postalCode, '88037395')
  assert.equal(requests[0][2].body.email, 'example@example.invalid')
  await gateway.createCustomer({ email: 'example@example.invalid', cpfCnpj: '12ABC34501DE35', phone: '+12025550123' })
  assert.equal(requests[1][2].body.phone, undefined)
})

test('Stripe adapter receives E.164 while customer contact remains unchanged', async () => {
  const { StripeGateway } = loadTypescriptModule('src/modules/payments/gateway/stripe.gateway.ts')
  let sent
  const gateway = new StripeGateway({ customers: { create: async input => { sent = input; return { id: 'customer-test' } } } })
  await gateway.createCustomer({ email: ' Example@Example.invalid ', phone: '(48) 99642-6091' })
  assert.equal(sent.phone, '+5548996426091')
  assert.equal(sent.email, 'example@example.invalid')
})
