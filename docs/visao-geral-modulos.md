# Arena Digital — Web Gestor: Visão Geral dos Módulos

> Pente fino na aplicação: o que cada módulo faz (criar / editar / marcar / excluir) e como tudo se conecta.
> Documento gerado a partir da leitura das `actions` (server actions), repositórios e camada de autenticação.

---

## 1. Como a aplicação está organizada

A web é um **Next.js (App Router)** com arquitetura modular. Cada funcionalidade fica em `src/modules/<módulo>` e segue sempre o mesmo padrão:

| Pasta | Papel |
|---|---|
| `actions/` | **Server Actions** (`"use server"`) — toda criação/edição/exclusão passa por aqui |
| `components/` | Telas e modais (client components) |
| `repositories/` | Acesso ao Supabase (queries) isolado das actions |
| `schemas/` | Validação de input com Zod |
| `types/` | Tipos/DTOs do módulo |
| `usecases/` | Regras de negócio mais complexas (usado em `payments`) |

**Pontos-chave de arquitetura:**
- Todas as queries sensíveis rodam **no servidor com `service_role`** (`getSupabaseAdmin()`), nunca direto do browser.
- Toda action começa validando acesso à arena via `src/lib/server-auth.ts` (ver seção 3).
- O **contexto de arena selecionada** (`ArenaContext`) define qual `arenaId` é usado nas rotas e no menu lateral.

---

## 2. Mapa de navegação (Sidebar)

O menu lateral (`src/components/dashboard/Sidebar.tsx`) é o "índice" da aplicação. A maioria dos itens depende da **arena selecionada** no seletor do topo.

| Item do menu | Rota | Módulo |
|---|---|---|
| Dashboard | `/dashboard` | `dashboard` |
| Espaços | `/dashboard/arenas/[id]` | `arenas` + `courts` + `bookings` |
| Atletas | `/dashboard/athletes/[arenaId]` | `athletes` |
| Estações | `/dashboard/arenas/[id]/stations` | `stations` |
| Catálogo | `/dashboard/settings/products/[id]` | `products` |
| Mensalistas | `/dashboard/arenas/[id]/mensalistas` | `bookings` (planos) |
| Rotativo | `/dashboard/rotativo/[arenaId]` | `rotativos` |
| Programa de fidelidade | `/dashboard/loyalty/[arenaId]` | `loyalty` |
| Financeiro | `/dashboard/finance/[arenaId]` | `finance` |
| Relatórios › Atletas e clientes | `/dashboard/reports/[arenaId]/clientes-overview` | `reports` |
| Relatórios › Pagamentos | `/dashboard/reports/[arenaId]/status-pagamentos` | `reports` |
| Configurações › Usuários | `/dashboard/settings/users/[arenaId]` | `users` |
| Configurações › Assinatura | `/dashboard/settings/subscription/[arenaId]` | `payments` |
| Configurações › Perfil da Arena | `/dashboard/settings/arenas` | `arenas` |

> O menu se adapta ao papel: um **Caixa** vê apenas "Minha estação" (ou "Estações"); **Relatórios** ficam ocultos para Caixa; **Configurações** só aparecem para Admin (Owner/Gestor).

---

## 3. Papéis de acesso e permissões

Definidos em `src/lib/server-auth.ts`. Toda action chama um destes "porteiros" antes de tocar no banco:

| Papel | Descrição |
|---|---|
| **Owner** | Dono da arena (`arenas.owner_id`). Acesso total. |
| **Gestor** | Administrador vinculado (`arena_users.role = 'Gestor'`). |
| **Atendente** | Operacional. Sem acesso a áreas administrativas. |
| **Caixa** | Restrito a uma estação específica (`assignedStationId`). |

| Função guard | Quem passa | Usada em |
|---|---|---|
| `requireAuthenticatedDbUser()` | Qualquer usuário logado e provisionado | Base de tudo |
| `assertArenaAccess()` | Qualquer membro da arena (inclui Caixa) | Estações, comandas, catálogo (leitura) |
| `assertArenaBackofficeAccess()` | Todos **menos Caixa** | Maioria das operações de gestão |
| `assertArenaAdminAccess()` | Apenas Owner/Gestor | Espaços, relatórios, config |
| `assertArenaOwnerAccess()` | Apenas Owner | Operações críticas |
| `assert{Court,Booking,Product,Station,StationOrder,Rotativo}Access()` | Valida que o recurso pertence à arena do usuário | Operações por ID |

Há também um **serviço de auditoria** (`src/modules/audit/audit-log.service.ts`): grava eventos em `audit_logs` de forma "fire-and-forget" (falha de auditoria nunca derruba a operação). Hoje é usado principalmente pelo módulo de pagamentos.

---

## 4. Módulos em detalhe

### 4.1. Arenas (`modules/arenas`)
Cadastro e perfil da arena (o "estabelecimento").

| Pode | Ação | Detalhe |
|---|---|---|
| **Criar** | `createArenaAction` | Cria arena, resolve geolocalização (POINT) a partir do endereço/município, define `owner_id` |
| **Editar** | `updateArenaAction` | Atualiza dados e relê localização |
| **Excluir** | `deleteArenaAction` | Remove a arena |
| Consultar | `getArenaByIdAction` | Detalhe da arena |
| Apoio | `getComodidadesAction`, `getEstadosAction`, `getMunicipiosByEstadoAction`, `getMunicipioByIbgeAction` | Listas auxiliares (comodidades, estados, municípios IBGE) |

**Conecta com:** geocoding (`lib/geocoding`), municípios/estados (IBGE), e é a entidade-raiz de praticamente todos os outros módulos (tudo é escopado por `arena_id`).

---

### 4.2. Courts / Espaços (`modules/courts`)
"Espaços" = quadras/áreas reserváveis da arena.

| Pode | Ação | Detalhe |
|---|---|---|
| **Criar** | `createCourtAction` | Cria espaço + vincula esportes (`court_sports`). **Valida o limite do plano** antes (`assertCanCreateSpaceForArena`) |
| **Editar** | `updateCourtAction` | Atualiza e re-sincroniza esportes |
| **Excluir** | `deleteCourtAction` | Remove o espaço |
| Consultar | `getCourtsByArenaAction`, `getCourtByIdAction` | Lista/detalhe com esportes |
| Apoio | `getSportsForCourtAction` | Lista de esportes disponíveis |

O espaço guarda configuração de horários por dia da semana (`day_config`), usada pelo dashboard para calcular ocupação.

**Conecta com:** `payments` (limite de espaços por plano), `bookings` (reservas acontecem sobre espaços), `dashboard` (ocupação).

---

### 4.3. Bookings / Reservas + Mensalistas (`modules/bookings`)
Coração da agenda. Três frentes: reservas avulsas, recorrentes e planos de mensalista.

**Reservas (`bookingActions.ts`):**
| Pode | Ação | Detalhe |
|---|---|---|
| **Criar** | `createBookingAction` | Cria reserva; se `confirmed` e com preço, gera **transação financeira** "Reserva Avulsa" |
| **Criar (recorrente)** | `createRecurringBookingsAction` | Várias reservas de uma vez; gera 1 transação somando as sessões |
| **Editar** | `updateBookingAction` | Atualiza atleta/esporte/horário/preço |
| **Marcar status** | `updateBookingStatusAction` | `confirmed` ↔ `cancelled` |
| Verificar | `checkBookingConflictsAction` | Detecta choque de horário (não bloqueia, devolve conflitos) |
| Consultar | `getBookingsByCourtAction`, `getBookingsByArenaAction`, `getBookingsByArenaWithSportsAction` | Para calendário/dashboard |

**Serviços na reserva (`bookingServiceActions.ts`):** permite anexar itens do catálogo (tipo *serviço*) a uma reserva.
- `replaceBookingServicesAction` / `syncBookingServicesAndTotalAction` — substitui linhas e recalcula o total (locação + serviços).
- `updateBookingTotalPriceAction` — ajusta valor total.

**Mensalistas (`mensalistaActions.ts`):**
| Pode | Ação | Detalhe |
|---|---|---|
| **Criar plano** | `createPlanoMensalistaAction` | Cria `planos_mensalista` + gera reservas dos próximos 3 meses (mês atual `confirmed`, demais `reservado`) + registra mensalidade do mês 1 |
| **Confirmar mês** | `confirmarMesMensalistaAction` | Confirma o mês mais antigo pendente, registra a mensalidade e **gera o próximo mês** automaticamente |
| **Cancelar plano** | `cancelPlanoMensalistaAction` | Marca plano como `cancelado` e cancela reservas futuras `reservado` |
| Consultar | `getPlanosMensalistaAction` | Lista planos ativos com "próximo mês reservado" |

**Conecta com:** `courts` (espaço da reserva), `athletes` (quem reserva), `finance` (toda reserva paga vira transação `entrada`), `products` (serviços anexados), `reports`/`dashboard`.

---

### 4.4. Athletes / Atletas (`modules/athletes`)
Base de clientes/atletas da arena.

| Pode | Ação | Detalhe |
|---|---|---|
| **Criar + convidar** | `linkAthlete` | Cria usuário no Auth (convite por e-mail p/ definir senha), cria perfil `atleta`, vincula à arena e ao esporte |
| **Vincular existente** | `linkExistingAthleteToArenaAction` | Liga um atleta já existente (achado por CPF) à arena |
| Buscar por CPF | `lookupAthleteByCpfAction` | Verifica se o CPF já existe e se já está vinculado |
| Consultar | `getAthletesByArenaAction` | Lista/busca atletas da arena |
| Detalhe 360° | `getAthleteDetailsAction` | Painel completo: fidelidade, reservas, esportes, rotativos, comandas e pagamentos do atleta |
| Apoio | `getSportsAction`, `getNiveisHabilidadeAction`, `searchMunicipiosAction` | Listas auxiliares |

> O perfil do atleta (`athleteDetailsActions.ts`) é um **agregador**: cruza dados de quase todos os outros módulos para um raio-x do cliente.

**Conecta com:** praticamente todo o sistema — é referenciado por reservas, comandas, rotativos, fidelidade e financeiro.

---

### 4.5. Stations / Estações + Comandas (`modules/stations`)
Pontos de venda da arena (bar, lanchonete etc.) e suas comandas.

**Estações (`stationActions.ts`):**
| Pode | Ação | Detalhe |
|---|---|---|
| **Criar** | `createStationAction` | Nova estação com tipo |
| **Editar** | `updateStationAction` | Atualiza nome/status/tipo |
| Consultar | `getStationsWithMetricsAction` | Estações + métricas (comandas abertas, abertas/fechadas hoje); respeita estação do Caixa |
| Consultar | `getStationWithOrdersAction`, `getStationByIdAction`, `getOrdersByStationAction` | Estação + comandas |
| Apoio | `getStationTypesAction`, `getArenaStationsForCatalogAction` | Tipos de estação / estações p/ catálogo |

**Comandas (`orderActions.ts`):**
| Pode | Ação | Detalhe |
|---|---|---|
| **Abrir comanda** | `createOrderWithItemsAction` | Cria `station_order` + itens; **baixa estoque** (com rollback em erro); valida atleta/cliente da arena |
| **Lançar itens** | `addOrderItemsAction` | Adiciona itens à comanda aberta e baixa estoque |
| **Registrar pagamento** | `addPaymentAction` | Cria `station_payment` |
| **Fechar comanda** | `closeOrderAndGenerateFinanceAction` | Marca `closed` e **gera transações financeiras** (1 por pagamento), com rollback se falhar |
| **Criar cliente** | `createCustomerAction` | Cliente de balcão (não-atleta) |
| **Editar** | `updateOrderAction` | Atualiza a comanda |
| Consultar | `getOrderByIdAction`, `getCustomersByArenaAction` | Detalhe / clientes |

**Conecta com:** `products` (estoque sai a cada item, volta no cancelamento via `restoreStockForOrderAction`), `finance` (fechamento gera entradas), `athletes`/clientes de balcão, `reports`.

---

### 4.6. Products / Catálogo + Estoque (`modules/products`)
Produtos e serviços vendáveis + controle de estoque.

| Pode | Ação | Detalhe |
|---|---|---|
| **Criar** | `createProductAction` | Produto ou serviço (`catalog_kind`) |
| **Editar** | `updateProductAction` | Atualiza item |
| **Excluir** | `deleteProductAction` | Remove item |
| **Entrada de estoque** | `createStockEntryAction` | Registra entrada (`product_stock_entries`) + movimento + novo saldo (com rollback) |
| Saída de estoque | `registerStockOutflowAction` | Baixa avulsa de estoque |
| Restaurar estoque | `restoreStockForOrderAction` | Devolve itens ao estoque ao cancelar comanda |
| Consultar | `getProductsByArenaAction`, `getStockMovementsByProductAction` | Lista / histórico de movimentos |

> Serviços (`catalog_kind = 'service'`) **não** controlam estoque (`skipStockLedger`). Todo movimento fica em `product_stock_movements` com saldo após (`balance_after`).

**Conecta com:** `stations` (comandas consomem produtos), `bookings` (serviços anexados a reservas).

---

### 4.7. Rotativos (`modules/rotativos`)
Sessões "rotativas" (day-use/aulão) com inscrição de atletas e sistema de créditos.

**Sessões:**
| Pode | Ação | Detalhe |
|---|---|---|
| **Criar** | `createRotativoAction` | Cria sessão + vincula quadras |
| **Editar** | `updateRotativoAction` | Atualiza sessão e quadras |
| **Marcar status** | `setRotativoStatusAction` | `ativo` ↔ `desativado` (não reativa após a data) |
| Consultar | `listRotativosAction`, `getRotativosAction`, `getRotativosByMonthAction`, `getRotativoByIdAction` | Listagens/calendário |

**Inscrições e créditos:**
| Pode | Ação | Detalhe |
|---|---|---|
| **Inscrever atleta** | `enrollAthleteAction` | Inscreve pagando avulso (gera transação financeira) **ou** consumindo crédito |
| **Lançar crédito** | `launchRotativoCreditAction` | Vende pacote de créditos (calcula valor pelos pacotes) + gera transação financeira |
| **Salvar pacotes** | `saveRotativoPacotesAction` | Configura pacotes de crédito da arena |
| Prévia | `previewCreditPurchaseValueAction` | Calcula valor antes de confirmar |
| Processar vencidos | `processExpiredRotativoCreditsAction` | Expira créditos vencidos |
| Consultar | `getParticipantsAction`, `getRotativoCreditMovementsAction`, `getTopRotativoAthletesAction`, `getRotativoCourtsAction`, `getRotativoPacotesAction` | Participantes, movimentos, ranking, etc. |

**Conecta com:** `athletes` (inscritos/créditos), `finance` (vendas geram entradas), `courts` (quadras da sessão), `reports`.

---

### 4.8. Finance / Financeiro (`modules/finance`)
Livro-caixa da arena. **É o ponto de convergência financeiro** — quase todos os módulos escrevem aqui.

| Pode | Ação | Detalhe |
|---|---|---|
| **Criar lançamento** | `createTransactionAction` | Entrada ou saída manual |
| **Editar** | `updateTransactionAction` | Atualiza lançamento |
| **Excluir** | `deleteTransactionAction` | Remove lançamento |
| Dashboard | `getFinanceDashboardAction` | Resumo + recentes + série diária (30 dias) |
| Consultar | `getTransactionsAction` | Lista por tipo/período |
| Apoio | `getModoPagamentoAction`, `getMensalistasComPendenciaAction` | Modos de pagamento / pendências de mensalistas |

> Transações automáticas chegam de: **reservas** ("Reserva Avulsa"), **mensalistas** ("Mensalidade"), **comandas** (categoria = tipo da estação), **rotativos** ("Rotativo").

**Conecta com:** todos os módulos que movimentam dinheiro + `reports` + `dashboard`.

---

### 4.9. Loyalty / Programa de Fidelidade (`modules/loyalty`)
Moeda virtual e pontos por atleta.

| Pode | Ação | Detalhe |
|---|---|---|
| **Enviar crédito** | `createCreditTransactionAction` | Crédito de pontos com validade configurável (30d a 2 anos) |
| **Registrar resgate** | `createRedemptionTransactionAction` | Desconta pontos do atleta |
| **Renomear moeda** | `updateCurrencyName` | Define o nome da moeda virtual da arena |
| Consultar | `getLoyaltyDashboardDataAction`, `getLatestCreditsAction`, `getLatestRedemptionsAction`, `getTopAthletesAction`, `getAthletesWithBalanceAction`, `getStatementAction` | Dashboard, extratos, ranking, saldos |
| Buscar | `searchAthletesAction` | Busca atletas para envio/resgate |

**Conecta com:** `athletes` (saldo aparece no perfil 360°), saldo consolidado na view `athlete_loyalty_balance`.

---

### 4.10. Reports / Relatórios (`modules/reports`)
Relatórios consolidados (somente leitura).

| Relatório | Ação | O que mostra |
|---|---|---|
| **Status de pagamentos** | `getPaymentStatusReportAction` | Unifica **5 fontes**: reservas, comandas, inscrições de rotativo, créditos de rotativo e lançamentos manuais — com filtros por período/espaço/esporte/tipo e resumo Pago/Pendente/Cancelado |
| **Visão de clientes** | `getClientesOverviewAction` | Segmenta atletas em categorias: sem reserva, 1 reserva, ativos recentes, frequentes, inativos e aniversariantes |

> O relatório de pagamentos é tolerante a falhas: se uma fonte secundária quebrar, ele loga e segue com as demais (reservas é a fonte principal obrigatória).

**Conecta com:** lê de `bookings`, `stations`, `rotativos`, `finance`, `athletes`.

---

### 4.11. Dashboard (`modules/dashboard`)
Tela inicial com indicadores.

| Pode | Ação | Detalhe |
|---|---|---|
| Consultar | `getDashboardDataAction` | Receita do mês + variação vs. mês anterior, reservas confirmadas hoje, nº de quadras, atletas ativos no mês, e **ocupação por quadra** no dia |

Suporta visão de **uma arena** ou **"todas"** (agrega as arenas que o usuário possui/é vinculado).

**Conecta com:** `finance` (receita), `bookings` (reservas/ocupação), `courts` (quadras + `day_config`).

---

### 4.12. Users / Usuários da Arena (`modules/users`)
Equipe que opera a arena.

| Pode | Ação | Detalhe |
|---|---|---|
| **Criar usuário** | `createArenaUserAction` | Cria no Auth (auto-confirmado) + vincula à arena com papel; Caixa exige estação |
| **Editar** | `updateArenaUserAction` | Atualiza nome/senha/papel/estação/status |
| **Excluir** | `deleteArenaUserAction` | Desvincula; se for o último vínculo, apaga de `users` e do Auth |
| Consultar | `getArenaUsersAction` | Lista a equipe da arena |
| Resolver signup | `resolveSelfServiceArenaSignup` | Consulta o catálogo antes de criar um tenant; cria cliente oculto somente quando não há correspondência e inicia o trial após o provisionamento |

**Conecta com:** `auth` (signup chama a resolução transacional), `platform-admin` (fila de reivindicações), `stations` (Caixa ↔ estação) e `payments` (trial somente após aprovação/provisionamento).

---

### 4.13. Auth (`modules/auth`)
Cadastro/onboarding de gestores.

| Pode | Ação | Detalhe |
|---|---|---|
| **Iniciar cadastro** | `startSignUpAction` | `auth.signUp` com metadata (nome, cpf, telefone, arena, endereço); envia confirmação por e-mail |
| **Resolver pós-cadastro** | `provisionAfterSignUpAction` | Após confirmar o e-mail, resolve a identidade da arena: provisiona um cliente oculto, abre reivindicação de local público ou bloqueia duplicidade/conflito |
| Consultar análise | `/sign-up/status` | Mantém o solicitante autenticado fora do backoffice enquanto o vínculo aguarda revisão |

O CPF/CNPJ informado identifica candidatos, mas não comprova propriedade. Quando uma arena já existe no catálogo público, somente um superadmin pode aprovar o vínculo; a aprovação preserva o `arena_id`, cria o acesso Gestor e só então ativa o plano experimental.

**Conecta com:** `users` (provisionamento), `payments` (trial inicial).

---

### 4.14. Payments / Assinaturas (`modules/payments`)
Cobrança da plataforma (a arena paga para usar o Arena Digital). É o módulo mais robusto (usecases + gateways).

| Pode | Onde | Detalhe |
|---|---|---|
| **Configurar cartão** | `create-setup-intent.usecase` | Cria customer + setup intent no gateway |
| **Assinar / trocar plano** | `subscribe.usecase` | Ativa experimental, cria/atualiza/troca assinatura, troca cartão, retenta pagamento incompleto — tudo auditado |
| **Cancelar** | `cancel-subscription.usecase` | Cancela assinatura |
| **Trial automático** | `ensure-experimental-subscription.usecase` | Garante plano experimental ao criar arena |
| **Histórico** | `get-payment-history.usecase` | Histórico de pagamentos |
| **Consultar plano** | `get-subscription.usecase` | Estado atual da assinatura/entitlement |
| **Snapshot de cobrança** | `sync-arena-billing-snapshot.usecase` | Sincroniza dados de faturamento da arena |

**Planos** (`plans.ts`): `experimental` (5 dias), `starter`, `max`, `pro`, `parceiro`. Cada plano tem **limite de espaços** (`maxSpaces`, com sentinela de "ilimitado"). Os dados de preço/limite vivem na tabela `subscription_plans`.

**Regras** (`subscription-rules.ts`): define assinatura "usável" (`active`/`trialing` e não expirada, ou acesso interno).

**Gateways**: abstração com implementações **Stripe** e **Asaas** (`gateway/`), além de webhook em `app/api/payments/webhook`.

**Conecta com:** `courts` (bloqueia criar espaço sem plano ou acima do limite — `assert-space-entitlement`), `users`/`auth` (trial no onboarding), `audit` (todo evento de assinatura é logado).

---

## 5. Como tudo se conecta (fluxo de dados)

```
                         ┌──────────────┐
                         │    ARENA     │  (raiz; tudo é escopado por arena_id)
                         └──────┬───────┘
        ┌───────────────┬───────┼────────────┬───────────────┐
        ▼               ▼       ▼            ▼               ▼
   ESPAÇOS         ESTAÇÕES   ATLETAS     ROTATIVOS       USUÁRIOS
   (courts)        (stations) (athletes)  (rotativos)     (equipe)
        │               │        │            │
        ▼               ▼        │            │
   RESERVAS         COMANDAS     │            │
   + MENSALISTAS    + itens      │            │
        │           (consome     │            │
        │            ESTOQUE)    │            │
        │               │        │            │
        └──────┬────────┴────────┴────────────┘
               ▼
        ┌─────────────┐        gera entradas automáticas
        │ FINANCEIRO  │◄───── (reservas, mensalidades, comandas, rotativos)
        └──────┬──────┘
               ▼
        ┌─────────────┐        ┌──────────────┐
        │ RELATÓRIOS  │        │  DASHBOARD   │  (consolidam tudo)
        └─────────────┘        └──────────────┘

   FIDELIDADE ──► pontos por atleta (aparecem no perfil 360°)
   PAGAMENTOS ──► assinatura da plataforma (libera/limita criação de espaços)
   AUDITORIA  ──► registra eventos sensíveis (hoje: assinaturas)
```

**Resumo das conexões mais importantes:**
1. **Arena** é a entidade-raiz; todo o resto é escopado por `arena_id`.
2. **Atleta** é o cliente que circula por reservas, comandas, rotativos e fidelidade.
3. **Financeiro** é o ralo onde caem as entradas: reservas pagas, mensalidades, fechamento de comandas e vendas de rotativo geram transações automaticamente.
4. **Estoque** é movimentado pelas comandas (saída ao vender, entrada ao cancelar) e por entradas manuais no catálogo.
5. **Relatórios e Dashboard** apenas leem e consolidam o que os outros módulos produzem.
6. **Pagamentos** controla o acesso comercial: sem plano válido, não dá para criar novos espaços.
7. **Permissões** (server-auth) embrulham cada action: Caixa fica preso à sua estação; áreas administrativas exigem Owner/Gestor.

---

## 6. Tabelas principais do banco (referência rápida)

| Domínio | Tabelas |
|---|---|
| Arena | `arenas`, `arena_users`, `arena_sports`, `arena_comodidades` |
| Espaços | `courts`, `court_sports` |
| Reservas | `bookings`, `booking_services`, `planos_mensalista` |
| Atletas | `atleta`, `arenas_atleta`, `atleta_esportes`, `users` |
| Estações | `stations`, `station_types`, `station_orders`, `station_order_items`, `station_payments`, `station_customers` |
| Catálogo | `products`, `product_stock_entries`, `product_stock_movements` |
| Rotativo | `rotativos`, `rotativo_courts`, `rotativo_inscricoes`, `rotativo_credito_lotes`, `rotativo_credito_movimentos` |
| Financeiro | `transactions`, `modo_pagamento` |
| Fidelidade | `programa_fidelidade_extrato`, `athlete_loyalty_balance` (view) |
| Assinatura | `arena_subscriptions`, `subscription_plans` |
| Auditoria | `audit_logs` |
| Geo | `estados`, `municipios` |

> Para o detalhamento de colunas e relacionamentos, ver `DATABASE_ARCHITECTURE.md`.
