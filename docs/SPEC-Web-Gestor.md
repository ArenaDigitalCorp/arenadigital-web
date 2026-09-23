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

production → produção

homolog → staging

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

Remodelagem da tela de Mensalistas (28/08/2026). `planos_mensalista` é a entidade
"recorrência". Sobre ela foi criada uma camada de cobrança mensal explícita.

> Desde 09/09/2026 um plano pode ter **N faixas semanais** em
> `planos_mensalista_blocos` (ver §20), com uma única mensalidade. A regra antiga
> — um atleta com N horários = N linhas em `planos_mensalista` — vale apenas para
> planos com `recorrencia_por_blocos = false`.

Migrações (repositório arenadigital-db, fonte única do schema):
- `supabase/migrations/20260828120000_mensalista_billing_schema.sql` — tabelas, view,
  colunas em `planos_mensalista`, RLS, grants e backfill.
- `20260828120010_mensalista_generate_mensalidades.sql`
- `20260828120020_mensalista_configure_rateio.sql`
- `20260828120030_mensalista_register_payment.sql`
- `20260828120040_mensalista_launch_credit.sql`
- `20260828120050_mensalista_set_termination.sql`
- `20260828120100_mensalista_billing_acl.sql` — REVOKE/GRANT EXECUTE (service_role) das 5 RPCs.
- `20260913160000_mensalista_rateio_flexivel.sql` — rateio incremental (ver §18.2):
  `configure_mensalista_rateio_atomic` não exige mais participante(s) nem soma batendo;
  `register_mensalista_payment_atomic` passa a limitar crédito aplicado/excedente pelo
  que falta da **mensalidade inteira**, não da fatia.
- `20260913170000_mensalista_rateio_remover_participante.sql` — nova RPC
  `remove_mensalista_rateio_participante_atomic` (ver §18.2).

As RPCs atômicas antigas (`create_/cancel_/confirm_monthly_plan_month_atomic`) continuam
no banco; a nova UI não chama mais `confirm_monthly_plan_month_atomic` — a confirmação do
mês passa pelo fluxo de pagamento abaixo.

### 18.1 Modelo de dados

`planos_mensalista` (novas colunas)
- data_encerramento_prevista date — mês a partir do qual a recorrência será encerrada
- encerramento_observacao text
- data_encerramento_efetiva date — preenchida quando o plano realmente encerra
- dia_vencimento smallint check (1..28)

`planos_mensalista_reajustes` — auditoria de reajuste de valor mensal (migração `20260904150000_mensalista_reajuste_valor`)
- id uuid pk (= p_operation_id, idempotência) / arena_id fk arenas / plano_id fk planos_mensalista on delete cascade
- valor_anterior / valor_novo numeric(10,2) check >= 0
- escopo text check ('mes_atual' | 'mes_seguinte') / competencia_vigencia date (dia 1)
- observacao text / registered_by fk users / created_at
- RLS: select `can_access_arena_backoffice(arena_id)`; escrita só via RPC (service_role)

`mensalista_mensalidades` — cobrança mensal de uma recorrência numa competência
- id uuid pk / arena_id fk arenas / plano_id fk planos_mensalista on delete cascade
- athlete_id uuid fk atleta — responsável (desnormalizado para agrupar/consultar)
- competencia date not null (dia 1 do mês) / valor_total numeric(10,2) — snapshot de valor_mensal;
  na **competência de início do plano** é pró-rateado: `round(valor_mensal/sessoes_por_mes, 2) × sessões que ainda cabem no mês a partir de data_inicio` (mês cheio ⇒ valor_mensal; 0 sessões ⇒ não gera mensalidade)
- rateio boolean default false
- status text check ('aberto' | 'parcial' | 'quitado' | 'cancelado')
- vencimento date / created_at / updated_at
- unique (plano_id, competencia)

`mensalista_cobrancas` — parcela por pessoa (1 linha quando não há rateio)
- id uuid pk / arena_id / mensalidade_id fk on delete cascade
- atleta_id uuid fk atleta on delete set null — NULL = participante avulso (só nome)
- nome text not null / valor_devido / valor_pago / credito_aplicado numeric(10,2) —
  com rateio ativo, valor_devido de uma fatia não é mais garantidamente significativo
  (participantes podem ser adicionados sem um valor pré-declarado; ver §18.2); o que
  vale sempre é `mensalista_mensalidades.valor_total` menos a soma paga pelas fatias
  ativas
- pago_em timestamptz — desde `20260913160000`, preenchido no primeiro pagamento
  registrado contra a fatia (não depende mais de valor_devido)
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
  Na competência em que `date_trunc('month', data_inicio) = competencia`, `valor_total`
  é pró-rateado por `private.mensalista_first_month_sessions(dia_semana, data_inicio,
  sessoes_por_mes)` — nº de ocorrências semanais do dia da recorrência de data_inicio
  até o fim do mês, limitado a sessoes_por_mes. 0 ocorrências ⇒ a mensalidade não é
  criada (a cobrança começa na competência seguinte). Migração
  `20260904140000_mensalista_prorata_first_month`.

- `configure_mensalista_rateio_atomic(p_arena_id, p_mensalidade_id, p_rateio, p_participantes jsonb, p_registered_by)`
  p_participantes = [{ atleta_id?, nome, ativo, valor }]. Congela as parcelas já pagas,
  apaga as não pagas e recria a partir da lista. rateio=false colapsa numa parcela do
  responsável. **Desde `20260913160000` (rateio incremental):** rateio=true não exige
  mais pelo menos um participante ativo, nem que Σ(valor) das ativas bata com o
  restante — a lista pode vir vazia (rateio ligado, ninguém lançado ainda) e cada
  participante entra com `valor` apenas informativo (0 = "ainda não sei quanto vai
  pagar"); a UI reenvia sempre a lista completa atual a cada adição/remoção. Continua
  validando que os `atleta_id` pertencem à arena. Recalcula o status da mensalidade a
  partir de `valor_total` (não mais da soma de `valor_devido` das fatias, que deixou
  de ser garantidamente igual ao total).

- `register_mensalista_payment_atomic(p_operation_id, p_arena_id, p_cobranca_id, p_valor, p_credito_aplicado, p_data, p_modo_pagamento_id, p_observacao, p_registered_by, p_lancar_excedente_credito default false)`
  Idempotente (p_operation_id = id do pagamento). **O dinheiro pode exceder o devido**
  (migração `20260904160000`, escopo ajustado para a mensalidade inteira em
  `20260913160000`): o "devido" que importa é `mensalidade.valor_total` menos a soma
  já paga por **todas as fatias ativas** da mensalidade (não mais a `valor_devido` da
  fatia que está recebendo o pagamento, que deixou de ser um teto significativo com o
  rateio incremental). `p_lancar_excedente_credito=false` grava o excedente na cobrança
  que está pagando (`valor_pago` fica acima do que sobrava); `=true` registra nessa
  cobrança só o que ainda faltava da mensalidade e lança o excedente como
  `mensalista_creditos` tipo='lancamento' — vinculado ao `atleta_id` da cobrança ou, se
  for parcela de **avulso**, ao **responsável da recorrência**
  (`planos_mensalista.athlete_id`); retorna `credito_atleta_id`. O **crédito aplicado**
  (`p_credito_aplicado`) nunca pode exceder o que falta da mensalidade inteira. Crédito
  aplicado exige cobrança com atleta_id e saldo suficiente (grava `mensalista_creditos`
  tipo='uso', valor negativo). Insere `mensalista_pagamentos` (valor = dinheiro total
  recebido); atualiza a cobrança (valor_pago, credito_aplicado, pago_em — agora marcado
  no primeiro pagamento, não mais quando a fatia "fecha"). Só a parte em dinheiro
  vai para `public.transactions`
  (type='entrada', category='Mensalidade', source_type='mensalista_pagamento',
  source_id=pagamento.id, ON CONFLICT DO UPDATE). Recalcula o status. Ao transicionar
  para 'quitado' (plano ativo): confirma os `bookings` 'reservado' da competência
  (price/rental_price = valor_total / sessoes_por_mes) e gera 1 mês 'reservado' à frente
  via `public._insert_monthly_plan_month_bookings`, exceto se
  data_encerramento_prevista cobrir o mês seguinte.

- `remove_mensalista_rateio_participante_atomic(p_arena_id, p_cobranca_id, p_registered_by)`
  (`20260913170000`). Exclui uma `mensalista_cobrancas` e reverte tudo o que havia sido
  lançado para ela: apaga os `mensalista_pagamentos` dessa cobrança (caem em cascata) e
  as linhas de `public.transactions` correspondentes (mesma convenção de exclusão
  definitiva de `deleteTransactionAction`, sem lançamento de estorno); apaga também as
  `mensalista_creditos` com `cobranca_id` igual (tanto o crédito **consumido** por ela
  — linhas `tipo='uso'`, negativas, removê-las devolve o saldo — quanto qualquer
  excedente que ela tivesse **lançado** — `tipo='lancamento'`, positivas). Bloqueado com
  `ERRCODE 55000` quando `mensalidade.status = 'quitado'` (as reservas do mês já foram
  confirmadas e o próximo mês já rolou) ou `'cancelado'`. Recalcula o status da
  mensalidade a partir de `valor_total`. Retorna `valor_revertido`, `credito_revertido`,
  `status` e a lista atualizada de `cobrancas` (mesmo formato de
  `configure_mensalista_rateio_atomic`).

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

- `reajustar_plano_mensalista_atomic(p_operation_id, p_arena_id, p_plano_id, p_novo_valor, p_escopo, p_observacao, p_registered_by)`
  (`20260904150000`). `p_escopo` ∈ {'mes_atual','mes_seguinte'}. Idempotente
  (p_operation_id = id do reajuste). Exige plano `status='ativo'` (senão `55000`).
  Materializa a competência corrente ao valor **antigo** primeiro (para 'mes_seguinte'
  nunca vazar no mês atual), registra em `planos_mensalista_reajustes`, faz
  `UPDATE planos_mensalista.valor_mensal = novo`, e reescreve `valor_total` +
  `valor_devido` das mensalidades `competencia >= vigência` que estejam **abertas/parciais
  sem rateio e sem pagamento/crédito**; as com rateio ou pagamento são contadas em
  `mensalidades_com_rateio_ignoradas` / `mensalidades_com_pagamento_ignoradas` no retorno.

### 18.3 Backend web (src/modules/mensalistas)

- types/mensalista.types.ts — rows das tabelas + `MensalistaResumo` (agregado por
  responsável), `MensalistaDetalhe`, `RecorrenciaResumo` (com `reajustes: ReajusteRow[]`),
  `RateioParticipanteInput`.
- schemas/mensalista.schema.ts — zod (configureRateio, registrarPagamento, lancarCredito,
  setEncerramento, reajustarValor).
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
  - configureRateioAction / removerParticipanteRateioAction / registrarPagamentoAction /
    lancarCreditoAction / retirarCreditoAction / setEncerramentoAction — parse zod + RPC
    correspondente. `configureRateioAction` também refaz um SELECT em
    `mensalista_cobrancas` após a RPC e devolve `data.cobrancas` — o `RateioModal` usa
    isso para persistir cada adição/toggle de participante imediatamente e seguir
    trabalhando com ids reais, sem precisar de um refresh de página inteiro a cada
    participante. `removerParticipanteRateioAction` devolve `valorRevertido`,
    `creditoRevertido`, `status` e `cobrancas` (mesmo formato).

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
  "Prever encerramento", **"Reajustar valor"**, "Cancelar plano" (reusa
  `cancel_monthly_plan_atomic` via `cancelPlanoMensalistaAction`) e um
  **Histórico de reajustes** (`RecorrenciaResumo.reajustes`). A **criação** de
  recorrência continua no calendário do espaço (`BookingModal` → `create_monthly_plan_atomic`),
  que agora mostra as recorrências que ainda cabem no mês e a 1ª mensalidade proporcional.
- Modais: `RateioModal` — desde `20260913160000`, fluxo incremental: mostra o valor
  total devido fixo; "Ativar rateio" liga sem exigir ninguém declarado; participantes
  (atleta cadastrado ou avulso) entram um a um via busca/"+ Adicionar participante",
  persistidos na hora (`configureRateioAction`); cada linha mostra só o quanto essa
  pessoa já pagou, com botão "Registrar pagamento" que abre o `RegistrarPagamentoModal`
  embutido para aquela fatia; toggle de ativo/remover só é permitido para quem ainda
  não pagou nada; um ícone de lixeira em cada linha — no modal e também na tabela de
  participantes por recorrência em `MensalistaDetailClient` (e na de "Pendências de
  meses anteriores") — chama `removerParticipanteRateioAction` (confirmação antes,
  bloqueado quando a mensalidade está quitada); resumo fixo **Pago / Falta** (ou "Pago a
  mais") sobre o valor total; "Desativar rateio" colapsa para a fatia única do
  responsável — `RegistrarPagamentoModal`
  (valor + data + forma + aplicar crédito; **permite pagar acima do devido** e pergunta
  se o excedente vira crédito; aceita `restanteMensalidade` opcional — quando informado,
  vindo de uma mensalidade com rateio, o "Restante" e o teto de crédito usam o que falta
  da mensalidade inteira em vez do `valor_devido` da fatia), `ReajustarValorModal` (novo
  valor + vigência mês atual/seguinte + observação), `LancarCreditoModal`, `RetirarCreditoModal`
  (retirada parcial do saldo do responsável, limitada ao saldo, registrada no extrato
  de créditos), `EncerramentoModal`.
- Util `src/lib/format.ts` — formatCurrency / formatCompetencia / formatDate / toCompetencia.
- `FinanceDashboardClient`: o botão "Confirmar" do painel de mensalistas pendentes vira
  link para o detalhe do mensalista.

---

## 19. Tabelas de preço de espaços

Contrato completo do banco: `arenadigital-db/docs/court-price-tables.md`.
Plano de produto: `docs/PLANO-Tabelas-de-Preco-Espacos.md`.

### 19.1 Modelo de dados (migração `20260904120000_court_price_tables` + `_acl`)

`court_price_tables` — grade nomeada de preços de um espaço
- id / court_id fk courts on delete cascade / arena_id fk arenas (desnormalizado p/ RLS)
- nome text / tipo text check ('padrao'|'mensalista'|'professor'|'custom')
- is_default boolean — exatamente 1 por espaço (índice único parcial); é a tabela do avulso e do app
- aplica_a text[] — dica de pré-seleção no modal de reserva
- ativo boolean / ordem int / created_at / updated_at
- Guards por trigger: **máx. 5 tabelas por espaço** (BEFORE INSERT) e `tipo` imutável nas 3 fixas (BEFORE UPDATE)

`court_price_table_days` — um dia da semana dentro de uma tabela
- price_table_id fk on delete cascade / arena_id / dia_semana smallint 0..6 (**0=domingo**)
- habilitado boolean / hora_inicio / hora_fim time (`fim <= inicio` cruza a meia-noite)
- slot_shift_time time null / preco_base numeric(10,2) — valor padrão do dia
- unique (price_table_id, dia_semana). **Sem linha = dia não oferecido** por essa tabela

`court_price_table_bands` — **só as faixas de exceção** (equivale ao `day_config.customPrices`)
- price_table_day_id fk on delete cascade / arena_id / hora_inicio / hora_fim / preco / ordem

Colunas de snapshot (nullable): `bookings.price_table_id`, `planos_mensalista.price_table_id`,
`app_booking_requests.price_table_id`, `app_online_booking_operations.price_table_id`.

RLS: select para `authenticated` via `can_access_arena_backoffice(arena_id)` nas 3 tabelas;
escrita só `service_role` / funções `SECURITY DEFINER`.

### 19.2 Resolver canônico

`public.resolve_court_price(p_court_id, p_price_table_id, p_start, p_end) → numeric`
(STABLE, SECURITY DEFINER, `search_path=''`, EXECUTE só `service_role`). Devolve a
**sugestão**: casa a janela do dia no fuso America/Sao_Paulo (testando ontem e hoje, para
funcionamento que cruza a meia-noite) e então:
- `courts.booking_type='hourly'` → **soma** o preço de cada hora (faixa que cobre o instante,
  senão `preco_base`), rateando a última hora parcial;
- `booking_type='unique'` → **valor fixo** da faixa que cobre o início, sem multiplicar pela duração;
- nenhum dia habilitado cobre o intervalo → **0**;
- `p_price_table_id` NULL → usa a tabela `is_default`; de outro espaço → erro `22023`.

O backoffice **sempre pode sobrescrever** o valor sugerido na reserva; o app usa o retorno direto.

### 19.3 Backend web (src/modules/courts)

- `types/price-table.types.ts` — `CourtPriceTable` / `CourtPriceDay` / `CourtPriceBand`,
  `MAX_PRICE_TABLES_PER_COURT = 5`, `RESERVED_PRICE_TABLE_KINDS`.
- `schemas/price-table.schema.ts` — zod (`upsertPriceTableSchema`, `createPriceTableSchema`).
- `lib/price-table-editor.ts` — adaptadores `CourtPriceDay ↔ DayConfig`, `toEditorDays` (7 dias
  na ordem segunda→domingo), `copyDaysFrom`, `dayConfigFromPriceDays`, `draftPriceTables`,
  `priceTableFromLegacyDayConfig` (aceita o mesmo que `getSlotPrice` aceita — inclusive hora
  sem zero à esquerda — e descarta o que ele descarta, para grade e tabela não divergirem).
- `lib/court-price-resolver.ts` — porta em TS de `resolve_court_price`: `resolveSlotPrice`
  (preço de um slot da grade, `null` fora da janela), `resolveCourtPriceSuggestion`
  (`hourly` soma / `unique` fixo), `matchPriceDay`/`priceAtInstant`. Coberto por teste de
  **paridade slot a slot** com o `getSlotPrice` legado.
- `actions/priceTableActions.ts` (todas com `assertArenaAdminAccess` + `assertCourtAccess`,
  exceto as de leitura do modal, que usam `assertArenaBackofficeAccess`):
  - `listCourtPriceTablesAction(arenaId, courtId)` — tabelas + dias + faixas montados.
  - `listCourtPriceTableOptionsAction(arenaId, courtId)` — lista enxuta para o `BookingModal`.
  - `quoteCourtPriceAction(arenaId, courtId, priceTableId|null, startISO, endISO)` → `resolve_court_price`.
  - `createCourtPriceTableAction` / `deleteCourtPriceTableAction` (só `custom`) /
    `setDefaultCourtPriceTableAction`.
  - `upsertCourtPriceTableAction(arenaId, input)` — reescreve cabeçalho + dias + faixas;
    quando `tipo='padrao'`, **espelha** `courts.day_config` / `price` / `available_days`
    (transição até o trigger de espelho do banco). Ainda não é atômico.
  - `saveDraftPriceTablesAction(arenaId, courtId, drafts)` — persiste as 3 tabelas fixas logo
    após criar o espaço (o trigger do banco já as semeou a partir do `day_config`).

Enquanto `supabase.types.ts` não é regenerado, essas actions acessam as tabelas via cliente
destipado (`/* eslint-disable @typescript-eslint/no-explicit-any */`, mesmo padrão de
`mobileContentActions`).

### 19.4 UI

- `components/PriceTablesConfig.tsx` — editor multi-tabela com dois modos:
  - **persistido** (`courtId`): carrega do servidor e **não tem botão próprio de salvar**
    (ver 19.6); permite `+ Nova tabela de Preços`, `Usar como tabela padrão` e
    `Excluir tabela` (só personalizadas).
  - **rascunho** (`draftTables` + `onDraftChange`): o pai é dono do estado, nada vai ao servidor
    até o espaço ser criado. Só as 3 fixas, sem criar/excluir/salvar por aba.
  - Comum aos dois: abas com selo de dias configurados (`Nd` / `vazia`), a tira de
    `DayCard` + o `DaySchedulePanel` do dia selecionado (ver 19.7),
    **Copiar faixas da tabela Padrão** e **Limpar tabela** nas não-padrão.
- `components/CourtForm.tsx` — **cadastro** renderiza o editor em modo rascunho (Padrão
  obrigatória: ao menos um dia habilitado, senão bloqueia o submit); no submit monta
  `day_config`/`available_days`/`price` a partir da Padrão, cria o espaço e chama
  `saveDraftPriceTablesAction`. **Edição** renderiza o modo persistido e o submit do
  formulário não toca mais em `day_config`.
- `BookingModal` — seletor **Tabela de preço** nas abas Avulso (default = `is_default`) e
  Mensal (default = `tipo='mensalista'`), exibido quando há mais de uma tabela. Ao trocar
  tabela/horário chama `quoteCourtPriceAction` e pré-preenche o valor, que **continua editável**
  ("Sugerido pela tabela: R$ X" + "usar sugerido").

### 19.5 Cópia de espaço (`duplicateCourtAction`)

Corrigido em 10/09/2026. O `INSERT` em `courts` dispara o trigger
`courts_seed_price_tables` (migration `20260904120000`), que semeia o espaço novo
com **Padrão traduzida de `day_config`** e **Mensalista/Professor vazias**. Numa
cópia isso perdia as faixas de Mensalista/Professor, as tabelas personalizadas,
os nomes renomeados e qual tabela era a `is_default`.

`lib/clone-price-tables.ts` → `clonePriceTablesToCourt(supabase, arenaId, sourceCourtId, targetCourtId)`
- Módulo puro (sem `'use server'`), recebe o cliente admin por parâmetro — por isso
  é testável com um cliente falso e não vira um endpoint de server action.
- Ordem: lê **toda** a origem (tabelas → dias → faixas) → `DELETE` das tabelas
  semeadas no destino (cascade leva dias/faixas) → reinsere tabela a tabela,
  preservando `nome`, `tipo`, `is_default`, `aplica_a`, `ativo`, `ordem`,
  `slot_shift_time`, `preco_base` e as faixas de cada dia.
- Ler tudo antes do `DELETE` é o que garante que uma falha de rede aborte com o
  destino ainda intacto (não é atômico: a RPC transacional é da Fase 2b).
- O `DELETE` é necessário porque as semeadas colidiriam com
  `court_price_tables_one_reserved_type_per_court`, `court_price_tables_court_nome_key`
  e `court_price_tables_one_default_per_court`. O guard de 5 tabelas por espaço não
  é atingido: o destino fica zerado antes da reinserção e a origem tem no máximo 5.
- Origem sem tabelas ⇒ retorna sem tocar no destino (as semeadas ficam).

`duplicateCourtAction` chama o helper depois de inserir o espaço e os esportes.
Falha na cópia **não** derruba o retorno: o espaço já existe, então a action
retorna `{ success: true, data, warning }` e `ArenaDetailPageClient` troca o
`toast.success` por `toast.warning` — repetir o "Copiar" criaria um segundo espaço.

Testes: `tests/court-price-tables-copy.test.mjs` (cliente Supabase falso — cópia
completa, `is_default`/`ativo` da origem, faixas por dia, tabela personalizada sem
dias, origem vazia, aborto antes do `DELETE`).

### 19.6 Botão único de salvar no formulário do espaço

Unificado em 10/09/2026. O cadastro já salvava tudo num botão só (editor em
rascunho + `saveDraftPriceTablesAction`); a **edição** tinha dois botões — o
"Salvar tabela" por aba e o "Salvar Alterações" do formulário, que não gravava as
tabelas. Agora `CourtForm` tem **um** `type="submit"` nos dois modos.

`PriceTablesConfig` expõe ao pai, por `ref` (React 19 — `ref` é prop, sem `forwardRef`):

```ts
export type PriceTablesHandle = {
  saveAll: () => Promise<boolean>   // false ⇒ já avisou o gestor por toast
  hasPendingChanges: () => boolean
}
```

- `saveDirtyTables(skipId?)` percorre as tabelas com `dirty` e chama
  `upsertCourtPriceTableAction` para cada uma (a da `padrao` continua espelhando
  `courts.day_config`/`price`/`available_days`), depois um `load()` só no fim.
- `CourtForm.onSubmit`, no ramo de edição: `updateCourtAction` → `saveAll()`. Se a
  gravação falhar, **não navega** — o gestor corrige e reenvia (o update do espaço
  é idempotente).
- As operações **estruturais** (`+ Nova tabela`, `Definir como padrão`, `Excluir`)
  continuam indo ao servidor na hora, mas agora chamam `saveDirtyTables()` antes:
  elas terminam em `load()`, que substitui o estado pelo do servidor e descartaria
  a edição em tela. `Excluir` passa `skipId` da própria tabela.
- Sinalização: bolinha âmbar na aba com pendência + aviso acima das abas
  ("N tabelas com alterações ainda não salvas — … em **Salvar Alterações**").

Testes em `tests/court-price-tables-boundaries.test.mjs` (ausência do "Salvar
tabela", um único `type="submit"`, `saveAll` no ramo de edição, as 3 guardas de
`saveDirtyTables`, indicador de pendência).

### 19.7 Semana em cards (editor de dias)

Implementado em 10/09/2026. Os 7 dias deixaram de ser 7 blocos abertos e
empilhados (~2.600px) e viraram uma tira de cards + um painel do dia
selecionado (~520px). Proposta e inventário de funções: artifact "Semana em cards".

**Arquivos**

- `lib/day-schedule.ts` (novo) — toda a matemática, extraída **sem alteração de
  comportamento** do antigo `DayScheduleConfig.tsx`: `tiersFromConfig` /
  `configFromTiers` (ida e volta das faixas), `normalizeTiers` (contiguidade e
  clamp ao funcionamento), `normalizeTime`, `countSlots`, `suggestSplitPoint`,
  `splittableTierIndex`, `isOvernight`, `slotShiftExample` e `summarizeDay`
  (resumo do card). Continua tudo em "minutos de operação" — horário anterior à
  abertura pertence ao dia seguinte. Os tipos `DayConfig`/`CustomPrice` moraram
  aqui (antes no componente); `price-table-editor.ts` importa daqui.
- `components/DayCard.tsx` (novo) — card de um dia: interruptor, horário, selo
  `+1`, barra de faixas (segmento proporcional à duração, opacidade pela posição
  do preço entre o mínimo e o máximo do dia) e `Nh · N faixas · R$ x–y`. É
  `div[role="button"]` — não `<button>` — porque contém o `Switch`; teclado por
  Enter/Espaço; o `onClick` do switch faz `stopPropagation` para não trocar o dia
  em edição junto.
- `components/DaySchedulePanel.tsx` (novo, era `DayScheduleConfig.tsx`) — o
  editor, agora em duas colunas: funcionamento + slots `:30` à esquerda, faixas
  de preço à direita. Perdeu o cabeçalho (nome do dia, checkbox, badge Ativo,
  contador, Replicar), que subiu para o card e a barra de modo.
- `components/DayScheduleConfig.tsx` — **removido**.

**Seleção e edição em lote (estado no `PriceTablesConfig`)**

- `selectedDows: number[]` + `batchMode: boolean`. Fora do lote, clicar num card
  troca a seleção; no lote, inclui/exclui — e a seleção **nunca fica vazia**
  (desmarcar o último mantém o anterior), senão o painel ficaria sem dia.
- `handleDayChange` grava a config do dia líder em todos os `selectedDows`,
  **preservando o `enabled` de cada dia**: quem abre e fecha é o interruptor, nunca
  um efeito colateral de editar preço.
- `handleReplicate` continua existindo (do dia líder para os outros 6) e fica
  desabilitado no lote e quando o dia líder está fechado.
- `autoPickedFor` guarda a tabela cujo dia já foi escolhido automaticamente: ao
  carregar e ao trocar de aba, se o dia selecionado estiver **fechado** naquela
  tabela, o painel pula para o primeiro dia aberto (a Professor costuma abrir
  menos dias que a Padrão). Ajuste de estado no render, não em efeito.
- `DaySchedulePanel` descarta o rascunho de horário digitado comparando uma
  **assinatura por valor** da config, não a identidade do objeto — o pai recria o
  `DayConfig` a cada render e a versão anterior (`useEffect` + `setState`)
  limpava o input no meio da digitação e violava `react-hooks/set-state-in-effect`.

**Invariante do payload**: `saveDirtyTables` monta os dias com
`EDITOR_DAY_ORDER.map(dow => editorDays.find(...)!)`. O `!` só é seguro porque
toda origem (servidor, rascunho, fallback de `day_config` legado, `copyDaysFrom`)
passa por `toEditor` → `toEditorDays`, que completa os 7 dias.

**Nomenclatura** (10/09/2026): `+ Nova tabela de Preços`, nome default
`Nova tabela de preços`, placeholder `Nome da tabela de preços`,
`Usar como tabela padrão`, `Excluir tabela`, `Adicionar faixa de horário`,
`Faixas de preço por horário`, `Valor por hora`, e horários rotulados
`Abre às` / `Fecha às` (dia) e `Começa às` / `Termina às` (faixa).

**Testes**: `tests/day-schedule.test.mjs` (26 — ida e volta da persistência,
idempotência da releitura, faixa padrão estável, madrugada, dados legados
corrompidos, reclamp, slots, divisão de faixa, resumo do card, invariante dos
7 dias) e a seção "Semana em cards" de `tests/court-price-tables-boundaries.test.mjs`.

---

### 19.8 Papéis das tabelas: `tipo` é a chave, `nome` é rótulo

Ajustado em 10/09/2026, preparando o vínculo com o perfil do cliente.

`court_price_tables.tipo` (`padrao` | `mensalista` | `professor` | `custom`) já era
a identidade da tabela; agora é o **único** identificador de papel — o `nome`
passou a ser puramente visual e imutável nas três reservadas.

**Como resolver a tabela pelo perfil do cliente** (o uso futuro):

```sql
SELECT id FROM public.court_price_tables
 WHERE court_id = $1 AND tipo = 'mensalista';
```

Servido pelo índice único parcial `court_price_tables_one_reserved_type_per_court
(court_id, tipo) WHERE tipo <> 'custom'`, criado em `20260904120000`. Ele é o que
garante **no máximo uma** tabela de cada papel por espaço — sem isso a resolução
por perfil seria ambígua. Nunca resolver por `nome`.

**Três camadas impedem o rename** (migração `20260910120000_court_price_tables_reserved_names.sql`):

1. **UI** — `PriceTablesConfig` troca o `Input` de nome por um rótulo com cadeado
   quando `isReservedPriceTableKind(tipo)`; o `title` explica que só as
   personalizadas são renomeáveis.
2. **Server action** — `upsertCourtPriceTableAction` omite `nome` do UPDATE
   quando o `tipo` lido do banco é reservado (a tela não é fronteira de
   segurança); `saveDraftPriceTablesAction` tem a mesma guarda.
3. **Banco** — `private.court_price_tables_guard` ganhou a regra
   `OLD.tipo <> 'custom' AND NEW.nome IS DISTINCT FROM OLD.nome → RAISE`, ao lado
   das que já barravam troca de `tipo`. A migração também documenta o contrato em
   `COMMENT ON COLUMN`/`ON INDEX`.

**Normalização do dado existente** (autorizada em 10/09/2026). A migração
reescreve o `nome` das reservadas para Padrão / Mensalista / Professor, para que
o papel tenha o mesmo rótulo em toda a plataforma.

Dois cuidados na migração, ambos cobertos por teste:

1. **Ordem.** `DROP TRIGGER` → `UPDATE` → `CREATE OR REPLACE FUNCTION` (com a
   regra nova) → `CREATE TRIGGER`. Se a regra entrasse antes, ela barraria a
   própria normalização. DDL no Postgres é transacional, então a janela sem
   trigger não existe para nenhuma sessão de fora.
2. **Colisão de nome.** `court_price_tables_court_nome_key (court_id, lower(nome))`
   é único: se uma tabela `custom` daquele espaço já se chama "Mensalista", o
   UPDATE da reservada colidiria. Um bloco anterior renomeia a personalizada para
   `<nome> (personalizada)` — com contador se isso também colidir — liberando o
   nome canônico. Como o índice é único, há no máximo uma detentora por espaço.

A migração emite `RAISE NOTICE` com quantas linhas normalizou e quantas
personalizadas precisou liberar.

`createCourtPriceTableAction` só cria `tipo='custom'`, então nunca há caminho para
um quarto papel reservado.

---

## 20. Recorrência de mensalista com vários blocos

Implementado em 09/09/2026. Um plano passa a representar N faixas semanais
(espaço, dia da semana, início, fim) com **uma única mensalidade**, para atender
o professor que aluga horários espalhados pela semana.

Mudança **aditiva**: as colunas `court_id`, `dia_semana`, `horario_inicio` e
`horario_fim` de `planos_mensalista` continuam existindo e continuam sendo a
fonte da verdade dos planos antigos. O discriminador é
`planos_mensalista.recorrencia_por_blocos`.

### 20.1 Migrações (repositório arenadigital-db)

- `20260909120000_mensalista_blocos_schema.sql` — coluna `recorrencia_por_blocos`,
  tabela `planos_mensalista_blocos`, índices, RLS, grants, backfill dos planos
  existentes e `private.mensalista_plan_blocks(uuid)`.
- `20260909120010_mensalista_blocos_bookings.sql` — `_insert_monthly_plan_month_bookings`
  ciente de blocos (assinatura inalterada).
- `20260909120020_mensalista_blocos_create.sql` — `create_monthly_plan_blocks_atomic`.
- `20260909120030_mensalista_blocos_prorata.sql` — `private.mensalista_month_minutes`
  e pró-rata por minutos em `generate_mensalista_mensalidades_atomic`.
- `20260909120040_mensalista_blocos_acl.sql` — REVOKE/GRANT EXECUTE.

### 20.2 Modelo de dados

`planos_mensalista` (nova coluna)
- recorrencia_por_blocos boolean not null default false — `true` ⇒ a agenda vem de
  `planos_mensalista_blocos`, o mês gera **todas as ocorrências de calendário** e o
  valor é rateado por duração. `false` mantém a regra legada (uma faixa,
  `sessoes_por_mes` fixo, preço por sessão igual).

`planos_mensalista_blocos` — faixas semanais de um plano
- id uuid pk / plano_id fk planos_mensalista on delete cascade
- arena_id fk arenas (desnormalizado para a policy de RLS) / court_id fk courts
- dia_semana smallint check (0..6)
- horario_inicio / horario_fim time, check horario_fim > horario_inicio
- created_at timestamptz
- unique (plano_id, court_id, dia_semana, horario_inicio)
- RLS: SELECT para `can_access_arena(arena_id)` ou o atleta dono do plano.
  `REVOKE ALL` de anon/authenticated + `GRANT SELECT` a authenticated. Escrita
  só pelas RPCs `SECURITY DEFINER`.

`private.mensalista_plan_blocks(p_plan_id uuid)` — fonte única de leitura: devolve
as linhas de `planos_mensalista_blocos` e, na ausência delas, deriva um bloco das
colunas legadas do plano. É o que mantém planos antigos funcionando.

### 20.3 RPCs

`create_monthly_plan_blocks_atomic(p_arena_id, p_athlete_id, p_sport_id, p_blocks jsonb,
p_valor_mensal, p_additional_athlete_ids, p_registered_by, p_effective_date default null)`
- `p_blocks`: `[{court_id, dia_semana, horario_inicio, horario_fim}]`, 1..40 itens.
- Valida cada bloco, rejeita **sobreposição entre blocos do próprio plano**, trava
  (`FOR UPDATE`) toda quadra envolvida, confere vínculo do atleta e dos participantes.
- **Bloqueia o bloco:** antes de gravar qualquer coisa, percorre todas as ocorrências
  do horizonte de 3 meses e levanta `23P01` nomeando data, hora e ocupante na primeira
  colisão. Nada é criado pela metade.
- Idempotente por `creation_fingerprint` (inclui os blocos e a data de vigência).
- Grava o **primeiro bloco** nas colunas legadas do plano para as telas que ainda leem
  `plan.dia_semana`, e `recorrencia_por_blocos = true`.
- `create_monthly_plan_atomic` (assinatura antiga) permanece intacta.

`_insert_monthly_plan_month_bookings` — no caminho por blocos, cada bloco gera **todas**
as suas ocorrências no mês e o preço de cada reserva é
`valor_mensal × (minutos do bloco / minutos do mês)`, de modo que a soma das reservas
fecha com a mensalidade. `p_session_price` é ignorado nesse caminho. Conflito continua
sendo decidido por `create_backoffice_booking`, que aborta a transação.

`generate_mensalista_mensalidades_atomic` — pró-rata da primeira competência por
**minutos** (`private.mensalista_month_minutes`) quando `recorrencia_por_blocos`;
caminho legado por sessões preservado.

### 20.4 Camada web

- `src/modules/bookings/lib/mensalista-blocos.ts` — aritmética de calendário pura:
  `agruparBlocos` (horas contíguas ⇒ um bloco), `ocorrencias`, `ocorrenciasDoBloco`
  (desconta a ocorrência de hoje quando o horário do bloco já começou — corrigido em
  14/09/2026, ver 22.4), `avaliarSlot`
  (estados `free | busy | conflict-future | closed | past` considerando **todo** o
  horizonte), `resumirPlano`, `fracaoPrimeiroMes` (espelha o pró-rata por minutos do
  banco), `intervaloDeCotacao`. Coberta por `tests/mensalista-blocos.test.mjs`.
- `src/modules/bookings/components/MensalistaBlocosPicker.tsx` — grade semanal,
  chips de espaço com horas livres, faixa de "outros espaços livres neste horário"
  e lista de blocos com valor por ocorrência.
- `createPlanoMensalistaBlocosAction(arenaId, {athlete_id, sport_id, blocos, valor_mensal,
  additional_athlete_ids})` — valida com zod, checa `assertCourtAccess` de **cada** espaço
  e chama a RPC.
- `quoteMonthlyBlocksAction(arenaId, blocks[])` — resolve `resolve_court_price` por bloco
  numa chamada só (debounce de 250 ms na tela). O total mensal é composto no cliente
  multiplicando pelas ocorrências reais de cada dia.
- `BookingModal` (aba Mensal) — carrega espaços e reservas dos 3 meses numa consulta ao
  abrir; seletor de **tabela de preço por espaço** usado; campo de valor mensal editável
  que para de ser sobrescrito assim que o gestor digita (`lastAutoValorBlocos`).

### 20.5 Tela de Mensalistas

`PLANO_SELECT` (`src/modules/mensalistas/actions/mensalistaActions.ts`) passou a embutir
os blocos:

```
blocos:planos_mensalista_blocos(id, court_id, dia_semana, horario_inicio, horario_fim,
                                court:court_id(id, name))
```

Só uma FK de `planos_mensalista_blocos` aponta para `planos_mensalista`
(`plano_id`), então o embed do PostgREST não é ambíguo. `PlanoMensalistaComDetalhes`
ganhou `blocos?: PlanoMensalistaBloco[] | null`.

`MensalistaDetailClient` decide pelo número de blocos:
- `blocos.length > 1` → cabeçalho agregado **"N horários · Xh por semana"**, seção
  "Horários da recorrência" no card aberto e aviso de encerramento listando todas as
  faixas liberadas para revenda.
- caso contrário → render legado (`p.court.name`, `DIAS[p.dia_semana]`, `horario`),
  inalterado. Planos legados criados após a migration vêm com `blocos: null`, e o
  componente trata com `p.blocos ?? []`.

---

### 20.9 Cancelamento definitivo do plano (`cancel_monthly_plan_atomic`)

*Ajustado em 13/09/2026.* Marca `planos_mensalista.status = 'cancelado'` e
cancela toda reserva futura (`start_time >= now()`) do plano, **incluindo as
já `confirmed`** — não só as `reservado`. Antes, o `UPDATE` filtrava
`status = 'reservado'`, e como o mês corrente nasce sempre `confirmed` na
criação do plano (independente de já estar pago), o restante do mês corrente
sobrevivia ao cancelamento e continuava ocupando o calendário — dessincronia
entre a tela de Mensalistas (recorrência cancelada) e o calendário do espaço
(horário ainda "reservado"). Migration
`20260913180000_cancel_monthly_plan_confirmed_too.sql`; teste pgTAP em
`atomic_monthly_plans.sql` atualizado para esperar 0 `confirmed` / 0
`reservado` / 8 `cancelled` após o cancelamento (antes: 4/0/4). Não lança
crédito automático — valor já recebido fica como está; compensar o atleta é
manual (Lançar/Retirar crédito).

## 21. Cancelamento de uma sessão do plano mensalista

Implementado em 11/09/2026. Cancela **um** booking da recorrência, com crédito
opcional, sem tocar em plano, mensalidade ou cobrança.

**Por que precisou de caminho próprio:** `updateBookingStatusAction` recusa
explicitamente reservas com `plano_mensalista_id` ("Reservas de mensalista devem
ser gerenciadas em Mensalistas"), porque cancelar uma sessão tem consequência
financeira. E `cancel_monthly_plan_atomic` encerra a recorrência inteira.

**Invariante que torna isso seguro:** nenhum trigger em `public.bookings`
recalcula mensalidade. O valor devido do mês vem do plano
(`valor_mensal` / pró-rata por sessões ou minutos), nunca da contagem de
bookings. Cancelar uma sessão, portanto, **não** reduz o que ele deve — o mês
segue cheio e o crédito é a compensação. Coberto por teste.

### 21.1 Migração (`arenadigital-db`)

`20260911120000_mensalista_cancel_session.sql`
- `mensalista_creditos.booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL`
  — aditiva e nullable (crédito manual avulso continua sem booking). O
  `SET NULL` garante que apagar a reserva não suma com o crédito concedido.
- `CREATE UNIQUE INDEX mensalista_creditos_one_per_booking ON (booking_id) WHERE booking_id IS NOT NULL`
  — **um crédito por jogo cancelado**. É essa a trava contra creditar duas vezes.
- `public.cancel_mensalista_booking_atomic(p_operation_id, p_arena_id, p_booking_id,
  p_lancar_credito, p_valor_credito, p_descricao, p_registered_by) RETURNS jsonb`
  - trava a reserva `FOR UPDATE`; exige `plano_mensalista_id` (recusa avulso);
  - o crédito vai para `planos_mensalista.athlete_id` — o **titular do plano**,
    não quem estiver no `bookings.athlete_id` (pode ser participante do rateio);
  - reserva já cancelada ⇒ devolve o estado com `idempotent: true`, sem erro e
    sem criar crédito (cobre duplo clique; cancelamento e crédito são a mesma
    transação, então não existe estado pela metade);
  - `UPDATE bookings SET status='cancelled'` + `INSERT mensalista_creditos`
    (`tipo='lancamento'`, `booking_id`), sob advisory lock por (arena, atleta);
  - devolve `{booking_id, atleta_id, credito_id, valor_credito, saldo, idempotent}`.
  - ACL: `REVOKE ... FROM PUBLIC, anon, authenticated, service_role` + `GRANT ... TO service_role`.

### 21.2 Backend web

`src/modules/bookings/actions/mensalistaActions.ts`
- `quoteSessaoMensalistaAction(arenaId, bookingId)` → `{ valorSugerido, tabelaNome, origem, atletaNome, inicio, fim }`.
  Cadeia da tabela de preço, deliberada:
  1. `planos_mensalista.price_table_id` (snapshot de quando o plano foi criado) → `origem: 'plano'`;
  2. tabela `tipo='mensalista'` do espaço — planos antigos não têm o snapshot, e o
     papel é resolvido por `tipo`, nunca por nome (ver §19.8) → `origem: 'mensalista'`;
  3. `null` ⇒ `resolve_court_price` cai na tabela padrão do espaço → `origem: 'padrao'`,
     e a tela **avisa** o gestor para conferir.

  O valor sai sempre de `resolve_court_price` no banco; não há cálculo de preço no cliente.
- `cancelarSessaoMensalistaAction(input)` — zod + `assertArenaBackofficeAccess` +
  `requireAuthenticatedDbUser`, chama a RPC e revalida as rotas do calendário **e**
  `/dashboard/arenas/[id]/mensalistas`.

`src/modules/bookings/lib/cancelamento-sessao.ts` — `diaCurto`, `diaExtenso`,
`faixaHoraria` e `descricaoCreditoJogoCancelado`. A descrição está fora do
componente porque é contrato com o gestor: é o que ele lê no extrato meses depois.

### 21.3 UI

- `BookingDetailsModal` — botão **"Cancelar este dia"** quando
  `isMensalista && status !== 'cancelled'`. Reserva **confirmada** (mês pago)
  também pode ser cancelada: é o caso que gera crédito.
- `CancelarSessaoMensalistaModal` — aviso em destaque de que vale só para aquele
  jogo; dia por extenso, horário, mensalista e espaço; checkbox de crédito
  (marcado por padrão); valor pré-preenchido pela cotação e **editável**;
  descrição pré-preenchida. `operationId: crypto.randomUUID()` como chave de
  idempotência.
- `MensalistaDetailClient` — linha do extrato de créditos ganha o selo
  **"Jogo cancelado"** quando `booking_id` está preenchido. O acesso é por
  helper com cast (`booking_id` ainda não está em `supabase.types.ts`).

Testes: `tests/mensalista-cancelar-sessao.test.mjs` (15 — texto exato da
descrição, escopo do SQL, cadeia da tabela de preço, autorização, idempotência,
ACL, entrada e saída na UI).

---

## 22. Cobrança do plano por blocos: preço da hora fixo

Corrigido em 11/09/2026, depois de um plano real sair 25% acima do combinado.

**O defeito.** A tela sugeria `valor_mensal` contando as ocorrências do **mês
seguinte** (outubro, 5 quintas ⇒ R$ 500) enquanto o pró-rata dividia pelas do
**mês de início** (setembro, 4 quintas). Resultado: R$ 500 × 2/4 = R$ 250 para 2
sessões — R$ 125/sessão num plano cotado a R$ 100/h. Duas referências diferentes
para a mesma conta.

Ao conferir o rateio das reservas apareceu o problema de fundo: com
`valor_mensal` fixo, R$ 500 × 12 = R$ 6.000/ano para 52 sessões = R$ 115,38 por
sessão. A mensalidade fixa e o preço de tabela são incompatíveis quando o número
de ocorrências varia de mês para mês.

**O modelo escolhido** (decisão do gestor, 11/09/2026): **o preço da hora é fixo,
a fatura acompanha o calendário.**

```
valor da competência = valor_mensal × (minutos do mês ÷ minutos do mês de referência)
```

O pró-rata do primeiro mês deixa de ser um caso especial: é a mesma fórmula, com
um mês parcial no numerador. `valor_mensal` passa a significar **o valor de um mês
de referência** — o primeiro mês em que o plano roda inteiro (o próprio mês quando
começa no dia 1, senão o seguinte). É a mesma referência que a tela usa para
sugerir o valor, então o preço por hora implícito bate sempre.

Caso do plano que originou a correção (quinta 20h–21h a R$ 100/h, criado em
11/09/2026):

| competência | reservas | valor | por reserva |
|---|---|---|---|
| set/2026 (estreia, parcial) | 2 | R$ 200,00 | R$ 100,00 |
| out/2026 (referência) | 5 | R$ 500,00 | R$ 100,00 |
| nov/2026 | 4 | R$ 400,00 | R$ 100,00 |
| dez/2026 | 5 | R$ 500,00 | R$ 100,00 |

### 22.1 Os três pontos que precisam da MESMA referência

Um desalinhamento entre quaisquer dois deles vira cobrança errada:

1. **`resumirPlano` / `fracaoPrimeiroMes`** (`lib/mensalista-blocos.ts`) —
   `mesReferencia(inicioVigencia)` é a fonte única no cliente. Antes,
   `ocorrenciasMesCheio` usava sempre o mês seguinte e `fracaoPrimeiroMes` usava o
   mês de início.
2. **`generate_mensalista_mensalidades_atomic`** (`20260909120030`) — o ramo
   `recorrencia_por_blocos` saiu de dentro da guarda "só na competência de
   estreia" e passou a valorar **toda** competência. O ramo legado
   (`sessoes_por_mes`) segue intocado, como `ELSIF`.
3. **`_insert_monthly_plan_month_bookings`** (`20260909120010`) — o denominador do
   rateio virou o mês de referência, e não o mês corrente. Sem isso o preço de uma
   reserva mudaria de mês para mês (R$ 125 num mês de 4 quintas) e a soma das
   reservas não fecharia com a mensalidade.

### 22.2 UI

- "Reservas em mês cheio" virou **"Reservas no mês de referência"** — o rótulo
  antigo sugeria um mês canônico que não existe.
- `ResumoPlano.variacaoMensal` traz os valores **distintos** que a fatura assume
  em 12 meses (`[{ocorrencias: 4, valor: 400}, {ocorrencias: 5, valor: 500}]`) e a
  tela os exibe quando há mais de um, antes de o gestor fechar o plano.

### 22.3 Escopo

Só `recorrencia_por_blocos = true`. Planos legados mantêm mensalidade fixa com
pró-rata por `sessoes_por_mes` apenas na estreia. Como as migrations de blocos
ainda não foram aplicadas, a correção foi feita **nelas mesmas** em vez de empilhar
uma migration de conserto sobre algo que nunca rodou — não há plano por blocos em
produção para migrar.

Testes: `tests/mensalista-blocos.test.mjs` (invariante preço-por-hora, caso real
do gestor, plano iniciado no dia 1º, blocos de durações diferentes, variação anual,
e as três referências no SQL).

### 22.4 O pró-rata também precisa saber a HORA de hoje, não só a data (14/09/2026)

`resumirPlano` e `fracaoPrimeiroMes` ganharam um parâmetro `agora: Date` (default
`new Date()`), e passam a usar `ocorrenciasDoBloco` em vez de `ocorrencias` cru.
Antes, `inicioVigencia` (a data de hoje à meia-noite) fazia com que a ocorrência de
HOJE sempre contasse na primeira competência, mesmo com o horário do bloco já
tendo passado — marcar às 20h40 um mensalista de segunda 16h–17h cobrava a sessão
de hoje, que o atleta não tem mais como jogar. `ocorrenciasDoBloco` descarta essa
ocorrência quando `horario_inicio < agora`, espelhando a mesma regra que
`create_monthly_plan_blocks_atomic` já usava para decidir quais reservas criar
(`IF v_start_time >= now() THEN ...`).

**Pendência (banco):** o item 1 da lista em 22.1 (`resumirPlano`/`fracaoPrimeiroMes`)
ficou consciente da hora; os itens 2 e 3 — `generate_mensalista_mensalidades_atomic`
e `private.mensalista_month_minutes`, em `arenadigital-db` — ainda tomam `p_from`
como `date`, sem hora. Na prática o próprio `create_monthly_plan_blocks_atomic` já
não cria a reserva de hoje quando o horário passou, então não sobra reserva
"fantasma"; mas o valor da primeira mensalidade gerada por
`generate_mensalista_mensalidades_atomic` ainda pode não bater com o que a tela
mostrou em "Cobrado agora" nesse caso de borda (criar o plano depois do horário de
hoje já ter passado). Alinhar as duas pontas requer uma migration em
`arenadigital-db` e está fora do escopo desta correção (feita só na tela).

---

## 23. Reajuste de valor: vigência ancorada na tela e ajuste pontual

Corrigido e ampliado em 11/09/2026 (migração `20260911130000_mensalista_reajuste_escopo_mes.sql`).

### 23.1 A vigência era ancorada no relógio, não na tela

`reajustar_plano_mensalista_atomic` derivava a competência de
`now() AT TIME ZONE 'America/Sao_Paulo'`. O gestor, olhando outubro numa tela com
navegação por mês, escolhia "Mês atual" e o reajuste caía em **setembro** em
diante — o mês corrente do servidor.

- A RPC ganhou `p_competencia date`: a âncora vem do cliente (o mês exibido).
  `COALESCE(p_competencia, now()…)` preserva o comportamento antigo se vier NULL.
- `ReajustarValorModal` recebe `competencia` (`YYYY-MM-01`) e **nomeia o mês em
  cada opção** — "De outubro de 2026 em diante" em vez de "Mês atual". O rótulo
  ambíguo era a causa raiz; renomear é o que impede a confusão de voltar.
- A assinatura mudou, então a versão antiga é derrubada com `DROP FUNCTION IF
  EXISTS …(uuid,uuid,uuid,numeric,text,text,uuid)` antes do `CREATE`, para não
  deixar sobrecarga ambígua.

### 23.2 Novo escopo `somente_mes`

Desconto pontual combinado com o mensalista, sem mexer no plano.

- `planos_mensalista_reajustes.escopo` aceita `somente_mes` (CHECK recriado).
- É o **único escopo que não executa** `UPDATE planos_mensalista SET valor_mensal`.
- O laço filtra `competencia = v_vigencia_comp` (igualdade), não `>=`.
- Grava o valor exato digitado, sem reaplicar a proporção — é um acerto pontual.

### 23.3 O reajuste passou a respeitar a regra de cobrança do plano

Com a mudança de §22 (plano por blocos cobra proporcional ao mês), o laço que
reescrevia mensalidades futuras com `valor_total = v_novo` **fixo** passou a estar
errado: um plano de quinta reajustado para R$ 550 cobraria R$ 550 num mês de 4
quintas, em vez de R$ 440.

A fórmula foi extraída para `private.mensalista_valor_competencia(plan, competencia,
valor_mensal)` (migração `20260909120000`), agora usada pelos **dois** caminhos:

| chamador | uso |
|---|---|
| `generate_mensalista_mensalidades_atomic` | valor de cada competência ao materializar |
| `reajustar_plano_mensalista_atomic` | valor de cada competência ao reescrever |

Plano legado devolve `valor_mensal` inalterado; blocos devolve a proporção; `0`
significa mês sem ocorrência (não se cobra) e `NULL`, plano inexistente. Um teste
garante que a fórmula **não** esteja duplicada fora dela.

### 23.4 Materialização antes de reescrever

A RPC chama `generate_mensalista_mensalidades_atomic` para o mês âncora (com o
valor **antigo**, para um reajuste "mês seguinte" não vazar para ele) e, quando a
vigência é outro mês, também para ele — senão não existiria linha para ajustar
num mês ainda não gerado.

Testes: `tests/mensalista-reajuste.test.mjs` (11) e
`tests/mensalista-reajuste-schema.test.mjs` (competência obrigatória no dia 1º,
novo escopo).

---

## 24. Exclusão e desativação de espaço

Implementado em 12/09/2026. Antes havia só "Excluir", que falhava com erro cru de
FK em alguns espaços e destruía histórico em outros.

### 24.1 O mapa de FKs que motivou o desenho

| tabela | `ON DELETE` | efeito ao excluir o espaço |
|---|---|---|
| `bookings` | **CASCADE** | apaga todas as reservas — e por cascata `booking_participants`, `booking_services` e afins |
| `court_sports` | CASCADE | ok |
| `court_price_tables` | CASCADE | ok |
| `rotativo_courts` | CASCADE | ok |
| `planos_mensalista` | NO ACTION | **bloqueia** com erro de FK |
| `planos_mensalista_blocos` | NO ACTION | **bloqueia** (migração de blocos) |
| `app_booking_requests` | **RESTRICT** | **bloqueia** |
| `transactions` | *sem FK* | **não** é apagada — fica sem a reserva que a originou |

A última linha é a que decide o desenho: o dinheiro permanece no caixa, mas perde
a rastreabilidade. Remover os bloqueios sem mais nada transformaria "Excluir
espaço" numa funcionalidade de perda de dados.

### 24.2 Backend (`courtActions.ts`)

- `getCourtDeletionImpactAction(arenaId, courtId)` → `CourtDeletionImpact`:
  contagens de reservas (total / futuras / confirmadas), recorrências,
  solicitações do app e tabelas de preço, mais `podeExcluir` e `bloqueios[]`
  já redigidos na linguagem do gestor. Reserva `cancelled` não conta como
  histórico. As contagens usam um helper tolerante: tabela inexistente no
  ambiente (migração pendente) conta **zero** em vez de derrubar o levantamento.
- `setCourtActiveAction(arenaId, courtId, ativo)` grava
  `status = 'ativo' | 'inativo'` **e** `is_active`. O `status` é o campo que as
  RPCs atômicas do banco já checam (`atomic_backoffice_booking_bundle`,
  `atomic_monthly_plan_create/confirm`, `create_monthly_plan_blocks_atomic` e as
  do app), então desativar bloqueia novas reservas de verdade, na camada certa.
- `deleteCourtAction` **refaz o levantamento no servidor** antes de apagar e
  recusa com mensagem específica quando há histórico — a tela não é fronteira de
  segurança.

### 24.3 UI (`ExcluirEspacoDialog.tsx`)

Um diálogo só, com as duas ações. Ao abrir, carrega o levantamento e mostra a
lista do que está vinculado. Depois:

- **sem histórico** → aviso vermelho do que será removido, botão "Excluir
  permanentemente" habilitado;
- **com histórico** → aviso âmbar com o motivo e os números, botão de excluir
  **desabilitado** (com o motivo no `title`), e a orientação de desativar;
- **espaço já inativo** → o mesmo diálogo oferece "Reativar espaço".

O item do menu passou de "Excluir" para "Desativar ou excluir" (ou "Reativar ou
excluir"), para o gestor saber que há uma saída reversível antes de abrir.

O `ConfirmActionDialog` genérico saiu deste fluxo: o aviso dependia de números
que só o servidor conhece.

Testes: `tests/court-exclusao.test.mjs` (15 — inclui a asserção do `ON DELETE
CASCADE` de `bookings` e da ausência de FK em `transactions`, que são as razões
de existir a guarda).

---

## 25. Perfil do atleta na arena

Implementado em 12/09/2026. Migração `20260912120000_atleta_perfil_arena.sql`.

### 25.1 O dado que faltava

`planos_mensalista.price_table_id` existia como coluna desde `20260904120000`, mas
**nada nunca a escrevia**: o gestor escolhia a tabela no seletor do `BookingModal`,
ela era usada para cotar e descartada no salvar — o campo não existia no schema da
action nem nas RPCs de criação. Sem ela, não há como distinguir um plano de
professor de um de mensalista comum.

`create_monthly_plan_blocks_atomic` ganhou `p_price_table_id` (a tabela do
**primeiro bloco**, mesmo critério já usado para `court_id` e horário do plano) e
valida que ela pertence ao espaço desse bloco. O caminho legado
(`create_monthly_plan_atomic`, sem seletor na tela) não recebeu o parâmetro.

Efeito colateral corrigido: o crédito de jogo cancelado (§21) lia esse campo e caía
sempre no fallback da tabela Mensalista — um professor recebia crédito a preço de
mensalista.

### 25.2 Modelo

Em `arenas_atleta` (já única por `id_arena, id_atleta`) — o perfil é **por arena**:

- `perfil text` — o que o gestor definiu. `NULL` = usar o sugerido.
- `perfil_definido_por uuid` + `perfil_definido_em timestamptz` — autoria, limpas ao voltar ao sugerido.
- `CHECK (perfil IS NULL OR perfil IN ('padrao','mensalista','professor'))`.

O perfil guarda o **papel**, nunca um `price_table_id`: as tabelas são por espaço e
cada espaço resolve a sua por `(court_id, tipo)` (§19.8). Um perfil preso a uma
tabela quebraria no segundo espaço.

Guardar sugerido e definido separadamente evita os dois erros clássicos: perder a
escolha do gestor quando o plano muda, e congelar um perfil que deveria acompanhar
a situação.

### 25.3 RPCs

- `private.atleta_papeis_derivados(arena, atleta) → text[]` — papéis em ordem de
  precedência. Professor exige `JOIN court_price_tables ON id = plano.price_table_id`
  com `tipo='professor'`, então plano legado (sem a coluna) nunca entra. Mensalista
  exige ser `planos_mensalista.athlete_id` de plano ativo — participante do rateio
  não conta. Sem nenhum, `['padrao']`.
- `public.get_atleta_perfil(arena, atleta) → jsonb` — `papeis_detectados`,
  `perfil_sugerido` (= `v_papeis[1]`), `perfil_definido`, `perfil_efetivo`
  (`COALESCE(definido, sugerido)`).
- `public.set_atleta_perfil_atomic(arena, atleta, perfil, registered_by)` —
  `perfil = NULL` volta ao sugerido. Devolve o estado resultante.

Todas server-only; a derivação é `private` e não é concedida nem ao `service_role`.

### 25.4 Web

- `modules/athletes/actions/perfilActions.ts` — `getPerfilAtletaAction` /
  `setPerfilAtletaAction`, com os rótulos e descrições dos perfis.
- `modules/athletes/components/PerfilAtletaCard.tsx` — selos dos papéis detectados,
  seletor com o sugerido marcado, e o motivo da sugestão em texto.
- `BookingModal` aba **Mensal**: a heurística fixa (`tipo='mensalista'`) deu lugar ao
  papel do atleta. A aba Avulso **não** foi alterada.

**Corrida resolvida:** o perfil e as tabelas dos espaços carregam em paralelo. Um
`useRef<Set<string>>` marca quais escolhas foram automáticas; quando o perfil chega
depois, essas voltam para recálculo, e a escolha manual do gestor é removida do
conjunto para nunca ser sobrescrita.

Testes: `tests/atleta-perfil.test.mjs` (19).

## 26. Relatório de Pagamentos — filtro de Atleta, Rateio linha a linha e dívida do mês

Implementado em 13/09/2026, em cima do relatório existente (`getPaymentStatusReportAction`,
`StatusPagamentosPageClient`).

### 26.1 Tipos (`modules/reports/types/report.types.ts`)

- `PaymentStatusRow.servico` ganha `'Recorrência' | 'Rateio'`.
- `PAYMENT_STATUS_SUMMARY_EXCLUDED_SERVICOS = ['Recorrência']` — a linha
  `Recorrência` é só contexto (o plano/mensalidade do mês), sem `valor`; excluída
  da soma dos cards para não contar 2x o que as linhas `Rateio` já somam.
- `PaymentStatusFilters` ganha `atletaId?: string` e `rateio?: boolean` (só tem
  efeito com `tipo: 'mensal'`).
- Novo `AthleteDebtSummary = { mensal: number; avulso: number }`.

### 26.2 Filtro de Atleta

Casa o atleta filtrado como **responsável OU participante** em qualquer fonte do
relatório — não só `bookings.athlete_id`/`transactions.atleta_id`, mas também
`booking_participants.atleta_id` (convidado de avulso com rateio) e
`station_orders.atleta.id`/`rotativo_inscricoes.atleta.id`/`rotativo_credito_movimentos.atleta.id`.
Implementado como pós-filtro em JS (`matchesAtleta`) depois do fetch de cada fonte —
todas já traziam `id` do atleta relacionado (ou passaram a trazer: `booking_participants`
ganhou `atleta_id` no `select`, e os `atleta:...(nome_perfil)` das demais fontes
ganharam `id`), então não precisou de nova query.

### 26.3 Checkbox "Rateio" (`rateio: boolean`, só com `tipo: 'mensal'`)

`buildRateioBreakdownRows(supabase, arenaId, competencia, { courtId, sportId, atletaId })`
substitui as linhas agregadas de `transactions` (categoria "Mensalidade") — a query de
`transactions` nem roda nesse modo (`wantsRateioBreakdown` no `reportActions.ts`).

- Busca `mensalista_mensalidades` da `competencia` (= `filters.startDate`, primeiro
  dia do mês) e `arena_id`; filtra por `athlete_id = atletaId` quando informado
  (responsável, não participante — ver 26.4 sobre por quê).
- Espaço/esporte: `resolveAllowedPlanoIds` junta `planos_mensalista` (coluna legada
  `court_id`/`sport_id`) com `planos_mensalista_blocos` (blocos extras de planos
  multi-horário) pra achar os `plano_id` que batem com o filtro.
- Por mensalidade: 1 linha `Recorrência` (plano + status quitado→Pago/senão→Pendente,
  `valor: null`) + 1 linha `Rateio` por `mensalista_cobrancas` ativa (`ativo=true`) —
  `valor` = quitado (`valor_pago+credito_aplicado`) se cobriu o `valor_devido`, senão
  o que falta (`valor_devido - pago - crédito`), status Pago/Pendente correspondente.
- `planos_mensalista_blocos` e a relação `mensalidade:mensalidade_id!inner(...)` ainda
  não estão nos tipos gerados — mesmo cliente destipado (`LooseClient`) usado em
  `modules/bookings/actions/mensalistaActions.ts`.

### 26.4 "Quanto o atleta deve" (`athleteDebt`, cards no client)

`computeAthleteDebtSummary` roda sempre que `filters.atletaId` está setado (com
qualquer `tipo`, inclusive `todos`) — não depende do checkbox Rateio nem do filtro
de Espaço/Esporte (dívida é do atleta, não de uma quadra).

- **Avulso devido:** `bookings` sem `plano_mensalista_id`, `status IN (reservado,
  pending_payment)`, no mês; soma `price` quando o atleta é `athlete_id`, ou a fatia
  não paga (`booking_participants.valor` sem `pago_em`) quando é convidado de reserva
  com `cobranca_por_participante`.
- **Mensal devido:** `mensalista_cobrancas` do atleta (`atleta_id = filtro`,
  `ativo = true`) cuja mensalidade (`!inner` join) é da `arena` e `competencia` do
  mês; soma `valor_devido - valor_pago - credito_aplicado` (clampado em 0).

Por que a linha `Rateio` (26.3) casa por **responsável** e o card de dívida (26.4)
casa por **participante direto** (`cobranca.atleta_id`): o checkbox mostra "as
recorrências de um responsável e o que está ligado a elas" (visão da recorrência);
o card responde "quanto ESSA pessoa deve", incluindo quando ela só participa do
rateio de alguém.

### 26.5 UI (`StatusPagamentosPageClient.tsx`)

- `AthleteFilterField` — combobox de busca única (debounce 400ms, `searchAthletesAction`
  reaproveitado de `modules/loyalty`), mesmo padrão do `BookingParticipantsField`.
- Checkbox "Rateio — Ver linha a linha" (`Checkbox` do design system) fica
  desabilitado fora de `tipo='mensal'`; trocar o Tipo para outro valor desliga o
  Rateio automaticamente.
- 2 cards novos ("{atleta} deve de Mensal" / "de Avulso") só renderizam com atleta
  selecionado, ao lado dos 3 cards existentes (Pago/Pendente/Cancelado).
- `applyFilters` foi refeito para receber um objeto de overrides parciais
  (`Partial<FilterState>`) em vez de 4 parâmetros posicionais — precisava para não
  multiplicar combinações com os 2 filtros novos.

## 27. Relatório de Pagamentos — extrato de ocupação hora a hora

Implementado em 14/09/2026. Fecha o mês com professor/mensalista: lista cada
hora de espaço ocupada, com o preço daquela hora.

### 27.1 Tipos e contrato

- `PaymentStatusRow` ganha `fim?: string | null` e `horas?: number | null` —
  presentes só em linha que vem de reserva (comanda/rotativo/lançamento manual
  não ocupam intervalo).
- `PaymentStatusSummary` ganha `totalACobrar` (pago + pendente, cancelado fora) e
  `totalHoras`.
- `PaymentStatusFilters` ganha `detalharPorHora?: boolean`.
- Export: `PAYMENT_STATUS_EXPORT_HEADERS` passa a ter **Horário** e **Horas**;
  `buildPaymentStatusSheetData(rows, formatData, formatHorario?)`.

### 27.2 `modules/reports/usage-lines.ts` (puro, testado)

`buildUsageLines({ startISO, endISO, valorReserva, precoDaHora, bookingType,
valorFallback })` devolve uma linha por hora (última fração rateada), ou uma
linha só quando o espaço é `booking_type = 'unique'`.

Regra de valor, nessa ordem:
1. `valorReserva` (avulso) — rateado por duração, **sobra do arredondamento na
   última linha**, para a soma bater ao centavo com o que foi cobrado;
2. `precoDaHora(instante)` — tabela de preço (mensal);
3. `valorFallback` — valor gravado na reserva, quando nenhuma tabela cobre;
4. `null` — sem nada disso, a linha fica sem valor em vez de virar R$ 0,00.

**`saoPauloWallClock(instant)`** devolve um `Date` cujos componentes *locais* são
os de São Paulo. Sem isso o relatório erraria a grade: o servidor roda em UTC e
uma quinta 21:00 na arena é **sexta 00:00** em UTC — leria a linha errada da
tabela. O módulo não tem import de runtime (só tipos, apagados pelo
`--experimental-strip-types`), por isso é testável direto em `tests/`.

### 27.3 Preço da hora (`reportActions.ts`)

- `loadArenaPricing(loose, arenaId)` monta, em 4 consultas, `courtId →
  { bookingType, porTabela, porTipo, padrao }` a partir de `court_price_tables` →
  `court_price_table_days` → `court_price_table_bands`. Só roda no modo extrato.
- `buildPrecoDaHora(...)` aplica a cascata de `quoteSessaoMensalistaAction`:
  snapshot do plano → tabela do tipo `mensalista` do espaço → **tabela padrão**.
  A padrão entra também como rede quando a tabela escolhida existe mas está
  **sem grade** — `Mensalista` e `Professor` nascem vazias
  (`seed_court_price_tables`), e `resolve_court_price` devolveria 0 para elas.
- O cálculo usa `matchPriceDay`/`priceAtInstant` de
  `courts/lib/court-price-resolver.ts`, a porta TS de `public.resolve_court_price`.
  Conferido contra o banco: uma reserva de 2h atravessando as faixas de R$ 100 e
  R$ 120 dá `[100, 120]` no TS e `220` no `resolve_court_price` — mesmo número.

### 27.4 O que entra e o que sai no modo extrato

`payment-report-sources.ts` ganhou o parâmetro `{ detalharPorHora }`:

- `shouldIncludeBookingRow` passa a aceitar **toda** reserva — inclusive a de
  mensalista já `confirmed` (a aula que aconteceu) e a avulsa `cancelled` (a data
  que caiu). Fora do extrato a regra antiga continua igual.
- `shouldIncludeTransactionRow` **descarta a categoria `Mensalidade`**, senão o
  mês entraria duas vezes (uso + pagamento). Lançamento manual e demais
  categorias seguem aparecendo.

O `summary` soma `totalACobrar`/`totalHoras` só no que não está cancelado, e
continua ignorando as linhas `Recorrência` (§26.1).

---

## 28. Relatório de Pagamentos — o mensal vem da cobrança, não da transação (14/09/2026)

### 28.1 O que estava errado

O mensalista entrava no relatório pela transação de categoria `Mensalidade`. São
duas, criadas pelo banco em momentos diferentes:

| `source_type` | Quando nasce | `total_value` |
|---|---|---|
| `monthly_plan_month` | na **criação** do plano (`create_monthly_plan_blocks_atomic`) | `valor_mensal` **cheio** |
| `mensalista_pagamento` | a cada pagamento registrado | o valor recebido |

A primeira é herança do modelo anterior à camada mensalidade→cobrança→pagamento
(28/08/2026) — a migration de remodelagem chega a tratar todo posting
`monthly_plan_month` histórico como mensalidade **quitada** no backfill. Ela não
conhece o pró-rata: um plano de R$ 320/mês criado no meio de setembro grava
R$ 320, quando a competência de estreia vale R$ 240. E, por ser `type='entrada'`,
o relatório a dava como **Paga** (`status: 'Pago'` fixo nas linhas de transação),
antes de qualquer recebimento — contradizendo o card `athleteDebt`, que já lia a
cobrança e mostrava R$ 240 em aberto.

Somar as duas transações contaria o mesmo mês duas vezes assim que o gestor
registrasse o pagamento.

### 28.2 Fonte nova: `mensalidade-rows.ts`

Módulo **puro** (só tipos importados), no espírito de `usage-lines.ts`:

- `loadMensalidadesDaCompetencia` (em `reportActions.ts`, a parte que consulta)
  devolve `MensalidadeContexto[]` — mensalidade + plano + espaço/esporte +
  `horario` da recorrência + cobranças ativas. É a mesma consulta que a visão
  Rateio já fazia, agora compartilhada pelas duas visões (uma query a menos).
- `resumoDaMensalidade(m)` → `{ valor, status, pagoEm }`. Devido = soma de
  `valor_devido` das cobranças ativas (ou `valor_total` quando não há nenhuma);
  liquidado = `valor_pago + credito_aplicado`. Quitada → `Pago` com a data do
  recebimento mais recente; parcial/aberta → `Pendente` com o que falta;
  `status='cancelado'` → `Cancelado` (fora do "quanto cobrar").
- `buildMensalidadeRows` (1 linha `Mensalista` por mensalidade) e
  `buildRateioBreakdownRows` (linhas `Recorrência` + `Rateio`) consomem o mesmo
  contexto — a soma das linhas de Rateio bate com a linha agregada, por
  construção.

### 28.3 O que sai, para não contar duas vezes

- `shouldIncludeTransactionRow` recebe `sourceType` e descarta a transação de
  `Mensalidade` gerada pelo sistema (`MENSALIDADE_SYSTEM_SOURCE_TYPES` =
  `monthly_plan_month`, `mensalista_pagamento`). **Lançamento manual** do
  Financeiro na mesma categoria não tem `source_type` e continua entrando.
- As **reservas** de um plano que já tem mensalidade na competência saem
  (`planosComMensalidade`). Sem isso, um mês cujas reservas ainda estão
  `reservado` (os meses à frente) apareceria como a mensalidade **mais** cada
  sessão. Meses ainda sem mensalidade gerada seguem listando as reservas, como
  antes — o relatório converge conforme `generate_mensalista_mensalidades_atomic`
  materializa cada competência.
- No extrato (`detalharPorHora`) nada disso roda: lá o mês aparece hora a hora
  nas reservas e a mensalidade sai inteira (§27.4).

Testes: `tests/relatorio-mensalidade-competencia.test.mjs`.

### 28.4 Pendência (banco)

A transação `monthly_plan_month` continua sendo gravada na criação do plano, com
o valor cheio, e **segue aparecendo no Financeiro e no faturamento do Dashboard**
(nenhum dos dois filtra por `source_type`) como uma entrada que ninguém pagou.
O relatório de Pagamentos deixou de contá-la, mas a correção de raiz é parar de
lançá-la — a cobrança do mensalista já é `mensalista_mensalidades` +
`mensalista_cobrancas`, e o recebimento já vira transação em
`mensalista_register_payment`. Requer migration em `arenadigital-db`.

---

## 29. Relatório de Pagamentos — exportação em PDF (15/09/2026)

### 29.1 Por que dois módulos separados

- `payment-status-pdf-data.ts`: **puro**, sem import de runtime — `buildAppliedFiltersDescription`
  (filtros efetivamente selecionados, na mesma lógica de "o que aparece" da tela) e
  `formatArenaAddressLine` (junta rua/número/complemento/bairro/cidade/UF, omitindo o
  que falta em vez de deixar vírgula solta). Testado direto em `tests/payment-status-pdf.test.mjs`.
- `payment-status-pdf.ts`: só roda no navegador — usa `fetch`/`FileReader` para embutir
  o logo como data URL e `jspdf`/`jspdf-autotable` (`4.2.1`/`5.0.8`, via `pnpm`) para
  desenhar. `StatusPagamentosPageClient` importa este módulo **dinamicamente** no clique
  de "Exportar PDF" (`await import('@/modules/reports/payment-status-pdf')`), o mesmo
  padrão já usado para `write-excel-file/browser` — nem jsPDF nem a lib de Excel entram
  no bundle inicial da página.

### 29.2 Dados da arena no cabeçalho

`PaymentStatusArenaInfo` (novo tipo em `report.types.ts`) é resolvido uma vez em
`page.tsx`, **fora** da action do relatório (não muda por filtro):

```
[getPaymentStatusReportAction, getArenaByIdAction, getArenaBillingAddress]
  = await Promise.all([...])
```

`getArenaByIdAction` dá nome/telefone/e-mail; `getArenaBillingAddress` (já existente,
usado pela tela de assinatura) resolve endereço + CNPJ/CPF, inclusive cidade/UF via
`municipios`/`estados`. `arenaInfo` desce como prop para o client, ao lado de
`initialCourts`/`initialSports`.

### 29.3 Layout do PDF

`jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })`. De cima para baixo,
tudo centralizado até a régua horizontal:

1. Logo (`/logo_arena_front_bgbranco.png` — 3ª troca no mesmo dia: primeiro
   `logo_arena.png`, depois `img/logo_pdf.png` — marca quadrada, agora esse banner
   horizontal em fundo branco; proporção fixa 625:211, dimensionado por
   `LOGO_WIDTH = 130pt` — o banner é largo e baixo, então quem manda é a largura,
   não a altura) + "Sistema de Gestão para Arenas Esportivas".
2. Nome da arena (negrito) + endereço — só isso (telefone, e-mail e CNPJ/CPF
   saíram do cabeçalho em 15/09/2026, a pedido; `getArenaByIdAction`/
   `getArenaBillingAddress` continuam trazendo os três, só não entram mais no PDF).
   Sem endereço cadastrado, a linha nem aparece (`formatArenaAddressLine` devolve
   `null`).
3. Título "Relatório de Pagamentos — {mês}" + "Filtros aplicados" (`buildAppliedFiltersDescription`,
   quebrado em linhas com `splitTextToSize`) + "Resumo do período" (os totais de
   `PaymentStatusSummary` — **sem** "Horas ocupadas", ver 29.5 — mais "{atleta} deve..."
   quando há Atleta filtrado).
4. Tabela via `autoTable(doc, {...})` — mesmas colunas da tela (Data, Horário, Atleta,
   Serviço, Espaço, Esporte, Valor, Status), não as da planilha Excel (que tem
   "Horas" a mais, uma coluna analítica que não está na UI). Status colorido por linha
   via `didParseCell` (verde/amarelo/vermelho, mesma paleta dos badges). Rodapé via
   `didDrawPage`: "Gerado em ..." à esquerda, "Página X de Y" à direita.

### 29.4 Verificação

`autoTable`/`jsPDF` são bibliotecas de terceiros — o comportamento dos hooks
(`didParseCell`, `didDrawPage`) e de `columnStyles` com chave numérica não dá pra
confirmar só lendo `.d.ts`. Rodado um smoke test fora da suíte (script descartável,
fora do repo) chamando `autoTable` com os mesmos hooks e `doc.output('arraybuffer')`:
gerou o PDF sem exceção. A suíte de testes do projeto cobre só a parte pura
(`payment-status-pdf-data.ts`) e os contratos de import dinâmico/strings-chave do
módulo browser-only, por regex de source — não a renderização em si.

### 29.5 "Horas ocupadas" removido do resumo (15/09/2026)

`summary.totalHoras` soma `horas` das linhas de `bookingRows` (reserva avulsa ou de
mensalista) — mas **não** das linhas de `mensalidade-rows` (§28), que não carregam
`horas`. Como a maioria das recorrências já tem mensalidade gerada na competência
(e as reservas correspondentes saem da lista — §28.3), o total ficava restrito às
poucas reservas que ainda não viraram mensalidade: um mês real com dezenas de horas
de mensalistas mostrava "2h ocupadas", vindo só de duas reservas avulsas de 1h. O
número nunca representou o total do período — foi tirado do resumo do PDF
(`resumoPartes` em `payment-status-pdf.ts`) junto com o parâmetro `formatHoras`,
que ficou sem uso.

**Pendência:** o card "Total a cobrar" da tela (`StatusPagamentosPageClient.tsx`)
ainda mostra o mesmo número (`· {formatHoras(summary.totalHoras)} ocupadas`) — não
foi tocado porque o pedido era sobre o PDF. Calcular horas ocupadas corretamente
exigiria somar também os blocos de `planos_mensalista_blocos` das mensalidades do
mês (não só das reservas soltas), o que está fora do escopo desta correção.

---

## 30. Calendário do espaço — visão de Mês (15/09/2026)

### 30.1 Escopo: acréscimo, não substituição

`CourtCalendarPageClient.tsx` (`/dashboard/arenas/{id}/courts/{courtId}/calendar`) já tinha
Dia/Semana — uma grade `[80px_1fr]` (coluna de horário + 1 ou 7 colunas de dia) que
rola verticalmente pelos slots de hora. `viewMode` virou `'day' | 'week' | 'month'`
e o bloco JSX de Dia/Semana permanece **byte a byte o mesmo**, dentro do ramo `else`
de um `viewMode === "month" ? (...) : (...)`; a visão de Mês é o ramo novo, num
layout completamente diferente (grid 7 colunas de dias, sem coluna de horário nem
scroll interno por slot). `tests/court-calendar-month-view.test.mjs` fixa isso por
regex de source — inclusive que `<TimeSlot` (exclusivo de Dia/Semana) continua
presente.

### 30.2 Grade do mês e busca de reservas

`monthDays` é a grade exibida: `startOfWeek(startOfMonth(currentDate))` até
`endOfWeek(endOfMonth(currentDate))` (semana começando segunda, como em `weekDays`)
— inclui os dias do mês anterior/seguinte que completam a primeira/última semana,
para a grade nunca ter uma linha pela metade.

`loadBookings` ganhou o ramo `month`: busca **a grade inteira**, não só
`1º..último dia do mês` — senão os dias de outro mês nas bordas apareceriam sem os
agendamentos que de fato têm. Dia e Semana seguem exatamente como antes.

`getBookingsForDay(date)` filtra `bookings` (já carregadas para a grade) por
`isSameDay` + `blocksAvailability` (mesmo filtro que decide o que ocupa um slot em
Dia/Semana) e ordena por horário — até 3 aparecem no card do dia, o resto vira
"+N mais".

### 30.3 Interação

- **Clicar no dia** (fundo do card) → `setViewMode("day")` + `setCurrentDate(day)` +
  `loadBookings(day, "day")`. É o "drill-down" padrão de calendário de mês: não dá
  pra cadastrar reserva direto no card do mês (não há horário ali), então o clique
  leva pra a visão que tem.
- **Clicar numa reserva** dentro do card → `e.stopPropagation()` (não troca de
  visão) + abre `BookingDetailsModal`, mesmo componente usado em Dia/Semana.
- Cor do chip por status/esporte: `getMonthChipStyles`, mesma regra de
  `SingleBookingCard` (pending_payment → laranja, reservado → âmbar, confirmado →
  cor do esporte via `getSportStyles`), resumida pra um chip de uma linha.

### 30.4 Navegação e rótulo do período

`handlePrevious`/`handleNext` ganharam o terceiro ramo (`subMonths`/`addMonths`);
"Hoje" já era genérico por `viewMode`. O rótulo do período no topo mostra
`format(currentDate, "MMMM 'de' yyyy")` em Mês, ao lado de `dd 'de' MMMM` (Dia) e
`dd/MM – dd/MM` (Semana) que continuam iguais.

### 30.5 Fora do escopo

`court-slots.ts` (§15.3) é o utilitário compartilhado que a aba Operação usa;
`CourtCalendarPageClient.tsx` mantém suas próprias cópias locais de `parseHHMM`,
`generateSlotsForDate` etc. — duplicação pré-existente, não mexida aqui (fora do
pedido, que era só acrescentar a visão de Mês).

---

## 31. Pausar plano do mensalista (21/09/2026)

Complementa §18. Feature nova: até aqui o ciclo de uma recorrência só tinha
`ativo`/`cancelado` (definitivo) e a "previsão de encerramento" (unidirecional).
Não havia como registrar um afastamento temporário e **reversível** — o
mensalista viaja um período e volta, sem perder o horário.

### 31.1 Modelo de dados

Migrations em `arenadigital-db`: `20260921100000_mensalista_pausa_schema.sql`,
`20260921100010_mensalista_pausa_atomic.sql`,
`20260921100020_mensalista_pausa_bookings_skip.sql`.

Nova tabela `planos_mensalista_pausas` (auditável, mesmo espírito de
`planos_mensalista_reajustes`, não colunas em `planos_mensalista`): `id`
(= operation_id), `arena_id`, `plano_id`, `pausa_inicio`/`pausa_fim` (date),
`cobranca_modo` (`integral`|`proporcional`|`nenhuma`), `bookings_acao`
(`liberar`|`manter`), `status` (`ativa`|`cancelada`), `observacao`,
`registered_by`, `cancelada_em`/`cancelada_por`. Índice único parcial
`WHERE status='ativa'` garante no máximo uma pausa ativa por plano — a RPC de
criação supera (cancela) uma pausa futura existente em vez de empilhar. RLS
só-SELECT via `can_access_arena_backoffice`; toda escrita via RPC
`SECURITY DEFINER`. O plano **continua `status='ativo'`** durante a pausa —
"pausado" é derivado (existe uma pausa `ativa` para o plano), não um valor de
`planos_mensalista.status`.

### 31.2 `private.mensalista_pausa_kept_ratio`

Fração (0..1) das ocorrências normais de uma competência que ficam **fora**
do intervalo de pausa. Reaproveita `private.mensalista_plan_blocks` (a mesma
fonte de ocorrências de `mensalista_valor_competencia` e
`_insert_monthly_plan_month_bookings`) em vez de duplicar a iteração de
dia-da-semana/blocos — mesma preocupação de fonte única que motivou extrair
`mensalista_valor_competencia` em 09/09. `cobranca_modo='proporcional'`
multiplica essa fração pelo `valor_total` **já materializado** da mensalidade
(que já reflete pró-rata de mês de estreia e proporção por blocos), em vez de
recalcular do zero.

### 31.3 `pausar_plano_mensalista_atomic`

Segue o esqueleto de `reajustar_plano_mensalista_atomic` (idempotência por
`p_operation_id`, advisory lock, `SELECT … FOR UPDATE` do plano, exige
`status='ativo'`):

- Rejeita `pausa_inicio` no passado e uma pausa que se sobreponha a uma **em
  andamento** (`ERRCODE 55000`). Uma pausa **futura ainda não iniciada** do
  mesmo plano é superada automaticamente (chama
  `private.mensalista_pausa_reverter` nela antes de inserir a nova) — é o
  mecanismo de "editar pausa": não existe uma RPC de update separada.
- Para cada competência que o intervalo toca: chama
  `generate_mensalista_mensalidades_atomic` (materializa se ainda não existe)
  e reescreve `valor_total`/`valor_devido` conforme `cobranca_modo`, pulando
  mensalidades com rateio ou pagamento (mesmo critério do reajuste, contado em
  `mensalidades_com_rateio_ignoradas`/`_com_pagamento_ignoradas`).
  `nenhuma` grava `valor_total=0` e `status='cancelado'` — reaproveita o
  enum já existente de `mensalista_mensalidades.status`; o filtro
  `status <> 'cancelado'` que a tela já usa nos totais passa a excluir esse
  mês automaticamente, sem mudança nenhuma no frontend.
- Resolve as reservas **já existentes** no intervalo (`status IN
  ('reservado','confirmed')`): `bookings_acao='liberar'` cancela
  (`UPDATE … SET status='cancelled'`, mesma forma de
  `set_mensalista_termination_atomic`); `'manter'` não toca.

### 31.4 `private.mensalista_pausa_reverter` e `remover_pausa_mensalista_atomic`

`mensalista_pausa_reverter(pausa_id, registered_by)` é o desfazimento
compartilhado entre "editar pausa" (§31.3) e "remover pausa": marca a pausa
`cancelada`, recalcula via `mensalista_valor_competencia` (ignorando a pausa)
as mensalidades que ela havia tocado e ainda não têm rateio/pagamento, e — só
quando `bookings_acao='liberar'` — reativa (`status='reservado'`) as reservas
`cancelled` dentro do intervalo da pausa. É *best-effort* (mesmo espírito de
não haver desfazimento perfeito no resto do módulo): se algo mais cancelou a
mesma reserva depois, ela é reativada do mesmo jeito.

`remover_pausa_mensalista_atomic` só aceita uma pausa `ativa` com
`pausa_inicio` no futuro — mesma regra de "Remover previsão" do encerramento.
Não é idempotente por operation_id (a ação é rara; um duplo clique encontra a
pausa já `cancelada` e falha com "Pausa ja foi removida", inofensivo).

### 31.5 Geração de reservas passa a saber pular dias pausados

`_insert_monthly_plan_month_bookings` (chamada por
`register_mensalista_payment_atomic` ao rolar o mês seguinte) ganhou, nos dois
caminhos (legado e por blocos), uma checagem `EXISTS` contra
`planos_mensalista_pausas` (`status='ativa'`, ocorrência dentro de
`[pausa_inicio, pausa_fim]`) logo depois do `p_skip_past`. Assinatura
inalterada. O efeito é que **nenhuma reserva nova nasce** dentro de um período
pausado — o calendário do espaço já trata `cancelled`/ausência de reserva como
horário livre (`blocksAvailability` em `CourtCalendarPageClient.tsx`), então
não há nenhuma mudança do lado da leitura da agenda.

`register_mensalista_payment_atomic` não muda: a condição de rolagem
(`data_encerramento_prevista`) continua igual, decidindo só **se** o próximo
mês é gerado — quais dias dentro dele nascem é decisão da função acima.

### 31.6 Web

Módulo `src/modules/mensalistas/`: `PausaRow` (tipo manual, como `ReajusteRow`),
`RecorrenciaResumo.pausas`, `StatusPlano` ganha `'pausado'` (prioridade
`cancelado > encerrando > pausado > ativo` em `derivePlanoStatus`, que agora
recebe um `Set<planoId>` de pausas ativas buscado à parte, tanto no overview
quanto no detalhe). `pausarPlanoSchema`/`removerPausaSchema` +
`pausarPlanoMensalistaAction`/`removerPausaMensalistaAction` seguem o
esqueleto de `reajustarValorPlanoAction`. `PausarPlanoModal.tsx` (novo) segue
o layout do `EncerramentoModal`/`ReajustarValorModal`: período (dois
`<Input type="date">`), cobrança e ação nas reservas como grupos de botões
estilo rádio, observação, e "Remover pausa" no rodapé quando a pausa ainda não
começou. Badge **Pausado** ao lado das tags existentes
(Proporcional/Pago/Cancelado) na recorrência e no `STATUS_PLANO_STYLE` do
overview. `supabase.types.ts` ganhou o hand-patch de
`planos_mensalista_pausas` + as duas RPCs (regeneração oficial pendente,
mesmo hábito do resto do módulo); `schema-contracts/arenadigital-web.public-tables.txt`
(no `arenadigital-db`) ganhou a tabela.

### 31.7 Fora do escopo (decisão consciente)

Encerrar uma pausa **em andamento** antecipadamente; múltiplas pausas
simultâneas no mesmo plano; estorno automático de valores já pagos antes do
registro da pausa (usar "Lançar crédito" manualmente, mesmo padrão do
overpay/reajuste).

Testes: `supabase/tests/20260921100010_mensalista_pausa_atomic_test.sql`
(pgTAP, cobre os três `cobranca_modo`, `liberar`/`manter`, skip na geração
futura, editar/superar pausa, remover pausa, idempotência e as três
rejeições). `tests/mensalista-actions-atomic.test.mjs` teve as contagens
estáticas bumpadas (9→11 auth, 4→5 operation_id) e ganhou os dois novos nomes
de schema/RPC na lista verificada.

## 32. Dashboard — filtro de período e layout horizontal no gráfico de ocupação (22/09/2026)

### 32.1 Problema

O gráfico "Ocupação dos espaços" (`src/modules/dashboard/components/OccupancyChart.tsx`)
só mostrava a ocupação do dia atual, sem opção de ver semana/mês, e usava
barras verticais com o nome do espaço no eixo X — em arenas com muitos
espaços os rótulos se sobrepunham.

### 32.2 Backend (`src/modules/dashboard/actions/dashboardActions.ts`)

`getDashboardDataAction(selectedArenaId, occupancyPeriod: OccupancyPeriod = 'day')`
ganhou o segundo parâmetro (`OccupancyPeriod = 'day' | 'week' | 'month'`,
`dashboard.types.ts`). `getOccupancyPeriodRange(period, now)` resolve o
intervalo: `day` = hoje, `week` = semana corrente (`startOfWeek`/`endOfWeek`,
`weekStartsOn: 1`), `month` = mês corrente. `buildOccupancyRows` deixou de
receber um único `dayName` e passou a receber `periodDates: Date[]`
(`eachDayOfInterval` do intervalo): para cada espaço, itera os dias do
período, soma a capacidade (`endHour - startHour` do `day_config` daquele
dia da semana, quando habilitado) e conta as reservas daquele dia dentro da
mesma janela de horário — mesma lógica de antes, só que somada dia a dia em
vez de calculada uma única vez para "hoje". A busca de `bookings` usa o
range do período (`occupancyRangeStartStr`/`occupancyRangeEndStr`, com a
mesma folga de 6h após o fim do período que já existia para o dia) em vez de
sempre buscar só o dia atual.

### 32.3 Frontend

`OccupancyChart.tsx`: `BarChart` do recharts passou a usar `layout="vertical"`
(barras horizontais, uma por espaço, nome no eixo Y à esquerda). Altura do
container é dinâmica (`Math.min(Math.max(220, N*44+20), 420)`); acima de
~9 espaços a lista ganha `overflow-y: auto` interno em vez de esticar o
card indefinidamente. Nome do espaço usa um tick customizado
(`CourtNameTick`) que trunca em 16 caracteres com "…" e expõe o nome
completo via `<title>` (tooltip nativo do SVG) — evita sobreposição sem
esconder a informação. A barra mantém o padrão de "uma barra só" (fundo
cinza = capacidade do período, preenchimento colorido = ocupado), como
antes, só que agora refletindo o período filtrado. `Tooltip` ganhou
`cursor={{ fill: '#f8fafc' }}` para destacar a linha em hover (antes era
transparente).

`src/app/dashboard/page.tsx`: novo estado `occupancyPeriod` (`OccupancyPeriod`,
padrão `'day'`) e `Tabs`/`TabsList`/`TabsTrigger` (Dia/Semana/Mês) no
`CardHeader` do gráfico; título do card e mensagem de vazio mudam por
período (`OCCUPANCY_PERIOD_LABELS`/`OCCUPANCY_EMPTY_MESSAGES`). A troca de
período dispara um `useEffect` dedicado que busca só a ocupação
(`isOccupancyLoading`, aplica `opacity-50` no card durante o fetch) sem
re-exibir o skeleton de página inteira — esse continua reservado para a
carga inicial e para troca de arena/usuário (`isLoading`, primeiro
`useEffect`, que lê o período atual via `occupancyPeriodRef` para não
precisar depender dele). Seletor de tabs oculto no modo `?tutorial=1`
(dado mockado fixo em `tutorialDashboardOccupancy`).

## 33. Templates de Mensagens — tela inicial (aba WhatsApp) (23/09/2026)

### 33.1 Escopo desta etapa

Interface do novo submenu **Configurações → Templates Mensagens**, seguindo
à risca o padrão visual/estrutural do Catálogo (`src/modules/products`), e
a modelagem de dados em `arenadigital-db` (33.5). A tela ainda opera com
estado local no client (`useState`) — os Server Actions (`categoryActions.ts`
como padrão) entram só depois da migração chegar em homolog e do
`supabase.types.ts` ser regenerado (33.4).

### 33.2 Menu e rotas

`Sidebar.tsx`: novo item "Templates Mensagens" dentro do accordion
Configurações, ao lado de Usuários/Assinatura/Perfil da Arena/WhatsApp
(`settingsTemplatesHref`, ativo quando `pathname.startsWith('/dashboard/settings/templates-mensagens')`).

`dashboard-default-route.ts`: seção `'templates-mensagens'` adicionada ao
`DashboardSection`, resolvendo para a primeira arena administrável
(Owner/Gestor) do usuário, igual à seção `'whatsapp'`.

Rotas (mesmo padrão de `settings/whatsapp/[arenaId]`):
- `src/app/dashboard/settings/templates-mensagens/page.tsx` — redirect via
  `resolveDashboardDefaultRoute('templates-mensagens')`.
- `src/app/dashboard/settings/templates-mensagens/[arenaId]/page.tsx` —
  server component; `assertArenaAdminAccess(arenaId)` (Owner/Gestor, mesma
  regra das demais telas de Configurações), busca `arenas.name` e renderiza
  `TemplatesMensagensPageClient` com `initialTemplates: []`.
- `loading.tsx`/`error.tsx` — `DashboardBlocksLoading`/`DashboardErrorState`,
  iguais aos de `whatsapp/[arenaId]`.

### 33.3 Módulo (`src/modules/templates-mensagens`)

- `types/templateMensagem.types.ts` — `MessageTemplate` (`id`, `arena_id`,
  `channel: 'whatsapp'`, `identifier`, `name`, `message`, `status: 'Ativo' | 'Inativo'`,
  `created_at`) e `MessageTemplateFormInput`. Tipo local provisório —
  quando o schema web (`supabase.types.ts`) for regenerado após a migração
  chegar em homolog, substituir por tipos derivados de
  `Database['public']['Tables']['message_templates']`.
- `constants/messageVariables.ts` — catálogo de variáveis disponíveis
  (`MESSAGE_TEMPLATE_VARIABLES`: `token`/`label`/`description`), ver 33.6.
- `components/TemplatesMensagensPageClient.tsx` — página: header, `DashboardTabs`
  com uma única aba ("Whatsapp", preparado para novos canais no futuro),
  toolbar (busca por nome/identificador/mensagem + filtro de status + botão
  "Novo template"), tabela (`arenaDataTable`: Nome — com o `identifier` como
  subtítulo em `<code>` —, Mensagem — truncada em 2 linhas —, Status, Criado
  em, Ações), menu de ações por linha (Editar/Excluir) e
  `ConfirmActionDialog` para exclusão. CRUD manipula `templates` (state)
  diretamente, sem Server Action.
- `components/TemplateMensagemFormModal.tsx` — `Dialog` + `react-hook-form` +
  `zod` (`identifier` min 2 + regex `^[a-z0-9]+(-[a-z0-9]+)*$`, `name` min 2,
  `message` min 5, `status`), campos Nome/Identificador/Mensagem (`Textarea`
  + painel de variáveis, ver 33.6)/Status, no mesmo estilo do
  `ProductFormModal`.

### 33.4 Status (23/09/2026) — persistência e motor implementados

O gestor já aplicou a migração `20260923120000_message_templates.sql`
manualmente no projeto de **homolog** (schema conferido em runtime: mesmas
colunas e constraint `message_templates_identifier_not_blank`). A promoção
formal `arenadigital-db`: branch `feat/templates-mensagens` → `main` →
`homolog` **ainda não foi feita** (fica pendente); enquanto isso o app local
aponta direto pra homolog (`NEXT_PUBLIC_SUPABASE_URL`), então os Server
Actions abaixo já funcionam de verdade. `src/types/supabase.types.ts` não
pôde ser regenerado via `pnpm db:types` (exige `supabase login`, só o
gestor tem o token) — a entrada de `message_templates` foi adicionada **à
mão**, no mesmo formato do gerador, e conferida contra o schema real.

Concluído nesta etapa:
- CRUD real (`templateMensagemActions.ts`, padrão de `categoryActions.ts`),
  substituindo o estado local do client; `TemplatesMensagensPageClient.tsx`
  e a rota `[arenaId]/page.tsx` já leem/escrevem a tabela.
- Motor de resolução de variáveis (33.7).
- Botão de mensagem em Relatórios → Pagamentos (33.8).

Pendente:
- Promover a migração para `main`/`homolog` pelo fluxo normal do time.
- `##ARENA_CHAVE_PIX##`/`##ARENA_TITULAR_PIX##` resolvem placeholder fixo —
  a leitura direta do Pix real esbarra numa redação deliberada de acesso
  financeiro (33.7).
- Ampliar o catálogo de variáveis conforme novos pontos de disparo forem
  definidos (o gestor já sinalizou que virão mais).

### 33.5 Arquitetura de dados (`arenadigital-db`, migração `20260923120000_message_templates.sql`)

Tabela `public.message_templates`: `id`, `arena_id` (FK `arenas`, `ON DELETE
CASCADE`), `channel` (`text`, hoje só `'whatsapp'` via `CHECK` — segue o
padrão recente do schema para conjuntos pequenos controlados pelo time,
como `court_price_tables.tipo`/`arenas_atleta.perfil`, em vez de uma tabela
de lookup à parte como `station_types`), `identifier` (código curto do
gestor, único por `arena_id + channel` via índice `lower(identifier)`),
`name`, `message`, `status` (`'Ativo' | 'Inativo'`, mesma convenção de
`products.status`), `created_by` (FK `users`, `ON DELETE SET NULL`),
`created_at`/`updated_at` (trigger `trg_message_templates_updated_at` →
`public.set_updated_at()`, já existente no baseline).

**RLS:** `ENABLE ROW LEVEL SECURITY` + policy de `SELECT` para
`authenticated` via `public.can_access_arena_backoffice(arena_id)` (helper
já usado por `court_price_tables`/`mensalista_*`); escrita liberada só para
`service_role` (`GRANT ALL ... TO service_role`) — sem RPC dedicada, porque
não há invariante multi-tabela a proteger aqui (diferente de
`arena_cancellation_policies`, que versiona e por isso escreve só via RPC
`SECURITY DEFINER`). Os Server Actions do web (rodando com `getSupabaseAdmin()`)
seguem o mesmo caminho de escrita direta que `product_categories`.

**Desvio deliberado do pedido original:** o gestor sugeriu uma tabela
`template_mensagens_canal` (FK separada para o canal). Optou-se por um
`CHECK` no lugar, por ser o padrão mais recente do schema para esse tipo de
enum pequeno — combinado com o gestor, que autorizou adaptar ao "mais
padronizado" do restante do sistema.

### 33.6 Catálogo de variáveis e seletor no formulário

`constants/messageVariables.ts` define as variáveis resolvidas pela
aplicação no envio — não são dado de banco, dependem de perfil do atleta,
relatório de mensalista e dados de pagamento da Arena. Cada variável tem
`category` (`Atleta | Contexto | Mensalista | Arena`), usada tanto para
agrupar o seletor no formulário quanto como pré-requisito de resolução:
`Mensalista` só resolve para atleta com plano ativo no mês filtrado; `Arena`
com "(Asaas)" no rótulo só resolve se o cadastro de pagamentos da Arena
estiver concluído.

- **Atleta:** `##ATLETA_NOME_COMPLETO##`, `##ATLETA_PRIMEIRO_NOME##`.
- **Contexto:** `##MES_REFERENCIA##` — mês filtrado na tela de origem, por
  extenso.
- **Mensalista:**
  - `##VALOR_DEVIDO_MES_CORRENTE##` — valor em aberto no mês filtrado
    (mesma fonte do Relatório de Mensalistas, seção 28), já descontando
    pagamento parcial/crédito.
  - `##VALOR_CREDITO_ATUAL##` — saldo de crédito do atleta, mesma fonte da
    view `mensalista_credito_saldo` (`arenadigital-db`).
  - `##MENSALISTA_RECORRENCIA##` — dia(s)/horário(s) formatados de todos os
    blocos do plano (`planos_mensalista_blocos`, ou o par legado
    `dia_semana`/`horario_inicio`/`horario_fim` quando
    `recorrencia_por_blocos = false`). Decisão: **uma única variável
    formatada** (ex. "Terças às 18h e 19h; Quintas às 20h") em vez de
    tokens separados de dia e horário — evita ambiguidade em planos com
    mais de um bloco.
  - `##MENSALISTA_TOTAL_HORAS_MES##` — soma das horas ocupadas no mês
    filtrado, desconsiderando sessões canceladas. Ainda não existe uma
    função pronta; a montar a partir de `src/modules/reports/usage-lines.ts`
    (`buildUsageLines`), mesma base do card "Total a cobrar".
  - `##MENSALISTA_VALOR_HORA##` — valor da hora vigente (RPC
    `resolve_court_price`, via `planos_mensalista.price_table_id` ou a
    tabela de preço tipo `mensalista` da quadra).
  - `##MENSALISTA_VALOR_MENSALIDADE##` — valor cheio da mensalidade do mês
    filtrado (`mensalista_mensalidades.valor_total`), **diferente** de
    `VALOR_DEVIDO_MES_CORRENTE` (que já desconta o que foi pago).
  - `##MENSALISTA_DATA_VENCIMENTO##` — `mensalista_mensalidades.vencimento`.
- **Arena:**
  - `##ARENA_ANTECEDENCIA_CANCELAMENTO##` — horas de antecedência da
    política de cancelamento vigente (`arena_cancellation_policy_tiers`).
    Decisão: usar a **faixa com `refund_percentage = 100`** (antecedência
    mínima para reembolso integral), não a faixa de maior reembolso
    disponível — fica vazio se a Arena não tiver faixa de 100%.
  - `##ARENA_CHAVE_PIX##` / `##ARENA_TITULAR_PIX##` — `arena_payment_accounts.pix_key`/`holder_name`
    (subconta Asaas; não existe "razão social" persistida em lugar
    nenhum — `holder_name` é o campo mais próximo). Decisão: quando a Arena
    não tiver essa conta configurada, a **prévia mostra um aviso editável**
    no lugar do token (ex. "[Pix não configurado]"), em vez de resolver
    vazio silenciosamente ou bloquear o envio — o gestor decide na hora se
    edita ou envia assim mesmo.
  - `##ARENA_CNPJ##` — `arenas.cpf_cnpj` (não distingue CPF de CNPJ).

`TemplateMensagemFormModal.tsx`: o campo Mensagem é um `Textarea` com
`ref` compartilhada (`field.ref` + `messageTextareaRef`, via callback ref)
para saber a posição do cursor. Abaixo dele, o painel de variáveis é
agrupado por `category` (`variablesByCategory`, ordem fixa em
`VARIABLE_CATEGORY_ORDER`), com scroll interno (`max-h-72`) para caber as
14 variáveis sem estourar o modal; clicar em uma insere o token na posição
do cursor (`selectionStart`/`selectionEnd`) via `form.setValue` e devolve o
foco/cursor à posição seguinte ao token inserido.

**Origem desta lista:** análise de uma mensagem real de mensalista (aviso
mensal de recorrência + valores + Pix) trazida pelo gestor em 23/09/2026,
cruzada arquivo a arquivo com o que já existe no sistema.

A resolução real dos tokens está implementada — ver 33.7.

### 33.7 Motor de resolução de variáveis (23/09/2026)

`src/modules/templates-mensagens/actions/templateVariableResolverActions.ts`,
`resolveMessageTemplateAction(arenaId, atletaId, competencia, rawMessage)`
(`assertArenaAdminAccess`). Só resolve os tokens que o texto realmente usa
(`rawMessage.match(/##[A-Z_]+##/g)`), pra não disparar consultas à toa.
Devolve `{ resolvedMessage, athleteName, athletePhone, warnings[] }`.

- **Atleta/Contexto:** leitura direta de `atleta` (`nome_perfil`, `telefone`)
  e `format(competencia, 'MMMM', ptBR)` para `##MES_REFERENCIA##`.
- **Mensalista:** chama **`getMensalistaDetailAction(arenaId, atletaId, competencia)`**
  (o mesmo loader da tela de Mensalistas — 20.4/seção do `mensalistaActions.ts`)
  em vez de reconsultar as tabelas; `resumo.restanteMes` →
  `VALOR_DEVIDO_MES_CORRENTE`, `resumo.valorMes` → `MENSALISTA_VALOR_MENSALIDADE`,
  `resumo.creditoSaldo` → `VALOR_CREDITO_ATUAL`. Se o atleta não tem plano
  mensalista (`detail.success === false`), todas as variáveis de mensalista
  viram `[sem plano mensalista ativo]` com aviso — nunca quebra o preview.
  - `MENSALISTA_RECORRENCIA`/`MENSALISTA_TOTAL_HORAS_MES`: para cada plano
    **ativo** (`plano.status !== 'cancelado'`), usa `plano.blocos` (ou o par
    legado `dia_semana`/`horario_inicio`/`horario_fim` do próprio plano
    quando não há blocos) e `ocorrenciasNoMes()`
    (`lib/mensalista-variables.ts`) conta quantas vezes aquele dia da semana
    cai no mês filtrado, **recortado por `data_inicio`/`data_encerramento_efetiva`**
    — reflete o mês de estreia/encerramento proporcional de verdade.
  - `MENSALISTA_VALOR_HORA`: **não** usa `mensalidade.valor_total ÷ horas do
    mês` — validado contra o caso real do Everton Cebolinha (dois planos de
    `valor_mensal: 500`, mesma quinta-feira, uma mensalidade prorrateada em
    `R$ 200` e a outra em `R$ 500` por motivo que não é proporcional às
    horas deste mês) e deu taxas diferentes (`R$ 250/h` e `R$ 100/h`) pro
    mesmo valor cheio — errado. A fórmula certa é **`plano.valor_mensal` ÷
    horas de um **mês cheio** (mesma `ocorrenciasNoMes()`, mas com
    `dataInicioPlano = startOfMonth(competencia)`, sem recorte)** — deu
    `R$ 125/h` pros dois planos, consistente. Com mais de um plano ativo,
    lista `"{quadra} ({esporte}): {valor}/h"` por plano.
  - `MENSALISTA_DATA_VENCIMENTO`: união dos `mensalidade.vencimento` dos
    planos ativos; mais de um valor distinto gera aviso (revisar antes de
    enviar).
- **Arena:** `##ARENA_CNPJ##` lê `arenas.cpf_cnpj` direto.
  `##ARENA_ANTECEDENCIA_CANCELAMENTO##` chama
  `getArenaCancellationPolicySettingsAction` e usa o tier com
  `refundPercentage === 100` (decisão de 23/09/2026, seção 33.6).
  **`##ARENA_CHAVE_PIX##`/`##ARENA_TITULAR_PIX##` ainda resolvem um
  placeholder fixo** — `getArenaPixSplitSettingsAction` existe, mas
  `settingsForFinancialOnboardingAccess` **redige** `pixKey` pra `''` pra
  qualquer chamador que não seja `super_admin_backoffice` (nem o próprio
  Owner da arena vê a chave crua por ali). Preencher de verdade exigiria uma
  leitura dedicada direto em `arena_payment_accounts` — decisão de produto
  em aberto, não tomada unilateralmente por contornar um controle de acesso
  financeiro existente.
- **Placeholders:** qualquer variável não resolvida vira `[texto entre
  colchetes]` (nunca um `##TOKEN##` cru sobrando na mensagem) e entra na
  lista de `warnings` — a prévia mostra os dois.

### 33.8 Botão de mensagem em Relatórios → Pagamentos (23/09/2026)

`PaymentStatusRow` ganhou `atletaId`/`telefone` (opcionais). Propagados nas
**seis** fontes de linha de `getPaymentStatusReportAction`
(`reportActions.ts`) — bookings, `station_payments`, `rotativo_inscricoes`,
`rotativo_credito_movimentos`, `transactions` — bastou adicionar `telefone`
a um `atleta:X(id, nome_perfil, …)` que já existia em cada `select`, sem
query nova. `mensalidade-rows.ts` (`buildMensalidadeRows`/`buildRateioBreakdownRows`)
também propaga (`MensalidadeContexto.telefone`, lido via
`atleta:athlete_id(telefone)` no `planos_mensalista` de
`loadMensalidadesDaCompetencia`); a linha `Rateio` (participante do rateio,
não o responsável) tem `atletaId` mas não `telefone` — sem uma consulta
extra por participante, o botão simplesmente não aparece nessas linhas.

`StatusPagamentosPageClient.tsx`: nova coluna "Ações" (ícone verde de
WhatsApp, `lucide-react MessageCircle`), visível só quando
`row.atletaId && row.telefone`. Clicar abre
`SendTemplateMessageModal` (`templates-mensagens/components`), passando
`arenaId`, `competencia={selectedMonth}` (o filtro de período da própria
tela, formato `YYYY-MM`) e `{ id, nome, telefone }` do atleta da linha.

`SendTemplateMessageModal.tsx`: dois passos —
1. **Selecionar template**: `getMessageTemplatesByArenaAction(arenaId)`,
   filtra só `status === 'Ativo'`.
2. **Prévia**: chama `resolveMessageTemplateAction`, mostra os `warnings`
   num aviso âmbar e o texto resolvido num `Textarea` **editável** (o
   gestor corrige manualmente os trechos entre colchetes antes de enviar).
   "Enviar via WhatsApp" chama `openWhatsAppWeb` (`src/lib/whatsapp-web.ts`,
   extraído do `handleWhatsApp` de `ClientesOverviewPageClient.tsx`, que
   passou a reusá-lo) com o telefone do atleta e o texto editado.

## 34. Menu — grupo "Gestão Reservas" e remoção de Cobranças Avulsas do Financeiro (23/09/2026)

### 34.1 `Sidebar.tsx`

Novo grupo expansível "Gestão Reservas" (ícone `ClipboardList`), inserido
imediatamente antes do bloco de "Relatórios" e seguindo exatamente o mesmo
template (próprio `useState` de open/active — `isBookingsOpen`/`isBookingsActive`/
`shouldShowBookingsOpen` —, botão pai com `ChevronDown` que gira, sub-itens
como `Link` dentro de um bloco recolhível com a linha vertical decorativa).
`isBookingsActive` é `pathname.includes("/mensalistas") || .includes("/pre-reservas") || .includes("/avulsas")`.

Sub-itens: **Avulsos** (`avulsasHref` novo, `/dashboard/arenas/${arenaId}/avulsas`),
**Mensalistas** (`mensalistasHref`, já existia) e **Pré-reservas**
(`preReservasHref`, já existia) — os dois últimos foram **removidos** do
array `mainNavItems` (onde viviam soltos) e viraram sub-itens do grupo.

**Guard de visibilidade:** `{!isCashier && (...)}`, **sem** `isAdmin` —
diferente de Relatórios/Configurações (`!isCashier && isAdmin`). Isso é
proposital: Mensalistas/Pré-reservas hoje não têm `requiresAdmin` no array
antigo (Atendente os vê), então gatear o grupo por `isAdmin` teria escondido
o menu de quem já tinha acesso — regressão que este guard evita. Caixa
continua sem ver o grupo porque `cashierItems` já substitui `mainNavItems`
inteiro antes de chegar aqui (tanto com quanto sem estação atribuída).

**Tutorial guiado:** `WelcomeTutorialDialog.tsx` tinha um passo com seletor
`[data-tutorial-menu="memberships"]` apontando para o antigo item solto de
Mensalistas. Esse atributo foi movido para o botão pai do novo grupo
"Gestão Reservas" (o clique nele já expõe Mensalistas) — sem isso, o passo
do tutorial ficaria "órfão" dentro de um accordion fechado.

`ClipboardPen`/`ClipboardClock` (ícones que os itens soltos usavam) saíram
dos imports — os sub-itens dos grupos (Relatórios/Configurações/Gestão
Reservas) seguem o padrão visual de só texto, sem ícone.

### 34.2 `FinanceDashboardClient.tsx` — remoção da seção "Cobranças Avulsas"

A página de Avulsos (`/dashboard/arenas/[id]/avulsas`,
`AvulsasPageClient.tsx`) já existia pronta e completa — só não tinha entrada
de menu, sendo alcançável apenas pelo link "Ver tudo" que já existia dentro
do card "Cobranças Avulsas" do Financeiro. Com o item de menu criado (34.1),
esse card ficou redundante e foi removido de `FinanceDashboardClient.tsx`
junto com tudo que só existia para ele: estados (`pendingAvulsos`,
`isLoadingAvulsos`, `confirmingId`, `confirmDialog`), a função
`loadPendingAvulsos` e seu `useEffect`, `handleConfirmarPagamento`, o
`<ConfirmarPagamentoDialog>` da tela, e os imports que ficaram sem uso
(`getAvulsosComPendenciaAction`, `AvulsoPendenciaItem`,
`confirmarPagamentoAvulsoAction`, `confirmarPagamentoParticipanteAvulsoAction`,
`ConfirmarPagamentoDialog`, `toast`, `parseISO`, `ptBR` e os ícones
`AlertCircle`/`CheckCircle2`/`Loader2`/`Clock`/`MapPin`/`Calendar`).
`getAvulsosComPendenciaAction` (`financeActions.ts`) também foi removida —
ficou sem nenhum caller no projeto; o tipo `AvulsoPendenciaItem` continua,
porque `AvulsoListItem` (usado por `getAvulsosTodosAction`, que alimenta a
página de Avulsos) o estende.

Financeiro agora só tem: cards de Saldo/Entradas/Despesas do mês,
comparativo e as duas listas "Últimas Entradas"/"Últimas Saídas" (cada uma
com "Ver tudo" para `/dashboard/finance/{arenaId}/entradas`\-`/saidas`).

## 35. Sidebar — correção de `isActive` sobreposto (23/09/2026)

`espacosActive` (`Sidebar.tsx`) fazia `/dashboard/arenas/` + exclusões
(`/stations`, `/mensalistas`, `/pre-reservas`, `!p.endsWith("/edit")`) sem
excluir `/avulsas` — resultado: "Espaços" e "Avulsos" ficavam ativos ao
mesmo tempo em `/dashboard/arenas/{id}/avulsas`. Corrigido com
`!p.includes("/avulsas")`.

No mesmo lugar, achado um segundo bug ao auditar as demais checagens:
`!p.endsWith("/edit")` é genérico demais e também apagava o destaque de
"Espaços" ao editar um espaço específico (`/dashboard/arenas/{id}/spaces/{spaceId}/edit`),
quando só deveria excluir a edição da própria arena
(`/dashboard/arenas/{id}/edit`, que já tem seu próprio destaque em "Perfil
da Arena"). Trocado pela mesma regex precisa de `isEditingArena`
(`/\/dashboard\/arenas\/[^/]+\/edit$/`), sem o `$` cair em rotas mais
profundas.

Auditoria das demais ~20 checagens de `isActive` do arquivo (substrings
`/mensalistas`, `/pre-reservas`, `/avulsas`, `clientes-overview`,
`status-pagamentos`, `movimentacao-estacoes`, `/stations`) contra todas as
rotas reais do app (`find src/app -type d`): nenhuma outra colisão — esses
termos só existem nas pastas de rota esperadas.

## 36. Componente reutilizável de envio por template (23/09/2026)

`src/modules/templates-mensagens/components/SendTemplateMessageButton.tsx`
— extrai o par botão+modal que antes vivia só em
`StatusPagamentosPageClient.tsx` (estado `messageAthlete` no componente
pai) para um componente autocontido: guarda seu próprio `open`, recebe só
`arenaId`, `athlete` (`{ id, nome, telefone }`) e `competencia?` opcional
(default: mês corrente, via `currentCompetencia()`) — quem chama não
precisa levantar estado nem renderizar o `SendTemplateMessageModal` à
parte. `athlete` `null`/`undefined` esconde o botão (não há para quem
mandar); `athlete.telefone` nulo mostra o botão desabilitado, em vez de
escondê-lo — informa a causa em vez de simplesmente não aparecer.

Duas telas passaram a usar o componente:
- **Relatórios → Pagamentos Reservas** (`StatusPagamentosPageClient.tsx`):
  troca o par estado+`<Button>`+`<SendTemplateMessageModal>` inline por uma
  linha (`<SendTemplateMessageButton arenaId={arenaId} competencia={selectedMonth} athlete={...} />`)
  na célula de Ações — `competencia` explícita, o mês filtrado na tela.
- **Relatórios → Atletas e clientes** (`ClientesOverviewPageClient.tsx`):
  troca o `handleWhatsApp(phone, name)` com texto fixo pelo mesmo
  componente, sem `competencia` (tela não tem filtro de período, usa o mês
  corrente). `handleWhatsApp` e o import de `openWhatsAppWeb`/`MessageCircle`
  saíram do arquivo, sem uso.

`src/lib/whatsapp-web.ts` continua vivo — é o `SendTemplateMessageModal`
que chama `openWhatsAppWeb` no envio final.

## 37. Coluna "Ações" e exportação de PDF por atleta em Pagamentos Reservas (23/09/2026)

### 37.1 Cabeçalho "Ações" visível

A coluna que já existia para o botão de WhatsApp (seção 33.8) tinha o texto
"Ações" só em `sr-only` (sem aparecer na tela — ver print anexado pelo
gestor). Trocado por texto visível no `<th>`.

### 37.2 Exportar PDF por atleta

Novo ícone (`FileText`, tooltip "Exportar PDF deste Atleta") ao lado do
botão de WhatsApp na coluna Ações, só em linhas com `row.atletaId`. Gera o
**mesmo PDF** do botão "Exportar PDF" do topo da tela
(`generatePaymentStatusPdf`), recortado para aquele atleta — sem alterar os
filtros visíveis da página.

`handleExportPdfForAthlete(atletaId, atletaNome)` (`StatusPagamentosPageClient.tsx`):
busca de novo no servidor via `getPaymentStatusReportAction` com os filtros
**atualmente ativos na tela** (Período, Tipo, Espaço, Esporte, Perfil,
Rateio, Detalhar por hora) mais `atletaId` — o equivalente a preencher o
filtro de Atleta com essa pessoa e clicar Filtrar → Exportar PDF, só que sem
mexer no que está na tela. Isso importa porque os `rows` já carregados no
client podem estar incompletos para aquele atleta quando outro filtro (ex.:
Tipo = Avulso) já excluiu linhas dele no fetch original — e é a mesma busca
que recalcula `athleteDebt` (quanto deve de Mensal/Avulso) correto para essa
pessoa, que só vem preenchido quando o filtro de Atleta está de fato ativo.

**Pipeline de exibição compartilhado:** `statusFilteredRows`/`baseRows`/
`sortedRows` (três `useMemo` encadeados) viraram uma função pura só,
`deriveDisplayRows(rows, statusFiltro, agruparPorAtleta, sortKey, sortDir)`
— filtro de status → agrupar por atleta → ordenar, nessa ordem. Usada tanto
pelo `sortedRows` da tela (o que alimenta tabela, paginação e as duas
exportações do topo) quanto pelo PDF por atleta, para os dois lerem os
lançamentos sob exatamente os mesmos critérios de status/agrupamento/ordem
vigentes na tela.

`fileName` inclui o nome do atleta (`slugify`, ex.: "Maria Teste" →
`maria-teste`). Estado de loading por linha (`exportingAthleteId`, spinner
substitui o ícone) em vez de um único `isExportingPdf` global — outro
export por atleta ou o export geral não travam por causa de um em
andamento. Erros aparecem em `toast.error` (import novo no arquivo).
