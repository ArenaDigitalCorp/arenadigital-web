# Plano — Ajuste das mensalidades do mês em lote (Mensalistas)

> Status: **implementado** (04/10/2026), branches `feat/mensalistas` (web) / `feature/mensalistas` (db), ainda não promovido. Decisões da §10 tomadas pelas recomendações: só o mês; contrato ÷ jogos do contrato; rateio ajusta o total do grupo; parcial só acima do já pago; gestor e atendente; arredondamento padrão em centavos.
> Repositórios: `arenadigital-db` (contagem de jogos, prévia e aplicação em lote) e `arenadigital-web` (botão, modal, actions). Especificação técnica final em `SPEC-Web-Gestor.md` §44.
> Fora da entrega: a refatoração opcional da §5.4 (miolo compartilhado com o reajuste individual) e as evoluções da §11.

## 1. Objetivo

Todo mês, algumas recorrências passam a ter **mais ou menos jogos** que no mês anterior. Uma recorrência de quarta tem 4 jogos em novembro/2026 e 5 em dezembro/2026; uma de sexta tem 5 em outubro/2026 e 4 em novembro/2026. Muitas arenas cobram por jogo, então a mensalidade daquele mês deveria subir ou descer. A decisão é sempre do gestor.

Hoje o ajuste só existe **por recorrência**, dentro do detalhe de cada mensalista (botão "Reajustar valor"). Numa arena com dezenas de mensalistas, isso vira um trabalho de horas, repetido todo mês.

O objetivo é uma **ação geral na tela inicial de Mensalistas** que:

1. mostre, para o mês escolhido, **todas as recorrências que merecem análise**, com os **jogos do mês anterior e do mês atual** e o **valor sugerido**;
2. deixe o gestor **aceitar, editar ou descartar** cada sugestão rapidamente;
3. aplique tudo de uma vez, **só o que o gestor confirmar**, com histórico e sem risco de ser aplicado duas vezes.

## 2. Situação atual

| Ponto | Como é hoje | Consequência |
|---|---|---|
| **Plano legado** (uma faixa só: dia + horário) — a maioria | `valor_total` da mensalidade = `valor_mensal` **fixo todo mês**, tenha o mês 4 ou 5 jogos. Só a estreia é proporcional (`sessoes_por_mes` como base). | **É o público desta ação.** O valor não acompanha a quantidade de jogos. |
| **Plano por blocos** (`recorrencia_por_blocos = true`, professor) | Já cobra **proporcional aos minutos do mês** (`private.mensalista_valor_competencia`): 5 quintas custam mais que 4, automaticamente. | Não precisa de ajuste manual. Fica fora da edição (ver §4.2). |
| **Reajuste individual** (`reajustar_plano_mensalista_atomic`) | Três escopos ancorados no mês visualizado: `somente_mes` (só a cobrança daquele mês, sem mudar o plano), `mes_atual` e `mes_seguinte` (mudam `valor_mensal` dali em diante). **Pula** mensalidades com rateio ou com qualquer pagamento. | O escopo `somente_mes` já é exatamente o ajuste "este mês tem 5 jogos". Falta fazê-lo **em lote**. |
| **Geração das mensalidades** | Preguiçosa: `generate_mensalista_mensalidades_atomic` cria as do mês quando alguém abre a competência (visão geral/detalhe) ou reajusta. | A prévia precisa funcionar para um mês ainda **não gerado** (ex.: o gestor prepara dezembro no fim de novembro). |
| **Contagem de jogos** | Só existe em minutos (`private.mensalista_month_minutes`) para blocos, ou "ocorrências até o fim do mês" para a estreia. Não considera pausas. | Precisamos de **uma** função de contagem de jogos do mês, no banco, com as mesmas regras que geram as reservas. |

## 3. Conceitos e regras

### 3.1 Jogos do mês (ocorrências)

Para um plano e uma competência, contamos as datas em que os blocos do plano caem no mês (`private.mensalista_plan_blocks`, que também cobre o plano legado):

- a partir de `max(data_inicio, 1º dia do mês)`;
- até `min(data_encerramento_efetiva/prevista, último dia do mês)`;
- separando as datas que caem numa **pausa ativa** (`planos_mensalista_pausas`).

Resultado por plano e mês: `ocorrencias` (calendário), `em_pausa` e `liquidas = ocorrencias − em_pausa`. É a mesma regra que `_insert_monthly_plan_month_bookings` usa para criar as reservas, então "5 jogos" na tela significa 5 reservas na agenda.

Um jogo avulso cancelado com crédito **não** reduz a contagem: ele já é compensado pelo crédito de mensalista.

### 3.2 Valor por jogo (base da sugestão)

`valor_por_jogo = valor_mensal ÷ sessoes_por_mes`: o preço contratado por jogo. Por exemplo, R$ 400 por 4 jogos dá R$ 100 por jogo. É a mesma base que o banco já usa no pró-rata da estreia.

### 3.3 Valor sugerido

`sugerido = arredondar(valor_por_jogo × jogos_liquidos_do_mês, 2)`.

| Recorrência | Plano | Mês | Jogos (mês anterior → mês) | Valor hoje | Sugerido |
|---|---|---|---|---|---|
| Caco · Quadra 04 · Qua 20h | R$ 400 / 4 jogos | dez/2026 | 4 → **5** | R$ 400,00 | **R$ 500,00** (+R$ 100) |
| Caco · Quadra 04 · Sex 20h | R$ 500 / 4 jogos | nov/2026 | 5 → **4** | R$ 500,00 | R$ 500,00 (sem diferença) |
| Ana · Quadra 02 · Sex 19h | R$ 500 / 4 jogos | out/2026 | 4 → **5** | R$ 500,00 | **R$ 625,00** (+R$ 125) |

Na linha da sexta de novembro, a sugestão bate com o valor de hoje: o mês volta a ter os 4 jogos do contrato. Se outubro tinha sido ajustado para R$ 625, novembro já nasce com R$ 500, porque o ajuste "só deste mês" não muda o plano. É a regra certa.

### 3.4 Quem aparece na lista

Recorrências **ativas** da arena (`status = 'ativo'`), **legadas**, com cobrança na competência escolhida (gerada ou a gerar).

- **"Precisam de análise"** (filtro padrão): `|sugerido − valor_atual| ≥ R$ 0,01`.
- **"Todas"**: mostra também as que já estão certas, para conferência.
- Cada linha mostra **jogos mês anterior → mês** com uma seta (sobe ou desce), mesmo quando o valor não muda.

### 3.5 Estados especiais de cada linha

| Situação | Comportamento | Selecionada por padrão |
|---|---|---|
| Mensalidade **quitada** | Não editável ("Já quitada"). Ajustar exigiria reabrir o mês, que já confirmou reservas e rolou a agenda. | — |
| **Pagamento parcial** | Editável só se o novo valor for **maior** que o já pago. Fica "Parcial" com o que falta recalculado. Quitar continua sendo pelo pagamento. | Não |
| **Rateio** | Ajusta o **total do grupo** (`valor_total`). As partes já pagas ficam congeladas e o "Falta" é recalculado. Selo "Rateio". | Não |
| **Pausa** no mês | Sugestão usa os jogos líquidos. Selo "Pausa" e aviso de que o valor pode já ter sido ajustado pela pausa. | Não |
| **Estreia** no mês (`data_inicio` no mês) | Já é proporcional. Selo "Estreia". Normalmente sem diferença. | Não |
| **Encerra** no mês | Jogos contados até o encerramento. Selo "Encerra". | Não |
| Plano **por blocos** | Fora da tabela editável. Resumo informativo: "N recorrências por blocos já são calculadas automaticamente". | — |
| Valor da mensalidade **mudou** entre abrir e aplicar | Linha ignorada no resultado ("Alterada por outra pessoa — revise"). | — |

As linhas comuns (sem selo) com diferença vêm **selecionadas**. As com selo vêm desmarcadas, para o gestor olhar uma a uma.

### 3.6 Escopo do ajuste

O ajuste em lote vale **somente para o mês escolhido** (escopo `somente_mes`): muda a cobrança daquele mês e **não altera o valor do plano**. No mês seguinte, a mensalidade volta a nascer pelo `valor_mensal`, e a tela mostra de novo o que diverge. Mudança permanente de preço continua sendo o "Reajustar valor" por recorrência.

## 4. Experiência do gestor

### 4.1 Entrada

Na tela inicial de Mensalistas, ao lado do seletor de mês, entra o botão **"Ajustar mensalidades do mês"**. Ele mostra um contador quando há recorrências para analisar no mês exibido (por exemplo, `Ajustar mensalidades · 12`). O contador vem da mesma prévia, então o gestor percebe na virada do mês que há trabalho a fazer.

### 4.2 Modal (tela larga; em celular vira lista de cartões)

```
┌ Ajustar mensalidades ───────────────────────────── ‹ Dezembro 2026 › ─┐
│ 38 recorrências · 12 com mudança de jogos · 9 precisam de análise     │
│ Impacto dos selecionados: +R$ 1.150,00 no mês                          │
│ [Precisam de análise ▾]  [Buscar mensalista…]  [Arredondar: centavos ▾]│
├───┬──────────────────┬──────────────────────┬────────┬──────────┬──────────┬─────────┬──────────┤
│ ☑ │ Mensalista       │ Recorrência          │ Jogos  │ Mês ant. │ Hoje     │ Novo    │ Dif.     │
├───┼──────────────────┼──────────────────────┼────────┼──────────┼──────────┼─────────┼──────────┤
│ ☑ │ Caco Barcelos    │ Quadra 04 · Qua 20h  │ 4 → 5▲ │ R$ 400   │ R$ 400   │ [500,00]│ +R$ 100  │
│ ☐ │ Bia Souza  Rateio│ Quadra 01 · Qua 19h  │ 4 → 5▲ │ R$ 600   │ R$ 600   │ [750,00]│ +R$ 150  │
│ ─ │ Davi Lima Quitada│ Quadra 03 · Qua 18h  │ 4 → 5▲ │ R$ 320   │ R$ 320   │   —     │   —      │
├───┴──────────────────┴──────────────────────┴────────┴──────────┴──────────┴─────────┴──────────┤
│ R$ por jogo: R$ 100,00 (R$ 400 ÷ 4) — aparece na linha, ao passar o mouse                │
│ ℹ 6 recorrências por blocos já são calculadas automaticamente                            │
│ Observação (opcional): [Dezembro com 5 quartas                                   ]        │
│                       [Cancelar]   [Revisar 8 ajustes (+R$ 1.150,00)]                    │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Edição rápida:** o campo "Novo" vem com a sugestão. Editar marca a linha e mostra "editado" (com "voltar à sugestão"). O teclado avança de linha em linha (Enter/Tab).
- **Ações em massa:** selecionar tudo / nenhum, "Aplicar sugestão aos selecionados" e arredondamento das sugestões (centavos, R$ 1, R$ 5).
- **Navegação de mês** dentro do modal, para preparar o mês seguinte antes da virada.
- **Confirmação:** um passo de revisão com a lista do que muda (de → para), total de impacto e quantos ficam de fora.
- **Resultado:** "8 ajustados · 1 ignorado (alterado por outra pessoa)", com o motivo por linha e o link para o mensalista.
- **Estados:** carregando (esqueleto da tabela); vazio ("Nenhuma recorrência precisa de ajuste em dezembro — todos os valores batem com os jogos do mês"); erro (mensagem + tentar de novo); sem permissão (botão não aparece).

### 4.3 Depois de aplicar

A visão geral e o detalhe recarregam, e o "Histórico de reajustes" da recorrência mostra "Ajuste do mês · dez/2026 · 4 → 5 jogos · R$ 400 → R$ 500 · em lote". Relatórios e Financeiro já leem `valor_total` da mensalidade, então refletem o ajuste sem mudança.

## 5. Banco (`arenadigital-db`)

### 5.1 Contagem de jogos — `private.mensalista_ocorrencias_competencia(p_plano_id, p_competencia)`

Retorna `(ocorrencias int, em_pausa int, liquidas int, estreia bool, encerra bool)` aplicando §3.1. É STABLE, SECURITY DEFINER, `search_path = ''` e sem EXECUTE público. Fica como fonte única: a prévia usa, e futuramente o gerador de reservas e o pró-rata podem convergir para ela.

### 5.2 Prévia — `public.mensalista_reajuste_mes_preview(p_arena_id, p_competencia) → jsonb`

**Só leitura** (não materializa nada) e só para `service_role`. Uma linha por recorrência ativa da arena:

- identificação: `plano_id`, responsável (`athlete_id`, nome), dia/horário/quadra, `por_blocos`;
- contrato: `valor_mensal`, `sessoes_por_mes`, `valor_por_jogo`;
- mês anterior: jogos líquidos e `valor_total` cobrado (se houver mensalidade);
- mês alvo: jogos (`ocorrencias`, `em_pausa`, `liquidas`) e mensalidade (`id`, `valor_total`, `status`, `rateio`, `pago`). Sem mensalidade gerada, o `valor_atual` é o que seria gerado (`valor_mensal`);
- `sugerido`, `diferenca`, e os flags `estreia`, `encerra`, `pausa`, `quitada`, `parcial`.

A regra de quem entra e dos selos fica no banco. O web só formata.

### 5.3 Aplicação em lote — `public.reajustar_mensalidades_mes_lote_atomic(...)`

Parâmetros: `p_operation_id, p_arena_id, p_competencia, p_itens jsonb, p_observacao, p_registered_by`. Cada item é `{ plano_id, novo_valor, valor_esperado }`, com até 500 itens.

1. **Idempotência:** o lote é uma linha nova em `mensalista_reajustes_lote` com `id = p_operation_id`. Repetir o mesmo id devolve o resultado gravado sem reaplicar.
2. **Trava:** advisory lock por `arena + competência`, então dois gestores aplicando ao mesmo tempo serializam.
3. **Materializa** a competência (`generate_mensalista_mensalidades_atomic`), como o reajuste individual já faz.
4. Para cada item, `FOR UPDATE` no plano e na mensalidade, e **valida**:
   - plano da arena e `ativo`;
   - mensalidade não quitada nem cancelada;
   - **concorrência otimista:** `valor_total` atual = `valor_esperado`; senão o item é ignorado ("alterada");
   - se houver pagamento parcial: `novo_valor >` já pago;
   - `0 ≤ novo_valor ≤ 100.000.000`.
5. **Aplica** como o escopo `somente_mes`:
   - atualiza `valor_total`;
   - sem rateio, atualiza também o `valor_devido` da cobrança ativa;
   - com rateio, só o total muda (as partes são incrementais, §5.12 do PRD);
   - recalcula `status` entre `aberto` e `parcial`.
6. **Audita** cada item aplicado em `planos_mensalista_reajustes` com `escopo = 'somente_mes'`, `lote_id` e o retrato `ocorrencias_anterior`, `ocorrencias_competencia` e `valor_sugerido`.
7. **Retorna** o resumo (`aplicados`, `ignorados`, `impacto`) e o resultado por item (`ok` | `quitada` | `alterada` | `abaixo_do_pago` | `inativo`).

Itens inválidos **não** derrubam o lote: são ignorados com motivo. Erros de contrato (arena errada, payload malformado) derrubam tudo.

### 5.4 Esquema

- **Tabela nova `mensalista_reajustes_lote`:**
  - colunas `id`, `arena_id`, `competencia`, `observacao`, `total_itens`, `aplicados`, `ignorados`, `impacto numeric(12,2)`, `resultado jsonb`, `registered_by`, `created_at`;
  - RLS de leitura via `can_access_arena_backoffice`, e escrita só pela RPC.
- **`planos_mensalista_reajustes`** ganha:
  - `lote_id uuid NULL` (FK, `ON DELETE SET NULL`);
  - `ocorrencias_anterior smallint NULL`;
  - `ocorrencias_competencia smallint NULL`;
  - `valor_sugerido numeric(10,2) NULL`.

  São colunas aditivas: o reajuste individual continua gravando sem elas.
- **Refatoração recomendada:** extrair o miolo "ajustar uma competência" para `private.mensalista_ajustar_valor_competencia(...)`, usado pelo lote e, num passo seguinte, pelo reajuste individual (`somente_mes`). Assim as duas regras não se separam com o tempo.
- ACL e contrato:
  - RPCs `SECURITY DEFINER`, `search_path = ''`, EXECUTE só para `service_role`, no padrão das demais;
  - `schema-contracts` ganha a tabela nova.

## 6. Web (`arenadigital-web`)

- **Tipos:** `ReajusteMesLinha` e `ReajusteMesPreview` em `mensalista.types.ts`. Hand-patch de `supabase.types.ts` para a tabela nova, as colunas e as duas RPCs (regerar no fim).
- **Schemas:** `reajusteMesLoteSchema`, com `operationId`, `competencia` (`YYYY-MM`), `itens[]` (uuid, valor ≥ 0, `valorEsperado`; de 1 a 500) e `observacao`.
- **Actions** (`mensalistaActions.ts`, `assertArenaBackofficeAccess`):
  - `getReajusteMesPreviewAction(arenaId, competencia)`;
  - `aplicarReajusteMesLoteAction(input)`, que gera o `operationId` no cliente para o reenvio ser idempotente. Ao final, `revalidateMensalistaPaths`.
- **Módulo puro** `reajuste-mes.ts`: arredondamento, impacto total, "precisa de análise", seleção padrão (§3.5) e validação da linha (ex.: abaixo do pago). Fica testável com `node --test`.
- **Componentes:**
  - `AjustarMensalidadesMesModal.tsx`: tabela/cartões, filtros, edição, revisão e resultado;
  - botão com contador no `MensalistasOverviewClient`;
  - selo "em lote" no histórico de reajustes do `MensalistaDetailClient`.
- **Desempenho:** a prévia é uma chamada só. O contador do botão usa a mesma prévia, carregada sob demanda ou junto da visão geral, a decidir pela medição em homolog.

## 7. Casos de borda

- **Mês sem nenhum jogo** (pausa no mês inteiro): `liquidas = 0`. Sugestão R$ 0, só com o selo "Pausa" e desmarcada. A pausa "sem cobrança" já zera.
- **`sessoes_por_mes = 0` ou nulo:** sem base. A linha aparece sem sugestão, e o gestor digita o valor.
- **Plano que mudou de valor no meio** (`mes_atual`/`mes_seguinte`): a base é sempre o `valor_mensal` atual.
- **Ajuste já feito no mês** (individual ou outro lote): `valor_atual` já reflete. Se bater com a sugestão, a linha some do filtro padrão.
- **Mensalidade gerada depois de abrir a prévia:** o lote materializa antes de aplicar. `valor_esperado` = `valor_mensal`, que é o que nasceu.
- **Fuso:** competência e datas em `America/Sao_Paulo`, como no restante do módulo.
- **Volume:** 500 itens por chamada. Arenas maiores enviam em partes, cada uma com o próprio `operationId`.

## 8. Testes

- **pgTAP:**
  - contagem (meses de 4 e 5 ocorrências, estreia, encerramento, pausa parcial e total, blocos);
  - prévia (flags e sugestão);
  - lote: aplica, idempotência, `valor_esperado` divergente, quitada, parcial abaixo do pago, rateio só no total, status recalculado, auditoria com `lote_id`, plano intocado.
- **Estáticos (`node --test`) nos dois repositórios:** ACL, `SECURITY DEFINER`, `search_path`, sem sobrecarga ambígua.
- **Web:** módulo puro `reajuste-mes.ts`, schema e action repassando `valor_esperado`.
- **Navegador (homolog):** loading, vazio, erro, permissão, celular, edição por teclado, revisão e resultado com itens ignorados.
- **Aceite com dados reais:** escolher uma arena de homolog, abrir dezembro/2026 (5 quartas) e conferir 4 → 5 e +R$ por jogo nas recorrências de quarta.

## 9. Etapas

| Fase | Entrega | Repositório |
|---|---|---|
| 1 | `mensalista_ocorrencias_competencia` + prévia + pgTAP | db |
| 2 | Tabela de lote, colunas de auditoria, RPC de lote, refatoração do miolo + pgTAP | db |
| 3 | Tipos, schema, actions, módulo puro + testes | web |
| 4 | Modal (prévia → edição → revisão → resultado), botão com contador, selo no histórico | web |
| 5 | PRD/SPEC, validação em homolog com dados reais, ordem de deploy **DB → web** | ambos |

As fases 1 e 2 são aditivas: não mudam nada do que já roda. A ordem de deploy é banco primeiro, como de costume.

## 10. Decisões para o gestor/produto

Cada item traz a recomendação.

1. **Escopo:** o lote ajusta **só o mês** (recomendado), ou também oferece "aplicar como novo valor do plano"?
2. **Base do valor por jogo:** **valor do contrato ÷ jogos do contrato** (recomendado), ou o preço da **tabela de preço** do espaço × duração?
3. **Rateio:** ajustar o **total do grupo** (recomendado), ou deixar o rateio fora do lote?
4. **Pagamento parcial:** permitir quando o novo valor fica **acima do já pago** (recomendado), ou bloquear como o reajuste individual faz hoje?
5. **Quem pode aplicar:** gestor e atendente (o mesmo do reajuste individual), ou só gestor?
6. **Arredondamento padrão** das sugestões: centavos (recomendado), R$ 1 ou R$ 5?

## 11. Evoluções futuras

- **Avisar os mensalistas** pelo template de mensagem (WhatsApp) com o novo valor e o motivo ("dezembro tem 5 jogos").
- **Desfazer um lote** (itens ainda sem pagamento), usando `mensalista_reajustes_lote`.
- **Histórico de lotes** com quem aplicou, quando e o impacto.
- **Cobrança por jogo automática** para planos legados (como os por blocos já fazem), por arena ou por plano, para quem não quer revisar todo mês.
