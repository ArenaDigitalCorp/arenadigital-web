/* eslint-disable @typescript-eslint/no-explicit-any -- court_price_table* não estão nos tipos gerados (mesmo padrão de priceTableActions) */

/**
 * Cópia das tabelas de preço de um espaço para outro (usada pelo "Copiar" do
 * espaço).
 *
 * Ao inserir um `courts`, o trigger `courts_seed_price_tables` do banco semeia
 * as três tabelas permanentes: a Padrão traduzida de `day_config` e a
 * Mensalista/Professor **vazias**. Numa cópia isso perde tudo que o gestor
 * configurou — as faixas de Mensalista/Professor, as tabelas personalizadas, os
 * nomes renomeados e qual delas é a padrão. Aqui as sementes do destino são
 * descartadas e as tabelas da origem reinseridas na íntegra.
 *
 * Não é atômico (a RPC transacional é da Fase 2b): a leitura da origem acontece
 * inteira antes do delete, então uma falha de rede derruba a operação antes de
 * mexer no destino.
 */

type LooseClient = {
  from: (table: string) => any
}

type SourceTable = {
  id: string
  nome: string
  tipo: string
  is_default: boolean
  aplica_a: string[] | null
  ativo: boolean
  ordem: number
}

type SourceDay = {
  id: string
  price_table_id: string
  dia_semana: number
  habilitado: boolean
  hora_inicio: string
  hora_fim: string
  slot_shift_time: string | null
  preco_base: number | string
}

type SourceBand = {
  price_table_day_id: string
  hora_inicio: string
  hora_fim: string
  preco: number | string
  ordem: number
}

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const row of rows) {
    const list = map.get(key(row)) ?? []
    list.push(row)
    map.set(key(row), list)
  }
  return map
}

export async function clonePriceTablesToCourt(
  supabase: LooseClient,
  arenaId: string,
  sourceCourtId: string,
  targetCourtId: string,
): Promise<void> {
  const { data: tables, error: tablesError } = await supabase
    .from('court_price_tables')
    .select('id, nome, tipo, is_default, aplica_a, ativo, ordem')
    .eq('court_id', sourceCourtId)
    .eq('arena_id', arenaId)
    .order('ordem', { ascending: true })
  if (tablesError) throw new Error(tablesError.message)

  const tableRows = (tables ?? []) as SourceTable[]
  // Sem tabelas na origem não há o que copiar — as sementes do destino ficam.
  if (tableRows.length === 0) return

  const { data: days, error: daysError } = await supabase
    .from('court_price_table_days')
    .select('id, price_table_id, dia_semana, habilitado, hora_inicio, hora_fim, slot_shift_time, preco_base')
    .in('price_table_id', tableRows.map((t) => t.id))
  if (daysError) throw new Error(daysError.message)
  const dayRows = (days ?? []) as SourceDay[]

  let bandRows: SourceBand[] = []
  if (dayRows.length > 0) {
    const { data: bands, error: bandsError } = await supabase
      .from('court_price_table_bands')
      .select('price_table_day_id, hora_inicio, hora_fim, preco, ordem')
      .in('price_table_day_id', dayRows.map((d) => d.id))
    if (bandsError) throw new Error(bandsError.message)
    bandRows = (bands ?? []) as SourceBand[]
  }

  const daysByTable = groupBy(dayRows, (d) => d.price_table_id)
  const bandsByDay = groupBy(bandRows, (b) => b.price_table_day_id)

  // O trigger já criou Padrão/Mensalista/Professor no destino; elas colidiriam
  // com os índices únicos (tipo reservado, nome, is_default) na reinserção.
  const { error: clearError } = await supabase
    .from('court_price_tables')
    .delete()
    .eq('court_id', targetCourtId)
    .eq('arena_id', arenaId)
  if (clearError) throw new Error(clearError.message)

  for (const table of tableRows) {
    const { data: created, error: tableError } = await supabase
      .from('court_price_tables')
      .insert({
        court_id: targetCourtId,
        arena_id: arenaId,
        nome: table.nome,
        tipo: table.tipo,
        is_default: table.is_default,
        aplica_a: table.aplica_a ?? [],
        ativo: table.ativo,
        ordem: table.ordem,
      })
      .select('id')
      .single()
    if (tableError) throw new Error(tableError.message)

    for (const day of daysByTable.get(table.id) ?? []) {
      const { data: createdDay, error: dayError } = await supabase
        .from('court_price_table_days')
        .insert({
          price_table_id: created.id,
          arena_id: arenaId,
          dia_semana: day.dia_semana,
          habilitado: day.habilitado,
          hora_inicio: day.hora_inicio,
          hora_fim: day.hora_fim,
          slot_shift_time: day.slot_shift_time,
          preco_base: Number(day.preco_base) || 0,
        })
        .select('id')
        .single()
      if (dayError) throw new Error(dayError.message)

      const bands = bandsByDay.get(day.id) ?? []
      if (bands.length === 0) continue

      const { error: bandsError } = await supabase
        .from('court_price_table_bands')
        .insert(
          bands.map((band, index) => ({
            price_table_day_id: createdDay.id,
            arena_id: arenaId,
            hora_inicio: band.hora_inicio,
            hora_fim: band.hora_fim,
            preco: Number(band.preco) || 0,
            ordem: band.ordem ?? index,
          })),
        )
      if (bandsError) throw new Error(bandsError.message)
    }
  }
}
