# PRD — Arena Digital (Web | Gestor de Arenas)

## 1. Visão Geral do Produto

**Nome:** Arena Digital  
**Versão:** SaaS Web — Gestão de Arenas  
**Público:** Gestores de Arenas Esportivas  
**Arquitetura:** API-first  
**Infraestrutura:** Serverless  

O Arena Digital – Web é um sistema SaaS voltado exclusivamente para **gestores de arenas esportivas**, permitindo a administração completa de arenas, quadras, espaços recreativos(salão de festas, churrasqueiras, etc), horários, usuários e indicadores operacionais.

O acesso ao sistema ocorre por meio de login, disponível a partir da landing page pública do Arena Digital.

---

## 2. Objetivo do Produto

- Digitalizar e centralizar a gestão de arenas esportivas
- Reduzir processos manuais de agendamento e controle
- Oferecer visão clara de operação e uso das arenas
- Garantir segurança e controle de acesso por perfil
- Servir como base administrativa para o aplicativo mobile dos atletas

---

## 3. Perfil do Usuário (Gestor)

### 3.1 Gestor de Arena
- Responsável pela operação da arena
- Controla quadras, horários e usuários
- Acompanha indicadores de uso

### 3.2 Administrador do Sistema
- Acesso total à plataforma
- Pode gerenciar múltiplas arenas
- Define permissões e configurações globais

---

## 4. Escopo da Versão Web

### Dentro do Escopo
- Gestão de arenas
- Gestão de quadras
- Agenda e horários
- Gestão de usuários (gestores e atletas)
- Relatórios básicos
- Configurações da arena
- Pagamentos online
- Integração com gateways
- Gestão de produtos
- Gestão de caixas
- Gestão de estações
- Agente de IA no WhatsApp (atendimento automático da arena)

### Fora do Escopo (MVP)
- Marketplace
- Multi-idioma
- White-label
- Interpretação de imagem e vídeo pelo Agente de IA
- Efetuar reservas/pagamentos pelo chat do Agente de IA

---

## 5. Funcionalidades do MVP

### 5.1 Autenticação e Acesso
- Login via Supabase Auth
- Controle de sessão
- Logout
- Proteção de rotas autenticadas
- Controle de acesso por perfil (RBAC)
- Esqueci minha senha (recuperação de senha)

---

### 5.2 Dashboard do Gestor
- Visão geral da arena
- Indicadores principais:
  - Ocupação das quadras
  - Horários disponíveis vs ocupados
  - Atletas cadastrados
- Acesso rápido às principais ações

---

### 5.3 Gestão de Arenas
- Cadastro de arena
  - Nome
  - Status (Aberto / Fechado / Fechado Temporariamente)
  - Esportes (Futebol, Vôlei, Beach Tennis, Paddle, Tênis, Futevôlei, etc)
  - Dias de funcionamento e horário
  - Endereço (Cep, Cidade, Estado, Bairro, Rua, Número, Complemento)
  - Telefone
  - Email
- Edição de dados da arena
- Nome da Moeda Digital

---

### 5.4 Gestão de Quadras
- Cadastro de quadras
- Tipo de quadra (beach tennis, volei, futevolei, futebol, paddle, tênis, etc.)
- Capacidade
- Status (Ativa / Inativa / Em manutenção)
- Associação com arena
- **Tabelas de preço** (substitui o preço único por dia/horário):
  - Todo espaço tem 3 tabelas fixas — **Padrão** (usada na reserva avulsa e no app), **Mensalista** e **Professor** — e a arena pode criar até 2 personalizadas (limite de 5 por espaço).
  - Cada tabela tem faixas de horário/preço por dia da semana, com a mesma mecânica de faixas de sempre (faixa padrão + exceções, replicar entre dias, funcionamento que cruza a meia-noite).
  - **No cadastro do espaço as 3 tabelas já podem ser preenchidas**, sem precisar salvar e voltar para editar. A **Padrão é obrigatória** (pelo menos um dia habilitado); Mensalista e Professor são **opcionais** e podem ficar vazias. Cada aba mostra um selo com quantos dias estão configurados (`Nd` / `vazia`).
  - Facilidades de preenchimento: **Copiar faixas da tabela Padrão** (traz horários, faixas e valores para a tabela aberta, restando só ajustar o que muda), **Replicar** um dia para os demais e **Limpar tabela**.
  - Tabelas personalizadas, definir outra tabela como padrão e excluir só ficam disponíveis na edição do espaço.
- Atributos da quadra
  - Coberta
  - Descoberta
  - Areia
  - Grama
  - Piso Sintético

---

### 5.5 Agenda e Horários
- Configuração de horários de funcionamento
- Visualização de agenda por quadra
- Bloqueio de horários
- Visualização de reservas feitas por atletas
- Possibilidade de cancelar reservas
- Possibilidade de alterar reservas
- Possibilidade de prorrogar reservas
- Possibilidade de remarcar reservas  
- Possibilidade de adicionar créditos a atletas
- Possibilidade de remover créditos de atletas
- Possibilidade marcar agendamento avulso e recorrente
- Atribuir uma reserva a uma pessoa responsável e a um grupo (opcional)  

#### 5.5.1 Aba "Operação" (visão consolidada de todos os espaços)
- **Status:** Implementado (27/07/2026).
- Aba da tela de Espaços (`Espaços | Operação | Cadastros`), com a mesma visão antes disponível apenas no modal "Ver operação do dia".
- Grade de um dia com todos os espaços da arena lado a lado (colunas) x horários (linhas), respeitando a configuração de funcionamento de cada espaço.
- Filtros disponíveis: navegação por data (dia anterior/próximo, calendário, "Hoje"), seleção de esportes e seleção de quais espaços aparecem na grade.
- **Espaço de trabalho para arenas com muitos espaços:**
  - Botão **"Tela cheia"** leva a grade inteira para uma sobreposição de 95% x 92% da tela, mantendo data, filtros e seleção; sai com o botão "Reduzir", com `Esc` ou clicando fora.
  - Botão para **ocultar a lista lateral de espaços**, liberando a largura toda para a grade (um contador mostra quantos espaços estão visíveis).
  - Colunas se esticam quando há poucos espaços e mantêm largura mínima com rolagem horizontal quando há muitos; a coluna de horário e o cabeçalho dos espaços ficam fixos durante a rolagem.
- Indicador de "próximo evento" nos horários livres que possuem reserva futura recorrente no mesmo dia da semana/horário.
- **Agendamento direto na grade:** clicar em um horário livre abre o modal de reserva (avulsa ou mensalista, mesmas telas do calendário de um único espaço), já com espaço, data, horário e preço do slot preenchidos.
- **Gestão da reserva:** clicar em uma reserva existente abre o modal de detalhes (confirmar pagamento, cancelar, editar), com as mesmas regras do calendário do espaço.
- O modal "Ver operação do dia" continua existindo (somente leitura) e reutiliza o mesmo componente.

---

### 5.6 Gestão de Usuários
- Visualização de atletas cadastrados
- Associação de atletas à arena
- Gestão de gestores secundários
- Definição de permissões
- Possibilidade de convidar atletas para a arena

---

### 5.7 Relatórios Básicos
- Uso das quadras por período
- Horários mais utilizados
- Quantidade de reservas

---

### 5.8 Gestão de Estações (Bar - Loja)
- Cadastro de estações
- Edição de dados da estação
- Ativação/desativação
- Informações gerais:
  - Nome
  - Status (Ativo / Em manutenção / Desativado)
  - Tipo (Bar / Loja / Outros)
- Associação com arena
- Uma Estação pode ter mais de uma caixa

---

### 5.8.1 Gestão de Caixas
- Cadastro de caixas
- Cada caixa está vinculado a uma estação
- Edição de dados da caixa
- Ativação/desativação
- Dentro do caixa é possível lançar itens de consumo (produtos e serviços)
- No caixa posso lançar uma comanda que contem itens de consumo
  - Abrir nova comanda:
    - Seleciono o cliente
    - Seleciono os itens (Listagem de itens de consumo daquela Arena)
    - Seleciono a quantidade

---

### 5.8.2 Registrar Pagamento
- Para registrar o pagamento, visualizo todas as comandas abertas dentro de um determinado caixa
- Com a comanda selecionada, visualizo os itens, quantidade por iten, valor unitário e valor total
- Posso registrar o pagamento da comanda
- Para registrar o pagamento:
  - Seleciono o método de pagamento
  - Informo o valor pago
  - Informo a forma de pagamento
  - Informo Observação (se houver)
  - Confirmo o pagamento
- Após confirmar o pagamento, a comanda é fechada

---

### 5.8.3 Listagem de Comandas da Estação (✅ Implementado)
- Ao acessar uma estação, as comandas são listadas em cards com paginação server-side (o banco pode conter milhares de comandas por dia)
- Paginação: 10, 25, 50 ou 100 comandas por página (default: 25)
- Filtro de status: Abertas (default), Pendentes, Fechadas ou Todos os status
- Busca por cliente: consulta todos os registros do banco (não apenas os visíveis na página), respeitando o status selecionado; busca por nome do cliente avulso, nome de perfil do atleta ou nº da comanda
- Filtro de data de abertura da comanda: intervalo "De" e "Até"
- Qualquer mudança de filtro/busca retorna à primeira página

---

### 5.8.5 Status "Pendente" da Comanda (✅ Implementado)
- Objetivo: permitir que o gestor marque manualmente uma comanda aberta como "Pendente" quando o cliente vai efetuar o pagamento em outro momento, sem perder o controle sobre ela.
- No detalhe da comanda (status Aberta), o gestor pode clicar em "Marcar como pendente"; a comanda passa a exibir o badge "Pendente" e a data/hora em que a mudança ocorreu ("Pendente desde ...").
- Enquanto pendente, a comanda continua totalmente editável: é possível lançar novos itens e registrar pagamento normalmente, exatamente como uma comanda aberta.
- O gestor pode reverter manualmente a comanda de "Pendente" para "Aberta" a qualquer momento (botão "Reverter para aberta"), caso tenha marcado por engano.
- Toda mudança de status (aberta → pendente, pendente → aberta) é registrada com quem alterou e quando, para fins de auditoria.
- Ao ser paga (saldo chega a zero), a comanda segue o fluxo normal já existente e é fechada automaticamente, independente de estar aberta ou pendente no momento do pagamento.
- O relatório Relatórios → Movimentação Estações reflete esse status: filtro "Status" com a opção "Pendente" e coluna "Status comanda" mostrando o badge e a data de "pendente desde" na listagem.

---

### 5.8.4 Rotativo — Gestão de Créditos (✅ Implementado)
- Configuração de pacotes de créditos (quantidade × valor em reais)
- Lançamento de crédito para atleta via modal "Novo crédito"
  - Seleção do atleta por input de busca: pesquisa pelo nome direto no banco a partir do 3º caractere digitado (evita carregar todos os atletas cadastrados)
  - Quantidade de rotativos, validade e forma de pagamento
- Listagem paginada de movimentações (compra / uso / vencimento) com busca por atleta
- Ranking dos atletas com mais créditos

---

### 5.9 Gestão de Produtos (Catálogo)
- Cadastro de produtos e serviços
- Edição de dados do produto
- Ativação/desativação (status Ativo / Inativo)
- Informações gerais:
  - Nome
  - Categoria (família do item, cadastrada pelo gestor)
  - Tipo de estação (produtos)
  - Status (Ativo / Inativo)
  - Valor (valor unitário)
- Associação com arena
- Controle de estoque com histórico de movimentações (entradas, saídas e estornos)

#### 5.9.1 Categorias de Produtos e Serviços
- **Status:** Implementado (21/07/2026).
- CRUD de categorias por arena, separadas por escopo (produtos e serviços).
- Cada produto/serviço pertence a uma categoria (família), organizando o catálogo.
- Categorias podem ser renomeadas, reordenadas e inativadas.
- Categorias com itens vinculados não podem ser excluídas, apenas inativadas.
- Filtro por categoria na listagem do catálogo.

#### 5.9.2 Reajuste de Preço em Massa
- **Status:** Implementado (21/07/2026).
- Objetivo: permitir ao gestor reajustar o preço de todos os itens de uma categoria de uma vez (ex.: +10% em todas as bebidas).
- Tipos de reajuste: percentual (ex.: +10%, -5%) ou valor fixo (ex.: +R$ 1,00).
- Regras de arredondamento: sem arredondamento (2 casas) ou terminação comercial ,00 / ,50 / ,90.
- Opção de incluir itens inativos; por padrão atinge apenas itens Ativos.
- **Preview obrigatório:** antes de confirmar, o gestor vê a tabela com preço atual → preço novo de cada item.

#### 5.9.3 Histórico de Alterações de Preço
- **Status:** Implementado (21/07/2026).
- Registro de toda alteração de preço, individual (edição do item) ou em massa.
- Cada registro guarda preço anterior, novo preço, tipo (manual/em massa), percentual aplicado, motivo, autor e data.
- Consulta por produto/serviço através de modal de histórico.

---

### 5.10 Agente de IA no WhatsApp
- **Status:** Em implementação (MVP — 22/07/2026). Plano técnico completo em `docs/PLANO-Agente-IA-WhatsApp.md`.
- **Objetivo:** conectar um número de WhatsApp à arena para que um agente de IA responda automaticamente os clientes, no escopo daquela arena.
- **Integrações:** Meta (WhatsApp Business Cloud API) para mensageria e OpenAI (ChatGPT) para a conversa/entendimento de contexto.

#### 5.10.1 Capacidades do agente (MVP)
- Horário de funcionamento da arena.
- Quadras/espaços ativos e suas modalidades.
- Valores de reserva **avulsa** (por hora) e **estimativa** de valor mensal.
- Disponibilidade de quadras por dia e horário (cruzando a grade com as reservas existentes).
- Entende mensagens de **texto** e de **áudio** (áudio é transcrito; a resposta é sempre em texto).
- Fora do escopo (horários/quadras/preços/disponibilidade) ou tipos não suportados (imagem, vídeo): responde com uma mensagem de fallback educada.

#### 5.10.2 Setup pelo gestor
- Card "Agente de IA (WhatsApp)" na tela de edição da arena.
- **Conectar número:** vínculo seguro e validado; **um número pertence a uma única arena** (e vice-versa).
- **Personalidade:** campo de prompt onde o gestor descreve o tom/personalidade do agente da sua arena.
- **Ligar/Desligar:** o gestor ativa ou desativa o agente a qualquer momento; desligado, nenhuma mensagem é respondida.
- **Mensagem de fallback** e **teto mensal de tokens** configuráveis.

#### 5.10.3 Regras e segurança
- O agente só responde se a arena tiver **assinatura ativa** e o agente estiver **ligado**.
- Isolamento total entre arenas: os dados respondidos são sempre e apenas da arena vinculada ao número.
- O agente **não efetua reservas nem cobranças** — apenas informa e orienta a procurar a arena.
- Nunca inventa dados: horários, preços e disponibilidade vêm sempre do banco.

---

### 5.11 Central de Notificações da Arena (tempo real)
- **Status:** Implementado (27/07/2026).
- **Objetivo:** avisar o backoffice da arena, em tempo real, sobre ações que os atletas realizam no **aplicativo** e que impactam a operação.
- **Eventos notificados:**
  - **Reserva pelo app** — o atleta reserva um espaço da arena.
  - **Confirmação em rotativo** — o atleta se inscreve/confirma presença em um rotativo da arena.
  - **Game Match criado** — o atleta abre um jogo tendo a arena como local.
- **Origem:** apenas ações vindas do app. Reservas e inscrições registradas pelo próprio backoffice **não** geram notificação.
- **Onde aparece:**
  - **Sino** no topo da barra lateral, com contador de não lidas, visível em qualquer tela do sistema.
  - **Toast** imediato quando o evento chega enquanto o gestor está no sistema, com atalho "Ver".
  - **Página "Notificações"** (`/dashboard/notifications/{arenaId}`) com o histórico completo e filtros por tipo/não lidas.
- **Ações:** marcar uma notificação como lida, marcar todas como lidas e clicar no aviso para ir direto ao contexto (calendário do espaço, rotativo ou operação do dia).
- **Escopo:** as notificações são sempre da arena selecionada e só são visíveis para quem tem acesso ao backoffice daquela arena.

---

### 5.12 Mensalistas — Gestão, Rateio, Crédito e Previsão de Encerramento
- **Status:** Implementado (28/08/2026). Remodelagem da tela de Mensalistas.
- **Objetivo:** dar ao gestor controle claro dos mensalistas — previsibilidade de recebimento por mês, quem já quitou e quem falta, controle de rateio da mensalidade entre várias pessoas, crédito manual em R$ e antecipação de encerramentos para revender o horário.
- **Ponto focal = responsável.** A lista agrupa por **responsável pela reserva**, mesmo quando o atleta tem mais de uma recorrência (dias/horários/quadras diferentes). Cada responsável é uma linha só.
- **Navegação por competência (mês).** Seletor `‹ Agosto 2026 ›` no topo (estado na URL `?competencia=YYYY-MM`). Todos os números da tela são do mês selecionado.
- **Visão geral (lista):**
  - KPIs do mês: **Total a receber**, **Total recebido**, **Restante**, **Encerrando em breve** (recorrências com encerramento previsto nos próximos 60 dias).
  - Filtros: status do plano (Ativo / Encerrando / Cancelado) e situação de pagamento (Pendente / Parcial / Quitado); busca por nome.
  - Colunas por responsável: status, nº de recorrências, início, encerramento previsto, valor do mês, recebido, restante, **atraso** (débito de meses anteriores), **situação** (🟢 Quitado / 🟡 Parcial / 🔴 Pendente, bem visual), **crédito** disponível (chip quando > 0).
  - **Atraso (débito de meses anteriores):** independentemente do mês que o gestor está olhando, um **alerta vermelho** no topo mostra quantos mensalistas têm mensalidade de competência anterior ao mês corrente ainda em aberto e o total; clicar filtra a lista. Cada linha traz o valor em atraso e há quantos meses. No detalhe, um selo "Em atraso" ao lado do nome e uma seção **"Pendências de meses anteriores"** listando cada competência devedora com botão de "Registrar pagamento" direto (não precisa navegar até o mês).
- **Detalhe do responsável** (`/dashboard/arenas/{id}/mensalistas/{athleteId}`):
  - KPIs: a receber, recebido, restante, **crédito** (saldo) e **saldo do programa de fidelidade** do atleta (mostra o nome da moeda configurada na arena, o saldo e a legenda "(Saldo Programa Fidelidade)").
  - **Recorrências:** quadra, dia, horário, valor/mês; toggle **Rateio**, botão **Reajustar valor** e ação **Encerrar** por recorrência. Quando há encerramento previsto, um destaque mostra o mês, a observação e o horário que ficará vago (para revenda).
  - **Reajustar valor:** o gestor define o novo valor mensal e escolhe a vigência — **mês atual** (a cobrança deste mês passa a ser o novo valor) ou **mês seguinte** (o mês atual fica como está). O sistema assume o novo valor como o valor do plano a partir da vigência, reescreve as cobranças abertas já geradas (meses com rateio ou pagamento registrado são preservados e o gestor é avisado) e registra tudo num **Histórico de reajustes** (valor anterior → novo, vigência, observação, data) visível na própria recorrência.
  - **Mensalidade do mês:** sem rateio → 1 linha (devido / pago / restante) com **Registrar pagamento**; com rateio → uma linha por participante (valor devido, pago, crédito aplicado, data, status) com **Registrar pagamento** por pessoa.
  - **Registrar pagamento acima do devido:** o valor em dinheiro pode passar do valor da cobrança. Quando isso acontece, o modal pergunta se o gestor quer que o excedente vire **crédito**: **sim** → a cobrança fica quitada no valor exato e o excedente entra como saldo de crédito; **não** → o pagamento é registrado como está (acima do devido). Se a parcela for de um **participante avulso** (sem cadastro), o crédito é lançado para o **responsável pela recorrência**. O dinheiro total recebido entra no **Financeiro** da arena nos dois casos; o crédito lançado não gera lançamento de caixa (só é receita quando aplicado).
  - **Histórico de pagamentos:** todos os pagamentos de todas as competências — data, competência, participante, valor em dinheiro, valor em crédito, observação (paginado).
  - **Créditos:** extrato do crédito manual do atleta (data, tipo, valor com sinal, descrição) + saldo atual.
- **Rateio da mensalidade:**
  - O valor total é dividido **igualmente** entre os participantes **ativos**. Ligar/desligar um participante **redistribui** automaticamente entre os demais; o gestor pode **sobrescrever** o valor de uma pessoa.
  - Participantes podem ser **atletas cadastrados** na arena ou **nomes avulsos** (texto livre, sem cadastro).
  - Parcelas já pagas ficam **congeladas** (não entram na redistribuição). A soma das parcelas ativas tem de fechar com o valor total.
- **Pagamento parcial:** com ou sem rateio, todo mês tem devido / pago / restante. O gestor pode registrar pagamentos parciais; o mês fica **Parcial** até quitar. Ao quitar o mês, as reservas daquele mês são confirmadas e a agenda "rola" um mês à frente (respeitando a previsão de encerramento).
- **Crédito manual:** botão **Lançar crédito** registra um valor em R$ para um atleta (responsável ou participante do rateio). O saldo fica sempre visível para o gestor e pode ser **abatido** no registro de um pagamento futuro. Um lançamento de crédito **não** entra no caixa; só vira receita quando é usado.
- **Retirada de crédito:** botão **Retirar crédito** desconta um valor do saldo do responsável, registrado como movimento "Retirada" no extrato de créditos. Não pode ultrapassar o saldo disponível e pode ser feita em **várias parcelas** até zerar o crédito (ex.: crédito de R$ 500 → retirada de R$ 200 num mês, R$ 200 no seguinte, R$ 100 depois). Cada retirada fica no histórico com data, valor e observação. Também não gera lançamento no caixa.
- **Previsão de encerramento:** botão **Encerrar** grava o mês a partir do qual a recorrência vai acabar + uma observação. As reservas ainda não confirmadas a partir desse mês são canceladas, liberando o horário. O encerramento **definitivo** continua sendo o cancelamento do plano.
- **Integração financeira:** cada pagamento em dinheiro gera uma entrada em `Financeiro` na categoria "Mensalidade" (aparece nos relatórios de pagamento). O painel "Cobranças Pendentes — Mensalistas" do Financeiro passa a levar ao detalhe do mensalista.
- **Cadastro assistido (BookingModal → aba Mensal):**
  - O modal mostra, sem exigir cálculo do gestor, **quantas recorrências ainda cabem no mês corrente** a partir de hoje (data + intervalo) e as reservas que serão criadas neste mês (confirmadas) vs. a cadência dos próximos 2 meses (reservado).
  - Quando há tabela de preço além da Padrão, um seletor **Tabela de preço** (default = Mensalista) alimenta a **sugestão** de `valor/sessão` e de `valor mensal` — sempre editável.
  - **Primeira mensalidade proporcional:** se o mensalista começa no meio do mês, a `mensalidade` da competência de início é `valor/sessão × sessões restantes` (mês cheio ⇒ valor mensal). Reflete direto na tela de Mensalistas (valor do mês / restante) e nas Cobranças.

---

## 6. Requisitos Não Funcionais

- Interface simples e responsiva
- Performance adequada para uso diário
- Segurança no acesso e nos dados
- Compatibilidade com navegadores modernos
- Disponibilidade 24/7

---

## 7. Restrições Técnicas

- Autenticação obrigatória via Supabase Auth
- Banco de dados Supabase (PostgreSQL)
- Backend serverless (Vercel)
- Consumo exclusivo via API REST
- Código versionado no GitHub

---

## 8. Métricas de Sucesso

- Número de arenas ativas
- Gestores ativos mensalmente
- Taxa de utilização das quadras
- Frequência de acesso ao sistema
- Retenção de gestores

---

## 9. Premissas

- Gestores possuem acesso à internet
- Cada arena possui ao menos um gestor responsável
- O sistema web é a fonte oficial de dados administrativos

---

## 10. Riscos e Dependências

- Adoção inicial pelos gestores
- Qualidade do cadastro de dados
- Dependência da estabilidade de serviços terceiros (Supabase, Vercel)


## 11. Fluxo de Agendamento

teste
