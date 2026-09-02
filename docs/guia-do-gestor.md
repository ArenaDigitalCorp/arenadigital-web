# Arena Digital — Guia do Gestor

Como usar o sistema no dia a dia: o que cada área faz, **as regras que o sistema aplica** e o que acontece automaticamente em seguida.

> Para a visão técnica (actions, banco, gateways), veja `visao-geral-modulos.md`.

---

## Sumário

1. [Regras gerais](#regras-gerais)
2. [Primeiro acesso](#primeiro-acesso)
3. [Dashboard](#dashboard)
4. [Espaços e reservas](#espaços-e-reservas)
5. [Atletas](#atletas)
6. [Estações e comandas](#estações-e-comandas)
7. [Catálogo e estoque](#catálogo-e-estoque)
8. [Mensalistas](#mensalistas)
9. [Rotativo](#rotativo)
10. [Programa de fidelidade](#programa-de-fidelidade)
11. [Financeiro](#financeiro)
12. [Relatórios](#relatórios)
13. [Configurações](#configurações)
14. [Como os módulos se conectam](#como-os-módulos-se-conectam)

---

## Regras gerais

### Arena selecionada

No topo da barra lateral há o **seletor de arena**. Quase tudo ocorre dentro da arena escolhida. Ao trocar de arena, os menus passam a mostrar os dados da nova unidade.

### Quem pode fazer o quê

| Perfil | Acesso |
|---|---|
| **Dono / Gestor** | Menu completo, incluindo Relatórios, Configurações e Assinatura |
| **Atendente** | Operação do dia a dia (reservas, atletas, comandas, rotativo, etc.), **sem** Configurações |
| **Caixa** | Apenas a **estação vinculada** a ele ("Minha estação"). Sem estação atribuída, vê só a lista de Estações |

**Regras de permissão:**

- **Caixa** não acessa: Espaços (cadastro), Mensalistas, Rotativo, Fidelidade, Financeiro, Relatórios, Configurações.
- **Caixa** só opera comandas na **própria estação** — tentativa em outra estação é bloqueada.
- **Atendente** não acessa Configurações nem Assinatura.
- **Assinatura** (cadastro de cartão, troca de plano): apenas **Dono ou Gestor**.

### Assinatura e bloqueio de acesso

Cada arena tem sua **própria assinatura**. Regras principais:

- No cadastro, o sistema ativa automaticamente o **Plano Experimental (5 dias, grátis, sem cartão)**.
- Quando o experimental **expira** ou não há assinatura válida, Dono/Gestor é **redirecionado para Assinatura** ao tentar usar outras áreas (exceto Dashboard durante o tutorial).
- **Criar novo espaço** exige assinatura ativa e respeito ao **limite de quadras do plano**.
- Pagamentos são processados via **Asaas** (checkout hospedado). A arena precisa ter **CPF/CNPJ** cadastrado para cobrança.

---

## Primeiro acesso

### O que você faz

| Etapa | O que acontece |
|---|---|
| **Cadastro** | Nome, CPF, telefone, e-mail, senha, nome da arena e endereço |
| **Confirmação de e-mail** | Sistema cria a arena, vincula como Gestor e ativa trial de 5 dias |
| **Login / recuperar senha** | Acesso normal ou redefinição por e-mail |
| **Tutorial** | Passo a passo no primeiro acesso; pode reaparecer com novidades |

### Regras de negócio

- Cada conta de gestor recebe **uma arena** no cadastro inicial (provisionamento automático).
- O trial experimental é **único por arena** — não pode ser reativado depois de migrar para plano pago.
- Edição e exclusão de arenas: **Configurações → Perfil da Arena**. Criação de arenas adicionais hoje ocorre só no cadastro inicial.

---

## Dashboard

**Menu:** Dashboard · **Quem:** Dono, Gestor, Atendente

### O que mostra

Receita do mês (e variação % vs. mês anterior), reservas confirmadas hoje, quadras ativas, atletas ativos no mês, ocupação por quadra no dia. Pode filtrar uma arena ou **Todas** (arenas do dono + vinculadas).

### Regras de negócio

- **Somente leitura** — nada é alterado aqui.
- **Receita:** soma de entradas do mês corrente. Variação % vs. mês anterior; se mês anterior = 0 e atual > 0, mostra 100%.
- **Reservas hoje:** status `Confirmado`, no intervalo do dia.
- **Atletas ativos:** atletas distintos com reserva confirmada no mês.
- **Ocupação:** considera quadras ativas com horário habilitado no dia; percentual limitado a **100%**.

---

## Espaços e reservas

**Menu:** Espaços · **Quem:** Dono, Gestor, Atendente (Caixa **não** acessa cadastro de espaços)

### O que você faz

| Ação | Como fazer | Efeito |
|---|---|---|
| Cadastrar espaço | Cadastros → **Cadastrar Espaço +** | Espaço disponível para reservas |
| Editar / excluir | Menu **⋮** no card ou tabela | Exclusão permanente |
| Ver agenda | Card ou ícone de calendário | Calendário Dia/Semana |
| Cadastrar reserva | Horário vazio ou **Cadastrar reserva** | Reserva no calendário |
| Analisar pré-reserva | **Pré-reservas** → selecionar solicitação | Aprovar e bloquear o horário, ou recusar |
| Gerenciar reserva | Clique na reserva → Detalhes | Editar, serviços, cancelar |
| Operação do dia | **Ver operação do dia**, **Horários disponíveis** | Identificar horários livres |

### Regras de negócio — Espaços

- Nome mínimo: **2 caracteres**.
- Status possíveis: Ativo, Inativo, Em manutenção, Desativado.
- Tipos: Quadra ou Espaço social.
- Capacidade mínima: **1** (se informada).
- Esportes vinculados opcionalmente; ao editar, substitui todos os vínculos.
- **Criar espaço** exige assinatura ativa + limite do plano não atingido.
- Endereço da arena alimenta geolocalização no mapa (geocodificação automática).

### Pré-reservas do aplicativo

- O recebimento é ativado por arena em **Configurações → Perfil da Arena → Aceitar pré-reservas pelo aplicativo**.
- Uma solicitação **Em análise** não ocupa a agenda. Mais de um atleta pode pedir o mesmo horário.
- Dono, Gestor e Atendente podem analisar a fila em **Pré-reservas**.
- Ao aprovar, o sistema revalida a disponibilidade e cria uma reserva **Ag. Confirmação**, que passa a bloquear a quadra.
- Se outra reserva já ocupar o período, a aprovação é bloqueada; a solicitação pode ser recusada.
- Recusar não cria reserva. Nesta etapa, aprovação e recusa não geram pagamento nem lançamento financeiro.

### Regras de negócio — Reservas avulsas

- **Conflito de horário:** na mesma quadra, não pode haver sobreposição com reservas **Confirmadas** ou **Reservadas** (mensalista pendente). O sistema **avisa** conflitos antes de salvar, mas na gravação **bloqueia** se houver conflito.
- Reservas **confirmadas com valor > 0** geram entrada automática no Financeiro (categoria **Reserva Avulsa**).
- **Recorrência:** gera semanas seguintes; conflitos são verificados; transação financeira única com quantidade = número de sessões confirmadas.
- **Serviços anexados:** só itens do catálogo com tipo **serviço** (produtos físicos não entram). Preço = preço atual do catálogo. Total = locação + serviços.
- Reservas de **mensalista** não podem ser editadas pelo calendário — gerenciadas em Mensalistas.
- Reservas mensalista com status **Ag. Confirmação** (`reservado`) têm ações limitadas no calendário.
- Cancelar reserva: status → **Cancelado** (some das contagens e relatórios como ativo).

### Status no calendário

| Status | Significado |
|---|---|
| Disponível | Horário livre |
| Confirmado | Reserva paga/confirmada |
| Ag. Confirmação | Mensalista com mês ainda não pago |
| Conflito | Sobreposição detectada |

### Efeitos automáticos

- Reserva confirmada com valor → Financeiro.
- Recorrência confirmada → Financeiro consolidado.
- Geocodificação ao salvar arena/endereço.

---

## Atletas

**Menu:** Atletas · **Quem:** Dono, Gestor, Atendente

### O que você faz

| Ação | Como fazer | Efeito |
|---|---|---|
| Vincular existente | **Cadastrar atleta** → CPF → **Vincular** | Atleta passa a operar na arena |
| Cadastrar novo | CPF não encontrado → dados → **Salvar e enviar convite** | Conta criada + e-mail de convite |
| Perfil 360º | Clique na lista | Visão consolidada (somente leitura) |

### Regras de negócio

- **CPF** deve ser válido (dígitos verificadores).
- Nome mínimo: **2 caracteres**; telefone mínimo: **10 caracteres**; e-mail com formato válido.
- Esporte obrigatório no cadastro.
- **CPF já existente** no Arena Digital → orienta vincular em vez de duplicar.
- **E-mail já cadastrado** → bloqueado.
- Novo atleta recebe **convite por e-mail** para definir senha do app.
- Vincular atleta existente é **idempotente** (vincular de novo não gera erro).
- Perfil 360º agrega: fidelidade, reservas, rotativos, comandas e pagamentos — **sem alteração** de dados.

---

## Estações e comandas

**Menu:** Estações · **Quem:** Dono, Gestor, Atendente, Caixa (só sua estação)

### O que você faz

| Ação | Como fazer | Efeito |
|---|---|---|
| Cadastrar / editar estação | **Cadastrar Estação** ou editar pelo card | Estação pronta para comandas |
| Abrir comanda | **Abrir comanda** → cliente → itens → **Abrir** | Comanda em aberto |
| Lançar item | **Lançar item +** | Soma ao total |
| Registrar pagamento | **Registrar pagamento** | Registra pagamento; pergunta se fecha |
| Fechar comanda | Confirmar após pagamento | Comanda fechada + Financeiro |
| Cancelar comanda | Ação na tela da comanda | Estoque devolvido |

### Regras de negócio — Estações

- Cadastro/edição de estações: **Dono, Gestor, Atendente** (Caixa não).
- Caixa **sem estação vinculada** não consegue operar comandas.
- Métricas do dia: comandas abertas, abertas hoje, fechadas hoje (desde meia-noite).

### Regras de negócio — Comandas

- Cliente: **atleta vinculado à arena** ou **cliente de balcão** (`station_customers`).
- **Produtos** debitam estoque; **serviços** não debitam estoque.
- Estoque insuficiente → operação **bloqueada**; se falhar no meio, sistema **desfaz** baixa e comanda criada.
- Total da comanda = soma dos itens.
- **Fechar comanda:** status → Fechada; gera **uma entrada no Financeiro por pagamento** (categoria = tipo da estação, ex.: "Bar - Comanda #007").
- Se falhar ao gerar financeiro no fechamento, comanda **volta para aberta**.
- **Cancelar comanda:** status → Cancelada; produtos **voltam ao estoque**. Comanda cancelada **não** gera financeiro.
- Caixa só acessa comandas da **própria estação**.

---

## Catálogo e estoque

**Menu:** Catálogo · **Quem:** Dono, Gestor, Atendente (Caixa vê produtos ao lançar itens)

### O que você faz

| Ação | Como fazer | Efeito |
|---|---|---|
| Cadastrar produto / serviço | **Cadastrar produto** ou **Cadastrar serviço** | Item no catálogo |
| Editar / excluir | Menu de ações | — |
| Entrada de estoque | **Lançar entrada** | Aumenta saldo |
| Histórico | Ícone de histórico | Movimentações com saldo após cada operação |

### Regras de negócio

- **Produtos** controlam estoque; **serviços** não.
- Serviços podem ser anexados a **reservas** e **comandas**.
- Produtos vinculados a uma **estação** (tipo) para filtragem nas comandas.
- **Entrada manual:** incrementa saldo + registra movimento.
- **Saída manual:** bloqueada se estoque < quantidade solicitada.
- Vendas em comandas: saída automática; cancelamento de comanda: **devolução** automática.
- Toda movimentação registra saldo após a operação no histórico.
- Criar/editar/excluir produtos e lançar entradas/saídas manuais: **Dono, Gestor, Atendente**.

---

## Mensalistas

**Menu:** Mensalistas · **Quem:** Dono, Gestor, Atendente

### O que você faz

| Ação | Como fazer | Efeito |
|---|---|---|
| Criar plano | **Novo mensalista** | Reservas + 1ª mensalidade no Financeiro |
| Confirmar mês | **Confirmar** → **Confirmar pagamento** | Confirma mês + gera próximo |
| Cancelar plano | **Cancelar plano** | Cancela reservas futuras pendentes |

### Regras de negócio

- Plano criado com status **Ativo** e data de início = hoje.
- Ao criar, gera reservas para **3 meses à frente** (mês atual + 2):
  - **Mês atual:** reservas **Confirmadas**, preço por sessão = valor mensal ÷ sessões/mês.
  - **Meses futuros:** reservas **Ag. Confirmação** (`reservado`), sem preço definido.
- Sessões com horário **no passado** não são criadas.
- Dia da semana e horário fixos; até **N sessões por mês** (intervalo semanal).
- Na criação, registra **mensalidade integral do mês 1** no Financeiro.
- **Confirmar pagamento:** confirma **todo o mês calendário** da reserva pendente mais antiga; valor pode ser ajustado; gera reservas do **próximo mês** em Ag. Confirmação.
- **Cancelar plano:** plano → Cancelado; reservas futuras **Ag. Confirmação** → Canceladas. Reservas já **Confirmadas** permanecem.
- Reservas de mensalista **não são editáveis** pelo calendário de reservas avulsas.

### Status

| Entidade | Status | Significado |
|---|---|---|
| Plano | Ativo / Cancelado | Plano vigente ou encerrado |
| Reserva | Confirmado | Mês pago |
| Reserva | Ag. Confirmação | Mês futuro/não pago |
| Reserva | Cancelado | Cancelada |

---

## Rotativo

**Menu:** Rotativo · **Quem:** Dono, Gestor, Atendente

### O que você faz — Sessões

| Ação | Como fazer | Efeito |
|---|---|---|
| Criar sessão | **Cadastrar rotativo** | Sessão ativa para inscrições |
| Editar | Editar na sessão | Atualiza dados |
| Ativar / desativar | Toggle | Controla inscrições |
| Inscrever atleta | Inscrever → avulso ou crédito | Financeiro ou consumo de crédito |

### O que você faz — Créditos

| Ação | Como fazer | Efeito |
|---|---|---|
| Configurar pacotes | **Adicionar pacote** → **Salvar** | Preços por quantidade |
| Vender créditos | **Lançar crédito** | Credita atleta + Financeiro |

### Regras de negócio — Sessões

- Sessão criada como **Ativa**.
- **Desativar:** não aceita novas inscrições.
- **Reativar:** só se a **data da sessão ≥ hoje**. Após a data passar, **não reativa**.
- Sessão com **limite de vagas:** bloqueia inscrições quando lotada.
- Atleta **já inscrito** na mesma sessão → erro.
- Atleta deve estar **vinculado à arena**.
- Pagamento **avulso** → entrada no Financeiro (categoria **Rotativo**).
- Pagamento **crédito** → consome **1 crédito** do lote mais antigo não vencido (FIFO). Exige saldo ≥ 1.

### Regras de negócio — Créditos

- Pacotes devem estar **configurados** antes de vender créditos.
- Valor: se quantidade = pacote cadastrado, usa preço do pacote; senão, proporcional ao primeiro pacote.
- Créditos têm **validade**; vencidos são **zerados automaticamente** (movimento de vencimento).
- Venda de crédito → lote creditado + entrada no Financeiro.

---

## Programa de fidelidade

**Menu:** Programa de fidelidade · **Quem:** Dono, Gestor, Atendente

### O que você faz

| Ação | Como fazer | Efeito |
|---|---|---|
| Configurar moeda | Nome da moeda → **Salvar** | Nome dos pontos na arena |
| Enviar pontos | **Novo envio** | Saldo sobe |
| Resgatar pontos | **Novo resgate** | Saldo desce |
| Extrato / ranking | Links na tela | Histórico e top atletas |

### Regras de negócio

- Nome da moeda virtual editável por arena.
- **Envio** com validade opcional: 1 mês (+30d), 2 meses (+60d), 3 meses, 6 meses, 1 ano ou 2 anos.
- **Resgate** sem data de vencimento.
- Saldo agregado por atleta (`athlete_loyalty_balance`); aparece no perfil 360º.
- Extrato paginado (10 itens/página); ranking padrão top **5** atletas.
- Movimentos registrados com usuário que executou a ação.

---

## Financeiro

**Menu:** Financeiro · **Quem:** Dono, Gestor, Atendente

### O que você faz

| Ação | Como fazer | Efeito |
|---|---|---|
| Ver resumo | Painel + gráfico 30 dias | Somente leitura |
| Lançar manualmente | **Nova entrada** ou **Nova saída** | Registro manual |
| Editar / excluir | Ações na linha | — |

### Regras de negócio

- Lançamento manual: descrição mín. **3 caracteres**; valor mín. **R$ 0,01**; quantidade mín. **1**; desconto ≥ 0.
- Tipos: **Entrada** ou **Saída**.
- Registra quem fez o lançamento (`registered_by`).

### Entradas automáticas (não lançar à mão)

| Origem | Categoria | Condição |
|---|---|---|
| Reserva avulsa confirmada | Reserva Avulsa | valor > 0 |
| Mensalista (criação ou confirmação) | Mensalidade | sempre |
| Comanda fechada | Tipo da estação (ex.: Bar) | se houver pagamento |
| Rotativo avulso | Rotativo | inscrição |
| Venda de crédito rotativo | Rotativo | compra de créditos |

Reservas avulsas automáticas **não** duplicam no relatório de pagamentos (filtro anti-duplicação).

---

## Relatórios

**Menu:** Relatórios · **Quem:** Dono, Gestor

### Pagamentos (Status de pagamentos)

Consolida **5 fontes:** reservas, pagamentos de comanda, inscrições rotativo avulso, compras de crédito rotativo e lançamentos manuais.

**Mapeamento de status:**

| Origem | Pago | Pendente | Cancelado |
|---|---|---|---|
| Reserva confirmada | ✓ | | |
| Reserva cancelada | | | ✓ |
| Reserva pendente | | ✓ | |
| Comanda fechada | ✓ | | |
| Comanda cancelada | | | ✓ |
| Rotativo desativado | | | ✓ (inscrição) |
| Crédito rotativo | ✓ | | |

Filtros: período, espaço, esporte, tipo. Resumo: Pago / Pendente / Cancelado.

### Atletas e clientes

Segmentação de atletas vinculados (reservas **canceladas não contam**):

| Segmento | Regra |
|---|---|
| Sem reserva | 0 reservas |
| 1 reserva | exatamente 1 |
| Ativos recentes | última reserva nos **30 dias** |
| Frequentes | ≥ **5** reservas |
| Inativos | tem reservas, mas última há **> 90 dias** |
| Aniversariantes | aniversário nos próximos **7 dias** |

Atalho para WhatsApp — somente leitura, sem alterar dados.

---

## Configurações

**Menu:** Configurações · **Quem:** Dono, Gestor

### Usuários

| Ação | Regra |
|---|---|
| Cadastrar | Papel: Gestor, Atendente ou Caixa. **Caixa exige estação vinculada.** Senha obrigatória na criação. |
| Editar | Pode trocar senha e estação (Caixa). |
| Excluir | Remove vínculo com a arena; se for o **último vínculo**, apaga a conta. |

### Assinatura (Asaas)

Pagamentos processados via **Asaas** — checkout hospedado externo. Após pagamento, retorno automático para tela de status (sem item no menu).

#### Planos

| Plano | Preço | Espaços | Regras |
|---|---|---|---|
| **Experimental** | Grátis | Até 5 | **5 dias**, uso **único**; ativado automaticamente no cadastro |
| **Starter** | R$ 249/mês | Até 10 | Contrato anual, cobrança mensal |
| **Max** | R$ 549/mês | Até 20 | Contrato anual, cobrança mensal |
| **PRO** | R$ 949/mês | Até 30 | Contrato anual, cobrança mensal |
| **Parceiro** | R$ 249/mês | Ilimitados | Atribuído manualmente; exige cartão para liberar recursos |

> Planos pagos: contrato de **365 dias**, cobrança **mensal** recorrente via Asaas.

#### Fluxo de assinatura

1. Dono/Gestor escolhe plano em **Configurações → Assinatura**.
2. Sistema redireciona para **checkout Asaas** (cadastro de cartão/pagamento).
3. Retorno automático com status (sucesso, cancelado ou expirado).
4. Webhooks do Asaas sincronizam status, plano e histórico de cobranças.

#### Regras de negócio

- **CPF/CNPJ da arena obrigatório** para cobrança no Asaas.
- Assinatura **utilizável:** status ativo e período não expirado.
- **Experimental expirado:** redirecionamento forçado para Assinatura.
- **Experimental:** não pode reassinar depois de usado ou migrado para plano pago.
- **Trocar plano:** upgrade/downgrade na mesma assinatura.
- **Cancelar renovação:** acesso continua até fim do período pago (`cancel_at_period_end`).
- **Reativar:** remove cancelamento programado antes do vencimento.
- **Criar espaço:** bloqueado sem assinatura ativa ou acima do limite do plano.
- Histórico de pagamentos disponível na aba **Histórico** da tela de Assinatura.

### Perfil da Arena

| Ação | Regra |
|---|---|
| Editar dados | Nome, endereço, comodidades, esportes, telefone, e-mail. Endereço → mapa. |
| Busca por CNPJ | Preenche razão social e dados cadastrais (Receita Federal). |
| Imagem | Upload no formulário. |
| Pré-reservas pelo aplicativo | Ativa ou desativa novas solicitações; a fila existente continua acessível. |
| Excluir arena | Permanente — remove arena e quadras associadas. |

---

## Como os módulos se conectam

```
Atleta ──┬── Reserva (Espaços) ──────────► Financeiro
         ├── Pré-reserva do App ─────────► Reserva após aprovação
         ├── Mensalista ─────────────────► Reservas + Financeiro
         ├── Comanda (Estação) ──────────► Financeiro + Estoque
         ├── Rotativo ───────────────────► Financeiro (ou crédito)
         └── Fidelidade ─────────────────► Saldo no perfil do atleta

Catálogo ──► Produtos nas comandas (baixa estoque)
          └► Serviços nas reservas e comandas

Assinatura (Asaas) ──► Limite de espaços + acesso ao sistema

Tudo acima ──► Dashboard e Relatórios (leitura consolidada)
```

| Origem | Destino automático |
|---|---|
| Reserva confirmada com valor | Financeiro (Entradas) |
| Plano mensalista criado | 3 meses de reservas + Financeiro |
| Mensalidade confirmada | Financeiro + próximo mês de reservas |
| Comanda fechada | Financeiro |
| Comanda cancelada | Estoque devolvido |
| Rotativo avulso / crédito vendido | Financeiro |
| Fidelidade (envio/resgate) | Saldo do atleta |
| Novo espaço | Verifica assinatura + limite do plano |
| Trial expirado | Bloqueio → Assinatura |

**Resumo:** Espaços, Estações, Rotativo e Mensalistas geram receita. Financeiro acumula tudo. Dashboard e Relatórios mostram o resultado. Catálogo abastece comandas. Atletas circulam por todos os módulos. Configurações controlam equipe, arena e plano (via Asaas).
