# PLANO — Tabelas de preço por espaço

> Status: **planejamento** (não implementado)
> Branch de trabalho: `feat/tabelas-preco-espacos`
> Repositórios afetados: `arenadigital-db` (schema/RPC/RLS), `arenadigital-web` (backoffice), `arenadigital-app` (exibição)

### Decisões travadas (2026-09-03)

1. **Arquitetura**: modelo **relacional** novo + função canônica `resolve_court_price()` única no banco. (descartado: namespacing dentro do `day_config`).
2. **Reserva que cruza faixas**: o resolver **soma faixa a faixa** (cada hora precificada pela faixa em que cai) e devolve um **valor total sugerido**. Pode alterar valores hoje exibidos em reservas longas — comunicar no changelog.
3. **Autonomia do gestor no backoffice**: o valor sugerido pela tabela é **sempre editável no momento da reserva**. O gestor vê o total calculado e pode digitar qualquer valor. A RPC de backoffice grava `price_table_id` (rastreabilidade) + o **valor efetivo** informado pelo gestor; `resolve_court_price` serve para sugerir, não para travar. (O app não tem override — ver §6.)
4. **Dia da semana** nas tabelas novas: índice numérico `0–6` (0=domingo), com adapter na leitura do `day_config` legado (nome PT).
5. **As 3 tabelas default são permanentes**: a config atual de preço do espaço vira a `Padrão`. `Mensalista` e `Professor` são criadas **vazias** (dias desabilitados, sem faixas). As 3 podem ser renomeadas e editadas, **não podem ser excluídas** nem mudar de `tipo`.
6. **Editor com atalhos de preenchimento** (porque as defaults nascem vazias): copiar as faixas da `Padrão` para a tabela atual (dia a dia e "copiar tudo"), aplicar um valor a todos os dias, e o "Replicar" por dia que já existe.
7. **Limite de 5 tabelas por espaço** (as 3 default + até 2 personalizadas).
8. **App e catálogo público usam só a `Padrão`**. O atleta no app vê apenas a tabela `Padrão`. `Mensalista`/`Professor` são de uso interno do backoffice.
9. **Sugestão pode vir 0**: enquanto a arena não preencher a `Mensalista`/`Professor`, a reserva desse tipo sugere R$ 0 e o gestor digita o valor (hoje o `valor_mensal` já é digitado à mão — sem regressão).
10. **`booking_type = 'unique'`**: as tabelas/faixas valem também para espaços "Valor único"; nesses, `resolve_court_price` devolve o **valor fixo da faixa** que cobre o horário, **sem multiplicar pela duração** (o `hourly` soma por hora). Normalmente 1 faixa cobre o dia; day-part opcional.

---

## 1. Objetivo

Hoje cada espaço (`courts`) tem **uma única** grade de preços por dia/horário, guardada em `courts.day_config` (JSONB). A reserva usa esse valor como sugestão editável e o **servidor confia no valor enviado pelo cliente** (backoffice) ou o recalcula do `day_config` (app).

Queremos que cada espaço tenha **múltiplas tabelas de preço**:

- 3 tabelas **default por arena/espaço**: `Padrão`, `Mensalista`, `Professor`.
- A arena pode criar **quantas tabelas quiser** (nome livre).
- Cada tabela mantém **faixas de horário/preço por dia da semana** exatamente como hoje (o que muda é ter N tabelas, não a mecânica das faixas).
- Na reserva:
  - **Avulsa** → usa a tabela `Padrão` por padrão, com **troca manual** para qualquer outra.
  - **Mensalista** → usa a tabela `Mensalista` por padrão, com **troca manual**.
- No momento da reserva o valor **tem que vir da tabela escolhida + faixa de horário**, calculado e validado no servidor (não só sugerido no cliente).

---

## 2. Estado atual (inventário de tudo que toca preço)

### 2.1 Banco (`arenadigital-db`)

| Objeto | Papel hoje |
|---|---|
| `courts.day_config jsonb` | Array com 1 entrada por dia: `{ day: "Segunda-feira", enabled, startTime, endTime, slotShiftTime, price, customPrices: [{id,start,end,price}], defaultTierId }`. `price` = faixa padrão (lacuna); `customPrices` = demais faixas. |
| `courts.price numeric(10,2)` | Fallback plano legado (o web grava `enabledDays[0].price` ao salvar). |
| `courts.available_days text[]` | Lista de dias habilitados (derivado). |
| `bookings.price` / `bookings.rental_price` | Valor efetivamente cobrado (snapshot). **Não há** referência à tabela de preço. |
| `planos_mensalista.valor_mensal numeric NOT NULL` | Valor mensal **100% manual** hoje. |
| `mensalista_mensalidades.valor_total` | Cópia de `valor_mensal` por competência (via `mensalista_generate_mensalidades`). |
| `mensalista_cobrancas.valor_devido` | Resultado do rateio de `valor_total`. |
| `app_booking_requests.quoted_rental_price` | Cotação do app, resolvida **no servidor** (não confia no app). |
| `app_online_booking_operations.quoted_rental_price` + `amount_cents` | Idem, com `CHECK amount_cents = round(quoted_rental_price*100)`. |

**Funções SQL que já resolvem preço a partir de `day_config`** (todas parseiam o JSON inline):

- `20260715160000_mobile_backend_security_hardening.sql` — reserva mobile (RPC legado).
- `20260801230000_secure_mobile_booking_rpc.sql` — reserva do próprio atleta, preço derivado no servidor.
- `20260830120000_app_booking_requests.sql` → `private.resolve_app_booking_request_quote(...)`.
- `20260901140000_app_online_booking_contract.sql` → usa `private.resolve_app_booking_request_quote(...)`.

**RPCs que confiam no preço do cliente** (backoffice):

- `save_backoffice_booking_bundle_atomic(p_rental_price, ...)` — avulsa (única/recorrente/rateio).
- `update_backoffice_booking(p_price, ...)`.
- `create_backoffice_booking` / `create_backoffice_bookings` (`p_price`).
- `create_monthly_plan_atomic(p_valor_mensal, ...)` — plano mensalista.
- `confirm_monthly_plan_month_atomic` — deriva `price/rental_price = valor_total / sessoes_por_mes`.

### 2.2 Web (`arenadigital-web`)

| Arquivo | Papel |
|---|---|
| `src/modules/courts/schemas/court.schema.ts` | `day_config: z.array(z.any())`. |
| `src/modules/courts/components/DayScheduleConfig.tsx` | **Editor das faixas** de um dia: converte `config` ↔ `tiers` contíguos, faixa padrão implícita (`defaultTierId` no formato `default-HH:MM`), suporte a virada de meia-noite e `slotShiftTime`. **Reaproveitável por tabela.** |
| `src/modules/courts/components/CourtForm.tsx` | Monta `dayConfigs[7]`, grava `day_config`, `available_days`, `price = enabledDays[0].price`. Botão "Replicar" copia um dia para os demais. |
| `src/modules/courts/actions/courtActions.ts` | `create/update/duplicate/deleteCourtAction` — grava `day_config` cru. |
| `src/modules/bookings/utils/court-slots.ts` | `getSlotPrice()`, `generateSlotsForDate/DayConfig`, `findDayConfig`, `isSlotWithinDayConfig`, `blocksAvailability`. Fonte "oficial" compartilhada. |
| `src/modules/bookings/components/CourtCalendarPageClient.tsx` | **Reimplementa `getSlotPrice` localmente** (linha ~329); passa `defaultPrice` ao `BookingModal`. |
| `src/modules/bookings/components/DayOperationBoard.tsx` | Usa `getSlotPrice` de `court-slots`; `setSlotPrice`; passa ao `BookingModal` (`variant='page'` interativo). |
| `src/modules/bookings/components/DayOperationModal.tsx` | Wrapper do board. |
| `src/modules/bookings/components/BookingModal.tsx` | Recebe `defaultPrice`; abas **Avulso** (campo editável `courtPrice`, serviços, recorrência, rateio) e **Mensal** (`valorMensal` manual, sessões/mês). Envia `rentalPrice` / `valor_mensal`. |
| `src/modules/bookings/actions/bookingActions.ts` | `saveBackofficeBookingBundleAction` (envia `rentalPrice`), `updateBookingAction`, `createBookingAction`, `createRecurringBookingsAction`. |
| `src/modules/bookings/actions/mensalistaActions.ts` | `createPlanoMensalistaAction` → `create_monthly_plan_atomic` (envia `valor_mensal`). |
| `src/modules/bookings/actions/appBookingRequestActions.ts` + `AppBookingRequestsPageClient.tsx` | Exibem `quotedRentalPrice`; aprovar cria booking via `review_app_booking_request`. |
| `src/modules/mensalistas/*` (`MensalistasOverviewClient`, `MensalistaDetailClient`, `mensalistaActions.ts`, `RateioModal`, ...) | Camada de cobrança. `valor_devido` deriva de `valor_mensal`. Nenhuma lógica de faixa aqui — só consome o valor do plano. |
| `src/modules/bookings/components/MensalistaModal.tsx` / `MensalistasView.tsx` / `MensalistasPageClient.tsx` | **Legado**, só usado no caminho `?tutorial=1`. |
| `src/modules/arenas/components/ArenaDetailPageClient.tsx` (~194–209) | Preview do preço do dia na listagem de espaços. |
| `src/modules/dashboard/actions/dashboardActions.ts` (~45–111) | Projeção de receita/ocupação a partir do `day_config`. |
| `src/modules/ai-agent/tools/agent-tools.ts` | `get_pricing` (monta faixas do `day_config`), `check_availability`. |
| `src/lib/tutorial-mock-data.ts` | Mocks com `day_config: []`. |
| `src/types/supabase.types.ts` | Tipos gerados — **regerar** após migração. |
| Catálogo público / import (`platform-admin/PublicArenaImport*`, `public-arena-catalog`) | Verificar se exibem preço de quadra ao público. |

### 2.3 App (`arenadigital-app`)

- Só **exibe** `quotedRentalPrice` devolvido pela RPC (`src/domains/jogos/preReservas.service.ts`, `src/components/jogos/PreReservasTab.tsx`). Não calcula preço.
- `Rotativos` têm `valor` próprio (não usam tabela de preço de quadra) — fora de escopo.

---

## 3. Decisão de arquitetura

**Recomendação: modelo relacional novo + 1 função canônica de precificação no banco.**

Motivos:

1. Já existem **4+ parsers de `day_config` em SQL** e **3 cópias de `getSlotPrice` em TS**. Multiplicar isso por N tabelas dentro de um JSON aninhado é insustentável.
2. O requisito central é o **servidor** decidir o preço pela tabela + faixa. Isso pede uma função SQL única, testável, usada por todas as RPCs (backoffice e app).
3. Relacional destrava: listar/duplicar tabelas, reajuste em massa por tabela (igual ao catálogo), histórico de preço no futuro, RLS limpa.

Alternativa descartada (namespacing dentro de `courts.day_config`): menos migração agora, mas mantém a duplicação de parsing e dificulta consulta/rateio/reajuste.

### 3.1 Modelo de dados novo (`arenadigital-db`)

```
court_price_tables
  id            uuid pk
  court_id      uuid not null  → courts(id) on delete cascade
  arena_id      uuid not null            -- denormalizado p/ RLS (== courts.arena_id)
  nome          text not null
  tipo          text not null default 'custom'
                check (tipo in ('padrao','mensalista','professor','custom'))
  is_default    boolean not null default false   -- tabela usada na reserva avulsa
  aplica_a      text[] not null default '{}'     -- p/ pré-seleção no modal: {'avulso'} | {'mensalista'} | ...
  ativo         boolean not null default true
  ordem         int not null default 0
  created_at    timestamptz not null default now()
  -- únicos:
  unique (court_id, lower(nome))
  unique (court_id) where is_default            -- exatamente 1 default por espaço
  unique (court_id, tipo) where tipo <> 'custom' -- 1 Padrão/Mensalista/Professor por espaço
  -- máx. 5 tabelas por court e proibição de excluir/mudar tipo das 3 default: por trigger.

court_price_table_days
  id             uuid pk
  price_table_id uuid not null → court_price_tables(id) on delete cascade
  arena_id       uuid not null            -- denormalizado p/ RLS uniforme
  dia_semana     smallint not null check (dia_semana between 0 and 6)  -- 0=domingo (alinha com JS getDay/Postgres DOW)
  habilitado     boolean not null default false   -- tabelas Mensalista/Professor nascem SEM linhas aqui
  hora_inicio    time not null
  hora_fim       time not null              -- <= hora_inicio ⇒ vira a meia-noite
  slot_shift_time time null
  preco_base     numeric(10,2) not null default 0   -- valor PADRÃO do dia (fallback + reajuste em massa)
  unique (price_table_id, dia_semana)

court_price_table_bands            -- APENAS as faixas de exceção (equivale ao customPrices do day_config)
  id                  uuid pk
  price_table_day_id  uuid not null → court_price_table_days(id) on delete cascade
  arena_id            uuid not null
  hora_inicio         time not null
  hora_fim            time not null
  preco               numeric(10,2) not null check (preco >= 0)
  ordem               int not null default 0
  -- O valor "padrão" NÃO vira faixa: fica em court_price_table_days.preco_base.
  -- Contiguidade/não-sobreposição = responsabilidade do editor web + RPC de escrita (Fase 2).
```

> **Decisão de implementação (Fase 1):** o modelo é `preco_base` (dia) **+ faixas de exceção esparsas** — reproduz exatamente o `getSlotPrice`/`resolve_app_booking_request_quote` atuais (`preço do dia`, sobrescrito quando o slot cai numa exceção). Não há coluna `is_base`. Guards por trigger nesta fase: **cap de 5 tabelas por espaço** (BEFORE INSERT) e **`tipo` imutável** nas 3 default (BEFORE UPDATE). Proteção contra DELETE das default e validação de sobreposição de faixas ficam na RPC de escrita da Fase 2 (evita conflito com o `ON DELETE CASCADE` de `courts`).

Colunas de snapshot nas tabelas existentes (todas **nullable**, aditivas):

```
bookings.price_table_id                       uuid null → court_price_tables(id) on delete set null
planos_mensalista.price_table_id              uuid null → court_price_tables(id) on delete set null
app_booking_requests.price_table_id           uuid null
app_online_booking_operations.price_table_id  uuid null
```

`courts.day_config` e `courts.price` **permanecem** durante a transição (espelho da tabela `Padrão`), removidos só na fase de limpeza.

### 3.2 Função canônica

```sql
public.resolve_court_price(
  p_court_id       uuid,
  p_price_table_id uuid,          -- null ⇒ usa a tabela is_default do espaço
  p_start          timestamptz,
  p_end            timestamptz
) returns numeric                 -- STABLE, SECURITY DEFINER
```

- Resolve no fuso da arena (America/Sao_Paulo — mesmo tratamento UTC-3 já usado).
- Trata virada de meia-noite (usa o dia anterior quando o slot cai na madrugada da janela iniciada no dia anterior).
- Respeita `courts.booking_type` (ver §8.1):
  - `hourly` → **soma faixa a faixa** ao longo do intervalo (hoje os resolvers usam só o preço do slot inicial).
  - `unique` (valor único) → devolve o **valor fixo da faixa** que cobre o horário, **sem multiplicar pela duração**.
- Se o dia da tabela estiver `habilitado = false` ou sem faixas ⇒ devolve `0` (sugestão neutra; o gestor digita — decisão travada 9).
- `p_price_table_id` inválido/de outro espaço ⇒ erro.
- Devolve **sugestão**. Quem trava o valor é: o app (sem humano) usa o resultado direto; o **backoffice sobrescreve livremente** (ver decisão travada 3 e §5).
- Fonte única para: sugestão das RPCs de backoffice, `resolve_app_booking_request_quote`, RPC de reserva do atleta, cotação do modal (via server action).

Server action nova no web: `quoteCourtPriceAction(courtId, priceTableId, startISO, endISO)` → `{ value }` (chama a função; usada pelo `BookingModal` para pré-preencher o campo, que segue editável).

---

## 4. Mudanças no backoffice web

### 4.1 Cadastro/edição de espaço (menu Espaços)

- Novo bloco **"Tabelas de preço"** substituindo o bloco único atual:
  - Abas/acordeão: `Padrão` · `Mensalista` · `Professor` · (até 2 personalizadas) · **+ Nova tabela** (desabilitado ao atingir 5 — decisão travada 7).
  - Cada aba renderiza os 7 `DayScheduleConfig` **sem alteração da mecânica de faixas** (reuso direto).
  - Ações por tabela: renomear, editar faixas; nas personalizadas também: definir como padrão (avulso), marcar `aplica_a`, ativar/desativar, excluir. As 3 default **não** têm excluir nem trocar tipo (decisão travada 5).
  - **Atalhos de preenchimento** (as default Mensalista/Professor nascem vazias — decisão travada 6):
    - "Copiar faixas da Padrão" — por dia e botão "copiar todos os dias" (traz horários + faixas + valores da `Padrão` para editar).
    - "Aplicar este valor a todos os dias" no editor de um dia.
    - "Replicar" por dia já existente.
    - Estado vazio da aba mostra CTA "Comece a partir da Padrão" ou "Configurar do zero".
- `court.schema.ts`: novo `priceTables` no schema (zod), `day_config` vira derivado/legado.
- Server actions novas em `courtActions.ts`:
  - `listCourtPriceTablesAction(arenaId, courtId)`
  - `upsertCourtPriceTableAction(arenaId, courtId, table)` (cabeçalho + dias + faixas, transacional via RPC; valida limite de 5 e imutabilidade das default)
  - `deleteCourtPriceTableAction(arenaId, courtId, tableId)` (só personalizadas)
  - `setDefaultCourtPriceTableAction(arenaId, courtId, tableId)`
- `createCourtAction`: ao criar espaço, **semear** as 3 tabelas default (RPC `seed_court_price_tables` ou trigger `AFTER INSERT ON courts`). A grade que o usuário preencheu na criação vai para a `Padrão`; `Mensalista` e `Professor` nascem **vazias** (dias desabilitados, sem faixas).
- `duplicateCourtAction`: copiar também as `court_price_tables` do original (respeitando o limite de 5).

### 4.2 Modal de reserva (`BookingModal.tsx`)

Princípio: **o sistema sempre soma e sugere o total pela tabela + faixa; o gestor sempre pode sobrescrever** o valor no momento da reserva e cobrar o que quiser.

- **Aba Avulso**:
  - Novo `Select` **"Tabela de preço"** (default = tabela `is_default` do espaço; opções = tabelas ativas).
  - Ao abrir, ao trocar tabela, ao mudar horário início/fim/data → chamar `quoteCourtPriceAction` e **pré-preencher** o campo "Valor pago" (`courtPrice`). O campo **permanece totalmente editável**; o gestor pode digitar qualquer valor.
  - UX sugerida: mostrar a sugestão ao lado do campo (ex.: "Sugerido pela tabela: R$ X") e, se o gestor editar, um selo discreto "valor ajustado manualmente" + botão "voltar ao sugerido".
  - Enviar `priceTableId` **e** `rentalPrice` (valor efetivo, possivelmente editado) no `BackofficeBookingBundleInput`.
- **Aba Mensal**:
  - Novo `Select` **"Tabela de preço"** (default = tabela `tipo='mensalista'`).
  - `valorMensal` **sugerido** = `resolve_court_price(dia/horário)` × `sessoes_por_mes`; campo editável, gestor pode sobrescrever.
  - Enviar `price_table_id` **e** `valor_mensal` (efetivo) em `CreatePlanoMensalistaInput`.
- **Edição de reserva avulsa**: mostrar a tabela usada (snapshot) e permitir trocar; recalcular sugestão; valor segue editável.
- **Recorrência**: a sugestão é recalculada por ocorrência (mesmo dia/horário ⇒ mesma faixa), mas o valor digitado pelo gestor vale para todas as ocorrências do lote (comportamento atual mantido).

### 4.3 Grade / calendário

- `CourtCalendarPageClient` e `DayOperationBoard`: a grade mostra o preço da **tabela default (avulso)** por slot.
  - Remover as 3 cópias de `getSlotPrice`; criar **um** util TS (`resolveSlotPrice(priceTableDays, date, slot)`) + **adapter** `legacyDayConfigToPriceTableDays(day_config)` para o período de transição.
  - Opcional (nice-to-have): seletor de tabela no topo da grade para pré-visualizar outras.
- `defaultPrice` passado ao `BookingModal` continua sendo o da tabela default; o modal recalcula ao trocar.

### 4.4 Outros consumidores

- `dashboardActions.ts` (projeção de receita): usar tabela default.
- `agent-tools.ts` `get_pricing`: retornar as tabelas relevantes (mínimo `Padrão` + `Mensalista`), deixando claro qual é qual. `check_availability` inalterado.
- `ArenaDetailPageClient` preview: preço da tabela `Padrão`.
- Catálogo público / discovery: preço da tabela `Padrão` (decisão travada 8).

---

## 5. Mudanças nas RPCs (`arenadigital-db`)

| RPC | Mudança |
|---|---|
| `save_backoffice_booking_bundle_atomic` | Novo `p_price_table_id` (obrigatório, para snapshot/rastreio). `p_rental_price` = **valor efetivo que o gestor confirmou** e é o que se cobra (o backoffice pode sobrescrever a sugestão à vontade); servidor só valida `>= 0`. `resolve_court_price` **não trava** o valor aqui — serve só para a sugestão calculada no modal. Grava `bookings.price_table_id` + `price/rental_price`. |
| `update_backoffice_booking` | Idem (`p_price_table_id` + `p_price` efetivo editável). |
| `create_backoffice_booking` / `create_backoffice_bookings` | Idem. |
| `create_monthly_plan_atomic` | Novo `p_price_table_id` (snapshot). `p_valor_mensal` = valor efetivo confirmado pelo gestor (editável; sugestão = `resolve_court_price × sessoes_por_mes` calculada no web). Grava `planos_mensalista.price_table_id` + `valor_mensal`. |
| `confirm_monthly_plan_month_atomic` | Sem mudança estrutural (continua `valor_total / sessoes`); `valor_total` agora tem origem rastreável. |
| `private.resolve_app_booking_request_quote` | Passar a usar `resolve_court_price` com a tabela **default** do espaço (ou por `app_booking_mode` no futuro). Grava `price_table_id`. |
| RPCs de reserva mobile (`secure_mobile_booking_rpc`, `mobile_backend_security_hardening`) | Trocar parsing inline de `day_config` por `resolve_court_price` (tabela default). |
| Reajuste em massa (novo, opcional) | `bulk_adjust_court_prices(arena_id, price_table_id?, tipo, valor, arredondamento)` espelhando o padrão do catálogo. |

RLS: `court_price_tables*` seguem a política de `courts` (`is_arena_backoffice_member(arena_id)` para escrita; leitura conforme necessidade do app). `resolve_court_price` como `SECURITY DEFINER` com checagem de pertencimento.

---

## 6. App mobile (`arenadigital-app`)

- **Sem mudança obrigatória** nesta entrega: o preço continua vindo da RPC, que resolve **sempre pela tabela `Padrão`** do espaço. O atleta só enxerga a `Padrão` (decisão travada 8).
- Como a `Padrão` é a tradução 1:1 do `day_config` atual, nada muda para o app na migração — exceto o cálculo passar a **somar faixa a faixa** em reservas que cruzam faixas (hoje já é o comportamento server-side do quote do app; confirmar em teste).
- **Fora de escopo**: `Mensalista`/`Professor` no app, "reserva mensalista pelo app", tabela por atleta.

---

## 7. Migração da base legada

Ordem **DB → web → DB → limpeza**, cada passo compatível com a versão anterior (AGENTS.md).

**Fase 1 — DB aditivo (nada quebra) — RASCUNHO PRONTO em `arenadigital-db`:**
- `supabase/migrations/20260904120000_court_price_tables.sql` — tabelas, `preco_base` + faixas de exceção, `resolve_court_price` (hourly soma / unique flat / 0 fora da grade), `private.court_price_at_instant`, `private.court_price_table_translate_legacy`, `private.seed_court_price_tables`, trigger `AFTER INSERT ON courts`, guards (cap 5 + `tipo` imutável), RLS (`can_access_arena_backoffice`), colunas `price_table_id` em `bookings`/`planos_mensalista`/`app_booking_requests`/`app_online_booking_operations`, backfill de todos os `courts`.
- `supabase/migrations/20260904120010_court_price_tables_acl.sql` — `EXECUTE` de `resolve_court_price` e `seed_court_price_tables` só para `service_role`.
- `supabase/tests/20260904120000_court_price_tables_test.sql` — 27 asserts pgTAP.
- `docs/court-price-tables.md` — contrato.
- **Backfill de `planos_mensalista.price_table_id`** para a tabela `Mensalista` do espaço: **não incluído nesta migração** (as tabelas nascem vazias; o vínculo é feito quando o gestor edita o plano na Fase 2). Reavaliar.
- **Pendente:** rodar `supabase db reset --local` + `npm run test` (pgTAP) — não validado localmente ainda (sem Docker/CLI nesta máquina).

**Fase 2 — Web (feita):** editor multi-tabela (`PriceTablesConfig`) com **dois modos** — persistido na edição (salva por aba, cria/exclui personalizadas, define padrão) e **rascunho no cadastro** (as 3 fixas já preenchidas no formulário, Padrão obrigatória, Mensalista/Professor opcionais, `saveDraftPriceTablesAction` persiste após criar o espaço). `BookingModal` com seletor de tabela + `quoteCourtPriceAction`. Facilidades: copiar faixas da Padrão, replicar dia, limpar tabela, selo de dias por aba.
**Pendente da Fase 2:** regenerar `supabase.types.ts` e atualizar `schema-contracts/arenadigital-web.public-tables.txt` (+3 tabelas); passar `price_table_id` às RPCs de reserva (depende da Fase 3).

**Fase 2b — DB:** trigger de **espelho** `Padrão` → `courts.day_config`/`courts.price` (só quando o editor passa a escrever nas tabelas novas). RPC transacional de escrita de tabela (valida contiguidade/não-sobreposição + imutabilidade das default no DELETE).

**Fase 3 — DB autoritativo:** RPCs de reserva/plano e `resolve_app_booking_request_quote` passam a usar `resolve_court_price` (override só backoffice). App segue igual.

**Fase 4 — App (opcional):** exibir nome da tabela.

**Fase 5 — Limpeza:** parar de ler/escrever `day_config`; remover trigger de espelho; remover cópias TS de `getSlotPrice`; avaliar dropar `courts.price` (ou manter como cache do menor preço para catálogo). Migração final remove/《depreca》`day_config`.

---

## 8. Decisões em aberto (precisam de definição antes de codar)

_Resolvidas (topo): arquitetura relacional; soma faixa a faixa (sugestão); autonomia total do gestor; dia da semana 0–6; branch renomeada; 3 defaults permanentes; Mensalista/Professor vazias + atalhos de preenchimento; limite 5; app/catálogo só Padrão; sugestão pode vir 0; `booking_type='unique'` usa valor fixo da faixa._

1. **Rateio / mensalistas** (não bloqueante): `valor_devido` continua derivando de `valor_mensal`; a única mudança é a origem do `valor_mensal` (agora com `price_table_id` de rastreio). Assumido que não há mais nada a mexer na camada de cobrança — revisar ao chegar na Fase 4.

---

## 9. Ordem de implementação sugerida

| # | Onde | Entrega |
|---|---|---|
| 0 | `arenadigital-db` docs + `arenadigital-web` docs | Contrato em `schema-contracts`, atualizar PRD/SPEC, fechar decisões §8. |
| 1 | `arenadigital-db` | Migração aditiva: tabelas + `resolve_court_price` + colunas nullable + backfill + seed + trigger de espelho + testes SQL. |
| 2 | `arenadigital-web` | `resolveSlotPrice` unificado + adapter legado (com testes). Sem UI ainda. |
| 3 | `arenadigital-web` | Editor multi-tabela em Espaços + server actions + seed no `createCourtAction`. |
| 4 | `arenadigital-web` | `BookingModal` (Avulso + Mensal) com seletor de tabela + `quoteCourtPriceAction`; grava `price_table_id`. |
| 5 | `arenadigital-web` | Grade/calendário, dashboard, `get_pricing`, preview do espaço. |
| 6 | `arenadigital-db` | RPCs recomputam canônico; `resolve_app_booking_request_quote` migra. |
| 7 | `arenadigital-app` | (opcional) exibir tabela aplicada. |
| 8 | ambos | Limpeza: remover `day_config`/duplicações. |

---

## 10. Testes e gates

- **`arenadigital-db`**: `supabase/tests` para `resolve_court_price` — faixa única, múltiplas faixas, virada de meia-noite, `slotShiftTime`, tabela default vs explícita, tabela de outro espaço (erro), reserva multi-hora somando faixas.
- **`arenadigital-web`**: `pnpm test` (resolver TS + adapter legado + cálculo de sugestão do modal), `pnpm test:security`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- **Visual** (mudança de UI): editor de tabelas e `BookingModal` nos estados loading / vazio / erro / permissão / responsivo.
- **Regressão**: reserva avulsa única/recorrente/rateio, plano mensalista + geração de mensalidade + rateio, pré-reserva do app (cotação), operação do dia.

---

## 11. Atualização de PRD/SPEC (obrigatória — CLAUDE.md global)

- **PRD §5.4 Gestão de Quadras**: trocar "Preço da quadra atribuído a dia e horário" por múltiplas tabelas de preço (`Padrão`, `Mensalista`, `Professor` + personalizadas), cada uma com faixas por dia/horário; a reserva escolhe a tabela pelo tipo (avulso → Padrão, mensalista → Mensalista) com troca manual; valor calculado no servidor.
- **SPEC**: nova seção "Tabelas de preço de espaços" (modelo de dados, `resolve_court_price`, RPCs, server actions); atualizar §15.3 (`getSlotPrice` → resolver unificado), §14.4 (`get_pricing`), seção Mensalistas (origem do `valor_mensal`), seção de RPCs de booking.
