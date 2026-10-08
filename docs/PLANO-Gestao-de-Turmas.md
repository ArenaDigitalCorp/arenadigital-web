# Plano — Gestão de Turmas

> Status: **integrado ao banco** (08/10/2026). Migrações aplicadas em homologação. A tela lê e grava pelo banco, sem dados fictícios, com testes unitários, ponta a ponta (server actions em homologação) e de navegador (login real). Branches: `feat/gestao-turmas` (web) e `feature/gestao-turmas` (db).
> Rota: `/dashboard/turmas/[arenaId]`, no menu **Turmas**, logo abaixo de Atletas.
> Os dados são fictícios e ficam em memória. Recarregar a página restaura os exemplos.

## 1. Objetivo

Dar à arena uma tela para gerir **turmas de aula**: quem é o professor, qual esporte e quais níveis, em que horário recorrente acontece, quantas vagas tem e quais alunos fazem parte, com o histórico de entradas e saídas. E uma visão dos **professores**: quantas turmas e alunos cada um tem.

## 2. Fases

1. **Protótipo**: tela completa no sistema, com dados fictícios. Feito.
2. **Refinamento**: decisões da §5 aplicadas. Restam as perguntas da §6.
3. **Modelo de dados** em `arenadigital-db`: tabelas, RLS, RPCs e testes, gerados a partir da tela aprovada. Feito (§7).
4. **Integração**: trocar os dados fictícios por server actions, mantendo os componentes. Feito (§10).

## 3. O que o protótipo cobre

### 3.1 Aba Turmas

- **Grid**, com todas as colunas ordenáveis:
  - Código, Professor, Esporte, Níveis e Criada em;
  - Horários, com o espaço, a origem ("Recorrência vinculada" ou "Recorrência criada pela turma") e "parte do bloco" quando a turma usa só um trecho;
  - **Alunos / vagas**: "3 / 4", ou só "3" quando a turma não tem limite. A turma cheia mostra o selo **Lotada**.
- **Filtros**:
  - busca por código ou professor;
  - esporte e professor;
  - **Mostrar encerradas**, desligado por padrão.
- **Ações por linha**:
  - turma ativa: Alunos, Editar e **Encerrar**;
  - turma encerrada: só o histórico de alunos.
- **Nova turma / Editar turma** (modal largo):
  - **Código**: gerado pelo sistema assim que o esporte é escolhido, no padrão `SIGLA-000` (ex.: TEN-002). **Não pode ser alterado.**
    - A numeração conta também as turmas encerradas, então um código nunca é reaproveitado.
    - Na edição, o **esporte fica travado**, porque a sigla dele forma o código.
  - **Professor responsável**: atletas com perfil Professor.
  - **Data de criação**: hoje por padrão, editável.
  - **Limite de vagas** (opcional): em branco, a turma fica aberta. Não pode ser menor que o número de alunos ativos.
  - **Esporte** (catálogo) e **níveis** do esporte, um ou mais.
  - **Recorrência**, em uma de duas opções:
    - **Usar recorrência existente**:
      - lista as recorrências da arena, as do professor primeiro;
      - para cada bloco, o gestor marca se a turma o usa e **em que trecho** (ex.: 10:00–11:00 de um bloco 09:00–11:00);
      - ao escolher a recorrência, cada bloco já vem com o **primeiro trecho livre** (sem as turmas ativas que já usam parte dele);
      - mostra quem já usa cada bloco;
      - trecho fora do bloco bloqueia o salvamento;
      - **sobreposição com outra turma** gera um **alerta vermelho em destaque** no bloco e um aviso no rodapé. Ao salvar, aparece uma **confirmação** com "Voltar e ajustar horário" como ação principal e "Salvar mesmo assim" como secundária: desencoraja seguir, mas permite.
    - **Criar novo horário recorrente** (a turma "vira mensalista"):
      - um ou mais blocos em **hora cheia** (espaço + dia + início + fim), como a grade de Mensalistas. Trocar o início mantém a duração;
      - conflito com outra recorrência **bloqueia**;
      - cada bloco mostra o preço da hora e a tabela usada: **Professor**, ou **Padrão** em destaque quando o espaço não tem tabela Professor;
      - **início da recorrência**: hoje ou uma data futura (nunca passada).
    - A cobrança usa **a mesma regra e o mesmo código** do cadastro de recorrência de Mensalistas (`resumirPlano` + `fracaoPrimeiroMes`, em `src/modules/bookings/lib/mensalista-blocos.ts`):
      - **Subtotal pela tabela**: horas e valor por semana, reservas no mês de referência e a mensalidade, com a variação do calendário (ex.: R$ 360 em meses com 4 terças, R$ 450 com 5);
      - **1ª mensalidade proporcional** ao período que sobra no mês de início, por minutos e contra o mês de referência. Exemplo: terça 13h–14h começando em 21/10 → 1 reserva (27/10) → R$ 90 de R$ 360. A aula de hoje já passada não conta;
      - aviso quando nenhuma aula cabe até o fim do mês de início;
      - **valor mensal cobrado editável** (desconto ou acréscimo), com "Voltar à tabela". A 1ª mensalidade acompanha o valor cobrado.
    - Ao salvar, cria a **recorrência do professor** com esse valor. Ela aparece no detalhe dele e passa a poder ser usada por outras turmas.
  - **Alunos iniciais** (só na criação): busca de atletas. Entram com a data de criação da turma, respeitando o limite de vagas.
- **Alunos da turma** (modal):
  - Resumo da turma, com **vagas** ("8 de 8 · lotada" ou "3 de 4 · 1 livre").
  - **Vincular atleta** com data de entrada, que não pode ser anterior à criação da turma.
    - **Bloqueado com a turma lotada**, com orientação para aumentar o limite ou desvincular alguém.
    - Avisa, sem bloquear, quando o nível do atleta está fora dos níveis da turma.
  - Aba **Alunos ativos**: data de entrada, tempo na turma e **Desvincular**, que pede a data de saída e um motivo opcional.
  - Aba **Histórico**: todos os períodos.
  - Turma encerrada: abre direto no Histórico, só para consulta.
- **Encerrar turma** (diálogo):
  - pede a data de encerramento (não pode ser antes da criação nem da entrada de nenhum aluno ativo) e um motivo opcional;
  - os alunos ativos recebem saída nessa data, com o motivo "Turma encerrada";
  - a turma sai da lista e das contagens, mas o histórico fica preservado;
  - **oferece encerrar a recorrência junto**, de duas formas:
    - **A partir de hoje** (padrão): mesma regra do "Cancelar plano" de Mensalistas. A recorrência é cancelada na hora e a próxima aula prevista (mostrada no diálogo) e as seguintes, inclusive as já confirmadas deste mês, voltam para revenda. Só fica disponível quando a turma encerra até hoje.
    - **A partir de um mês**: mesma regra do "Prever encerramento" de Mensalistas. Escolhe-se o mês a partir do qual ela acaba, e as reservas ainda não confirmadas desse mês em diante são canceladas.
    - Vem **marcado** quando a recorrência foi criada por esta turma; nos demais casos, desmarcado.
    - Fica **indisponível**, com o motivo, quando a recorrência é de outra pessoa, ainda é usada por outra turma ativa ou já tem encerramento marcado.
    - Recorrência com encerramento marcado não aparece mais para turmas novas e mostra o selo "encerra a partir de …" no detalhe do professor.

### 3.2 Aba Professores

- **Grid**, com todas as colunas ordenáveis: Professor, Telefone, E-mail, Esportes, **Turmas** (só ativas, com barra proporcional), Alunos ativos, Aulas/semana e Professor desde.
- **Filtros**: busca, os chips Todos / Com turmas / Sem turmas e os atalhos **Mais turmas / Menos turmas**.
- **Detalhe do professor**:
  - dados gerais;
  - esportes e níveis;
  - números: turmas, alunos e aulas por semana;
  - **horários recorrentes em nome do professor**, com o trecho que cada turma usa (ex.: "TEN-001 09:00–10:00") ou "sem turma";
  - turmas ativas pelas quais responde, com a contagem das encerradas.

### 3.3 Aba Atletas

- **Quem aparece**: todo atleta que **faz ou já fez parte** de alguma turma, inclusive turma encerrada. Atleta sem nenhum vínculo não aparece.
- **Grid**, com todas as colunas ordenáveis:
  - **Atleta** (nome e telefone);
  - **Esportes e níveis** do perfil (ex.: "Beach Tennis · D");
  - **Turmas atuais** como códigos clicáveis, que abrem os alunos da turma. O código fica em âmbar com ⚠ quando o nível do atleta está fora dos níveis daquela turma;
  - **Professores** atuais;
  - **Aulas/semana** (soma dos horários das turmas atuais);
  - **Aluno desde** (primeira entrada);
  - **Última movimentação** ("Entrou em BT-002" / "Saiu de FTV-001", com a data);
  - **Situação**: Em turma / Ex-aluno.
- **Filtros**:
  - busca por nome ou e-mail;
  - esporte (turmas atuais ou passadas daquele esporte);
  - professor atual;
  - chips Todos / Em turma / Ex-alunos, com contadores;
  - chip **"Nível fora da turma"**, que lista só quem está em turma de nível diferente do seu.
- **Ficha do atleta** (modal):
  - dados;
  - números: turmas atuais, aulas por semana e **passagens** (quantos vínculos já teve);
  - **esportes e níveis do perfil**, cada um com as turmas atuais daquele esporte e os níveis delas. Esporte de turma sem nível no perfil do atleta aparece com aviso;
  - aba **Turmas atuais**: turma, esporte, **nível do atleta × níveis da turma**, professor, horários, entrada e tempo na turma;
  - aba **Histórico**: todos os vínculos, inclusive de turmas encerradas, com entrada, saída, permanência e motivo. Ex-aluno abre direto no Histórico.
- **Navegação cruzada**:
  - o código da turma (na grid ou na ficha) abre os alunos da turma;
  - o nome do aluno em "Alunos da turma" abre a ficha do atleta.

## 4. Regras do protótipo

| # | Regra | Como está |
|---|---|---|
| R1 | Código | **Gerado pelo sistema**, `SIGLA-000` por esporte, imutável e nunca reaproveitado. **Único por arena**. Como o mesmo código pode existir em outras arenas, o app mostra o código junto com o nome da arena. |
| R2 | Esporte | Escolhido na criação. Não muda depois (faz parte do código). |
| R3 | Professor | Atleta com perfil efetivo **Professor** na arena (§5.15 do PRD). |
| R4 | Níveis | Pelo menos 1, quando o esporte tem níveis. A turma pode ter vários. |
| R5 | Vagas | Opcional. Com limite, o vínculo de aluno é **bloqueado** ao lotar. Não pode ficar abaixo dos alunos ativos. |
| R6 | Recorrência existente | A turma usa **trechos** de um ou mais blocos de uma recorrência, dentro dos limites de cada bloco. Sobreposição com outra turma ativa: **alerta chamativo + confirmação explícita**, mas é permitida. |
| R7 | Novo horário | **Cria a recorrência do professor** (reserva o espaço), cobrada pela tabela **Professor** de cada espaço ou, sem ela, pela **Padrão**. Conflito bloqueia. A cobrança fica em Mensalistas. |
| R7a | Mensalidade da turma nova | **Mesma regra e mesmo código** das reservas de mensalista: mensalidade pelo mês de referência, 1ª mensalidade proporcional por minutos a partir do início escolhido e valor editável. Horários em hora cheia. Início ≥ hoje. |
| R8 | Vínculo de aluno | Cada vínculo é um **período** (entrada, saída e motivo). Voltar à turma abre um novo período. |
| R9 | Datas | Entrada ≥ criação da turma. Saída ≥ entrada. Encerramento ≥ criação e ≥ entrada de cada aluno ativo. |
| R10 | Encerramento | Não há exclusão. A turma encerrada **some da lista e das contagens**, fica acessível pelo filtro "Mostrar encerradas" e preserva o histórico. Os alunos ativos saem na data do encerramento. |
| R10a | Recorrência no encerramento | **Opcional** encerrar junto, a partir de hoje (regra do "Cancelar plano", só com a turma encerrando até hoje) ou a partir de um mês (regra do "Prever encerramento"). Disponível só se a recorrência for do professor da turma, nenhuma outra turma ativa a usar e não houver encerramento já marcado. Vem marcado quando a recorrência foi criada pela turma. |
| R11 | Contagens | "Alunos" = períodos sem saída. No professor, os alunos são **distintos** e só contam turmas ativas. |
| R12 | Aulas/semana | Soma da duração dos trechos das turmas ativas do professor. |
| R13 | Acesso | Mesmo de Mensalistas: backoffice da arena (`assertArenaBackofficeAccess`). |
| R15 | Aba Atletas | Lista quem tem pelo menos um vínculo (ativo ou não). **Em turma** = algum vínculo sem saída em turma ativa; senão, **Ex-aluno**. Na mesma data, a saída conta antes da entrada (troca de turma). |
| R14 | Cobrança de alunos | **Fora do escopo** desta feature. |

## 5. Decisões tomadas (07/10/2026)

| Tema | Decisão |
|---|---|
| Código da turma | Gerado automaticamente pelo sistema, sem edição. Mantém o formato `SIGLA-000`. O atleta vai buscar suas turmas por ele no app, em outra feature. |
| Excluir × encerrar | **Encerrar**, preservando o histórico. A turma encerrada não aparece na visão padrão. |
| Novo horário recorrente | **Reserva a quadra**: cria a recorrência do professor com a tabela de preço Professor do espaço; sem ela, a Padrão. |
| Parte de um bloco | A turma **pode usar só parte** de um bloco de reserva. |
| Limite de vagas | **Opcional**. Se definido, é respeitado; senão, a turma fica aberta. |
| Cobrança dos alunos | **Não** será feita por aqui por enquanto. |
| Unicidade do código | **Único por arena.** |
| Recorrência ao encerrar | **Oferecer encerrar junto**, quando for seguro (R10a). |
| Sobreposição de turmas | **Alerta bem chamativo** para a pessoa não seguir, mas **permitindo seguir** se ela confirmar. |
| Turma que vira mensalista | Mensalidade e pró-rata pela **mesma regra das reservas de mensalista**, sem código duplicado, considerando a data de início escolhida. |

## 6. Perguntas ainda em aberto

Cada pergunta traz a recomendação atual.

1. **Reabrir turma encerrada**: é preciso? Hoje não há essa ação.
2. Um atleta pode estar em **várias turmas ativas**? No protótipo, sim.
3. Nível do aluno fora dos níveis da turma: **avisar** (protótipo) ou **bloquear**?
4. A turma precisa de **nome/descrição** além do código?
5. **Chamada/presença** por aula: escopo desta feature ou evolução?
6. **App**: o professor vê as próprias turmas? Isso se soma à busca por código do aluno.
7. **Quem gerencia**: gestor e atendente (protótipo), ou só gestor?
8. "Professor desde" usa a data em que o perfil Professor foi definido (`definido_em`). Para perfil só **sugerido**, qual data mostrar?
9. A data de criação pode ser **retroativa**? No protótipo, sim.

## 7. Arquitetura do banco (arenadigital-db)

Contrato completo: `arenadigital-db/schema-contracts/arena.turmas.md`.

**Migrações** (aditivas, nessa ordem):

| Migração | Conteúdo |
|---|---|
| `20261007230000_turmas_schema.sql` | `sports.sigla` com as siglas atuais; UNIQUE de apoio às FKs compostas; backfill dos blocos de planos legados; tabelas, índices, gatilhos, RLS e grants |
| `20261007230010_turmas_helpers.sql` | funções `private`: sigla, perfil efetivo, tabela de preço do professor, validações e criação da recorrência |
| `20261007230020_turmas_rpcs.sql` | `create_turma_atomic`, `update_turma_atomic`, `encerrar_turma_atomic`, `list_turma_recorrencias` |
| `20261007230030_turma_alunos_rpcs.sql` | `vincular_turma_aluno_atomic`, `desvincular_turma_aluno_atomic` |
| `20261007230040_turmas_acl.sql` | `EXECUTE` só para `service_role` e comentários |
| `20261008120000_encerrar_turma_recorrencia_agora.sql` | `encerrar_turma_atomic` ganha `p_encerrar_recorrencia_agora boolean DEFAULT false` (encerrar a recorrência a partir de hoje) |

**Tabelas e chaves estrangeiras:**

| Tabela | O que guarda | Chaves |
|---|---|---|
| `turmas` | código (`codigo_prefixo` + `codigo_sequencia` → `codigo` gerado), professor, esporte, recorrência usada, data de criação, vagas, status e encerramento | `arenas`, `atleta` (professor), `sports`; `(plano_mensalista_id, arena_id)` → `planos_mensalista` |
| `turma_niveis` | níveis da turma | `(turma, arena, esporte)` → `turmas`; `(nivel, esporte)` → `nivel_habilidade_esporte`, o que garante nível do esporte da turma |
| `turma_horarios` | trecho de cada bloco usado | `(turma, arena, plano)` → `turmas`; `(bloco, plano)` → `planos_mensalista_blocos`, o que garante bloco da recorrência da turma |
| `turma_alunos` | períodos (entrada, saída, motivo) | `(turma, arena)` → `turmas`; `atleta` |

**Decisões estruturais:**
- **Professor e alunos apontam para `atleta`, não para `arenas_atleta`.** A exclusão de conta apaga os vínculos com arenas (e anonimiza o atleta). Uma FK ali bloquearia a exclusão ou apagaria o histórico. O vínculo com a arena é validado nas RPCs, e o gatilho `trg_arenas_atleta_encerra_turmas` fecha os períodos ativos quando o atleta sai da arena.
- **Regras no banco**, não só na tela:
  - o código é imutável (gatilho);
  - o trecho fica dentro do bloco (gatilho);
  - a entrada não pode ser antes da criação da turma (gatilho);
  - há um período ativo por aluno e turma (índice único);
  - as vagas são conferidas sob lock;
  - a sobreposição exige confirmação (`SQLSTATE 23P01`).
- **Sem regra duplicada:**
  - o professor é validado pelo perfil efetivo, com a mesma derivação de `list_atleta_perfis`;
  - a nova recorrência nasce por `create_monthly_plan_blocks_atomic`, com `p_effective_date` e a tabela Professor do espaço;
  - encerrar a recorrência junto usa `cancel_monthly_plan_atomic` (a partir de hoje) ou `set_mensalista_termination_atomic` (a partir de um mês).
- **Planos legados** sem linha de bloco recebem a linha (mesmo backfill de 09/09/2026). `list_turma_recorrencias` também faz isso na hora, para planos criados depois pela tela antiga.
- **Leitura**: RLS `SELECT` para o backoffice da arena nas quatro tabelas; o web lê com service role. Professores vêm de `list_atleta_perfis`.

## 8. Arquivos do protótipo

- `src/app/dashboard/turmas/page.tsx`: redireciona para a arena padrão (`resolveDashboardDefaultRoute('turmas')`).
- `src/app/dashboard/turmas/[arenaId]/page.tsx`: checa o acesso e renderiza o cliente.
- `src/modules/turmas/types.ts`, `mock-data.ts` (dados fictícios) e `lib.ts`:
  - horários e trechos, incluindo a primeira faixa livre;
  - preço pela tabela do professor e conversão para o `Bloco` de Mensalistas (`paraBlocoMensalista`, `valorOcorrencia`);
  - contagens, vagas e geração de código.
- A mensalidade **não tem cálculo próprio**: usa `resumirPlano` e `fracaoPrimeiroMes` de `src/modules/bookings/lib/mensalista-blocos.ts`.
- `src/modules/turmas/components/`:
  - `TurmasPageClient` (estado em memória de turmas e recorrências, abas e navegação entre modais);
  - `TurmasTab`, `ProfessoresTab` e `AtletasTab`;
  - `TurmaFormModal`, `TurmaAlunosModal`, `ProfessorDetalheModal`, `AtletaDetalheModal` e `EncerrarTurmaDialog`;
  - `Ordenavel` (cabeçalho ordenável + `useOrdenacao`).
- Menu: `src/components/dashboard/Sidebar.tsx` (item "Turmas", ícone `GraduationCap`).

## 9. Próximos passos

1. Revisar e abrir os PRs: primeiro `arenadigital-db` (banco antes do web), depois `arenadigital-web`, ambos para `main`.
2. Regenerar `src/types/supabase.types.ts` quando houver token de acesso ao Supabase. Hoje o módulo usa o cliente destipado, como `court_price_tables`. Atualizar junto `schema-contracts/arenadigital-web.public-tables.txt` no db.
3. Fechar as perguntas que restam na §6.

## 10. Integração (fase 4)

- **Leitura** (`getTurmasPageDataAction`, chamada pela página no servidor):
  - esportes e níveis;
  - espaços com a tabela Professor/Padrão;
  - atletas da arena, paginados pelo `fetchAllSupabaseRows`, e os perfis (`list_atleta_perfis`);
  - recorrências (`list_turma_recorrencias`);
  - turmas com níveis, trechos (com o bloco embutido) e períodos de alunos.

  Quem já saiu da arena entra como "não membro", para o histórico mostrar o nome.
- **Escrita**:
  - `criarTurmaAction`, `editarTurmaAction`, `encerrarTurmaAction`, `vincularAlunoAction` e `desvincularAlunoAction`, só pelas RPCs;
  - cada uma checa `assertArenaBackofficeAccess` e pega o usuário da sessão;
  - turma e período usam ids gerados na tela, o que torna as operações idempotentes.
- **Novo horário**: o valor de cada aula vem de `quoteMonthlyBlocksAction`, a mesma cotação de Mensalistas, pela tabela Professor do espaço; a mensalidade, de `resumirPlano` / `fracaoPrimeiroMes`.
- **Erros**: as mensagens do banco ganham acentuação (`erros.ts`). A sobreposição não confirmada (23P01) volta como pedido de confirmação na tela.
- **Atualização**: depois de gravar, a página recarrega do servidor. Em "Alunos da turma", entrada e saída aparecem na hora (otimista) até os dados novos chegarem.
- **Testes**:
  - `tests/turmas.test.mjs` (unitários e contrato das ações);
  - ponta a ponta em homologação: 16 passos com as server actions reais numa arena isolada, removida no fim;
  - "a partir de hoje": 5 passos ponta a ponta no banco local com a migração `20261008120000`, mais pgTAP;
  - navegador com login real: criar, vincular, desvincular, encerrar, cotação e abas, além das duas opções da recorrência no diálogo de encerrar.
