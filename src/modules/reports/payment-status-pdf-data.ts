/**
 * Dados puros para o PDF do relatório de Pagamentos — o que entra no
 * cabeçalho (endereço da arena) e a lista de "Filtros aplicados".
 *
 * Fica fora de `payment-status-pdf.ts` porque aquele módulo importa `jspdf`
 * (só existe no navegador); este não importa nada em tempo de execução, então
 * dá para testar sem jsdom nem mockar canvas/Image.
 */

export interface AppliedFiltersInput {
  /** Sempre presente — o relatório é sempre de um mês. */
  monthLabel: string
  tipo: 'todos' | 'avulso' | 'mensal'
  /** Nome já resolvido (a tela tem a lista de espaços/esportes em mãos). */
  courtName?: string | null
  sportName?: string | null
  atletaNome?: string | null
  perfilLabel?: string | null
  rateio: boolean
  detalharPorHora: boolean
}

export interface AppliedFilter {
  label: string
  value: string
}

/**
 * Só os filtros que o gestor de fato aplicou — "Todos os espaços" ou Tipo de
 * Jogo = Todos não aparecem, senão a lista vira ruído em vez de um resumo do
 * que gerou aquele recorte.
 */
export function buildAppliedFiltersDescription(input: AppliedFiltersInput): AppliedFilter[] {
  const filtros: AppliedFilter[] = [{ label: 'Período', value: input.monthLabel }]

  if (input.tipo !== 'todos') {
    filtros.push({ label: 'Tipo de Jogo', value: input.tipo === 'avulso' ? 'Avulso' : 'Mensal' })
  }
  if (input.atletaNome) filtros.push({ label: 'Atleta', value: input.atletaNome })
  if (input.perfilLabel) filtros.push({ label: 'Perfil de Atleta', value: input.perfilLabel })
  if (input.courtName) filtros.push({ label: 'Espaço', value: input.courtName })
  if (input.sportName) filtros.push({ label: 'Esporte', value: input.sportName })
  // Rateio só é um filtro de fato com Tipo = Mensal (é quando o checkbox existe).
  if (input.tipo === 'mensal' && input.rateio) {
    filtros.push({ label: 'Rateio', value: 'Ver linha a linha' })
  }
  if (input.detalharPorHora) {
    filtros.push({ label: 'Ocupação', value: 'Detalhar por hora' })
  }

  return filtros
}

export interface ArenaAddressInput {
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  stateUf: string | null
}

/**
 * "Rua Exemplo, 123 - Sala 2 - Bairro Tal — Cidade/UF", omitindo pedaços
 * ausentes em vez de deixar vírgulas soltas. `null` quando não há nada —
 * a página decide se mostra a linha ou não.
 */
export function formatArenaAddressLine(addr: ArenaAddressInput): string | null {
  const numero = addr.number ? `, ${addr.number}` : ''
  const logradouro = addr.street ? `${addr.street}${numero}` : null
  const complemento = addr.complement || null

  const primeiraParte = [logradouro, complemento].filter(Boolean).join(' - ')

  const cidadeUf = [addr.city, addr.stateUf].filter(Boolean).join('/')
  const segundaParte = [addr.neighborhood, cidadeUf || null].filter(Boolean).join(' - ')

  const linha = [primeiraParte, segundaParte].filter((p) => p && p.length > 0).join(' — ')
  return linha || null
}
