import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  STATION_STATUSES,
  STATION_STATUS_OPTIONS,
  isStationStatus,
  stationStatusLabel,
} from '../src/modules/stations/station-status.ts'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

test('status de estação segue a constraint stations_status_check', () => {
  assert.deepEqual([...STATION_STATUSES].sort(), ['Em manutenção', 'ativo', 'inativo'])
  assert.equal(isStationStatus('Desativado'), false)
  assert.deepEqual(
    STATION_STATUS_OPTIONS.map((o) => [o.value, o.label]),
    [['ativo', 'Ativo'], ['Em manutenção', 'Em manutenção'], ['inativo', 'Desativado']],
  )
  assert.equal(stationStatusLabel('inativo'), 'Desativado')
})

test('formulário e actions de estação não enviam status fora da constraint', async () => {
  const [form, actions] = await Promise.all([
    source('src/modules/stations/components/StationForm.tsx'),
    source('src/modules/stations/actions/stationActions.ts'),
  ])
  assert.doesNotMatch(form, /value="Desativado"/)
  assert.match(form, /z\.enum\(STATION_STATUSES\)/)
  assert.equal((actions.match(/isStationStatus\(input\.status\)/g) ?? []).length, 2)
})
