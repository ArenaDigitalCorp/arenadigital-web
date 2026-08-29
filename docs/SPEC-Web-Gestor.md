# SPEC — Arena Digital (Web | Gestor de Arenas)

## 1. Objetivo da Especificação

Este documento descreve **como** será implementada a versão Web do Arena Digital, voltada exclusivamente para **gestores de arenas esportivas**, detalhando arquitetura, stack técnica, padrões de desenvolvimento, autenticação, controle de acesso e integração com serviços externos.

---

## 2. Arquitetura Geral

Arquitetura **API-first**, onde toda a lógica de negócio reside no backend, e o frontend web consome a API de forma segura.

[ Landing Page ]
|
| -> Login
v
[ Web SaaS (Gestores) ] ────> [ API Serverless (Vercel) ]
|
├── Supabase Auth
├── Supabase (PostgreSQL)
└── Serviços auxiliares


---

## 3. Stack Técnica

### 3.1 Frontend Web (Gestor)
- Next.js (App Router)
- TypeScript
- TailwindCSS
- Supabase Auth SDK
- Fetch / Axios para consumo da API

---

### 3.2 Backend
- Next.js API Routes ou Edge Functions
- TypeScript
- Supabase Client (Service Role)
- Zod (validação de payloads)
- Arquitetura modular por domínio

---

### 3.3 Infraestrutura
- Deploy: Vercel
- Banco de dados: Supabase (PostgreSQL)
- Autenticação: Supabase Auth
- Versionamento: GitHub

---

## 4. Autenticação e Autorização

### 4.1 Autenticação (Supabase Auth)

- Toda autenticação é realizada via Supabase Auth
- O frontend nunca persiste senhas fora do provedor de autenticação
- A sessão Supabase autentica as requisições protegidas

Header padrão:
Authorization: Bearer <supabase_access_token>

---

### 4.2 Autorização (RBAC)

Controle de acesso baseado em **roles** por arena. O sistema usa 3 perfis de usuário (mapeados para as roles do banco):

| Perfil          | Role no banco | Acesso                                                                                           |
|-----------------|---------------|--------------------------------------------------------------------------------------------------|
| Administrador   | `Gestor`      | Acesso **total e irrestrito** a todas as funcionalidades                                         |
| Usuário comum   | `Atendente`   | Dashboard, Atletas, Espaços, Estações, Produtos, Financeiro, Loyalty, Rotativo, Relatórios — **sem Configurações** |
| Caixa           | `Caixa`       | Acesso **somente ao menu Estações**                                                              |

> O `Owner` da arena equivale ao Administrador (acesso total).

#### Regras de redirecionamento para o perfil Caixa
- Caixa **com estação atribuída**: redirecionado automaticamente para `/dashboard/arenas/{id}/stations/{stationId}`
- Caixa **sem estação atribuída**: redirecionado para `/dashboard/arenas/{id}/stations` (lista de estações)
- A Sidebar exibe apenas o item de menu "Estações" (ou "Minha Estação" se houver estação vinculada)

#### Funções de proteção de rota (server-side — `src/lib/server-auth.ts`)
| Função                         | Quem é bloqueado       | Uso                                      |
|--------------------------------|------------------------|------------------------------------------|
| `assertArenaAccess`            | Nenhum (qualquer membro) | Verificação básica de acesso à arena   |
| `assertArenaBackofficeAccess`  | Caixa                  | Financeiro, Loyalty, Rotativo, Espaços  |
| `assertArenaAdminAccess`       | Caixa + Atendente      | Configurações exclusivas de Admin       |
| `assertArenaOwnerAccess`       | Todos (exceto Owner)   | Ações restritas ao dono da arena        |
| `assertArenaSubscriptionAccess`| Não-Owner e não-Gestor | Gerenciamento de assinatura             |

A validação ocorre no backend via server components e API routes.

---

## 5. Middleware de Segurança

### Responsabilidades
- Validar sessão Supabase
- Extrair `auth.users.id`
- Buscar usuário interno no Supabase
- Verificar role e arena associada
- Bloquear acessos não autorizados

---

## 6. Modelo de Dados (Visão Técnica)

### 6.1 Users

```sql
users
- id (uuid, pk)
- email (text, unique)
- email (text)
- name (text)
- role (admin | gestor)
- created_at (timestamp)

arenas
- id (uuid, pk)
- name (text)
- address (text)
- opening_hours (jsonb)
- is_active (boolean)
- created_at (timestamp)

courts
- id (uuid, pk)
- arena_id (uuid, fk)
- name (text)
- type (text)
- capacity (int)
- is_active (boolean)
- created_at (timestamp)

bookings
- id (uuid, pk)
- arena_id (uuid, fk)
- court_id (uuid, fk)
- athlete_id (uuid)
- start_time (timestamp)
- end_time (timestamp)
- status (confirmed | cancelled)
- created_at (timestamp)
```

### 6.2 Catálogo (Produtos, Categorias e Preços)

```sql
products
- id (uuid, pk)
- arena_id (uuid, fk)
- name (text)
- catalog_kind (product | service)
- category_id (uuid, fk -> product_categories, nullable)
- item_type (text)            -- mantido por compat (comandas/busca); sincronizado com o nome da categoria
- station_type_id (uuid, fk, nullable)
- price (numeric)
- stock_quantity (int, default 0)
- status (Ativo | Inativo)
- created_by / updated_by (uuid, fk -> users)
- created_at / updated_at (timestamp)

product_categories
- id (uuid, pk)
- arena_id (uuid, fk)
- name (text)
- kind (product | service)
- sort_order (int, default 0)
- active (boolean, default true)
- created_by (uuid, fk -> users)
- created_at / updated_at (timestamp)
- unique (arena_id, kind, name)

product_price_history
- id (uuid, pk)
- product_id (uuid, fk -> products)
- arena_id (uuid, fk)
- old_price (numeric)
- new_price (numeric)
- change_type (manual | bulk)
- adjustment_percent (numeric, nullable)   -- preenchido em reajuste percentual
- batch_id (uuid, nullable)                -- agrupa itens de um mesmo reajuste em massa
- reason (text, nullable)
- changed_by (uuid, fk -> users)
- created_at (timestamp)
```

#### Server Actions do Catálogo (Next.js)

O módulo `src/modules/products` expõe server actions (não endpoints REST):

**Categorias** (`actions/categoryActions.ts`):
- `getCategoriesByArenaAction(arenaId)`
- `createCategoryAction(arenaId, { name, kind })`
- `updateCategoryAction(arenaId, categoryId, { name?, active?, sort_order? })` — renomear sincroniza `item_type` dos produtos vinculados
- `deleteCategoryAction(arenaId, categoryId)` — bloqueado se houver itens vinculados

**Preços** (`actions/priceActions.ts`):
- `getPriceHistoryByProductAction(productId)`
- `bulkAdjustPricesAction(arenaId, { category_id, adjustment_type, amount, rounding, include_inactive, reason? })` — aplica reajuste em massa com rollback transacional e registro de histórico por `batch_id`

**Produtos** (`actions/stockActions.ts`):
- `updateProductAction` grava histórico `manual` em `product_price_history` quando o preço muda.

Utilitários de cálculo em `types/product.types.ts`: `computeAdjustedPrice` e `applyPriceRounding` (compartilhados entre preview no cliente e aplicação no servidor, garantindo consistência).

---

7. Endpoints — Web Gestor
Autenticação / Sessão
GET /api/v1/me

Arenas
GET    /api/v1/arenas
POST   /api/v1/arenas
PUT    /api/v1/arenas/{id}
DELETE /api/v1/arenas/{id}


Quadras
GET    /api/v1/arenas/{arenaId}/courts
POST   /api/v1/arenas/{arenaId}/courts
PUT    /api/v1/courts/{id}
DELETE /api/v1/courts/{id}


Agenda / Reservas
GET    /api/v1/arenas/{arenaId}/bookings


Usuários
GET    /api/v1/users
POST   /api/v1/users
PUT    /api/v1/users/{id}
DELETE /api/v1/users/{id}


8. Padrão de Resposta da API
{
  "success": true,
  "data": {},
  "message": "Operação realizada com sucesso",
  "errors": null
}


9. Supabase — Diretrizes Técnicas

PostgreSQL como banco principal

Row Level Security (RLS) habilitado

Policies baseadas em:

auth_user_id

role

relacionamento com arena_id

Acesso ao banco sempre via backend

10. Estrutura de Pastas (Backend)

src/
 ├── modules/
 │    ├── auth/
 │    ├── users/
 │    ├── arenas/
 │    ├── courts/
 │    └── bookings/
 ├── shared/
 │    ├── middleware/
 │    ├── database/
 │    └── utils/
 └── app/api/


11. Deploy — Vercel
Ambientes

main → produção

develop → staging

Variáveis de Ambiente

CLERK_SECRET_KEY

SUPABASE_URL

SUPABASE_SERVICE_ROLE_KEY

Agente de IA (WhatsApp) — ver seção 14:
META_APP_ID, META_APP_SECRET, META_WHATSAPP_VERIFY_TOKEN, META_GRAPH_API_VERSION,
OPENAI_API_KEY, OPENAI_AGENT_MODEL, OPENAI_TRANSCRIBE_MODEL,
AI_AGENT_ENCRYPTION_KEY, WHATSAPP_MAX_AUDIO_SECONDS

12. Estações — Listagem Paginada de Comandas

Tela: /dashboard/arenas/{id}/stations/{stationId}
Componentes: src/modules/stations/components/StationDetailPageClient.tsx
Server actions: src/modules/stations/actions/stationActions.ts

Contrato (StationOrdersFilters — src/modules/stations/types/station.types.ts):

interface StationOrdersFilters {
  page?: number        // default 1
  pageSize?: number    // 10 | 25 | 50 | 100 (default 25)
  status?: 'open' | 'pending' | 'closed' | 'todos'  // default na UI: 'open'
  search?: string      // busca por cliente/nº da comanda em todo o banco
  dateFrom?: string    // ISO timestamp (inclusive) — created_at >=
  dateTo?: string      // ISO timestamp (inclusive) — created_at <=
}

Actions:
- getStationWithOrdersAction(arenaId, stationId, filters) → { success, station, orders, total }
- getOrdersByStationAction(arenaId, stationId, filters) → { success, data, total }

Implementação:
- Paginação via .range() do Supabase com count: 'exact' (total retornado para a UI)
- Busca por cliente: OR entre customer_name ILIKE, atleta_id IN (ids de atleta com
  nome_perfil ILIKE — pré-consulta limitada a 200 ids) e order_number (se o termo for numérico)
- Filtros de status e data aplicados no banco, combinados com a busca
- UI: debounce de 400ms na busca; mudança de filtro/busca/pageSize reseta para página 1;
  a primeira página é renderizada no servidor (SSR) com os filtros default

13. Rotativo — Modal "Novo crédito" (busca de atleta)

Tela: /dashboard/rotativo/{arenaId} — aba Gestão de créditos
Componente: src/modules/rotativos/components/CreditosTab.tsx
Server action: getAthletesByArenaAction(arenaId, searchTerm?) — src/modules/athletes/actions/athleteActions.ts

- Campo "Selecione o atleta" é um input de busca (substituiu o select que carregava
  todos os atletas da arena)
- A busca dispara a partir do 3º caractere, com debounce de 400ms
- Filtro server-side: nome_perfil ILIKE %termo%, restrito aos atletas vinculados à arena
  (join arenas_atleta) — SupabaseAthleteRepository.findByArena
- Ao selecionar, o atleta vira um chip com opção de remover (X); o id alimenta o campo
  athleteId do formulário (react-hook-form + zod)

14. Agente de IA no WhatsApp

Status: Em implementação (MVP — 22/07/2026). Plano completo: docs/PLANO-Agente-IA-WhatsApp.md.
Módulo: src/modules/ai-agent. Integrações: Meta WhatsApp Business Cloud API + OpenAI (chat/tool calling + transcrição).

14.1 Modelo de dados (migração arenadigital-db/supabase/migrations/20260801141000_consolidate_web_ai_whatsapp.sql)

arena_ai_agents      -- config por arena (1:1). enabled, persona_prompt, model,
                        temperature, max_output_tokens, monthly_token_cap,
                        fallback_message, status (draft|active|paused). unique(arena_id)
whatsapp_channels    -- vínculo número↔arena. phone_number_id (UNIQUE, chave de
                        roteamento), waba_id, display_phone_number, verified_name,
                        access_token_encrypted (CIFRADO EM APP), status
                        (pending|connected|error|disconnected). unique(arena_id) E unique(phone_number_id)
whatsapp_webhook_events -- idempotência (espelha payment_webhook_events); dedupe por
                        (provider, wa_message_id)
whatsapp_conversations  -- thread por contato/arena. unique(arena_id, contact_wa_id)
whatsapp_messages       -- log inbound/outbound: content_type (text|audio|unsupported),
                        transcribed_from_audio, media_id, llm_model, transcription_model,
                        prompt_tokens, completion_tokens, audio_seconds, tool_calls, status

RLS permissiva no padrão do projeto, EXCETO o token de acesso, que é protegido por
cifra em aplicação (AES-256-GCM, chave AI_AGENT_ENCRYPTION_KEY) — nunca em texto puro.

14.2 Endpoints (API routes)

POST /api/whatsapp/webhook           -- recebe mensagens do Meta. Verifica assinatura
                                        X-Hub-Signature-256, registra idempotência,
                                        responde 200 imediatamente e processa via after().
GET  /api/whatsapp/webhook           -- handshake (hub.verify_token → hub.challenge).
POST /api/whatsapp/embedded-signup   -- troca code→token do Embedded Signup, inscreve o
                                        app no WABA (subscribed_apps) e conecta o canal.

URL a cadastrar no painel do Meta: https://<dominio>/api/whatsapp/webhook (runtime nodejs).

14.3 Server Actions (src/modules/ai-agent/actions/agentActions.ts)

- getAgentSettingsAction(arenaId) → { agent, channel }
- updateAgentConfigAction(arenaId, input)  -- persona, fallback, teto de tokens (zod)
- toggleAgentAction(arenaId, enabled)      -- só ativa com canal conectado; auditado
- connectChannelAction(input)              -- valida unicidade do número; cifra o token; auditado
- disconnectChannelAction(arenaId)         -- desliga o agente junto; auditado

Todas com assertArenaBackofficeAccess(arenaId). UI: ArenaAiAgentSettingsCard, renderizado
em src/app/dashboard/arenas/[id]/edit/page.tsx (ao lado do card de Pix).

14.4 Ferramentas do agente (tool calling — tools/agent-tools.ts)

Todas recebem arena_id FIXO do canal (o LLM nunca fornece arena):
- get_opening_hours()                       -- arenas.opening_hours
- list_courts(sport?)                        -- courts + court_sports (ativas)
- get_pricing(court?, sport?)                -- avulso do day_config; mensal é ESTIMATIVA
- check_availability(date, time?, court?, sport?) -- grade (day_config) × bookings; fuso BR (UTC-3)

14.5 Fluxo de mensagem (resumo)

1. Webhook verifica assinatura → idempotência → ACK 200 → after(processInboundMessage).
2. processInboundMessage: roteia por phone_number_id; gates (agente ligado + assinatura
   ativa via hasUsableSubscription); persiste conversa. Tipo não suportado → fallback.
3. generateAgentReply: transcreve áudio (guarda de tamanho via file_size), aplica teto
   mensal de tokens, monta prompt (persona + guardrails + data/hora BR), roda o loop de
   tool calling (máx. 5 rodadas), envia a resposta e registra tokens/custo.

14.6 Segurança
- Isolamento por phone_number_id; queries sempre filtradas por arena_id do canal.
- Assinatura X-Hub-Signature-256 (App Secret) e verify_token no handshake.
- Token de acesso cifrado em app; exposto apenas no caminho de envio.
- Gate de assinatura + enabled; auditoria em audit_logs (entity_type 'arena_ai_agent').

15. Espaços — Aba "Operação" (grade multi-espaços agendável)

15.1 Navegação
- `ArenaDashboardTab = 'espacos' | 'cadastro' | 'operacao'` (src/lib/arena-dashboard-navigation.ts).
- URL: `/dashboard/arenas/[id]` (espacos, padrão), `?tab=cadastro`, `?tab=operacao`.
- `arenaDashboardPath(arenaId, tab)` e `spaceEditPath(arenaId, spaceId, returnTab)` já
  serializam qualquer uma das três abas; `parseArenaDashboardTab`/`parseReturnTabParam`
  fazem o parse com fallback em 'espacos'.

15.2 Componentes
- `src/modules/bookings/components/DayOperationBoard.tsx` — visão completa (cabeçalho com
  filtros, sidebar de espaços e grade). Props:
    arenaId: string
    courts: OperationCourt[]                  -- { id, name, day_config, price, booking_type, sports[] }
    variant?: 'modal' | 'page'                -- altura/borda do container
    interactive?: boolean                     -- habilita agendar/abrir reservas na grade
    onClose?: () => void                      -- renderiza o botão X no cabeçalho
  Estado interno de workspace (só em variant='page'):
    isExpanded    -- o mesmo elemento troca as classes do container para
                     `fixed ... h-[92vh] w-[95vw]` + backdrop z-40, então data, filtros e
                     seleção de espaços são preservados ao expandir/reduzir. Um wrapper
                     mantém a altura original para a página não saltar. Fecha com Esc
                     (ignorado enquanto um modal de reserva está aberto) e trava o scroll
                     do body. Os modais de reserva (portal no body, z-50) seguem por cima.
    isSidebarOpen -- recolhe a lista lateral de espaços (w-52 -> w-0) para dar largura à grade.
  A tabela usa `w-full` + `min-w-[150px]` por coluna: estica com poucos espaços e rola
  horizontalmente com muitos.
- `src/modules/bookings/components/DayOperationModal.tsx` — passou a ser um wrapper do board
  (overlay + backdrop), `variant="modal"`, sem interatividade. Mantém a assinatura anterior
  (`arenaName` continua aceito, agora opcional).
- `ArenaDetailPageClient` renderiza `<DayOperationBoard variant="page" interactive />` na aba
  Operação; sem espaços cadastrados exibe estado vazio.

15.3 Utilitários compartilhados (src/modules/bookings/utils/court-slots.ts)
Extraídos da duplicação entre calendário do espaço e operação do dia:
- parseHHMM(t), slotLabel(slot), slotToMinutes(slot), dayConfigNameFor(date)
- findDayConfig(date, dayConfigs) / generateSlotsForDayConfig(cfg) / generateSlotsForDate(date, dayConfigs)
- isSlotWithinDayConfig(date, dayConfigs, slot) -- sem day_config = aberto 24h
- getSlotPrice(date, dayConfigs, slot, fallbackPrice) -- customPrices > preço do dia > court.price;
  trata virada de madrugada usando a config do dia anterior
- blocksAvailability(booking) -- confirmed/reservado ocupam; pending_payment só até payment_expires_at

15.4 Dados e interações
- Reservas do dia: `getBookingsByArenaWithSportsAction(arenaId, inicioDia, fimDia)`.
- Reservas futuras (D+1 até D+60): mesma action, usadas no indicador de "próximo evento".
- Slot livre + `interactive` → `BookingModal` (abas avulsa/mensalista) com courtId da coluna,
  selectedDate/Hour/Minute do slot e defaultPrice de `getSlotPrice`.
- Reserva existente + `interactive` → `BookingDetailsModal` com o court da coluna; `onEdit`
  só é passado para reservas avulsas não canceladas e sem Pix pendente (mesma regra do
  `CourtCalendarPageClient`).
- `onSuccess` de ambos os modais recarrega reservas do dia e futuras.

16. Notificações da Arena (tempo real)

16.1 Modelo de dados (migração arenadigital-db/supabase/migrations/20260801142000_consolidate_web_arena_notifications.sql)

arena_notifications
- id uuid pk
- arena_id uuid not null fk arenas on delete cascade
- type text not null check ('booking_created' | 'rotativo_inscricao' | 'open_game_created')
- title text not null
- body text
- payload jsonb not null default '{}'
- entity_type text / entity_id uuid   -- reserva, inscrição ou open_game de origem
- atleta_id uuid fk atleta on delete set null
- read_at timestamptz / created_at timestamptz default now()

Índices: (arena_id, created_at desc); parcial (arena_id) where read_at is null;
único parcial (type, entity_id) para não duplicar o mesmo evento.

RLS (habilitado):
- select/update: public.is_arena_backoffice_member(arena_id) — owner da arena ou
  vínculo ativo em arena_users, resolvido por users.auth_user_id = auth.uid().
- Sem policy de insert: apenas as triggers (security definer) e a service role gravam.

16.2 Origem do evento (como distinguir app x backoffice)

public.current_app_atleta() (security definer) resolve o atleta da sessão:
atleta -> users -> users.auth_user_id = auth.uid().

- App: as escritas passam pelo PostgREST com o JWT do atleta, então auth.uid() existe
  e a função devolve o atleta -> a notificação é criada.
- Web gestor: todas as escritas usam a service role (getSupabaseAdmin), auth.uid() é
  null -> a trigger retorna sem notificar. É isso que evita a arena notificar a si mesma.

16.3 Triggers (after insert, security definer)

- trg_notify_arena_booking_created   on bookings            -> notify_arena_booking_created()
- trg_notify_arena_rotativo_inscricao on rotativo_inscricoes -> notify_arena_rotativo_inscricao()
  (arena_id vem de rotativos.id_arena, pois a inscrição não tem a coluna)
- trg_notify_arena_open_game_created on open_games          -> notify_arena_open_game_created()

Cada função monta title/body em pt-BR (horários convertidos para America/Sao_Paulo) e
grava o contexto em payload (ids, nomes de quadra/esporte, horário, valores).

16.4 Realtime

A tabela é adicionada à publication supabase_realtime. O cliente assina
`postgres_changes` (INSERT e UPDATE) com filter `arena_id=eq.<arenaId>` usando o
browser client autenticado — a RLS acima é quem autoriza o canal.

16.5 Frontend (src/modules/notifications)

- types/notification.types.ts — ArenaNotification, rótulos por tipo e
  notificationTargetPath() (para onde o clique leva: calendário do espaço,
  /dashboard/rotativo/{arenaId} ou a aba Operação).
- actions/notificationActions.ts (server actions, todas com assertArenaBackofficeAccess):
  - getArenaNotificationsAction(arenaId, { limit?, onlyUnread?, types? }) -> lista + unreadCount
  - markNotificationReadAction(arenaId, notificationId)
  - markAllNotificationsReadAction(arenaId)
- hooks/useArenaNotificationsFeed.ts — carga inicial + assinatura realtime +
  polling de 60s como fallback (caso o Realtime não esteja habilitado) + atualização
  otimista do lido. Aceita initialNotifications (SSR) e onNewNotification.
- context/NotificationsContext.tsx — NotificationsProvider (montado em
  DashboardLayoutWrapper, dentro de ArenaProvider) mantém o feed da arena selecionada
  e dispara o toast (sonner) a cada evento novo.
- components/NotificationsBell.tsx — sino + badge de não lidas + popover com os 8
  últimos avisos e link "Ver todas". Renderizado no topo da Sidebar (suporta o estado
  recolhido).
- components/NotificationItem.tsx / NotificationIcon.tsx — linha e ícone por tipo,
  compartilhados entre popover e página.
- components/NotificationsPageClient.tsx — página com filtros (Todas / Não lidas /
  por tipo) e "marcar todas como lidas".

16.6 Rotas

- /dashboard/notifications            -> redirect via resolveDashboardDefaultRoute('notifications')
- /dashboard/notifications/[arenaId]  -> assertArenaBackofficeAccess + SSR das 100 últimas

17. Estações — Status "Pendente" da Comanda

Migração (repositório arenadigital-db, fonte única do schema):
supabase/migrations/20260802130000_consolidate_web_station_order_pending_status.sql
Essa migration também atualiza close_station_order (definida em
20260801122000_station_order_transaction_safety.sql) para aceitar o fechamento de
comandas 'pending', além de 'open'.

17.1 Modelo de dados

station_orders (alterações)
- status: agora aceita 'open' | 'pending' | 'closed' | 'cancelled' (CHECK constraint)
- pending_marked_at timestamptz null — preenchido ao marcar como pendente, limpo ao
  reverter para aberta; evita join para exibir "pendente desde" no detalhe e no relatório

station_order_status_history (nova tabela) — auditoria das mudanças manuais de status
- id uuid pk / order_id uuid fk station_orders / arena_id uuid fk arenas
- previous_status text / new_status text
- changed_by uuid fk users — quem fez a mudança
- created_at timestamptz default now()
RLS: select restrito a public.is_arena_backoffice_member(arena_id) (mesmo helper da
seção 16.1); sem policy de insert — só as RPCs abaixo (security definer) gravam.

17.2 RPCs (Postgres, security definer)

- set_station_order_pending(p_arena_id, p_order_id, p_registered_by)
  Exige status atual = 'open'; seta status='pending', pending_marked_at=now();
  grava histórico ('open' -> 'pending').
- revert_station_order_to_open(p_arena_id, p_order_id, p_registered_by)
  Exige status atual = 'pending'; seta status='open', pending_marked_at=null;
  grava histórico ('pending' -> 'open').

17.3 Server actions (src/modules/stations/actions/orderActions.ts)

- markOrderPendingAction(arenaId, orderId) -> chama set_station_order_pending
- revertOrderToOpenAction(arenaId, orderId) -> chama revert_station_order_to_open

17.4 Regras de negócio

- Uma comanda 'pending' permanece totalmente editável (lançar item, registrar
  pagamento) — mesmo comportamento de 'open'.
- Reversão manual 'pending' -> 'open' é permitida a qualquer momento.
- Ao registrar pagamento que zera o saldo, closeOrderAndGenerateFinanceAction fecha a
  comanda normalmente, independente de estar 'open' ou 'pending'.
- updateOrderAction (cancelamento) continua restrito a status='cancelled'; marcar como
  pendente/reverter usa as actions dedicadas acima, não esse endpoint genérico.

17.5 UI

- Detalhe da comanda (orders/[orderId]/page.tsx): badge "Pendente", texto "Pendente
  desde {data}", botão "Marcar como pendente" (quando open) e "Reverter para aberta"
  (quando pending); "Lançar item"/"Registrar pagamento" visíveis em open e pending.
- Listagem da estação (StationDetailPageClient.tsx): filtro de status ganha a opção
  "Pendentes"; cards de comanda pending têm estilo distinto do open/closed.
- Relatório Movimentação Estações (MovimentacaoEstacoesPageClient.tsx +
  stationMovementActions.ts): filtro "Status" ganha "Pendente"; nova coluna "Status
  comanda" com badge por status e, quando pending, a data de "pendente desde"
  (StationMovementRow.pending_marked_at).

## 18. Mensalistas — Gestão, Rateio, Crédito e Previsão de Encerramento

Remodelagem da tela de Mensalistas (28/08/2026). `planos_mensalista` continua sendo a
entidade "recorrência" (um atleta com N horários = N linhas em `planos_mensalista`).
Sobre ela foi criada uma camada de cobrança mensal explícita.

Migrações (repositório arenadigital-db, fonte única do schema):
- `supabase/migrations/20260828120000_mensalista_billing_schema.sql` — tabelas, view,
  colunas em `planos_mensalista`, RLS, grants e backfill.
- `20260828120010_mensalista_generate_mensalidades.sql`
- `20260828120020_mensalista_configure_rateio.sql`
- `20260828120030_mensalista_register_payment.sql`
- `20260828120040_mensalista_launch_credit.sql`
- `20260828120050_mensalista_set_termination.sql`
- `20260828120100_mensalista_billing_acl.sql` — REVOKE/GRANT EXECUTE (service_role) das 5 RPCs.

As RPCs atômicas antigas (`create_/cancel_/confirm_monthly_plan_month_atomic`) continuam
no banco; a nova UI não chama mais `confirm_monthly_plan_month_atomic` — a confirmação do
mês passa pelo fluxo de pagamento abaixo.

### 18.1 Modelo de dados

`planos_mensalista` (novas colunas)
- data_encerramento_prevista date — mês a partir do qual a recorrência será encerrada
- encerramento_observacao text
- data_encerramento_efetiva date — preenchida quando o plano realmente encerra
- dia_vencimento smallint check (1..28)

`mensalista_mensalidades` — cobrança mensal de uma recorrência numa competência
- id uuid pk / arena_id fk arenas / plano_id fk planos_mensalista on delete cascade
- athlete_id uuid fk atleta — responsável (desnormalizado para agrupar/consultar)
- competencia date not null (dia 1 do mês) / valor_total numeric(10,2) — snapshot de valor_mensal
- rateio boolean default false
- status text check ('aberto' | 'parcial' | 'quitado' | 'cancelado')
- vencimento date / created_at / updated_at
- unique (plano_id, competencia)

`mensalista_cobrancas` — parcela por pessoa (1 linha quando não há rateio)
- id uuid pk / arena_id / mensalidade_id fk on delete cascade
- atleta_id uuid fk atleta on delete set null — NULL = participante avulso (só nome)
- nome text not null / valor_devido / valor_pago / credito_aplicado numeric(10,2)
- pago_em timestamptz — preenchido quando valor_pago + credito_aplicado >= valor_devido
- modo_pagamento_id fk modo_pagamento / ativo boolean default true (toggle do rateio)
- observacao text / created_at / updated_at

`mensalista_pagamentos` — evento de pagamento (permite parciais múltiplos)
- id uuid pk (= chave de idempotência da RPC) / arena_id / cobranca_id fk on delete cascade
- valor numeric(10,2) — dinheiro (espelhado em public.transactions)
- credito_aplicado numeric(10,2) — parte paga com crédito (não entra no caixa)
- data_pagamento date / modo_pagamento_id / observacao / registered_by fk users
- transaction_id fk transactions on delete set null / created_at

`mensalista_creditos` — livro-razão de crédito manual por atleta e arena (valor com sinal)
- id uuid pk / arena_id / atleta_id fk atleta on delete cascade
- tipo text check ('lancamento' | 'uso' | 'estorno' | 'ajuste' | 'retirada')
  ('retirada' adicionado em `20260828130000_mensalista_credit_withdraw.sql`)
- valor numeric(10,2) not null, <> 0 — entrada de crédito > 0; uso e retirada < 0
- descricao text / cobranca_id fk (quando tipo='uso') / registered_by fk users / created_at

`mensalista_credito_saldo` (view) — arena_id, atleta_id, saldo = SUM(valor)

RLS (todas as tabelas): select para authenticated com `public.can_access_arena(arena_id)`;
sem policy de insert/update/delete — só as RPCs (security definer, service_role) gravam.

Backfill: cada `public.transactions` com source_type='monthly_plan_month' vira uma
`mensalista_mensalidades` quitada + 1 `mensalista_cobrancas` do responsável +
1 `mensalista_pagamentos` ligado à transação. Idempotente.

### 18.2 RPCs (Postgres, security definer, search_path = '')

- `generate_mensalista_mensalidades_atomic(p_arena_id, p_competencia, p_registered_by)`
  Para cada recorrência ativa da arena na competência (data_inicio <= fim do mês,
  status <> 'cancelado', antes de data_encerramento_efetiva), garante 1 mensalidade
  (unique plano_id+competencia) + 1 cobrança default do responsável. Idempotente
  (advisory lock por arena+competencia). Chamada a cada load da tela.

- `configure_mensalista_rateio_atomic(p_arena_id, p_mensalidade_id, p_rateio, p_participantes jsonb, p_registered_by)`
  p_participantes = [{ atleta_id?, nome, ativo, valor }]. Congela as parcelas já pagas,
  apaga as não pagas e recria a partir da lista. rateio=false colapsa numa parcela do
  responsável. Valida Σ(ativas) + Σ(travadas) = valor_total (tolerância 0,01) e que os
  atleta_id pertencem à arena. Recalcula o status da mensalidade.

- `register_mensalista_payment_atomic(p_operation_id, p_arena_id, p_cobranca_id, p_valor, p_credito_aplicado, p_data, p_modo_pagamento_id, p_observacao, p_registered_by)`
  Idempotente (p_operation_id = id do pagamento). Rejeita overpay. Crédito exige
  cobrança com atleta_id e saldo suficiente (grava `mensalista_creditos` tipo='uso',
  valor negativo). Insere `mensalista_pagamentos`; atualiza a cobrança (valor_pago,
  credito_aplicado, pago_em). Só a parte em dinheiro vai para `public.transactions`
  (type='entrada', category='Mensalidade', source_type='mensalista_pagamento',
  source_id=pagamento.id, ON CONFLICT DO UPDATE). Recalcula o status. Ao transicionar
  para 'quitado' (plano ativo): confirma os `bookings` 'reservado' da competência
  (price/rental_price = valor_total / sessoes_por_mes) e gera 1 mês 'reservado' à frente
  via `public._insert_monthly_plan_month_bookings`, exceto se
  data_encerramento_prevista cobrir o mês seguinte.

- `launch_mensalista_credit_atomic(p_operation_id, p_arena_id, p_atleta_id, p_valor, p_descricao, p_registered_by)`
  Idempotente (p_operation_id = id do crédito). Valida atleta na arena. Insere
  `mensalista_creditos` (tipo 'lancamento' se valor > 0, senão 'ajuste'). Não gera
  transação. Retorna o novo saldo.

- `withdraw_mensalista_credit_atomic(p_operation_id, p_arena_id, p_atleta_id, p_valor, p_descricao, p_registered_by)`
  (`20260828130000` + `..._acl.sql`). Retirada manual de crédito. Idempotente
  (p_operation_id = id do movimento). `p_valor` é a magnitude; grava
  `mensalista_creditos` tipo='retirada', valor = -abs(p_valor). Trava por
  `advisory_xact_lock` e **rejeita se `saldo < valor`** (`ERRCODE 55000`), então pode
  ser feita em várias parcelas até zerar. Não gera transação. Retorna o novo saldo.

- `set_mensalista_termination_atomic(p_arena_id, p_plan_id, p_data_prevista, p_observacao, p_registered_by)`
  Grava data_encerramento_prevista + encerramento_observacao no plano e cancela os
  `bookings` 'reservado' com start_time >= mês previsto (America/Sao_Paulo).
  p_data_prevista = NULL limpa a previsão. Não altera o status do plano.

### 18.3 Backend web (src/modules/mensalistas)

- types/mensalista.types.ts — rows das tabelas + `MensalistaResumo` (agregado por
  responsável), `MensalistaDetalhe`, `RecorrenciaResumo`, `RateioParticipanteInput`.
- schemas/mensalista.schema.ts — zod (configureRateio, registrarPagamento, lancarCredito,
  setEncerramento).
- actions/mensalistaActions.ts (server actions, `assertArenaBackofficeAccess` +
  `requireAuthenticatedDbUser`, `revalidatePath` de mensalistas/finance/relatórios):
  - getMensalistasOverviewAction(arenaId, competencia) — chama a RPC de geração, lê
    planos + mensalidades + cobranças + saldo de crédito, agrupa por athlete_id e
    calcula KPIs. Também busca `mensalista_mensalidades` com `competencia <` 1º dia do
    mês corrente e `status in ('aberto','parcial')` → por responsável, `atrasoValor`
    (Σ restante das cobranças ativas) e `atrasoMeses`; totais `atrasoTotal` /
    `atrasoMensalistas`.
  - getMensalistaDetailAction(arenaId, athleteId, competencia) — inclui `atrasos`
    (competências anteriores ao mês corrente, diferentes da visualizada, ainda
    abertas), cada uma com quadra, valor devido/pago/restante e as cobranças, para
    "Registrar pagamento" direto. Também retorna `fidelidade` = `{ moeda:
    arenas.nome_moeda_virtual, saldo: athlete_loyalty_balance.balance }` para o
    card de saldo do programa de fidelidade.
  - configureRateioAction / registrarPagamentoAction / lancarCreditoAction /
    retirarCreditoAction / setEncerramentoAction — parse zod + RPC correspondente.

### 18.4 Rotas e UI

- `/dashboard/arenas/{id}/mensalistas?competencia=YYYY-MM` —
  `MensalistasOverviewClient` (lista por responsável, stepper de mês, 4 KPIs, filtros,
  situação visual). Mantém `?tutorial=1` (client legado com mock).
- `/dashboard/arenas/{id}/mensalistas/{athleteId}?competencia=YYYY-MM` —
  `MensalistaDetailClient` (KPIs — a receber / recebido / restante / crédito e um 5º
  card com o **saldo do programa de fidelidade** do atleta: nome da moeda da arena,
  saldo `$` e legenda "(Saldo Programa Fidelidade)", ícone `Star` do menu —,
  recorrências + mensalidade do mês, histórico de pagamentos paginado, extrato de
  créditos). Por recorrência: toggle de rateio,
  "Prever encerramento" e "Cancelar plano" (reusa `cancel_monthly_plan_atomic` via
  `cancelPlanoMensalistaAction`). A **criação** de recorrência continua no calendário
  do espaço (`BookingModal`/`MensalistaModal` → `create_monthly_plan_atomic`).
- Modais: `RateioModal` (lista de atletas do rateio, toggle + valor + adicionar
  participante/nome avulso, split igual ao vivo), `RegistrarPagamentoModal` (valor +
  data + forma + aplicar crédito), `LancarCreditoModal`, `RetirarCreditoModal`
  (retirada parcial do saldo do responsável, limitada ao saldo, registrada no extrato
  de créditos), `EncerramentoModal`.
- Util `src/lib/format.ts` — formatCurrency / formatCompetencia / formatDate / toCompetencia.
- `FinanceDashboardClient`: o botão "Confirmar" do painel de mensalistas pendentes vira
  link para o detalhe do mensalista.
