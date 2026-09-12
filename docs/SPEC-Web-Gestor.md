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
  Na competência em que `date_trunc('month', data_inicio) = competencia`, `valor_total`
  é pró-rateado por `private.mensalista_first_month_sessions(dia_semana, data_inicio,
  sessoes_por_mes)` — nº de ocorrências semanais do dia da recorrência de data_inicio
  até o fim do mês, limitado a sessoes_por_mes. 0 ocorrências ⇒ a mensalidade não é
  criada (a cobrança começa na competência seguinte). Migração
  `20260904140000_mensalista_prorata_first_month`.

- `configure_mensalista_rateio_atomic(p_arena_id, p_mensalidade_id, p_rateio, p_participantes jsonb, p_registered_by)`
  p_participantes = [{ atleta_id?, nome, ativo, valor }]. Congela as parcelas já pagas,
  apaga as não pagas e recria a partir da lista. rateio=false colapsa numa parcela do
  responsável. Valida Σ(ativas) + Σ(travadas) = valor_total (tolerância 0,01) e que os
  atleta_id pertencem à arena. Recalcula o status da mensalidade.

- `register_mensalista_payment_atomic(p_operation_id, p_arena_id, p_cobranca_id, p_valor, p_credito_aplicado, p_data, p_modo_pagamento_id, p_observacao, p_registered_by, p_lancar_excedente_credito default false)`
  Idempotente (p_operation_id = id do pagamento). **O dinheiro pode exceder o devido**
  (migração `20260904160000`): `p_lancar_excedente_credito=false` grava o excedente na
  cobrança (`valor_pago > valor_devido`); `=true` quita a cobrança no valor exato e lança
  o excedente como `mensalista_creditos` tipo='lancamento' — vinculado ao `atleta_id` da
  cobrança ou, se for parcela de **avulso**, ao **responsável da recorrência**
  (`planos_mensalista.athlete_id`); retorna `credito_atleta_id`. O **crédito aplicado**
  (`p_credito_aplicado`) nunca pode exceder o devido. Crédito aplicado exige
  cobrança com atleta_id e saldo suficiente (grava `mensalista_creditos` tipo='uso',
  valor negativo). Insere `mensalista_pagamentos` (valor = dinheiro total recebido);
  atualiza a cobrança (valor_pago, credito_aplicado, pago_em). Só a parte em dinheiro
  vai para `public.transactions`
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
  "Prever encerramento", **"Reajustar valor"**, "Cancelar plano" (reusa
  `cancel_monthly_plan_atomic` via `cancelPlanoMensalistaAction`) e um
  **Histórico de reajustes** (`RecorrenciaResumo.reajustes`). A **criação** de
  recorrência continua no calendário do espaço (`BookingModal` → `create_monthly_plan_atomic`),
  que agora mostra as recorrências que ainda cabem no mês e a 1ª mensalidade proporcional.
- Modais: `RateioModal` (lista de atletas do rateio, toggle + valor + adicionar
  participante/nome avulso, split igual ao vivo), `RegistrarPagamentoModal` (valor +
  data + forma + aplicar crédito; **permite pagar acima do devido** e pergunta se o
  excedente vira crédito), `ReajustarValorModal` (novo valor + vigência mês atual/seguinte
  + observação), `LancarCreditoModal`, `RetirarCreditoModal`
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
  `agruparBlocos` (horas contíguas ⇒ um bloco), `ocorrencias`, `avaliarSlot`
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
