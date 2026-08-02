# Arquitetura de Banco de Dados - Arena Digital (Integração App Mobile e Web)

Este documento descreve a arquitetura atual do banco de dados (Supabase) utilizada no projeto `arenadigital-web` e expõe as regras de negócios, tabelas e fluxos para que o projeto do Aplicativo Mobile possa se integrar perfeitamente com a mesma base de dados.

> **Importante:** Mantenha este documento atualizado sempre que novas tabelas, relacionamentos ou mudanças significativas nas regras de negócio (RLS) forem aplicadas no projeto Web.

---

## 1. Visão Geral do Sistema Base

O banco de dados é gerido via **Supabase** (PostgreSQL) com migrações em SQL puro (`supabase/migrations/*.sql`).
A autenticação é feita com **Supabase Auth**. O `auth.users.id` é o mesmo identificador salvo em public.`users.id`, e o perfil do atleta fica vinculado por `atleta.id_users`.

> **Nota para Gestores:** Além dos dados de autenticação e nome, a tabela `users` também armazena o `cpf`, fornecido no momento do cadastro do gestor na plataforma Web. O telefone é armazenado diretamente no registro da respectiva `arena`.

---

## 2. Entidades Principais para o App Mobile

Abaixo estão as entidades core do sistema focadas nas funcionalidades que o aplicativo precisará consumir ou interagir.

### 2.1. Arenas (`arenas` e tabelas auxiliares)

As Arenas representam os estabelecimentos cadastrados no sistema.

- **Funcionalidade no App:** Os usuários poderão realizar buscas de arenas por localidade, filtros e geolocalização exata usando GPS.
- **Tabela `arenas`:**
  - `id` (uuid, primary key)
  - `name` (text) - Nome da arena.
  - `status` (text) - ('ativo', 'inativo', 'Em manutenção'). **Apenas exibir arenas 'ativo'.**
  - **Localização:** `address` (jsonb), `zip_code`, `municipio_id` (foreign key para a tabela `municipios`, campo `codigo_ibge`), `number`, `complement`, `neighborhood` (Bairro). **Nota:** os campos `city` e `state` foram removidos em favor do `municipio_id`.
  - **Geolocalização (PostGIS):** Além do endereço textual, a tabela agora conta com a coluna `location` do tipo `geography(Point, 4326)`. Esta coluna recebe a Longitude e Latitude exata da Arena.
  - **Contatos & Redes:** `phone`, `email`, `facebook`, `instagram`, `tiktok`.
  - **Mídia:** `banner_url` e `description`.
  - **Financeiro:** `nome_moeda_virtual` (Usado no programa de fidelidade).

- **Como o App Mobile deve buscar Arenas:**
  Para listar as arenas considerando a distância do usuário, o App deve invocar a **RPC** `search_arenas_by_proximity(user_lat, user_lng, max_distance_meters)`. Essa função do Supabase retorna a lista de arenas 'ativo' ordenadas pela proximidade real. O payload inclui o valor de `dist_meters`, o array `sports` de modalidades e o array `comodidades`. Para apresentar a localidade (Cidade/Estado), o App usará o `municipio_id` retornado pela RPC para fazer um join posterior com a tabela `municipios` e `estados`.

### 2.1.1. Arenas Favoritas (`atleta_arena_favoritos`) e Vínculos (`arenas_atleta`)

Mantém o registro das arenas que um atleta favoritou no aplicativo e os vínculos entre arenas e atletas.

- **Funcionalidade no App:** O atleta pode favoritar/desfavoritar uma arena para acesso rápido (salvo em `atleta_arena_favoritos`). Além disso, ao favoritar, o sistema também cria uma vinculação caso não exista na tabela principal de vínculos (`arenas_atleta`).
- **Tabela `arenas_atleta` (Vínculo Principal):**
  - Vincula um atleta a uma arena.
  - **`origem` (Enum: `arena`, `aplicativo`):** Identifica se o vínculo foi criado pelo gestor da arena convidando o atleta (`arena`) ou se o atleta buscou a arena e a marcou como favorita (`aplicativo`). Quando favoritar no aplicativo, o valor preenchido deve ser `aplicativo`. Se o usuário desfavoritar pelo aplicativo, o registro será removido de ambas tabelas (`atleta_arena_favoritos` e `arenas_atleta`), independentemente da `origem` do vínculo (opt-out de relacionamento/novidades da arena).
- **Tabela `atleta_arena_favoritos`: (Apenas Favoritos)**
- **Tabela `atleta_arena_favoritos`:**
  - `id` (uuid, primary key)
  - `id_atleta` (uuid, foreign key para `atleta.id`)
  - `id_arena` (uuid, foreign key para `arenas.id`)
  - `created_at` (timestamp with time zone)
  - Restrição `UNIQUE` em (`id_atleta`, `id_arena`) para impedir favoritos duplicados.

- **Como o App Mobile deve buscar os Favoritos:**
  Fazer queries de `select` na tabela `atleta_arena_favoritos`, filtrando por `id_atleta = [id_do_atleta_logado]`. Para verificar se a arena está na lista do usuário, basta checar se o `id_arena` existe no retorno. Alternativamente, fazer join com `arenas` para trazer a lista de arenas favoritas completas.

### 2.2. Atletas (`atleta` e `atleta_esportes`)

O usuário do app é um "Atleta". Ele terá um perfil próprio, configurando privacidade.

- **Funcionalidade no App:** Busca de atletas para formar times, adicionar amigos ou desafiantes.
- **Privacidade de Busca:** A regra de ouro é respeitar a coluna `compartilha_info`.
- **Tabela `atleta`:**
  - `id` (uuid, primary key)
  - `id_users` (uuid, foreign key para `users.id`) - O elo entre a auth e o perfil.
  - `cpf` - Identificador único de negócio do atleta, salvo apenas com dígitos.
  - `nome_perfil`, `descricao_perfil`, `data_nascimento`, `telefone`.
  - `origem_cadastro` - Se cadastrado pelo 'aplicativo' ou pela 'arena'.
  - **`role` (tabela `users`):** Todo atleta criado pelo sistema Arena Digital Web recebe a role `'atleta'` na tabela de usuários.
  - **Redes:** `instagram`, `facebook`, `tiktok`.
  - **`compartilha_info` (boolean):** Identifica se o atleta permite que seu perfil seja encontrado pelos outros usuários.
- **Tabela `atleta_esportes`:** Permite que o atleta cadastre seus esportes favoritos, seu nível de habilidade e uma descrição adicional.
  - `id_atleta` (uuid, foreign key para `atleta.id`)
  - `id_esporte` (uuid, foreign key para `sports.id`)
  - `id_nivel_habilidade_esporte` (uuid, foreign key para `nivel_habilidade_esporte.id`)
  - `descricao` (text) - Comentários ou observações sobre a prática deste esporte.
- **Tabela `nivel_habilidade_esporte` (Referência):** Define os níveis de habilidade possíveis para cada esporte.
  - `id` (uuid, primary key)
  - `nivel` (text) - Descrição do nível (Ex: Iniciante, Intermediário, Pro).
  - `id_esporte` (uuid, foreign key para `sports.id`) - Vincula o nível a um esporte específico.
- **Tabela `atleta_esporte_historico` (Log):** Registra o histórico de evolução de níveis do atleta.
  - `id` (uuid, primary key)
  - `id_atleta` (uuid, foreign key para `atleta.id`)
  - `id_nivel_habilidade_esporte` (uuid, foreign key para `nivel_habilidade_esporte.id`)
  - `data_criacao` (timestamp with time zone) - Data/hora em que a mudança ocorreu.

- **Como o App Mobile deve buscar Atletas:**
  No módulo de pesquisa, ao buscar atletas, a cláusula `where compartilha_info = true` é **obrigatória**.

### 2.3. Comodidades (`comodidades` e `arena_comodidades`)

As arenas possuem comodidades e facilidades que podem ser oferecidas para os atletas (ex: Churrasqueira, Wifi, Salão de Festas).

- **Funcionalidade no App:** O aplicativo listará as comodidades no perfil da Arena e, futuramente, poderá usá-las em filtros de busca avançada.
- **Tabela `comodidades`:**
  - `id` (uuid, primary key)
  - `name` (text, unique) - Nome da comodidade.
- **Tabela `arena_comodidades`:**
  - Tabela de junção para mapeamento N:N entre `arenas` e `comodidades`.
  - `arena_id` (uuid, foreign key para `arenas.id`)
  - `comodidade_id` (uuid, foreign key para `comodidades.id`)
  - **Primary Key Composta:** (`arena_id`, `comodidade_id`) com delete cascade para ambas origens.
- **Como o App Mobile consultará as Comodidades:**
  Acessando a relação de `arena_comodidades` na query de busca de detalhes da arena, ou utilizando o array `comodidades` retornado pela RPC `search_arenas_by_proximity` para fins de filtragem local no frontend.

### 2.4. Times (A desenvolver)

A estrutura de _Times_ (Equipes, Panelinhas) ainda será construída.

- **Previsão:** Deve haver uma tabela de `times` e uma de vínculo `atleta_time`. Será mapeado posteriormente, seguindo o padrão relacional estabelecido.

### 2.4. Quadras e Agendamentos (`courts` e `bookings`)

Dentro das arenas, o atleta visualizará as quadras disponíveis e fará reservas.

- **Tabela `courts`:**
  - `id`, `arena_id`, `name`, `type`, `status` ('ativo', etc).
  - `image_url` (imagem da quadra), `is_covered` (se é coberta), `observations`.
  - **Preços e Agenda base:** `day_config` (jsonb). Essa coluna guarda a configuração da grade horária base e os valores para cada hora/dia da semana.
- **Tabela `bookings` (Reservas):**
  - Onde ficam salvos os horários já reservados.
  - `id`, `arena_id`, `court_id`, `athlete_id`, `sport_id`.
  - `start_time`, `end_time` (timestamp with time zone).
  - `status` ('confirmed', 'cancelled', 'pending').
  - `price` (Valor pago).

- **Como o App Mobile consultará a Disponibilidade:**
  1. Carregar configuração em `courts.day_config`.
  2. Consultar os `bookings` confirmados ou pendentes naquele `court_id` para um range de data específico (ex: um determinado `start_time`).
  3. Cruzar a grade horária (`day_config`) com os `bookings` para renderizar os horários livres.

### 2.5. Rotativos / Jogos Abertos (`rotativos` e `rotativo_inscricoes`)

O sistema da Web permite ao gestor abrir um jogo ("Rotativo") para inscrições abertas (exatamente como uma partida avulsa).

- **Tabela `rotativos`:** Representa o "evento" (ex: Rachão de Vôlei). Possui dados como data, hora, limite de participantes e `valor` (por inscrição).
- **Tabela `rotativo_inscricoes`:** Relaciona o `id_rotativo` com o `id_atleta` interessado, o `status_pagamento` e o `valor_pago`.
- **Funcionalidade no App:** O atleta pode se inscrever nestes jogos listados na página da Arena.

### 2.6. Pagamentos e Transações (App para a Arena)

O pagamento realizado pelo usuário através do aplicativo **deve ser direcionado para a Arena**.

- Atualmente, as transações financeiras na visão do gestor são persistidas na tabela `transactions`.
- **Coluna `atleta_id` (opcional):** A tabela `transactions` possui a coluna `atleta_id` (UUID, nullable, FK → `atleta.id` com `ON DELETE SET NULL`). Ao registrar uma **entrada**, o gestor pode vincular opcionalmente um atleta da carteira da arena. Quando preenchido, o nome do atleta é exibido no relatório de entradas e nos cards do dashboard financeiro. Transações sem atleta vinculado exibem `—`.
- **Migração:** `ALTER TABLE transactions ADD COLUMN atleta_id UUID REFERENCES atleta(id) ON DELETE SET NULL;`
- **Desenho Futuro (App):** Deve-se definir a infraestrutura de pagamentos (Ex: Stripe, Pagar.me ou MercadoPago com Split de Pagamentos, ou cobrança na chave própria da Arena). Ao efetuar a reserva no App, o status da reserva no `bookings` muda para e.g. `'confirmed'`, e um registro poderá ser injetado em `transactions` com tipo `'entrada'` e a origem do App, garantindo que o relatório do gestor reflita essa venda imediatamente.

### 2.6.1. Modos de Pagamento (`modo_pagamento`)

Tabela de referência que armazena os métodos de pagamento disponíveis para lançamentos financeiros.

- **Tabela `modo_pagamento`:**
  - `id` (uuid, primary key, default `gen_random_uuid()`)
  - `nome` (text, unique, not null) — Nome do modo de pagamento.
  - `created_at` (timestamp with time zone, default utc now)
- **Dados iniciais (seed):** Cartão de crédito, Cartão de débito, Dinheiro em espécie, Pix.
- **Relacionamento com `transactions`:** A tabela `transactions` possui a coluna `modo_pagamento_id` (UUID, nullable, FK → `modo_pagamento.id` com `ON DELETE SET NULL`). Ao registrar um lançamento (entrada ou saída), o gestor pode selecionar opcionalmente o modo de pagamento utilizado.
- **Migração:** `ALTER TABLE transactions ADD COLUMN modo_pagamento_id UUID REFERENCES modo_pagamento(id) ON DELETE SET NULL;`
- **RLS:** Política permissiva `Allow all for modo_pagamento` (padrão atual do projeto).

### 2.7. Programa de Fidelidade (`programa_fidelidade_extrato`)

Algumas arenas oferecem cashback ou pontos ("Coins" da Arena).

- Os extratos são visualizados usando a view `athlete_loyalty_balance` (soma os créditos e subtrai resgates).
- O aplicativo pode consultar essa View simples: `SELECT balance FROM athlete_loyalty_balance WHERE id_arena = ? AND id_atleta = ?` para informar ao usuário quantos créditos ele tem em uma determinada Arena.

### 2.8. Rastreamento e Presença em Tempo Real (`atleta_locations`)

A fim de contar e exibir informações sobre a lotação das arenas, o app rastreia a posição dos atletas.

- **Funcionalidade no App:** O aplicativo captura a localização GPS do atleta a cada 5 minutos e envia para o banco fazendo um _Upsert_, mantendo apenas uma única linha (a mais atualizada) por usuário.
- **Tabela `atleta_locations`:**
  - `id_atleta` (uuid, primary key, foreign key para `atleta.id`).
  - `location` (geography(Point, 4326)).
  - `updated_at` (timestamp, indicando a última verificação).
- **Controlador na Arena (`show_presence`):** A tabela `arenas` recebeu uma flag `show_presence` (boolean, default TRUE). Se FALSE, a arena oculta essas contagens de visitantes em tempo real.
- **Função RPC (`get_arena_presence`):** Conta quantos atletas estão em um raio de 500 metros da Arena e que tiveram a localização enviada na última hora (`updated_at >= NOW() - INTERVAL '1 hour'`). Retorna -1 se a arena desativou a exibição.

### 2.9. Dashboard e Lógica de Ocupação

A taxa de ocupação das quadras é calculada sob demanda para o dia atual, cruzando a disponibilidade da grade horária com as reservas confirmadas.

- **Regra de Cálculo de Ocupação (Dashboard):**
  1. Identificar a configuração de funcionamento da quadra para o dia da semana atual no array `day_config`.
  2. Calcular o total de slots horários disponíveis (ex: 08:00 às 22:00 = 14 slots de 1h).
  3. Contar o número de reservas com status `'confirmed'` ou `'pending'` para o dia atual.
  4. Taxa de Ocupação (%) = `(Número de Reservas / Total de Slots) * 100`.
- **Implementação Técnica:** Esta lógica reside no `DashboardService.ts`. O campo `day_config` é um `jsonb` contendo um array de objetos (ex: `[{ "day": "Segunda-feira", "enabled": true, "startTime": "08:00", "endTime": "22:00" }, ...]`).

### 2.10. Produtos e Controle de Estoque (`products`, `product_stock_entries` e `product_stock_movements`)

O sistema de Ponto de Venda (PDV) das estações exige o controle rigoroso do estoque de produtos e suas movimentações para rastreabilidade e segurança.

- **Tabela `products`:** Cadastro do produto.
  - `id`, `arena_id`, `name`, `description`, `price`, `status`.
  - `catalog_kind` ('product' ou 'service'): distingue produtos com estoque de serviços cobráveis (ex.: aluguel de raquete).
  - `category_id` (FK -> `product_categories`, nullable): categoria/família do item. Ver seção 2.11.
  - `item_type` (text): mantido por compatibilidade (comandas e busca agrupam por ele). É sincronizado com o nome da categoria vinculada ao criar/editar item ou renomear a categoria.
  - `stock_quantity` (integer, default 0): Guarda o saldo atual do produto em estoque. O status do produto ("Em estoque" ou "Sem estoque") no frontend passou a ser derivado ativamente dessa coluna (em regra: `stock_quantity > 0`).
- **Tabela `product_stock_entries`:** Registra exclusivamente as entradas físicas e recebimento de mercadorias.
  - `id`, `product_id`, `arena_id`, `quantity`, `entry_date`, `supplier`, `description`, `invoice_number`, `registered_by` (FK -> `users`), `created_at`.
- **Tabela `product_stock_movements`:** Representa o log de auditoria e linha do tempo do estoque, englobando entradas, saídas (lançamento em comandas) e estornos (cancelamento de comanda).
  - `id`, `product_id`, `arena_id`, `type` ('entrada' ou 'saida'), `quantity`, `reference_type` (ex: 'stock_entry', 'order_item', 'cancellation'), `reference_id`, `balance_after`, `registered_by` (FK -> `users`), `created_at`.
- **Fluxo do Frontend e Backend:**
  1. A entrada de um estoque insere um registro em `product_stock_entries`, cria um evento `entrada` em `product_stock_movements` e incrementa o `stock_quantity` do produto.
  2. O lançamento de itens numa comanda cria a saída do estoque: um evento `saida` em `product_stock_movements` e um decremento direto no saldo do produto. Regras de tela bloqueiam novos lançamentos que extrapolam o saldo (`quantity > stock_quantity`).
  3. O cancelamento de uma comanda (`status = 'cancelled'`) localiza os itens estornados, adiciona o saldo de volta no produto e lança um novo movimento do tipo `entrada` com a flag `cancellation`.

### 2.11. Categorias de Catálogo e Histórico de Preços (`product_categories` e `product_price_history`)

Evolução do Catálogo para agrupar produtos/serviços por família e dar controle e auditoria sobre a precificação.

- **Tabela `product_categories`:** Categorias por arena, gerenciadas pelo próprio gestor.
  - `id`, `arena_id` (FK -> `arenas`), `name`, `kind` ('product' ou 'service'), `sort_order`, `active`, `created_by` (FK -> `users`), `created_at`, `updated_at`.
  - Unicidade: `(arena_id, kind, name)` — não há categorias duplicadas por nome dentro do mesmo escopo.
  - Categorias com produtos vinculados **não podem ser excluídas** (apenas inativadas). Renomear uma categoria sincroniza o `item_type` dos produtos vinculados.
- **Tabela `product_price_history`:** Log de auditoria de toda alteração de preço (individual ou em massa).
  - `id`, `product_id` (FK -> `products`), `arena_id`, `old_price`, `new_price`, `change_type` ('manual' ou 'bulk'), `adjustment_percent` (nullable, preenchido em reajuste percentual), `batch_id` (nullable, agrupa os itens de um mesmo reajuste em massa), `reason` (nullable), `changed_by` (FK -> `users`), `created_at`.
- **Fluxo do Frontend e Backend:**
  1. **Alteração individual:** ao salvar um produto/serviço com preço diferente do atual, `updateProductAction` grava uma linha `manual` em `product_price_history`.
  2. **Reajuste em massa:** `bulkAdjustPricesAction` recebe categoria, tipo (percentual ou valor fixo), arredondamento (exato, terminação ,00/,50/,90) e flag de incluir inativos. Calcula os novos preços, aplica com preview obrigatório na UI e grava uma linha `bulk` por item alterado, todas com o mesmo `batch_id`. Em caso de erro, faz rollback dos preços já atualizados e apaga o lote de histórico.
  3. **Backfill inicial:** a migração cria categorias a partir dos `item_type` existentes de cada arena e vincula os produtos automaticamente.

### 2.12. Agente de IA no WhatsApp (`arena_ai_agents`, `whatsapp_channels`, `whatsapp_webhook_events`, `whatsapp_conversations`, `whatsapp_messages`)

Módulo do **Agente de IA da Arena**: cada arena pode conectar um número de WhatsApp (Meta Cloud API) e ativar um agente LLM (OpenAI) que responde clientes sobre horários, quadras, preços (avulso/mensalista) e disponibilidade. O agente interpreta **texto e áudio** (áudio transcrito por speech-to-text; imagem/vídeo não são interpretados no MVP). Plano completo em `docs/PLANO-Agente-IA-WhatsApp.md`. Migração (repositório arenadigital-db): `supabase/migrations/20260801141000_consolidate_web_ai_whatsapp.sql`.

- **Tabela `arena_ai_agents`:** Configuração do agente por arena (1:1 com `arenas`).
  - `id`, `arena_id` (FK -> `arenas`, **UNIQUE**), `enabled` (liga/desliga o agente), `persona_prompt` (personalidade definida pelo gestor), `model` (default `gpt-4o-mini`), `temperature`, `max_output_tokens`, `monthly_token_cap` (teto de custo), `fallback_message`, `status` ('draft'|'active'|'paused'), `created_by` (FK -> `users`), `created_at`, `updated_at`.
- **Tabela `whatsapp_channels`:** Vínculo número ↔ arena. **Um número pertence a exatamente uma arena e vice-versa** (`arena_id` UNIQUE **e** `phone_number_id` UNIQUE).
  - `id`, `arena_id` (FK, UNIQUE), `provider` (default 'meta'), `phone_number_id` (UNIQUE — **chave de roteamento** do webhook), `waba_id`, `display_phone_number`, `verified_name`, `access_token_encrypted` (**token cifrado em aplicação** com `AI_AGENT_ENCRYPTION_KEY` — nunca em texto puro), `token_expires_at`, `status` ('pending'|'connected'|'error'|'disconnected'), `connected_at`, `last_inbound_at`, timestamps.
- **Tabela `whatsapp_webhook_events`:** Idempotência dos eventos recebidos do Meta (espelha `payment_webhook_events`). Dedupe por `(provider, wa_message_id)` (índice único parcial). Colunas: `provider`, `provider_event_id`, `wa_message_id`, `phone_number_id`, `arena_id`, `event_type`, `status` ('processing'|'processed'|'failed'|'ignored'), `payload` (jsonb), `error_message`, `attempts`, `processing_started_at`, `processed_at`, timestamps.
- **Tabela `whatsapp_conversations`:** Thread por contato/arena. `arena_id`, `channel_id`, `contact_wa_id`, `contact_name`, `last_message_at`, `message_count`, `status` ('open'|'idle'|'closed'). UNIQUE (`arena_id`, `contact_wa_id`).
- **Tabela `whatsapp_messages`:** Log de mensagens e custo. `conversation_id`, `arena_id`, `direction` ('inbound'|'outbound'), `wa_message_id`, `content`, `content_type` ('text'|'audio'|'unsupported'), `transcribed_from_audio`, `media_id`, `llm_model`, `transcription_model`, `prompt_tokens`, `completion_tokens`, `audio_seconds`, `tool_calls` (jsonb), `status` ('received'|'sent'|'delivered'|'failed'), `error_message`, `created_at`.
- **Isolamento entre arenas (regra de ouro):** o `arena_id` é sempre derivado do `whatsapp_channels.phone_number_id` recebido no webhook — **nunca** do texto da mensagem ou do LLM. Todas as consultas das ferramentas do agente são filtradas por esse `arena_id`.
- **RLS:** políticas permissivas `Allow all for ...` no padrão atual do projeto. **Exceção de segurança:** o token de acesso (`access_token_encrypted`) é protegido por **cifra em aplicação**, não por RLS.

---

## 3. Row Level Security (RLS) policies 🛡️

Atualmente, pela necessidade da aplicação estar tanto em estágio inicial como sendo consumida parcialmente sem Auth via APIs locais, a vasta maioria das tabelas possui políticas permissivas:

```sql
-- Exemplo comum no schema
create policy "Allow all for X" on X for all using (true) with check (true);
```

**Para o App Mobile:**
Apesar da facilidade por estar aberto, em etapas posteriores (Produção), o RLS deverá ser apertado. Atualmente o App terá permissões quase plenas via Supabase Key. Sendo assim, a filtragem de dados sensíveis e respeito à regra de negócio (ex: buscar apenas atletas com `compartilha_info = true`) **deve** ser gerida ativamente no código do front-end/app durante as consultas.

---

## 4. Sugestões de Setup do Client do App Mobile

1. **Camada de Serviço (Repository Pattern):** Sempre encapsule as chamadas ao Supabase. Evite expor tabelas diretamente no UI.
2. **Integração Auth <-> Perfil:** Ao registrar no App Mobile, após o Supabase Auth criar o usuário, também deve ser criada/atualizada a linha em `users` e depois o row de `atleta`, caso não exista, com `origem_cadastro = 'aplicativo'`.
3. **Múltiplos Esportes (Filtros):** Use a tabela de ligação relacional `arena_sports` (join table entre arenas e sports) além do uso da propriedade em array, para um filtro rápido e performático de arenas por modalidade pelo App.

## 5. Histórico e Manutenibilidade

Qualquer nova alteração nos arquivos `supabase/migrations/` referentes a campos que o App Mobile consumirá, como novas chaves estrangeiras, novas regras de precificação no JSON do `day_config` das quadras, ou o novo módulo de **Times**, deverá ser imediatamente reportada nas seções destas documentações (item 2.3 em diante).
