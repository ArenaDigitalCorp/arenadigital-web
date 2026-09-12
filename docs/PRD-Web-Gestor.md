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
  - **Padrão, Mensalista e Professor têm nome fixo** (10/09/2026). Elas não são nomes, são **papéis**: o perfil do cliente aponta para a tabela do espaço pelo papel, e renomear daria a impressão de que o papel mudou junto. Na tela o nome delas aparece como rótulo com cadeado, explicando que só as tabelas criadas pelo gestor podem ser renomeadas. Espaços cujas reservadas tenham sido renomeadas antes disso são **normalizados** de volta para Padrão / Mensalista / Professor, para que o mesmo papel tenha o mesmo rótulo em toda a plataforma. Se o nome canônico estiver em uso por uma tabela personalizada daquele espaço, ela recebe o sufixo "(personalizada)" para liberá-lo.
  - **Semana em cards** (10/09/2026): os sete dias deixaram de ficar abertos e empilhados. Uma tira de sete cards mostra a semana inteira de relance — cada card traz o interruptor de abrir/fechar, o horário, quantas faixas e a variação de preço, além de uma barrinha em que cada segmento é proporcional à duração da faixa e o tom acompanha o preço. Clicando num card, o painel abaixo edita aquele dia em duas colunas (funcionamento à esquerda, faixas de preço à direita). Em **Editar vários dias**, o gestor marca quantos cards quiser e configura todos de uma vez — o que o "Replicar para todos os dias" (mantido) não cobria, por ser tudo ou nada. Abrir e fechar um dia continua sendo só pelo interruptor: editar preço nunca abre um dia fechado. A altura da seção cai de cerca de 2.600px para ~520px, sem perder nenhuma das 13 funções do editor de dias nem das 11 de gerenciar tabelas.
  - **Um único botão salva tudo** (10/09/2026): tanto no cadastro quanto na edição, o botão do fim do formulário grava os dados do espaço **e** as tabelas de preço. O "Salvar tabela" por aba saiu — havia dois botões na edição e o do fim não gravava as tabelas, o que fazia o gestor perder o que tinha ajustado. As abas com alteração pendente ficam marcadas e um aviso lembra que elas vão junto no Salvar.
- **Desativar ou excluir espaço** (12/09/2026): o menu do espaço abre um diálogo que primeiro **mostra o que está vinculado a ele** — reservas no histórico, reservas futuras, recorrências de mensalista, solicitações do app e tabelas de preço — e só então oferece os dois caminhos:
  - **Desativar** (reversível, sempre disponível): o espaço para de aceitar novas reservas, novas recorrências e pedidos pelo app. As reservas já marcadas continuam valendo e o histórico fica intacto. Reativar é pelo mesmo diálogo.
  - **Excluir permanentemente**: só fica habilitado para espaço **sem histórico nenhum** — aquele criado por engano ou que nunca foi usado. Leva junto as tabelas de preço e os esportes vinculados.

  Espaço com histórico **não é excluído**, e o diálogo diz o motivo com os números na tela. A razão é concreta: apagar o espaço apagaria em cascata todas as suas reservas, e os lançamentos de caixa — que não são apagados — ficariam sem a reserva que os originou. Antes desta mudança o "Excluir" simplesmente falhava com erro de banco quando havia mensalista ou pedido do app, e funcionava destruindo o histórico quando não havia.
- **Copiar espaço:** cria um espaço novo com toda a configuração do original — esportes, atributos, funcionamento e **as tabelas de preço inteiras** (as 3 fixas, as personalizadas, os nomes renomeados, quais dias e faixas cada uma tem e qual delas é a padrão). Antes da correção de 10/09/2026 a cópia nascia só com a tabela Padrão preenchida e Mensalista/Professor vazias, o que fazia o espaço copiado cotar R$ 0 para mensalista e professor. Se as tabelas não puderem ser copiadas, o espaço ainda é criado e o gestor recebe um aviso para revisá-las (em vez de o "Copiar" falhar e tentar criar um segundo espaço).
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
  - **Reajustar valor:** o gestor define o novo valor e escolhe entre **três vigências**, cada uma nomeando o mês de que se trata (corrigido em 11/09/2026):
    - **Somente [mês]** — ajuste pontual, para um desconto combinado num mês específico. Muda só a cobrança daquele mês; **o valor do plano não é alterado** e os demais meses seguem como estavam.
    - **De [mês] em diante** — novo valor do plano, já valendo para a cobrança do mês visualizado.
    - **De [mês seguinte] em diante** — novo valor do plano; a cobrança do mês visualizado fica como está.

    A vigência é ancorada no **mês que o gestor está vendo na tela**. Antes, "mês atual" significava o mês corrente do calendário: olhando outubro em setembro, o reajuste caía sobre setembro. Os rótulos passaram a nomear o mês justamente para não haver dúvida.

    Nos dois escopos que mudam o plano, as cobranças abertas já geradas são reescritas da vigência em diante — respeitando a regra de cobrança do plano, de modo que uma recorrência por blocos continua custando menos em meses com menos jogos. Meses com rateio ou pagamento registrado são preservados e o gestor é avisado. Tudo fica no **Histórico de reajustes** (valor anterior → novo, escopo, vigência, observação, data) visível na própria recorrência.
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

### 5.13 Recorrência de mensalista com vários blocos (professor)

- **Status:** Implementado (09/09/2026).
- **Problema:** o cadastro pedia **um** dia da semana e **um** intervalo, em **um** espaço. Um professor que aluga terça 19h–21h, quinta 19h–21h e sábado 9h–11h precisava de três cadastros — e recebia três mensalidades separadas, o que quebra a gestão e a cobrança.
- **Objetivo:** montar toda a agenda do professor em um cadastro só, com uma única mensalidade, vendo a disponibilidade real e o valor fechando em tempo real.

**Como funciona (BookingModal → aba Mensal):**
- **Grade de disponibilidade no lugar dos campos soltos.** A aba mostra a semana do espaço (dias × horas). O gestor clica nos horários livres; **horas seguidas viram um bloco só** ("Terça 19:00–21:00"). Pode marcar quantos dias e horários quiser, **inclusive em espaços diferentes**, no mesmo plano.
- **Só é possível marcar horário livre.** Ocupado e fora do funcionamento vêm desabilitados, com o nome de quem ocupa na própria célula.
- **Conflito numa ocorrência futura bloqueia o horário.** Como o plano gera reservas por 3 meses, um horário livre nesta semana pode colidir daqui a seis semanas. A grade sinaliza isso (faixa âmbar) e **não deixa selecionar** — a decisão é bloquear o bloco, não criar pela metade.
- **Encontrar horas em outros espaços.** Cada espaço mostra quantas horas livres tem na semana. Ao passar por um horário, uma faixa lista **os outros espaços livres naquele mesmo horário**; um clique troca de espaço e já marca.
- **Subtotal ao vivo.** O valor de cada bloco vem do servidor pela tabela de preço do espaço (respeitando faixas de horário — a hora das 20h pode custar mais que a das 9h). A tela soma horas/semana, valor/semana, reservas em mês cheio e a **mensalidade** sugerida.
- **Tabela de preço por espaço, escolhida pelo gestor.** Como as tabelas são por espaço, o plano que usa dois espaços mostra dois seletores (default = Mensalista, quando existe). Não há desconto automático de professor nesta fase: o gestor escolhe a tabela.
- **Valor sempre editável.** O campo "Valor mensal cobrado" vem preenchido pela soma da tabela e pode ser alterado para aplicar **desconto ou acréscimo** negociado. Uma vez editado à mão, a sugestão deixa de sobrescrever e a tela passa a mostrar quanto a tabela sugeria.
- **A mensalidade acompanha o calendário (corrigido em 11/09/2026).** O preço da hora é fixo — é o da tabela de preço. O que varia é quantas vezes o dia da semana cai no mês. Um plano de quinta a R$ 100/h custa **R$ 500 num mês de 5 quintas e R$ 400 num de 4**, e o mês de estreia é proporcional ao que ainda cabe nele. Assim toda reserva do plano vale exatamente o preço de tabela, e o ano fecha em sessões × preço da hora, sem sobra nem falta. A tela mostra os dois valores que a fatura vai assumir antes de o gestor fechar o plano.
- **O campo "Valor mensal cobrado" é o valor de um mês de referência** (o primeiro mês em que o plano roda inteiro). Editá-lo para aplicar desconto ou acréscimo reajusta todos os meses na mesma proporção.
- **Primeira mensalidade proporcional por duração.** Com blocos de tamanhos diferentes, o pró-rata conta **minutos**, não sessões: perder um sábado de 2h pesa o dobro de perder uma terça de 1h.

**Reflexo na tela de Mensalistas (5.12):**
- Um plano com várias faixas passa a ser resumido no card como **"N horários · Xh por semana"**, em vez de mostrar apenas a primeira faixa (o que exibia 2h para um plano de 6h e fazia o valor parecer desproporcional).
- Abrindo o card, aparece a seção **"Horários da recorrência"** com espaço, dia e faixa de cada bloco.
- O aviso de encerramento passa a listar **todos** os horários liberados para revenda; antes anunciava só um.
- Plano de uma faixa só (todos os atuais) continua exibido exatamente como antes.

---

### 5.14 Cancelar um jogo do mensalista (sem cancelar a recorrência)

- **Status:** Implementado (11/09/2026).
- **Problema:** o mensalista que avisava com antecedência que não ia a uma das sessões não tinha tratamento. A tela de detalhes da reserva recusava cancelar qualquer reserva de mensalista ("Gerencie via Mensalistas"), e cancelar pelo módulo de Mensalistas encerrava a recorrência inteira. Na prática o gestor ficava sem registro: ou deixava o horário ocupado, ou combinava o crédito por fora.
- **Caso coberto:** ele comprou 4 quartas do mês, faltou à terceira e avisou antes. Quer remarcar em outro dia ou receber crédito.

**Como funciona (Detalhes da reserva → "Cancelar este dia"):**
- O botão aparece em reserva de mensalista que ainda não esteja cancelada — **inclusive já confirmada/paga**, que é justamente o caso em que o crédito faz sentido.
- A confirmação diz, em destaque, que o cancelamento vale **somente para aquele jogo**: a recorrência segue ativa e a **mensalidade do mês não muda**. Mostra dia por extenso, faixa de horário, mensalista e espaço, para o gestor conferir antes de confirmar.
- **Lançar crédito é opcional**, marcado por padrão. Desmarcado, apenas libera o horário.
- **O valor vem pronto**, equivalente à hora reservada segundo a tabela de preço que vale para a mensalidade dele — e a tela diz qual tabela usou. Continua editável para um acerto negociado. Se o plano não tiver tabela de mensalista e a sugestão cair na tabela padrão do espaço, a tela avisa para o gestor conferir.
- **A descrição já vem escrita:** "Crédito lançado referente a jogo não realizado do dia DD/MM/AAAA".

**Reflexo em Mensalistas (5.12):**
- O crédito entra no extrato do mensalista com um selo **"Jogo cancelado"**, ficando claro a que se refere mesmo meses depois, e passa a somar no saldo usado para abater mensalidades.
- Um jogo cancelado gera **no máximo um** crédito — duplo clique ou reenvio não credita duas vezes.

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
