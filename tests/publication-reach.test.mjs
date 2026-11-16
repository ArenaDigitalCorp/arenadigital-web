import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs';
const { arenaPromotionActionSchema, openGameActionSchema } = loadTypescriptModule('src/modules/mobile-content/schemas/mobile-content-action.schema.ts');
for (const [name, schema, fixture] of [
 ['horário', arenaPromotionActionSchema, { title:'Horário livre' }],
 ['jogo', openGameActionSchema, { sport_id:'f9200000-0000-4000-8000-000000000001',owner_atleta_id:'f9200000-0000-4000-8000-000000000002', date:'2026-12-01',start_time:'19:00',end_time:'20:00' }],
]) {
 test(`${name}: preserves reach, accepts endpoints and rejects invalid reach`, () => {
  for(const reach_km of [0,15,30]) assert.equal(schema.parse({...fixture,reach_km}).reach_km,reach_km);
  for(const reach_km of [-1,31,1.5,'30',null]) assert.equal(schema.safeParse({...fixture,reach_km}).success,false);
  assert.equal(schema.parse(fixture).reach_km,undefined,'Old editors do not overwrite stored reach');
 });
}
