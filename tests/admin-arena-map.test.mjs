import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin arena coverage uses a real geographic map instead of an illustrative Brazil SVG', async () => {
  const [section, map] = await Promise.all([
    source('src/modules/super-admin/components/sections/ArenasSection.tsx'),
    source('src/modules/platform-admin/components/ArenaCoverageMap.tsx'),
  ])

  assert.match(section, /<ArenaCoverageMap arenas=\{mappedArenas\}/u)
  assert.match(section, /Localização real pelas coordenadas cadastradas/u)
  assert.doesNotMatch(section, /<svg|Brasil em construção|\/ 40\) \* 100/u)
  assert.match(map, /import\("leaflet"\)/u)
  assert.match(map, /leaflet\.latLng\(arena\.latitude, arena\.longitude\)/u)
  assert.match(map, /map\.fitBounds\(bounds/u)
})

test('map markers are safe, navigable and visibly attributed', async () => {
  const map = await source('src/modules/platform-admin/components/ArenaCoverageMap.tsx')

  assert.match(map, /title\.textContent = arena\.name/u)
  assert.match(map, /router\.push\(`\/admin\/arenas\/\$\{arena\.id\}`\)/u)
  assert.match(map, /https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/u)
  assert.match(map, /OpenStreetMap<\/a> contributors/u)
  assert.doesNotMatch(map, /innerHTML/u)
})
