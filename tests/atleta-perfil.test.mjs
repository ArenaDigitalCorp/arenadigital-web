import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const perfilActions = read('../src/modules/athletes/actions/perfilActions.ts')
const card = read('../src/modules/athletes/components/PerfilAtletaCard.tsx')
const bookingModal = read('../src/modules/bookings/components/BookingModal.tsx')
const mensalistaActions = read('../src/modules/bookings/actions/mensalistaActions.ts')
const athletePage = read('../src/app/dashboard/athletes/[arenaId]/[athleteId]/page.tsx')

const DB_ROOT = fileURLToPath(new URL('../../../arenadigital-db/', import.meta.url))
const hasDbRepo = existsSync(DB_ROOT)
const mig = (name) => readFileSync(`${DB_ROOT}supabase/migrations/${name}`, 'utf8')
const PERFIL = '20260912120000_atleta_perfil_arena.sql'
const CREATE = '20260909120020_mensalista_blocos_create.sql'
const CORRETIVA = '20260912130000_plano_price_table_e_perfis_lista.sql'

// ── O dado que a regra do Professor exige ─────────────────────────────────

test('a tabela escolhida pelo gestor chega ao banco', { skip: !hasDbRepo }, () => {
  // Sem isso não há como distinguir plano de professor de plano de mensalista:
  // a escolha era feita na tela, usada para cotar e descartada no salvar.
  const sql = mig(CORRETIVA)
  assert.match(sql, /p_price_table_id uuid DEFAULT NULL/)
  assert.match(sql, /recorrencia_por_blocos, price_table_id/)
  assert.match(sql, /true, p_price_table_id/)
})

test('e é validada contra o espaço do primeiro bloco', { skip: !hasDbRepo }, () => {
  assert.match(
    mig(CORRETIVA),
    /Tabela de preco nao pertence ao espaco do primeiro bloco/,
    'tabela de outro espaço cotaria errado'
  )
})

test('mudança posterior vira migração nova, não edição da já aplicada', { skip: !hasDbRepo }, () => {
  // O Supabase controla migrations por nome de arquivo: editar uma já aplicada
  // não muda nada no banco, e o ambiente passa a divergir do arquivo.
  assert.doesNotMatch(mig(CREATE), /p_price_table_id/, 'a migração original ficou intacta')
  assert.doesNotMatch(mig(PERFIL), /list_atleta_perfis/, 'idem para a do perfil')

  const corretiva = mig(CORRETIVA)
  assert.match(
    corretiva,
    /DROP FUNCTION IF EXISTS public\.create_monthly_plan_blocks_atomic\(uuid,uuid,uuid,jsonb,numeric,uuid\[\],uuid,date\)/,
    'a assinatura antiga tem que sair para não virar sobrecarga ambígua'
  )
  assert.match(corretiva, /GRANT EXECUTE ON FUNCTION public\.create_monthly_plan_blocks_atomic\(uuid, uuid, uuid, jsonb, numeric, uuid\[\], uuid, date, uuid\) TO service_role/)
})

test('o caminho completo da escolha até a RPC', () => {
  assert.match(bookingModal, /price_table_id: priceTableByCourt\[blocosSelecionados\[0\]\.courtId\] \?\? null/)
  assert.match(mensalistaActions, /price_table_id: uuidSchema\.nullable\(\)\.optional\(\)/)
  assert.match(mensalistaActions, /p_price_table_id: parsed\.price_table_id \?\? null/)
})

test('o caminho legado (uma faixa) não ganhou o parâmetro', () => {
  // create_monthly_plan_atomic não tem o argumento; passá-lo quebraria a chamada.
  const legado = mensalistaActions.slice(
    mensalistaActions.indexOf("'create_monthly_plan_atomic'"),
    mensalistaActions.indexOf("'create_monthly_plan_blocks_atomic'")
  )
  assert.ok(legado.length > 0)
  assert.doesNotMatch(legado, /p_price_table_id/)
})

// ── Derivação ─────────────────────────────────────────────────────────────

test('professor exige plano ativo com tabela de tipo professor', { skip: !hasDbRepo }, () => {
  const sql = mig(PERFIL)
  assert.match(
    sql,
    /JOIN public\.court_price_tables tabela ON tabela\.id = plano\.price_table_id[\s\S]{0,260}tabela\.tipo = 'professor'/
  )
  // plano legado (sem price_table_id) não entra pelo JOIN — é o comportamento pedido
  assert.match(sql, /professor legado e marcado a mao/)
})

test('mensalista é quem responde pela mensalidade, não o participante do rateio', { skip: !hasDbRepo }, () => {
  const sql = mig(PERFIL)
  assert.match(sql, /plano\.athlete_id = p_atleta_id[\s\S]{0,120}plano\.status = 'ativo'/)
  assert.match(sql, /Participante do rateio\s*\n\s*--\s*NAO conta/)
})

test('sem plano ativo o atleta é cliente padrão', { skip: !hasDbRepo }, () => {
  assert.match(mig(PERFIL), /IF array_length\(v_papeis, 1\) IS NULL THEN[\s\S]{0,120}ARRAY\['padrao'\]/)
})

test('a precedência é professor > mensalista > padrão', { skip: !hasDbRepo }, () => {
  const sql = mig(PERFIL)
  const prof = sql.indexOf("array_append(v_papeis, 'professor')")
  const mens = sql.indexOf("array_append(v_papeis, 'mensalista')")
  assert.ok(prof !== -1 && mens !== -1)
  assert.ok(prof < mens, 'professor tem que ser acrescentado primeiro — v_papeis[1] é o sugerido')
  assert.match(sql, /'perfil_sugerido', v_papeis\[1\]/)
})

// ── Sugerido x definido ───────────────────────────────────────────────────

test('o definido pelo gestor ganha do sugerido, e NULL volta ao sugerido', { skip: !hasDbRepo }, () => {
  const sql = mig(PERFIL)
  assert.match(sql, /'perfil_efetivo', COALESCE\(v_vinculo\.perfil, v_papeis\[1\]\)/)
  assert.match(sql, /NULL e legitimo: significa "voltar ao sugerido/)
  assert.match(
    sql,
    /perfil_definido_por = CASE WHEN p_perfil IS NULL THEN NULL ELSE p_registered_by END/,
    'voltar ao sugerido limpa a autoria'
  )
})

test('o perfil é por arena, não do atleta', { skip: !hasDbRepo }, () => {
  const sql = mig(PERFIL)
  assert.match(sql, /ALTER TABLE public\.arenas_atleta/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.atleta\b/, 'não pode ser global')
  assert.match(sql, /id_arena = p_arena_id AND id_atleta = p_atleta_id/)
})

test('o perfil guarda o papel, nunca uma tabela de preço', { skip: !hasDbRepo }, () => {
  const sql = mig(PERFIL)
  assert.match(sql, /CHECK \(perfil IS NULL OR perfil IN \('padrao', 'mensalista', 'professor'\)\)/)
  assert.doesNotMatch(
    sql,
    /perfil[a-z_]* uuid REFERENCES public\.court_price_tables/,
    'tabela é por espaço; um perfil preso a uma quebraria no segundo espaço'
  )
})

test('as RPCs de perfil são server-only', { skip: !hasDbRepo }, () => {
  const sql = mig(PERFIL)
  for (const fn of ['get_atleta_perfil(uuid,uuid)', 'set_atleta_perfil_atomic(uuid,uuid,text,uuid)']) {
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn.replace(/[()]/g, '\\$&')} FROM PUBLIC, anon, authenticated, service_role`))
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn.replace(/[()]/g, '\\$&')} TO service_role`))
  }
  // a derivação é privada e nem o service_role chama direto
  assert.match(sql, /REVOKE ALL ON FUNCTION private\.atleta_papeis_derivados\(uuid,uuid\) FROM PUBLIC, anon, authenticated, service_role/)
})

test('as actions exigem backoffice da arena', () => {
  for (const fn of ['getPerfilAtletaAction', 'setPerfilAtletaAction']) {
    const corpo = perfilActions.slice(perfilActions.indexOf(`export async function ${fn}`))
    assert.match(corpo.slice(0, 500), /await assertArenaBackofficeAccess\(/, `${fn} sem checagem`)
  }
  assert.match(perfilActions, /await requireAuthenticatedDbUser\(\)/)
})

// ── Tela do atleta ────────────────────────────────────────────────────────

test('a tela mostra os papéis detectados e deixa escolher', () => {
  assert.match(athletePage, /<PerfilAtletaCard arenaId=\{arenaId\} atletaId=\{athleteId\} \/>/)
  assert.match(card, /estado\.papeisDetectados\.map/)
  assert.match(card, /PERFIS_ATLETA\.map/)
  assert.match(card, />\s*sugerido\s*<\/span>/, 'o selo de sugerido aparece na opção')
})

test('a tela explica o porquê da sugestão', () => {
  const tipos = read('../src/modules/athletes/types/perfil.types.ts')
  assert.match(tipos, /PERFIL_MOTIVO: Record<PerfilAtleta, string>/)
  assert.match(tipos, /tem recorrência ativa cotada pela tabela Professor/)
  assert.match(card, /porque \{PERFIL_MOTIVO\[estado\.perfilSugerido\]\}/)
  assert.match(card, /Voltar ao sugerido/)
})

test('rótulos e constantes vivem fora do arquivo de actions', () => {
  // É a causa raiz do "Atleta não encontrado": constante exportada de um
  // arquivo 'use server' derruba o módulo em runtime.
  const actions = read('../src/modules/athletes/actions/perfilActions.ts')
  assert.match(actions, /^\s*'use server'/)
  assert.doesNotMatch(actions, /^export const/m)
  assert.match(
    read('../src/modules/athletes/types/perfil.types.ts'),
    /export const PERFIS_ATLETA/
  )
})

// ── O perfil escolhendo a tabela ──────────────────────────────────────────

test('professor cai na tabela Professor na aba Mensal', () => {
  assert.match(
    bookingModal,
    /perfilAtleta === 'professor' \? 'professor' : 'mensalista'/
  )
  assert.match(bookingModal, /tables\.find\(\(t\) => t\.tipo === papel\)/)
  // e continua caindo na Mensalista quando não há tabela do papel
  assert.match(bookingModal, /tables\.find\(\(t\) => t\.tipo === 'mensalista'\) \?\?/)
})

test('o perfil que chega atrasado não deixa a escolha errada', () => {
  // O perfil e as tabelas carregam em paralelo. Sem isto, um professor ficaria
  // com a Mensalista escolhida antes de o perfil ser conhecido.
  assert.match(bookingModal, /const tabelasAutomaticas = useRef<Set<string>>/)
  assert.match(bookingModal, /if \(anterior !== proximo && tabelasAutomaticas\.current\.size > 0\)/)
  assert.match(bookingModal, /for \(const courtId of tabelasAutomaticas\.current\) delete next\[courtId\]/)
  assert.match(bookingModal, /perfilAtleta\]\);/, 'o efeito declara a dependência')
})

test('escolha manual do gestor não é sobrescrita pelo perfil', () => {
  assert.match(bookingModal, /tabelasAutomaticas\.current\.delete\(cid\)/)
  assert.match(bookingModal, /Escolha do gestor: o perfil não sobrescreve mais/)
})

test('o perfil só interfere no plano mensal, não no avulso', () => {
  assert.match(bookingModal, /bookingType !== 'mensal'/)
  // a aba avulso segue com o seu próprio seletor, intocado
  assert.match(bookingModal, /onValueChange=\{setAvulsoPriceTableId\}/)
})

// ── Regra do Next que derruba o módulo inteiro em runtime ─────────────────

test("arquivo 'use server' só exporta função async", async () => {
  // Exportar uma constante de um arquivo 'use server' não quebra tsc, nem lint,
  // nem `next build` — quebra na avaliação do módulo, em runtime, derrubando a
  // página que o importa. Foi exatamente o que aconteceu com PERFIS_ATLETA.
  const { readdirSync, statSync } = await import('node:fs')
  const { join } = await import('node:path')

  const raiz = fileURLToPath(new URL('../src', import.meta.url))
  const arquivos = []
  const andar = (dir) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) andar(caminho)
      else if (/\.tsx?$/.test(nome)) arquivos.push(caminho)
    }
  }
  andar(raiz)

  const problemas = []
  for (const caminho of arquivos) {
    const conteudo = readFileSync(caminho, 'utf8')
    if (!/^\s*['"]use server['"]/.test(conteudo)) continue

    for (const m of conteudo.matchAll(/^export\s+(?!async\s+function\b)(?!type\b)(?!interface\b)(\S+)/gm)) {
      problemas.push(`${caminho.replace(raiz, 'src')}: export ${m[1]}`)
    }
  }

  assert.deepEqual(
    problemas,
    [],
    'arquivo "use server" só pode exportar funções async (tipos e interfaces são apagados na compilação)'
  )
})

// ── Listagem de atletas: coluna, filtro e ordenação ───────────────────────

test('o perfil de todos os atletas vem numa chamada só', { skip: !hasDbRepo }, () => {
  const sql = mig(CORRETIVA)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.list_atleta_perfis\(p_arena_id uuid\)/)
  // reusa a regra em vez de reescrevê-la em forma de agregação — duas cópias da
  // mesma regra saem do ar uma da outra
  assert.match(sql, /SELECT private\.atleta_papeis_derivados\(p_arena_id, vinculo\.id_atleta\) AS papeis/)
  assert.match(sql, /COALESCE\(vinculo\.perfil, derivados\.papeis\[1\]\)/)
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.list_atleta_perfis\(uuid\) TO service_role/
  )
})

test('a listagem carrega atletas e perfis em paralelo', () => {
  const list = read('../src/modules/athletes/components/AthletesList.tsx')
  assert.match(list, /await Promise\.all\(\[\s*\n\s*getAthletesByArenaAction\(arenaId\),\s*\n\s*listPerfisAtletaAction\(arenaId\),/)
  // perfil indisponível não pode derrubar a lista
  assert.match(list, /perfisRes\.success && perfisRes\.data \? perfisRes\.data : \{\}/)
})

test('sem perfis disponíveis, a tela não inventa "Cliente padrão"', () => {
  const list = read('../src/modules/athletes/components/AthletesList.tsx')
  assert.match(list, /const perfisDisponiveis = Object\.keys\(perfis\)\.length > 0/)
  assert.match(list, /!perfisDisponiveis && 'hidden'/, 'o filtro some em vez de mentir')
  assert.match(list, /perfilFiltro === 'todos' \|\| !perfisDisponiveis/)
})

test('o filtro por perfil mostra a contagem de cada um', () => {
  const list = read('../src/modules/athletes/components/AthletesList.tsx')
  assert.match(list, /\(\['todos', \.\.\.PERFIS_ATLETA\] as const\)\.map/)
  assert.match(list, /const contagem = useMemo/)
  assert.match(list, /\(perfis\[a\.id\] \?\? 'padrao'\) === perfilFiltro/)
})

test('a tabela tem coluna de perfil e cabeçalhos ordenáveis', () => {
  const tabela = read('../src/modules/athletes/components/AthletesTable.tsx')
  assert.match(tabela, /<Ordenavel coluna="name"/)
  assert.match(tabela, /<Ordenavel coluna="sport"/)
  assert.match(tabela, /<Ordenavel coluna="perfil"/)
  assert.match(tabela, /PERFIL_BADGE\[perfis\[athlete\.id\]\]/)
  // a coluna nova entrou na contagem do colspan dos estados vazios
  assert.match(tabela, /colSpan=\{7\}/)
  assert.doesNotMatch(tabela, /colSpan=\{6\}/)
})

test('o cabeçalho ordenável não é recriado a cada render', () => {
  // Definido dentro do componente, o React remonta o cabeçalho inteiro a cada
  // render — e o ESLint reprova com "Cannot create components during render".
  const tabela = read('../src/modules/athletes/components/AthletesTable.tsx')
  const inicioComponente = tabela.indexOf('export function AthletesTable')
  assert.ok(
    tabela.indexOf('function Ordenavel(') < inicioComponente,
    'Ordenavel tem que ser definido no módulo, fora do render'
  )
})

test('a ordenação respeita acentuação do português', () => {
  const tabela = read('../src/modules/athletes/components/AthletesTable.tsx')
  assert.match(tabela, /localeCompare\(valor\(b\), "pt-BR", \{ sensitivity: "base" \}\)/)
})

// ── Índice de apoio para list_atleta_perfis não virar N sequential scans ──

test('planos_mensalista ganha índice de apoio, sem CONCURRENTLY dentro da migration', { skip: !hasDbRepo }, () => {
  const sql = mig('20260912140000_planos_mensalista_lookup_index.sql')
  assert.match(
    sql,
    /CREATE INDEX IF NOT EXISTS planos_mensalista_arena_athlete_status_idx\s*\n\s*ON public\.planos_mensalista \(arena_id, athlete_id, status\)/
  )
  // Supabase roda migration dentro de transação — CONCURRENTLY aqui quebraria o deploy.
  assert.doesNotMatch(sql, /CREATE INDEX CONCURRENTLY/)
  assert.match(sql, /SET lock_timeout = '5s'/)
  assert.match(sql, /RESET lock_timeout/)
})

test('o índice novo está documentado no runbook de rollout', { skip: !hasDbRepo }, () => {
  const doc = readFileSync(
    `${DB_ROOT}docs/operations/integrity-performance-rollout.md`,
    'utf8'
  )
  assert.match(doc, /20260912140000.*planos_mensalista\(arena_id, athlete_id, status\)/)
})
