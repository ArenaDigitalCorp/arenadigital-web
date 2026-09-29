# Plano — Rateio na reserva avulsa

- **Status:** implementado e validado localmente (28/09/2026) — `feature/rateio-reserva-avulsa` em `arenadigital-db`, `feat/rateio-reserva-avulsa` em `arenadigital-web`. Documentação viva: PRD §5.19, SPEC §40.
- **Ordem de deploy:** `arenadigital-db` → `arenadigital-web` (o banco novo continua atendendo o web antigo).

## 1. Objetivo

Permitir que uma reserva avulsa tenha o valor dividido entre várias pessoas (rateio), no mesmo
molde do rateio de mensalista: cada pessoa tem sua cobrança, com devido/pago/restante,
pagamentos parciais, e pode ser atleta cadastrado **ou pessoa sem cadastro** (só nome). A
gestão posterior acontece em **Gestão Reservas → Avulsos**.

## 2. Situação atual (o que muda)

- A reserva avulsa tem o toggle **"Cobrança separada por participante"**: o valor digitado vira
  **valor por pessoa**, gravado igual para todos em `booking_participants.valor`
  (`p_participant_value` único). Não aceita serviços; exige atleta cadastrado.
- Pagamento por pessoa via `confirm_backoffice_participant_payment` — integral, lança
  `transactions` com `source_type = 'booking_participant'`, `source_id = participant.id`;
  quando todos pagam, a reserva vira `confirmed`.
- `booking_participants` é a tabela **social** da reserva (app "meus jogos", notificações de
  cancelamento, `UNIQUE (booking_id, atleta_id)`, `atleta_id NOT NULL`). Não comporta pessoa
  sem cadastro.

## 3. Regras de produto

| Tema | Regra |
|---|---|
| Nome | Toggle passa a se chamar **Rateio** (substitui "Cobrança separada por participante"). |
| Valor da locação | Campo volta a ser o **total da locação**. |
| Divisão | **Livre**: cada pessoa tem seu valor. Divisão igual é só a sugestão inicial; a soma não precisa fechar com a locação — a tela mostra a diferença como aviso. |
| Pessoas | Atleta cadastrado **ou** pessoa sem cadastro (nome). O responsável é o dono da reserva — pode inclusive ser uma reserva feita em nome de quem não tem cadastro. |
| Serviços | Permitidos com rateio; somam na cobrança do **responsável** (só a locação é rateada). |
| Quando | No cadastro da reserva (calendário) **e depois**, em Gestão Reservas → Avulsos. |
| Pagamento | **Parcial** por pessoa (devido / pago / restante; status Pendente/Parcial/Pago). |
| Confirmação | Reserva vira `confirmed` quando todas as cobranças ativas estão quitadas. |
| Remover pendente | Remove a pessoa do rateio. |
| Remover quem pagou | Permitido com **estorno**: apaga os pagamentos e as entradas no Financeiro (mesma convenção de `remove_mensalista_rateio_participante_atomic`), após confirmação mostrando o valor. Bloqueado com a reserva já `confirmed`. |
| Desligar rateio | Só enquanto ninguém pagou nada; colapsa para cobrança única do responsável. |
| Fora do escopo | Crédito manual (mensalista_creditos) no avulso; rateio em reserva multi-bloco; reserva `confirmed`/cancelada não é editável no rateio. |

## 4. Banco (`arenadigital-db`)

### 4.1 Tabelas

```
public.booking_cobrancas
  id uuid PK
  arena_id uuid NOT NULL → arenas
  booking_id uuid NOT NULL → bookings ON DELETE CASCADE
  atleta_id uuid NULL → atleta ON DELETE SET NULL   -- NULL = pessoa sem cadastro
  nome text NOT NULL                                 -- snapshot do nome exibido
  responsavel boolean NOT NULL DEFAULT false         -- 1 por reserva (índice parcial único)
  valor_devido numeric(10,2) NOT NULL CHECK (>= 0)   -- parte da locação (+ serviços no responsável)
  valor_pago numeric(10,2) NOT NULL DEFAULT 0 CHECK (>= 0)
  status text  ('aberto','parcial','quitado')        -- derivado de devido x pago
  created_at, updated_at
  UNIQUE (booking_id, atleta_id) WHERE atleta_id IS NOT NULL

public.booking_cobranca_pagamentos
  id uuid PK, arena_id, cobranca_id → booking_cobrancas ON DELETE CASCADE,
  valor numeric(10,2) CHECK (> 0), data_pagamento date, modo_pagamento_id,
  observacao, registered_by → users, transaction_id → transactions ON DELETE SET NULL,
  created_at
```

RLS/ACL no padrão de `mensalista_cobrancas`/`mensalista_pagamentos` (leitura escopada à arena;
escrita só via RPC `SECURITY DEFINER` + `service_role`).

`booking_participants` continua sendo a fonte social: atleta cadastrado no rateio também tem
linha lá (como hoje); pessoa sem cadastro fica **só** em `booking_cobrancas`.
`booking_participants.valor/pago_em` deixam de ser escritos pelo fluxo novo.

### 4.2 Backfill (reservas legadas com `cobranca_por_participante = true`)

Para cada participante `responsavel`/`convidado`: cria `booking_cobrancas` (`valor_devido = valor`,
`valor_pago = valor se pago_em`) e, se pago, um `booking_cobranca_pagamentos` com
`transaction_id` apontando para a transação legada (`source_type = 'booking_participant'`,
`source_id = participant.id`) — assim a exclusão com estorno também apaga o lançamento antigo.
`bookings.price` das legadas **não** é normalizado agora: o modal de edição do web anterior lê
`price` como valor por pessoa. A normalização vai para a migração de limpeza (§4.5).

### 4.3 RPCs

- `save_backoffice_booking_bundle_atomic` — novo parâmetro `p_rateio jsonb`
  (`[{atleta_id?, nome, valor}]`) no lugar de `p_participant_value`; grava/atualiza
  `booking_cobrancas` preservando quem já pagou; aceita serviços com rateio (somados no
  responsável); `bookings.price = soma das partes + serviços`, `rental_price = locação`.
- `booking_rateio_add_atomic(p_arena_id, p_booking_id, p_atleta_id?, p_nome, p_valor, p_registered_by)`
  — adiciona pessoa (e linha em `booking_participants` se cadastrada).
- `booking_rateio_update_valor_atomic(...)` — altera valor devido (não abaixo do já pago).
- `booking_rateio_remove_atomic(...)` — remove com estorno (apaga pagamentos + transações).
- `booking_rateio_toggle_atomic(...)` — ativa (cria cobrança do responsável = total) / desativa
  (só sem pagamentos).
- `register_booking_cobranca_payment_atomic(p_arena_id, p_cobranca_id, p_valor, p_modo_pagamento_id, p_data, p_observacao, p_registered_by, p_operation_id)`
  — pagamento parcial idempotente; lança `transactions` (`source_type = 'booking_cobranca_pagamento'`);
  recalcula status; confirma a reserva quando todas quitadas.
- Todas: lock da reserva `FOR UPDATE`, reserva avulsa (`plano_mensalista_id IS NULL`),
  status `reservado`, vínculo do atleta com a arena.

### 4.4 Compatibilidade na transição (DB novo + web antigo)

- `confirm_backoffice_participant_payment` (mesma assinatura) passa a registrar o pagamento
  integral na `booking_cobrancas` de mesmo id (via `register_booking_cobranca_payment_atomic`).
- `save_backoffice_booking_bundle_atomic` mantém a assinatura antiga (com `p_participant_value`)
  traduzindo para `p_rateio` com valor igual para todos.
- Remoção das assinaturas antigas numa migração posterior, depois do web em produção.
- `bookings.price` numa reserva com rateio: o web novo **não** usa — lê os totais de
  `booking_cobrancas` (reservas legadas ainda guardam o valor por pessoa até a limpeza).

### 4.5 Migrações (implementadas)

| Arquivo | Conteúdo |
|---|---|
| `20260928140000_booking_rateio_schema` | tabelas, índices, RLS/ACL, backfill |
| `20260928140100_booking_rateio_helpers` | `private.booking_rateio_lock_booking`, `private.booking_rateio_sync` (pago_em, espelho em `booking_participants`, total, confirmação) |
| `20260928140200_booking_rateio_rpcs` | `configure_booking_rateio_atomic`, `add_booking_rateio_participante_atomic`, `update_booking_rateio_valores_atomic` (`[{cobranca_id, valor}]`, valor = parte da locação), `remove_booking_rateio_participante_atomic`, `register_booking_cobranca_payment_atomic` |
| `20260928140300_booking_rateio_bundle_lines` | `private.apply_backoffice_booking_bundle_lines` com `p_rateio` + caminho legado |
| `20260928140400_booking_rateio_bundle_atomic` | `save_backoffice_booking_bundle_atomic(..., p_rateio jsonb DEFAULT NULL)` |
| `20260928140500_booking_rateio_participant_payment_compat` | `confirm_backoffice_participant_payment` grava na cobrança |
| `20260928140600_booking_rateio_acl` | grants `service_role` |

**Limpeza (depois do web novo em produção):** normalizar `bookings.price` das legadas para a soma
das partes, remover o caminho `p_participant_value` e parar de espelhar em `booking_participants`.

## 5. Web (`arenadigital-web`)

### 5.1 Cadastro da reserva — `BookingModal`
- Toggle **Rateio**; lista de pessoas (responsável + participantes) com valor editável;
  adicionar **atleta** (`BookingParticipantsField`) ou **pessoa sem cadastro** (nome).
- Sugestão de divisão igual (centavos no responsável), recalculada enquanto o gestor não
  editou; aviso "Soma das partes R$ X · locação R$ Y" quando difere.
- Serviços liberados com rateio; linha do responsável mostra "parte + serviços".

### 5.2 Gestão Reservas → Avulsos — `AvulsasPageClient`
- Lista agrupada por reserva: reserva com rateio vira uma linha
  "Rateio · 3/5 pagos · R$ pago de R$ total", expansível com as pessoas (status, devido, pago,
  restante). Busca casa atleta cadastrado **e** nome sem cadastro.
- Modal **Gerenciar rateio** (molde do `RateioModal` do mensalista): adicionar atleta/pessoa,
  editar valor, remover (com estorno e confirmação), registrar pagamento (parcial), ativar /
  desativar rateio em avulsa pendente.
- Cards "pendente / recebido" passam a somar restante/pago das cobranças.
- `getAvulsosTodosAction` passa a ler `booking_cobrancas`.

### 5.3 Calendário — `BookingDetailsModal`
- Resumo somente leitura do rateio (pessoas, pago/restante) + link **Gerenciar em Avulsos**.
- Rótulo do calendário (`booking-participants.ts`) inclui pessoas sem cadastro após os
  cadastrados, responsável sempre primeiro.

### 5.4 Relatórios / Financeiro
- `reportActions` (Pagamentos Reservas, "quanto o atleta deve de Avulso", filtro de atleta)
  lê `booking_cobrancas` (restante = devido − pago); sem cadastro aparece pelo nome.
- Transações novas: `source_type = 'booking_cobranca_pagamento'` com categoria "Reserva Avulsa".

## 6. Testes
- DB: testes das RPCs (parcial, quitação confirma reserva, remoção com estorno, bloqueios,
  backfill preservando vínculo com transações, compat das assinaturas antigas).
- Web: `tests/*.test.mjs` para sugestão de divisão, agrupamento da lista de Avulsos, cálculo de
  totais/relatórios; typecheck, lint, build; verificação no navegador (loading, vazio, erro,
  permissão, mobile).

## 7. Etapas
1. DB: tabelas + RLS + backfill + RPCs + compat (migração em `arenadigital-db`).
2. Web: tipos/actions → Avulsos (lista + Gerenciar rateio) → BookingModal → BookingDetailsModal
   → relatórios.
3. PRD/SPEC, testes, validação local; PR db → `main`, PR web → `main`; promoção
   `main → homolog → production` (db antes do web).
