import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const read = (relative) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const priceTableActions = read('../src/modules/courts/actions/priceTableActions.ts')
const bookingModal = read('../src/modules/bookings/components/BookingModal.tsx')
const courtForm = read('../src/modules/courts/components/CourtForm.tsx')
const priceTablesConfig = read('../src/modules/courts/components/PriceTablesConfig.tsx')

// O repo do banco é irmão; em CI do web ele pode não estar presente.
const DB_ROOT = fileURLToPath(new URL('../../../arenadigital-db/', import.meta.url))
const hasDbRepo = existsSync(DB_ROOT)
const readMigration = (name) => readFileSync(`${DB_ROOT}supabase/migrations/${name}`, 'utf8')

// ── Autorização das server actions ────────────────────────────────────────

test('toda server action de tabela de preço passa por autorização de arena', () => {
  const exported = [
    ...priceTableActions.matchAll(/export async function (\w+)\(/g),
  ].map((m) => m[1])

  assert.deepEqual(
    exported.sort(),
    [
      'createCourtPriceTableAction',
      'deleteCourtPriceTableAction',
      'listCourtPriceTableOptionsAction',
      'listCourtPriceTablesAction',
      'quoteCourtPriceAction',
      'saveDraftPriceTablesAction',
      'setDefaultCourtPriceTableAction',
      'upsertCourtPriceTableAction',
    ],
    'nova action exige revisão de autorização neste teste'
  )

  const asserts =
    (priceTableActions.match(/await assertArenaAdminAccess\(/g)?.length ?? 0) +
    (priceTableActions.match(/await assertArenaBackofficeAccess\(/g)?.length ?? 0)
  assert.equal(asserts, exported.length, 'uma checagem de arena por action')

  // Toda action que recebe courtId também valida que ele pertence à arena.
  assert.equal(
    priceTableActions.match(/await assertCourtAccess\(/g)?.length,
    8,
    'assertCourtAccess em todas as actions com courtId'
  )
})

test('leitura do modal usa backoffice; escrita e edição de espaço usam admin', () => {
  const optionsAction = priceTableActions.slice(
    priceTableActions.indexOf('export async function listCourtPriceTableOptionsAction')
  )
  assert.match(
    optionsAction.slice(0, 400),
    /assertArenaBackofficeAccess/,
    'a lista do BookingModal não pode exigir admin (Atendente também reserva)'
  )

  for (const action of [
    'upsertCourtPriceTableAction',
    'saveDraftPriceTablesAction',
    'createCourtPriceTableAction',
    'deleteCourtPriceTableAction',
    'setDefaultCourtPriceTableAction',
    'listCourtPriceTablesAction',
  ]) {
    const body = priceTableActions.slice(
      priceTableActions.indexOf(`export async function ${action}`)
    )
    assert.match(
      body.slice(0, 400),
      /assertArenaAdminAccess/,
      `${action} deve exigir admin`
    )
  }
})

test('a cotação vem do banco, nunca de valor enviado pelo cliente', () => {
  assert.match(priceTableActions, /\.rpc\('resolve_court_price'/)
  assert.match(priceTableActions, /p_court_id: courtId/)
  assert.match(priceTableActions, /p_price_table_id: priceTableId \?\? null/)
  // não existe caminho que aceite um preço pronto do cliente
  assert.doesNotMatch(priceTableActions, /p_valor|p_price\b|precoInformado/)
})

test('escritas sempre filtram por arena e espaço', () => {
  const courtsUpdate = priceTableActions.slice(
    priceTableActions.indexOf("from('courts')")
  )
  assert.match(courtsUpdate.slice(0, 600), /\.eq\('id', courtId\)/)
  assert.match(courtsUpdate.slice(0, 600), /\.eq\('arena_id', arenaId\)/)

  // nenhum update/delete de tabela sem escopo de court_id
  for (const match of priceTableActions.matchAll(
    /from\('court_price_tables'\)\s*\n\s*\.(update|delete)\([^)]*\)([\s\S]{0,220})/g
  )) {
    assert.match(
      match[2],
      /court_id|price_table_id/,
      'update/delete de court_price_tables sem escopo'
    )
  }
})

// ── O gestor mantém o controle do valor na reserva ────────────────────────

test('o BookingModal só sugere: o valor segue editável e há "usar sugerido"', () => {
  assert.match(bookingModal, /quoteCourtPriceAction\(/)
  // o campo continua um input livre controlado por courtPrice
  assert.match(bookingModal, /value=\{courtPrice\}/)
  assert.match(bookingModal, /onChange=\{\(e\) => setCourtPrice\(e\.target\.value\)\}/)
  // só sobrescreve quando o campo está vazio ou ainda mostra a última sugestão
  assert.match(
    bookingModal,
    /prev === '' \|\| prev === lastAutoCourtPrice\.current/,
    'não pode clobber o valor digitado pelo gestor'
  )
  assert.match(bookingModal, /usar sugerido/)
  // o valor efetivo enviado é o do campo, não a cotação
  assert.match(bookingModal, /rentalPrice: court/)
})

test('o valor mensal sugerido também não sobrescreve edição do gestor', () => {
  assert.match(
    bookingModal,
    /prev === '' \|\| prev === lastAutoValorMensal\.current/
  )
  assert.match(bookingModal, /valor_mensal: Number\(valorMensal\)/)
})

test('reserva de plano existente não é reprecificada ao abrir', () => {
  assert.match(
    bookingModal,
    /lastAutoCourtPrice\.current = null[\s\S]{0,200}return;/,
    'ao editar uma reserva o auto-quote não pode substituir o valor salvo'
  )
})

// ── Cadastro de espaço: Padrão obrigatória, opcionais opcionais ───────────

test('o cadastro exige ao menos um dia na tabela Padrão', () => {
  assert.match(courtForm, /padraoDayConfig\.length === 0/)
  assert.match(courtForm, /Habilite pelo menos um dia na tabela Padrão/)
  // e persiste as 3 depois de criar o espaço
  assert.match(courtForm, /saveDraftPriceTablesAction\(/)
  assert.match(courtForm, /draftTables\.map\(\(t\) => \(\{/)
})

test('a edição não regrava day_config pelo formulário do espaço', () => {
  const editBranch = courtForm.slice(
    courtForm.indexOf('if (initialData) {'),
    courtForm.indexOf('} else {')
  )
  assert.doesNotMatch(editBranch, /day_config/)
  assert.match(courtForm, /const finalInput = \{ \.\.\.input, image_url: imageUrl \}/)
})

test('o editor em rascunho não fala com o servidor', () => {
  const draftGuards = [
    /const isDraft = !!draftTables && !!onDraftChange/,
    /if \(isDraft \|\| !courtId\) return/,
    /\{!isDraft && \(/,
  ]
  for (const guard of draftGuards) assert.match(priceTablesConfig, guard)
})

test('as facilidades de preenchimento continuam disponíveis', () => {
  assert.match(priceTablesConfig, /Copiar faixas da tabela Padrão/)
  assert.match(priceTablesConfig, /Limpar tabela/)
  assert.match(priceTablesConfig, /onReplicate=\{\(\) => handleReplicate\(day\.diaSemana\)\}/)
  assert.match(priceTablesConfig, /days > 0 \? `\$\{days\}d` : 'vazia'/)
})

// ── Migrações: forma idempotente e ACL fechada ────────────────────────────

const MIGRATIONS = [
  '20260904120000_court_price_tables.sql',
  '20260904120010_court_price_tables_acl.sql',
  '20260904140000_mensalista_prorata_first_month.sql',
  '20260904150000_mensalista_reajuste_valor.sql',
  '20260904160000_mensalista_payment_overpay_credit.sql',
]

test('o repositório web não carrega migrations', { skip: false }, () => {
  const guard = read('../package.json')
  assert.match(guard, /guard:migration-ownership/)
})

test(
  'migrations são reexecutáveis e com search_path travado',
  { skip: hasDbRepo ? false : 'arenadigital-db não está checado out ao lado' },
  () => {
    for (const name of MIGRATIONS) {
      const sql = readMigration(name)

      for (const create of sql.matchAll(/CREATE (TABLE|INDEX|UNIQUE INDEX)\s+(?!IF NOT EXISTS)/g)) {
        assert.fail(`${name}: ${create[0].trim()} sem IF NOT EXISTS`)
      }
      assert.doesNotMatch(
        sql,
        /CREATE FUNCTION\s/,
        `${name}: CREATE FUNCTION sem OR REPLACE`
      )
      if (sql.includes('CREATE POLICY')) {
        assert.match(sql, /DROP POLICY IF EXISTS/, `${name}: CREATE POLICY sem DROP IF EXISTS`)
      }
      if (sql.includes('CREATE TRIGGER')) {
        assert.match(sql, /DROP TRIGGER IF EXISTS/, `${name}: CREATE TRIGGER sem DROP IF EXISTS`)
      }

      const functions = sql.match(/CREATE OR REPLACE FUNCTION/g)?.length ?? 0
      if (functions > 0) {
        assert.equal(
          sql.match(/SET search_path = ''/g)?.length,
          functions,
          `${name}: toda função precisa de search_path = ''`
        )
      }
    }
  }
)

test(
  'as tabelas de preço têm RLS e nenhuma escrita para authenticated',
  { skip: hasDbRepo ? false : 'arenadigital-db não está checado out ao lado' },
  () => {
    const sql = readMigration('20260904120000_court_price_tables.sql')
    for (const table of [
      'court_price_tables',
      'court_price_table_days',
      'court_price_table_bands',
    ]) {
      assert.match(
        sql,
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
        `${table} sem RLS`
      )
      assert.match(
        sql,
        new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM anon, authenticated`)
      )
      assert.match(
        sql,
        new RegExp(`GRANT SELECT ON TABLE public\\.${table} TO authenticated`)
      )
      assert.doesNotMatch(
        sql,
        new RegExp(`GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*public\\.${table} TO authenticated`)
      )
    }
    // leitura restrita ao backoffice da arena
    assert.equal(sql.match(/can_access_arena_backoffice\(arena_id\)/g)?.length, 3)
  }
)

test(
  'resolve_court_price só é executável pelo service_role',
  { skip: hasDbRepo ? false : 'arenadigital-db não está checado out ao lado' },
  () => {
    const acl = readMigration('20260904120010_court_price_tables_acl.sql')
    assert.match(
      acl,
      /REVOKE ALL ON FUNCTION public\.resolve_court_price\([^)]*\) FROM PUBLIC, anon, authenticated/
    )
    assert.match(
      acl,
      /GRANT EXECUTE ON FUNCTION public\.resolve_court_price\([^)]*\) TO service_role/
    )
    assert.doesNotMatch(acl, /resolve_court_price[^;]*TO authenticated/)
  }
)

test(
  'as colunas de snapshot são aditivas e nullable',
  { skip: hasDbRepo ? false : 'arenadigital-db não está checado out ao lado' },
  () => {
    const sql = readMigration('20260904120000_court_price_tables.sql')
    for (const table of [
      'bookings',
      'planos_mensalista',
      'app_booking_requests',
      'app_online_booking_operations',
    ]) {
      assert.match(
        sql,
        new RegExp(
          `ALTER TABLE public\\.${table}\\s*\\n\\s*ADD COLUMN IF NOT EXISTS price_table_id uuid\\s*\\n\\s*REFERENCES public\\.court_price_tables\\(id\\) ON DELETE SET NULL`
        ),
        `${table}.price_table_id precisa ser aditiva, nullable e ON DELETE SET NULL`
      )
      assert.doesNotMatch(
        sql,
        new RegExp(`${table}[\\s\\S]{0,120}price_table_id uuid NOT NULL`)
      )
    }
  }
)

test(
  'nenhuma migration da leva altera day_config ou courts.price existentes',
  { skip: hasDbRepo ? false : 'arenadigital-db não está checado out ao lado' },
  () => {
    const sql = readMigration('20260904120000_court_price_tables.sql')
    assert.doesNotMatch(
      sql,
      /UPDATE public\.courts\s+SET[\s\S]{0,200}day_config/,
      'a migração é aditiva: o day_config legado permanece intacto'
    )
    assert.doesNotMatch(sql, /DROP COLUMN[\s\S]{0,80}day_config/)
    assert.doesNotMatch(sql, /ALTER TABLE public\.courts[\s\S]{0,120}DROP/)
  }
)

test(
  'o caminho de confirmação de reserva segue trocando só o que é aditivo',
  { skip: hasDbRepo ? false : 'arenadigital-db não está checado out ao lado' },
  () => {
    const overpay = readMigration('20260904160000_mensalista_payment_overpay_credit.sql')
    // dinheiro integral continua espelhado no caixa
    assert.match(overpay, /source_type[\s\S]{0,120}'mensalista_pagamento'/)
    assert.match(overpay, /v_valor, 1, v_valor, 0, v_data, v_data, p_registered_by/)
    // o crédito lançado não vira lançamento de caixa
    const creditBlock = overpay.slice(
      overpay.indexOf('Surplus cash -> athlete credit'),
      overpay.indexOf('Mirror the full cash received')
    )
    assert.doesNotMatch(creditBlock, /INSERT INTO public\.transactions/)
    // e a confirmação das reservas do mês continua na transição para quitado
    assert.match(
      overpay,
      /v_old_status <> 'quitado' AND v_new_status = 'quitado'/
    )
    assert.match(overpay, /SET status = 'confirmed',/)
  }
)
