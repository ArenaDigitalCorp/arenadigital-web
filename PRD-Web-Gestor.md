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

### Fora do Escopo (MVP)
- Marketplace
- Multi-idioma
- White-label

---

## 5. Funcionalidades do MVP

### 5.1 Autenticação e Acesso
- Login via Clerk
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
- Preço da quadra atribuido a dia e horario
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

### 5.9 Gestão de Produtos
- Cadastro de produtos
- Edição de dados do produto
- Ativação/desativação
- Informações gerais:
  - Nome
  - Tipo (Alimentação / Bebida / Vestimenta / Acessório)
  - Status (Em Estoque / Em Falta)
  - Valor (valor unitário)
- Associação com arena

---

## 6. Requisitos Não Funcionais

- Interface simples e responsiva
- Performance adequada para uso diário
- Segurança no acesso e nos dados
- Compatibilidade com navegadores modernos
- Disponibilidade 24/7

---

## 7. Restrições Técnicas

- Autenticação obrigatória via Clerk
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
- Dependência da estabilidade de serviços terceiros (Clerk, Supabase, Vercel)
