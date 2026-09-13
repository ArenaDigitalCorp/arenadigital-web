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
const dayCard = read('../src/modules/courts/components/DayCard.tsx')
const dayPanel = read('../src/modules/courts/components/DaySchedulePanel.tsx')

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
      'quoteMonthlyBlocksAction',
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
  // quoteMonthlyBlocksAction recebe blocos de vários espaços e valida cada um
  // deles em laço — daí a nona ocorrência.
  assert.equal(
    priceTableActions.match(/await assertCourtAccess\(/g)?.length,
    9,
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
  // A recorrência passou a ser N blocos, então a sugestão vem do somatório da
  // grade — mas a garantia é a mesma: só preenche campo vazio ou a própria
  // sugestão anterior, nunca um valor que o gestor digitou.
  assert.match(
    bookingModal,
    /prev === '' \|\| prev === lastAutoValorBlocos\.current/
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

/**
 * Ramo `if (initialData) { … }` do `onSubmit`. O `} else {` tem que ser buscado
 * a partir do início do ramo: há outro antes dele no arquivo, e ancorar no
 * primeiro devolvia string vazia (asserção que passava sem testar nada).
 */
function editBranch({ stripComments = false } = {}) {
  const start = courtForm.indexOf('if (initialData) {')
  const branch = courtForm.slice(start, courtForm.indexOf('} else {', start))
  assert.ok(branch.includes('updateCourtAction'), 'o ramo de edição foi localizado')
  return stripComments ? branch.replace(/^\s*\/\/.*$/gm, '') : branch
}

test('a edição não regrava day_config pelo formulário do espaço', () => {
  assert.doesNotMatch(editBranch({ stripComments: true }), /day_config/)
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

// ── Um único botão de salvar no formulário do espaço ──────────────────────

test('o editor persistido não tem botão próprio de salvar', () => {
  assert.doesNotMatch(priceTablesConfig, /Salvar tabela/)
  // O único submit do formulário continua sendo o do próprio form.
  const submits = courtForm.match(/type="submit"/g) ?? []
  assert.equal(submits.length, 1, 'cadastro e edição salvam por um botão só')
})

test('o submit da edição grava as tabelas de preço junto com o espaço', () => {
  assert.match(priceTablesConfig, /export type PriceTablesHandle/)
  assert.match(priceTablesConfig, /saveAll: \(\) => saveDirtyTables\(\)/)
  assert.match(courtForm, /ref=\{priceTablesRef\}/)

  const branch = editBranch()
  assert.match(branch, /priceTablesRef\.current\?\.saveAll\(\)/)
  assert.match(branch, /tablesSaved === false/, 'falha na gravação não navega para fora')
})

test('operação estrutural grava as pendências antes de recarregar do servidor', () => {
  // handleCreate/handleSetDefault/handleDelete chamam load(), que substitui o
  // estado pelo do servidor — sem gravar antes, a edição na tela some.
  const guards = priceTablesConfig.match(/if \(!\(await saveDirtyTables\((active\.id)?\)\)\) return/g) ?? []
  assert.equal(guards.length, 3, 'criar, definir padrão e excluir preservam o que está na tela')
  assert.match(priceTablesConfig, /saveDirtyTables\(active\.id\)/, 'a tabela excluída não é gravada antes')
})

test('o gestor vê quais tabelas têm alteração pendente', () => {
  assert.match(priceTablesConfig, /const dirtyCount = tables\.filter\(\(t\) => t\.dirty\)\.length/)
  assert.match(priceTablesConfig, /ainda não salvas/)
  assert.match(priceTablesConfig, /Salvar Alterações<\/strong>/)
})

test('as facilidades de preenchimento continuam disponíveis', () => {
  assert.match(priceTablesConfig, /Copiar faixas da tabela Padrão/)
  assert.match(priceTablesConfig, /Limpar tabela/)
  assert.match(priceTablesConfig, /Replicar para todos os dias/)
  assert.match(priceTablesConfig, /onClick=\{handleReplicate\}/)
  assert.match(priceTablesConfig, /days > 0 \? `\$\{days\}d` : 'vazia'/)
})

// ── Migrações: forma idempotente e ACL fechada ────────────────────────────

const MIGRATIONS = [
  '20260904120000_court_price_tables.sql',
  '20260904120010_court_price_tables_acl.sql',
  '20260904140000_mensalista_prorata_first_month.sql',
  '20260904150000_mensalista_reajuste_valor.sql',
  '20260904160000_mensalista_payment_overpay_credit.sql',
  '20260910120000_court_price_tables_reserved_names.sql',
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

// ── Semana em cards: card + painel, edição em lote, rótulos ───────────────

test('o dia vira card de resumo e o editor vira painel separado', () => {
  // A matemática saiu inteira para a lib — o componente não recalcula nada.
  assert.match(dayCard, /summarizeDay/)
  assert.doesNotMatch(dayCard, /parseHHMM|customPrices/, 'o card não faz conta própria')
  assert.match(dayPanel, /from "@\/modules\/courts\/lib\/day-schedule"/)

  // O card carrega o que antes exigia abrir o dia.
  for (const info of [/slots/, /tierCount/, /minPrice/, /overnight/, /segments/]) {
    assert.match(dayCard, info)
  }
  assert.match(dayCard, /onToggle/, 'liga/desliga sem abrir o painel')
})

test('a tira mostra os 7 dias, de segunda a domingo', () => {
  assert.match(priceTablesConfig, /EDITOR_DAY_ORDER\.map\(\(dow\) => \{/)
  assert.match(priceTablesConfig, /<DayCard/)
  assert.match(priceTablesConfig, /lg:grid-cols-7/)
})

test('o interruptor do card não dispara a seleção do card', () => {
  assert.match(
    dayCard,
    /onClick=\{\(e\) => e\.stopPropagation\(\)\}/,
    'clicar no switch não pode também trocar o dia em edição'
  )
  // card com controle interativo dentro: div[role=button], nunca <button>
  assert.match(dayCard, /role="button"/)
  assert.doesNotMatch(dayCard, /<button/, 'botão dentro de botão é HTML inválido')
})

test('o card responde ao teclado', () => {
  assert.match(dayCard, /onKeyDown/)
  assert.match(dayCard, /e\.key === 'Enter' \|\| e\.key === ' '/)
  assert.match(dayCard, /tabIndex=\{0\}/)
  assert.match(dayCard, /aria-label=/)
})

test('a seleção nunca fica vazia', () => {
  // desmarcar o último dia selecionado mantém a seleção anterior
  assert.match(
    priceTablesConfig,
    /return next\.length > 0 \? next : prev/,
    'sem isso o painel ficaria sem dia para editar'
  )
})

test('editar em lote não abre nem fecha dia por conta própria', () => {
  assert.match(
    priceTablesConfig,
    /dayConfigToCourtPriceDay\(d\.diaSemana, nextConfig\), enabled: d\.enabled/,
    'quem abre e fecha o dia é o interruptor, não a edição de preço'
  )
  assert.match(dayPanel, /batchDays/)
  assert.match(dayPanel, /Estas configurações valem também para/)
})

test('Replicar não fica disponível quando não faz sentido', () => {
  assert.match(
    priceTablesConfig,
    /disabled=\{!canEditActive \|\| batchMode \|\| !leadDay\?\.enabled\}/,
    'replicar dia fechado ou em lote copiaria o que o gestor não vê'
  )
})

test('o painel abre num dia que aquela tabela realmente usa', () => {
  assert.match(priceTablesConfig, /const firstOpen = EDITOR_DAY_ORDER\.find\(\(dow\) => dayOf\(dow\)\?\.enabled\)/)
  // re-escolhe ao trocar de tabela, mas só quando o dia atual está fechado nela
  assert.match(priceTablesConfig, /autoPickedFor !== activeTableKey/)
  assert.match(priceTablesConfig, /if \(!dayOf\(selectedDows\[0\]\)\?\.enabled\)/)
})

test('o rascunho de horário digitado não é apagado por re-render do pai', () => {
  // A config chega como objeto novo a cada render; comparar por valor evita
  // limpar o input enquanto o gestor digita.
  assert.match(dayPanel, /const configSignature = \[/)
  assert.match(dayPanel, /lastSignature !== configSignature/)
  assert.doesNotMatch(dayPanel, /useEffect/, 'setState em efeito foi trocado por ajuste no render')
})

test('os rótulos dizem a que se referem', () => {
  assert.match(priceTablesConfig, /Nova tabela de Preços/)
  assert.match(priceTablesConfig, /nome: 'Nova tabela de preços'/)
  assert.match(priceTablesConfig, /placeholder="Nome da tabela de preços"/)
  assert.match(priceTablesConfig, /Usar como tabela padrão/)
  assert.match(priceTablesConfig, /Excluir tabela/)
  assert.match(priceTablesConfig, /Limite de \$\{MAX_PRICE_TABLES_PER_COURT\} tabelas de preços por espaço/)
  assert.match(dayPanel, /Adicionar faixa de horário/)
  assert.match(dayPanel, /Faixas de preço por horário/)
  assert.match(dayPanel, /Valor por hora/)
  // horários com rótulo explícito em vez de "Início"/"Fim" soltos
  assert.match(dayPanel, /Abre às/)
  assert.match(dayPanel, /Fecha às/)
  assert.match(dayPanel, /Começa às/)
  assert.match(dayPanel, /Termina às/)
})

test('todo controle de tabela vive no cabeçalho da tabela ativa', () => {
  const header = priceTablesConfig.slice(
    priceTablesConfig.indexOf('Cabeçalho da tabela ativa'),
    priceTablesConfig.indexOf('Tira da semana')
  )
  assert.ok(header.length > 0, 'cabeçalho localizado')
  for (const control of [
    /Nome da tabela de preços/,
    /Usar como tabela padrão/,
    /Copiar faixas da tabela Padrão/,
    /Limpar tabela/,
    /Excluir tabela/,
  ]) {
    assert.match(header, control)
  }
})

test('as travas de quem pode fazer o quê seguem as de antes', () => {
  // criar/definir padrão/excluir: só no modo persistido, com id
  assert.match(priceTablesConfig, /\{!isDraft && active\.id && !active\.isDefault && \(/)
  assert.match(
    priceTablesConfig,
    /!isDraft && active\.id && !isReservedPriceTableKind\(active\.tipo\) && !active\.isDefault/,
    'Padrão, Mensalista e Professor continuam sem excluir'
  )
  assert.match(priceTablesConfig, /disabled=\{!persisted \|\| busy \|\| tables\.length >= MAX_PRICE_TABLES_PER_COURT\}/)
})

test('toda tabela entra no editor por toEditor (garante os 7 dias do payload)', () => {
  // `saveDirtyTables` faz `EDITOR_DAY_ORDER.map(dow => editorDays.find(...)!)`.
  // O `!` só é seguro porque toda origem passa por toEditor → toEditorDays.
  assert.match(priceTablesConfig, /function toEditor\(table: CourtPriceTable\): EditorTable \{\s*\n\s*return \{ \.\.\.table, editorDays: toEditorDays\(table\.days\)/)
  assert.match(priceTablesConfig, /setLoaded\(\[toEditor\(fallback\)\]\)/, 'o fallback legado também')
  assert.match(priceTablesConfig, /const editors = res\.data\.map\(toEditor\)/)
  assert.match(priceTablesConfig, /\(draftTables \?\? \[\]\)\.map\(toEditor\)/, 'e o rascunho do cadastro')
})

// ── Padrão/Mensalista/Professor: papel fixo, nome fixo ────────────────────

test('o nome das 3 reservadas não é editável na tela', () => {
  const header = priceTablesConfig.slice(
    priceTablesConfig.indexOf('Cabeçalho da tabela ativa'),
    priceTablesConfig.indexOf('Tira da semana')
  )
  assert.match(header, /isReservedPriceTableKind\(active\.tipo\) \? \(/, 'reservada não recebe input')
  assert.match(header, /<Lock className/, 'o cadeado explica por que não dá para editar')
  assert.match(header, /nome fixo/, 'e o title diz o motivo')
  // o input de nome continua existindo, só que no ramo das personalizadas
  assert.match(header, /placeholder="Nome da tabela de preços"/)
})

test('o servidor ignora rename de reservada, não confia na tela', () => {
  assert.match(
    priceTableActions,
    /\.\.\.\(isReservedPriceTableKind\(current\.tipo\) \? \{\} : \{ nome: parsed\.nome \}\)/,
    'upsert não pode gravar nome de tabela reservada'
  )
  assert.match(
    priceTableActions,
    /if \(nome && !isReservedPriceTableKind\(draft\.tipo\)\)/,
    'o cadastro em rascunho também'
  )
  // criar tabela nova só produz custom — nunca um papel reservado
  assert.match(priceTableActions, /tipo: 'custom',/)
})

test('`tipo` é a chave de identificação do papel, não o nome', () => {
  const types = read('../src/modules/courts/types/price-table.types.ts')
  assert.match(types, /RESERVED_PRICE_TABLE_KINDS[\s\S]{0,120}'padrao',\s*\n\s*'mensalista',\s*\n\s*'professor',/)
  assert.match(types, /export function isReservedPriceTableKind/)
})

test('o banco recusa o rename mesmo se o web tentar', { skip: !hasDbRepo }, () => {
  const sql = readMigration('20260910120000_court_price_tables_reserved_names.sql')

  assert.match(
    sql,
    /OLD\.tipo <> 'custom' AND NEW\.nome IS DISTINCT FROM OLD\.nome[\s\S]{0,160}RAISE EXCEPTION/,
    'guard de nome ausente'
  )
  // as regras que já existiam continuam no guard recriado
  assert.match(sql, /nao mudam de tipo/)
  assert.match(sql, /nao pode virar tipo reservado/)
  assert.match(sql, /Limite de 5 tabelas de preco por espaco/)

  // o índice de lookup por perfil está documentado no schema
  assert.match(sql, /COMMENT ON COLUMN public\.court_price_tables\.tipo IS/)
  assert.match(sql, /COMMENT ON INDEX public\.court_price_tables_one_reserved_type_per_court IS/)
  assert.match(sql, /WHERE court_id = \$1 AND tipo = \$2/, 'documenta como resolver pelo perfil')

  // ── Normalização dos nomes existentes ──────────────────────────────────
  // As três reservadas passam a ter o nome canônico.
  for (const [tipo, nome] of [
    ['padrao', 'Padrão'],
    ['mensalista', 'Mensalista'],
    ['professor', 'Professor'],
  ]) {
    assert.match(
      sql,
      new RegExp(`SET nome = '${nome}'\\s*\\n\\s*WHERE tipo = '${tipo}' AND nome IS DISTINCT FROM '${nome}'`),
      `normalização de ${tipo} ausente`
    )
  }

  // O nome canônico preso numa personalizada é liberado antes, senão o UPDATE
  // colide com o índice único (court_id, lower(nome)).
  assert.match(sql, /lower\(btrim\(t\.nome\)\) IN \('padrão', 'mensalista', 'professor'\)/)
  assert.match(sql, /\(personalizada\)/)
  assert.match(sql, /WHILE EXISTS \(/, 'e o nome liberado também precisa ser único')
})

test('a normalização roda antes do guard que a proibiria', { skip: !hasDbRepo }, () => {
  const sql = readMigration('20260910120000_court_price_tables_reserved_names.sql')

  const dropTrigger = sql.indexOf('DROP TRIGGER IF EXISTS court_price_tables_guard')
  const update = sql.indexOf("SET nome = 'Padrão'")
  const guardRule = sql.indexOf('NEW.nome IS DISTINCT FROM OLD.nome')
  const createTrigger = sql.indexOf('CREATE TRIGGER court_price_tables_guard')

  assert.ok(dropTrigger !== -1 && update !== -1 && guardRule !== -1 && createTrigger !== -1)
  assert.ok(
    dropTrigger < update,
    'o trigger antigo tem que sair antes do UPDATE, senão a regra nova barra a própria normalização'
  )
  assert.ok(update < guardRule, 'a regra de nome entra depois de os dados já estarem normalizados')
  assert.ok(guardRule < createTrigger, 'e o trigger só volta com a função já substituída')
})
