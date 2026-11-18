'use server'

import { assertStationAccess } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'

// An operator can sell the items at their station without opening the arena's catalog.
export async function getStationSaleProducts(arenaId: string, stationId: string) {
    await assertStationAccess(stationId, arenaId)
    const client = getSupabaseAdmin()
    const station = await client.from('stations').select('station_type_id')
        .eq('arena_id', arenaId).eq('id', stationId).single()
    if (station.error) throw new Error('Não foi possível consultar a estação.')
    const { data, error } = await client.from('products')
        .select('id,name,item_type,catalog_kind,status,station_id,station_type_id,price,stock_quantity')
        .eq('arena_id', arenaId).order('name')
    if (error) throw new Error('Não foi possível carregar os itens da estação.')
    return data.filter(item => {
        if (item.station_id) return item.station_id === stationId
        return item.catalog_kind === 'service' || !station.data.station_type_id || item.station_type_id === station.data.station_type_id
    })
}

export async function searchStationCustomers(arenaId: string, stationId: string, search: string) {
    await assertStationAccess(stationId, arenaId)
    const term = search.trim().slice(0, 100)
    if (term.length < 2) return []
    const pattern = '%' + term.replace(/[\\%_]/g, '\\$&') + '%'
    const client = getSupabaseAdmin()
    const [customers, athletes] = await Promise.all([
        client.from('station_customers').select('id,name').eq('arena_id', arenaId)
            .ilike('name', pattern).order('name').limit(30),
        client.from('atleta').select('id,nome_perfil,arenas_atleta!inner(id_arena)')
            .eq('arenas_atleta.id_arena', arenaId).ilike('nome_perfil', pattern).order('nome_perfil').limit(30),
    ])
    if (customers.error || athletes.error) throw new Error('Não foi possível buscar clientes desta estação.')
    return [
        ...customers.data.map(row => ({ id: 'customer:' + row.id, name: row.name, origin: 'station' })),
        ...athletes.data.map(row => ({ id: 'athlete:' + row.id, name: row.nome_perfil, origin: 'athlete' })),
    ]
}
