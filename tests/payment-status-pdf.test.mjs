import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildAppliedFiltersDescription,
  formatArenaAddressLine,
} from '../src/modules/reports/payment-status-pdf-data.ts'

// ── Filtros aplicados: só o que o gestor de fato escolheu ─────────────────

test('período sempre aparece, mesmo sem nenhum outro filtro', () => {
  const filtros = buildAppliedFiltersDescription({
    monthLabel: 'Setembro de 2026',
    tipo: 'todos',
    rateio: false,
    detalharPorHora: false,
  })

  assert.deepEqual(filtros, [{ label: 'Período', value: 'Setembro de 2026' }])
})

test('tipo, espaço, esporte e atleta entram só quando selecionados', () => {
  const filtros = buildAppliedFiltersDescription({
    monthLabel: 'Setembro de 2026',
    tipo: 'mensal',
    courtName: 'Quadra 01',
    sportName: 'Beach Tennis',
    atletaNome: 'Philip Coutinho',
    rateio: false,
    detalharPorHora: false,
  })

  assert.deepEqual(filtros, [
    { label: 'Período', value: 'Setembro de 2026' },
    { label: 'Tipo de Jogo', value: 'Mensal' },
    { label: 'Atleta', value: 'Philip Coutinho' },
    { label: 'Espaço', value: 'Quadra 01' },
    { label: 'Esporte', value: 'Beach Tennis' },
  ])
})

test('rateio só é um filtro de fato com Tipo de Jogo = Mensal', () => {
  // Marcado mas sem Tipo = Mensal, o checkbox nem existe na tela — não é um filtro aplicado.
  const semMensal = buildAppliedFiltersDescription({
    monthLabel: 'Setembro de 2026',
    tipo: 'todos',
    rateio: true,
    detalharPorHora: false,
  })
  assert.equal(semMensal.find((f) => f.label === 'Rateio'), undefined)

  const comMensal = buildAppliedFiltersDescription({
    monthLabel: 'Setembro de 2026',
    tipo: 'mensal',
    rateio: true,
    detalharPorHora: false,
  })
  assert.deepEqual(comMensal.find((f) => f.label === 'Rateio'), {
    label: 'Rateio',
    value: 'Ver linha a linha',
  })
})

test('detalhar por hora aparece como filtro de Ocupação', () => {
  const filtros = buildAppliedFiltersDescription({
    monthLabel: 'Setembro de 2026',
    tipo: 'todos',
    rateio: false,
    detalharPorHora: true,
  })

  assert.deepEqual(filtros.find((f) => f.label === 'Ocupação'), {
    label: 'Ocupação',
    value: 'Detalhar por hora',
  })
})

// ── Endereço da arena: omite o que falta, sem vírgula solta ───────────────

test('endereço completo junta rua, número, complemento, bairro e cidade/UF', () => {
  const linha = formatArenaAddressLine({
    street: 'Av. Exemplo',
    number: '123',
    complement: 'Bloco B',
    neighborhood: 'Centro',
    city: 'Florianópolis',
    stateUf: 'SC',
  })

  assert.equal(linha, 'Av. Exemplo, 123 - Bloco B — Centro - Florianópolis/SC')
})

test('sem complemento não sobra hífen solto', () => {
  const linha = formatArenaAddressLine({
    street: 'Av. Exemplo',
    number: '123',
    complement: null,
    neighborhood: 'Centro',
    city: 'Florianópolis',
    stateUf: 'SC',
  })

  assert.equal(linha, 'Av. Exemplo, 123 — Centro - Florianópolis/SC')
})

test('sem endereço nenhum cadastrado, devolve null em vez de string vazia', () => {
  const linha = formatArenaAddressLine({
    street: null,
    number: null,
    complement: null,
    neighborhood: null,
    city: null,
    stateUf: null,
  })

  assert.equal(linha, null)
})

test('só cidade/UF (sem rua) ainda forma uma linha válida', () => {
  const linha = formatArenaAddressLine({
    street: null,
    number: null,
    complement: null,
    neighborhood: null,
    city: 'Florianópolis',
    stateUf: 'SC',
  })

  assert.equal(linha, 'Florianópolis/SC')
})

// ── O componente exporta pelo módulo browser-only, sem puxar jspdf de cara ─

test('o botão de PDF importa o gerador dinamicamente, como o de Excel', async () => {
  const component = await readFile(
    new URL('../src/modules/reports/components/StatusPagamentosPageClient.tsx', import.meta.url),
    'utf8',
  )

  assert.match(component, /import\('@\/modules\/reports\/payment-status-pdf'\)/u)
  assert.doesNotMatch(component, /^import .*jspdf/mu)
})

test('o gerador de PDF não roda no bundle do servidor — sem import estático de jspdf fora do módulo dedicado', async () => {
  const pdfModule = await readFile(
    new URL('../src/modules/reports/payment-status-pdf.ts', import.meta.url),
    'utf8',
  )

  // jsPDF e autoTable só entram via import() dinâmico, dentro da função de geração.
  assert.match(pdfModule, /import\('jspdf'\)/u)
  assert.match(pdfModule, /import\('jspdf-autotable'\)/u)
  assert.doesNotMatch(pdfModule, /^import .*from 'jspdf/mu)
})

test('o PDF mostra logo, marca Arena Digital e dados da arena centralizados, com os filtros aplicados', async () => {
  const pdfModule = await readFile(
    new URL('../src/modules/reports/payment-status-pdf.ts', import.meta.url),
    'utf8',
  )

  assert.match(pdfModule, /logo_arena_front_bgbranco\.png/u)
  assert.match(pdfModule, /Sistema de Gestão para Arenas Esportivas/u)
  assert.match(pdfModule, /align: 'center'/u)
  assert.match(pdfModule, /Filtros aplicados/u)
  assert.match(pdfModule, /buildAppliedFiltersDescription/u)
})

test('o resumo do PDF não mostra mais "Horas ocupadas" — a soma não representava o período', async () => {
  const pdfModule = await readFile(
    new URL('../src/modules/reports/payment-status-pdf.ts', import.meta.url),
    'utf8',
  )

  // Só o texto que iria pro PDF (dentro de um template literal); o comentário
  // explicando a remoção pode citar o rótulo livremente.
  assert.doesNotMatch(pdfModule, /`Horas ocupadas/u)
  // Horas só aparecem onde a contagem é completa: no extrato do atleta e na
  // coluna do resumo por atleta, que só existe com "Detalhar por hora" (cada
  // hora de mensalista vem da reserva, não da linha agregada da mensalidade).
  const resumoDoPeriodo = pdfModule.slice(
    pdfModule.indexOf('Resumo do período'),
    pdfModule.indexOf('Tabela de lançamentos'),
  )
  assert.doesNotMatch(resumoDoPeriodo, /formatHoras/u)
  assert.match(pdfModule, /const comHoras = filtros\.detalharPorHora/u)
})

test('o cabeçalho do PDF só mostra nome e endereço da arena — sem telefone, e-mail ou CNPJ/CPF', async () => {
  const pdfModule = await readFile(
    new URL('../src/modules/reports/payment-status-pdf.ts', import.meta.url),
    'utf8',
  )

  assert.match(pdfModule, /arena\.name/u)
  assert.match(pdfModule, /formatArenaAddressLine/u)
  assert.doesNotMatch(pdfModule, /arena\.phone/u)
  assert.doesNotMatch(pdfModule, /arena\.email/u)
  assert.doesNotMatch(pdfModule, /arena\.cpfCnpj/u)
})
