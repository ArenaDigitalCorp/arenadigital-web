import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesAsaasSubaccountOwnership } from '../src/modules/arenas/services/asaas-subaccount-ownership.ts'

const expected = { accountId: 'acc_123', walletId: 'wal_123', cpfCnpj: '11.222.333/0001-81' }
const remote = { id: 'acc_123', walletId: 'wal_123', cpfCnpj: '11222333000181' }

test('manual reconciliation requires matching account, wallet and full document', () => {
  assert.equal(matchesAsaasSubaccountOwnership(remote, expected), true)
  assert.equal(matchesAsaasSubaccountOwnership({ ...remote, id: 'acc_other' }, expected), false)
  assert.equal(matchesAsaasSubaccountOwnership({ ...remote, walletId: 'wal_other' }, expected), false)
  assert.equal(matchesAsaasSubaccountOwnership({ ...remote, cpfCnpj: '11222333000182' }, expected), false)
  assert.equal(matchesAsaasSubaccountOwnership({ ...remote, cpfCnpj: null }, expected), false)
})
