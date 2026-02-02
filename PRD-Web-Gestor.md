# PRD — Arena Digital (Web | Gestor de Arenas)

## 1. Visão Geral do Produto

**Nome:** Arena Digital  
**Versão:** SaaS Web — Gestão de Arenas  
**Público:** Gestores de Arenas Esportivas  
**Arquitetura:** API-first  
**Infraestrutura:** Serverless  

O Arena Digital – Web é um sistema SaaS voltado exclusivamente para **gestores de arenas esportivas**, permitindo a administração completa de arenas, quadras, horários, usuários e indicadores operacionais.

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

### Fora do Escopo (MVP)
- Pagamentos online
- Integração com gateways
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
- Edição de dados da arena
- Ativação/desativação
- Informações gerais:
  - Nome
  - Endereço
  - Horário de funcionamento

---

### 5.4 Gestão de Quadras
- Cadastro de quadras
- Tipo de quadra (futebol, paddle, tênis, etc.)
- Capacidade
- Status (ativa/inativa)
- Associação com arena

---

### 5.5 Agenda e Horários
- Configuração de horários de funcionamento
- Visualização de agenda por quadra
- Bloqueio de horários
- Visualização de reservas feitas por atletas

---

### 5.6 Gestão de Usuários
- Visualização de atletas cadastrados
- Associação de atletas à arena
- Gestão de gestores secundários
- Definição de permissões

---

### 5.7 Relatórios Básicos
- Uso das quadras por período
- Horários mais utilizados
- Quantidade de reservas

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
