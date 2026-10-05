import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { register } from 'node:module'
import test from 'node:test'

// recorrencia-filtro.ts importa credito-recorrencia.ts via alias `@/`
// (resolvido pelo bundler). Aqui o alias é mapeado para `src/` só neste teste.
const srcRoot = new URL('../src/', import.meta.url).href
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        if (specifier.startsWith('@/')) {
          return next(${JSON.stringify(srcRoot)} + specifier.slice(2) + '.ts', context)
        }
        return next(specifier, context)
      }
    `)
)

const { buildRecorrenciaOptions, formatRecorrenciaOption } = await import(
  '../src/modules/reports/recorrencia-filtro.ts'
)
const { resolveReportSourceFlags } = await import('../src/modules/reports/payment-report-sources.ts')
const { buildAppliedFiltersDescription } = await import('../src/modules/reports/payment-status-pdf-data.ts')

const CACO = 'atleta-caco'

const plano = (over) => ({
  id: 'p',
  athlete_id: CACO,
  athlete_name: 'Caco Barcelos',
  status: 'ativo',
  dia_semana: 3,
  horario_inicio: '20:00:00',
  horario_fim: '21:00:00',
  court: { name: 'Quadra 04' },
  blocos: [],
  ...over,
})

// ── Opções do filtro ───────────────────────────────────────────────────────

test('ativas primeiro, depois as do próprio atleta, e então por dia e horário', () => {
  const opcoes = buildRecorrenciaOptions(
    [
      plano({ id: 'sex', dia_semana: 5 }),
      plano({ id: 'cancelada', dia_semana: 1, status: 'cancelado' }),
      plano({ id: 'grupo-bia', dia_semana: 2, athlete_id: 'atleta-bia', athlete_name: 'Bia' }),
      plano({ id: 'qua', dia_semana: 3 }),
    ],
    CACO
  )

  assert.deepEqual(
    opcoes.map((o) => o.id),
    ['qua', 'sex', 'grupo-bia', 'cancelada']
  )
})

test('grupo de outro responsável traz o nome dele; o do atleta, não', () => {
  const [dele, deOutro] = buildRecorrenciaOptions(
    [plano({ id: 'qua' }), plano({ id: 'ter', dia_semana: 2, athlete_id: 'atleta-bia', athlete_name: 'Bia' })],
    CACO
  )

  assert.deepEqual(dele, {
    id: 'qua',
    label: 'Quadra 04 · Qua · 20:00 às 21:00',
    responsavel: null,
    cancelada: false,
  })
  assert.equal(deOutro.responsavel, 'Bia')
})

test('o mesmo plano vindo de duas fontes (responsável e rateio) aparece uma vez', () => {
  const opcoes = buildRecorrenciaOptions([plano({ id: 'qua' }), plano({ id: 'qua' })], CACO)
  assert.equal(opcoes.length, 1)
})

test('texto da opção diz de quem é o grupo e se foi cancelado', () => {
  assert.equal(
    formatRecorrenciaOption({ id: 'x', label: 'Quadra 04 · Qua · 20:00 às 21:00', responsavel: null, cancelada: false }),
    'Quadra 04 · Qua · 20:00 às 21:00'
  )
  assert.equal(
    formatRecorrenciaOption({ id: 'x', label: 'Quadra 01 · Ter · 19:00 às 20:00', responsavel: 'Bia', cancelada: true }),
    'Quadra 01 · Ter · 19:00 às 20:00 · grupo de Bia · cancelada'
  )
})

// ── Fontes e filtros aplicados ─────────────────────────────────────────────

test('recorrência recorta como espaço/esporte: sem comanda, rotativo nem lançamento manual', () => {
  assert.deepEqual(resolveReportSourceFlags({ atletaId: CACO, planoId: 'qua' }), {
    mode: 'booking_scoped',
    includeStationPayments: false,
    includeRotativoInscricoes: false,
    includeRotativoCreditos: false,
    includeTransactions: false,
  })
  // Só o atleta continua trazendo tudo dele.
  assert.equal(resolveReportSourceFlags({ atletaId: CACO }).mode, 'full')
})

test('recorrência entra nos filtros aplicados logo depois do atleta', () => {
  const filtros = buildAppliedFiltersDescription({
    monthLabel: 'Outubro de 2026',
    tipo: 'todos',
    atletaNome: 'Caco Barcelos',
    recorrenciaLabel: 'Quadra 04 · Qua · 20:00 às 21:00',
    rateio: false,
    detalharPorHora: false,
  })

  assert.deepEqual(filtros, [
    { label: 'Período', value: 'Outubro de 2026' },
    { label: 'Atleta', value: 'Caco Barcelos' },
    { label: 'Recorrência', value: 'Quadra 04 · Qua · 20:00 às 21:00' },
  ])
})

// ── Recorte na action ──────────────────────────────────────────────────────

test('a action recorta reservas, mensalidade, créditos e dívida pela recorrência', async () => {
  const report = await readFile(
    new URL('../src/modules/reports/actions/reportActions.ts', import.meta.url),
    'utf8'
  )

  assert.match(report, /if \(filters\.planoId\) query = query\.eq\('plano_mensalista_id', filters\.planoId\)/)
  // A mensalidade é a do grupo, mesmo quando o atleta filtrado só participa dele.
  assert.match(report, /atletaId: filters\.planoId \? undefined : filters\.atletaId/)
  assert.match(report, /planoIds: filters\.planoId \? \[filters\.planoId\] : undefined/)
  assert.match(report, /if \(filters\.planoId\) query = query\.eq\('plano_id', filters\.planoId\)/)
  assert.match(report, /cobrancaQuery = cobrancaQuery\.eq\('mensalidade\.plano_id', planoId\)/)
  assert.match(report, /planoId \? Promise\.resolve\(\{ data: \[\], error: null \}\) : avulsoQuery/)
})
