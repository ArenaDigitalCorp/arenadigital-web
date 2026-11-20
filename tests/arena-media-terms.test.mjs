import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTypescriptModule } from './helpers/load-typescript-module.mjs'

const arenaId = 'b4000000-0000-4000-8000-000000000001'
const spaceId = 'b4000000-0000-4000-8000-000000000002'
const { ARENA_TERMS_VERSION: version } = loadTypescriptModule('src/modules/terms/arena-terms.ts')

test('somente o aceite expresso da versão exibida vai ao RPC da sessão', async () => {
    const calls = []
    const accepted = { version, is_owner: true, accepted_at: '2026-11-20T12:00:00Z', receipts: [] }
    const { acceptArenaTerms } = loadTypescriptModule('src/modules/terms/arena-terms-actions.ts', {
        '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ rpc: async (name, args) => {
            calls.push({ name, ...args })
            return { data: accepted, error: null }
        } }) },
    })
    assert.ok((await acceptArenaTerms(arenaId, version, false)).error)
    assert.ok((await acceptArenaTerms(arenaId, 'old', true)).error)
    assert.equal(calls.length, 0)
    assert.equal((await acceptArenaTerms(arenaId, version, true)).data, accepted)
    assert.deepEqual(calls, [{ name: 'accept_arena_terms', p_arena_id: arenaId, p_version: version }])
})

test('erro na consulta ou recusa do banco não vira aceite', async () => {
    const { getArenaTermsStatus, acceptArenaTerms } = loadTypescriptModule('src/modules/terms/arena-terms-actions.ts', {
        '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ rpc: async () => ({ data: null, error: { code: '42501' } }) }) },
    })
    await assert.rejects(getArenaTermsStatus(arenaId), /consultar/)
    assert.ok((await acceptArenaTerms(arenaId, version, true)).error)
})

test('publicação do banner e da foto do espaço exige aceite da arena antes de chegar ao storage', async () => {
    const writes = []
    const checks = []
    let acceptedAt = null
    const { POST } = loadTypescriptModule('src/app/api/upload/route.ts', {
        '@/lib/server-auth': { assertArenaResourceAccess: async () => {}, assertCourtAccess: async () => {}, AuthorizationError: Error },
        '@/modules/terms/arena-terms-actions': { getArenaTermsStatus: async id => {
            checks.push(id)
            return { accepted_at: acceptedAt }
        } },
        '@/lib/r2Client': {
            arenaBannerKey: () => 'banner.jpg', spaceImageKey: () => 'space.jpg',
            uploadToR2: async (_bytes, key) => { writes.push(key); return 'https://example.com/' + key },
        },
    })
    async function upload(type) {
        const body = new FormData()
        body.set('type', type)
        body.set('arenaId', arenaId)
        if (type === 'space') body.set('spaceId', spaceId)
        body.set('file', new File([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])], 'quadra.jpg', { type: 'image/jpeg' }))
        return POST(new Request('https://example.com/api/upload', { method: 'POST', body }))
    }
    for (const type of ['space', 'banner']) assert.equal((await upload(type)).status, 403)
    assert.deepEqual(writes, [])
    acceptedAt = '2026-11-20T12:00:00Z'
    for (const type of ['banner', 'space']) assert.equal((await upload(type)).status, 200)
    assert.deepEqual(writes, ['banner.jpg', 'space.jpg'])
    assert.deepEqual(checks, [arenaId, arenaId, arenaId, arenaId])
})


test('titular pode revisar e consultar os termos sem sair da tela permitida pelo plano expirado', () => {
    const arena = { id: arenaId, name: 'Arena Exemplo', isOwner: true }
    const status = { is_owner: true, version, accepted_at: null }
    const { ArenaTermsNotice } = loadTypescriptModule('src/modules/terms/ArenaTermsNotice.tsx', {
        'next/navigation': { usePathname: () => '/dashboard/settings/subscription/' + arenaId },
        '@/contexts/ArenaContext': { useArena: () => ({ selectedArenaDetails: arena }) },
        './use-arena-terms': { useArenaTerms: () => ({ data: status }) },
        './ArenaTermsPanel': { ArenaTermsPanel: () => createElement('div', null, 'Painel de aceite') },
    })
    const render = () => renderToStaticMarkup(createElement(ArenaTermsNotice))
    assert.match(render(), /Revisar termos/)
    assert.match(render(), /Painel de aceite/)
    status.accepted_at = '2026-11-20T12:00:00Z'
    assert.match(render(), /Consultar comprovantes/)
    arena.isOwner = false
    assert.equal(render(), '')
})
