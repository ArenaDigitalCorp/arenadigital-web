/**
 * Extrato de ocupação: quebra uma reserva nas horas que ela ocupou e dá o valor
 * de cada hora. É o que permite fechar o mês com um professor/mensalista listando
 * "01/09/2026 16:00 às 17:00 — R$ X".
 *
 * Duas fontes de valor, deliberadamente diferentes:
 *
 *  - **Avulso** usa o valor efetivamente gravado na reserva, rateado entre as
 *    horas (o gestor pode ter negociado/editado o valor, e é esse que vale). A
 *    sobra do arredondamento cai na última hora, então a soma das linhas é
 *    exatamente o valor da reserva.
 *  - **Mensal** usa a tabela de preço do horário (`precoDaHora`), porque a
 *    reserva de mensalista guarda a fatia da mensalidade daquele mês — que não
 *    é o preço da hora.
 *
 * O módulo não importa nada em tempo de execução (só tipos, que o
 * `--experimental-strip-types` apaga): quem resolve preço é o chamador, com a
 * porta TS de `public.resolve_court_price` em `courts/lib/court-price-resolver`.
 */

const MS_PER_HOUR = 3_600_000
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo'

const saoPauloParts = new Intl.DateTimeFormat('en-US', {
  timeZone: SAO_PAULO_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/**
 * Data cujos componentes **locais** (`getDay`, `getHours`) são os de São Paulo.
 *
 * O relatório roda no servidor, que em produção está em UTC — ler `getHours()`
 * direto do instante daria a hora errada e, pior, o dia da semana errado (uma
 * quinta 21:00 em SP é sexta 00:00 em UTC), escolhendo a linha errada da tabela
 * de preço. A grade de preço é sempre expressa no fuso da arena.
 */
export function saoPauloWallClock(instant: Date): Date {
  const parts = saoPauloParts.formatToParts(instant)
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  // hour12:false devolve "24" para a meia-noite em alguns runtimes; o dia já é o correto.
  const hour = value('hour') % 24
  return new Date(
    value('year'),
    value('month') - 1,
    value('day'),
    hour,
    value('minute'),
    value('second'),
    0
  )
}

export interface UsageLine {
  inicioISO: string
  fimISO: string
  horas: number
  /** `null` quando nenhuma tabela cobre o horário e a reserva não tem valor. */
  valor: number | null
}

export interface UsageLineInput {
  startISO: string
  endISO: string
  /**
   * Valor efetivo da reserva. Manda quando presente (caso avulso): é rateado
   * entre as horas. Nas reservas de mensalista venha `null`, para o valor sair
   * da tabela de preço.
   */
  valorReserva?: number | null
  /**
   * Preço da hora que começa no instante dado (já em wall clock de São Paulo).
   * `null` quando nenhuma tabela de preço cobre aquele horário.
   */
  precoDaHora?: ((wallClockInstant: Date) => number | null) | null
  /** `unique` = espaço cobrado por evento; a hora não é a unidade de cobrança. */
  bookingType?: 'hourly' | 'unique'
  /** Último recurso quando nenhuma tabela cobre o horário: o valor gravado na reserva. */
  valorFallback?: number | null
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Fatias de 1h a partir do início; a última pode ser fracionária. */
function sliceHours(totalMs: number): { offsetMs: number; horas: number }[] {
  if (!Number.isFinite(totalMs) || totalMs <= 0) return []

  const slices: { offsetMs: number; horas: number }[] = []
  for (let offsetMs = 0; offsetMs < totalMs; offsetMs += MS_PER_HOUR) {
    slices.push({ offsetMs, horas: Math.min(1, (totalMs - offsetMs) / MS_PER_HOUR) })
  }
  return slices
}

/**
 * Uma linha por hora ocupada. Espaço cobrado por evento (`bookingType:
 * 'unique'`) devolve uma linha só, com o intervalo inteiro.
 */
export function buildUsageLines(input: UsageLineInput): UsageLine[] {
  const start = new Date(input.startISO)
  const end = new Date(input.endISO)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []

  const totalMs = end.getTime() - start.getTime()
  if (totalMs <= 0) return []

  const totalHoras = totalMs / MS_PER_HOUR
  const precoDaHora = input.precoDaHora ?? (() => null)

  if (input.bookingType === 'unique') {
    const precoTabela = precoDaHora(saoPauloWallClock(start))
    const valor = input.valorReserva ?? precoTabela ?? input.valorFallback ?? null
    return [
      {
        inicioISO: start.toISOString(),
        fimISO: end.toISOString(),
        horas: round2(totalHoras),
        valor: valor == null ? null : round2(valor),
      },
    ]
  }

  const slices = sliceHours(totalMs)
  if (slices.length === 0) return []

  const precos = slices.map((slice) =>
    precoDaHora(saoPauloWallClock(new Date(start.getTime() + slice.offsetMs)))
  )
  const semTabela = precos.every((preco) => preco == null)

  // Avulso (ou mensal sem tabela que cubra o horário): o valor da reserva é
  // rateado por duração, com a sobra do arredondamento na última linha, para a
  // soma bater exatamente com o que foi cobrado.
  const valorRateado = input.valorReserva ?? (semTabela ? input.valorFallback ?? null : null)
  const rateia = valorRateado != null && totalHoras > 0

  let distribuido = 0

  return slices.map((slice, index) => {
    const inicio = new Date(start.getTime() + slice.offsetMs)
    const fim = new Date(inicio.getTime() + slice.horas * MS_PER_HOUR)

    let valor: number | null
    if (rateia) {
      valor =
        index === slices.length - 1
          ? round2(valorRateado - distribuido)
          : round2((valorRateado * slice.horas) / totalHoras)
      distribuido = round2(distribuido + valor)
    } else {
      const preco = precos[index]
      valor = preco == null ? null : round2(preco * slice.horas)
    }

    return {
      inicioISO: inicio.toISOString(),
      fimISO: fim.toISOString(),
      horas: round2(slice.horas),
      valor,
    }
  })
}
