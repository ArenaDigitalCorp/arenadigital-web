# Mapa de padronização de campos

Máscara pertence à entrada e à exibição. O servidor valida e normaliza antes de
salvar; o banco preserva identificadores como texto e valores/datas nos tipos
nativos. A mesma pessoa pode colar um valor com ou sem máscara sem criar outra
identidade. Os formatos já existentes continuam legíveis.

## Regras por tipo

| Informação / campos | Entrada e exibição | Valor salvo / contrato |
| --- | --- | --- |
| CPF (`users.cpf`, `atleta.cpf`, `station_customers.cpf`) | `529.982.247-25`, com verificação dos dígitos | Texto `52998224725`; preservar zeros iniciais. A máscara não torna obrigatório um campo opcional. |
| CNPJ / documento da arena (`arenas.cpf_cnpj`, documento do onboarding) | `12.ABC.345/01DE-35` ou CPF; checksum correspondente | Texto `12ABC34501DE35`, sem pontuação e com letras maiúsculas. Nunca converter em número nem remover letras. |
| Telefone / celular (`telefone`, `phone`, contato do cliente e da arena) | BR `+55 (48) 99642-6091`, fixo com 8 dígitos; internacional com país explícito | E.164 `+5548996426091`. Nacional completo só ganha `+55` após validar DDD e estrutura. Não inventar DDD, cortar dígitos, descartar ramal ou escolher um número entre vários. |
| CEP (`atleta.cep`, `arenas.zip_code`, onboarding `postalCode`) | `88037-395`; colar `88.037-395` também é aceito | Texto de 8 dígitos `88037395`, preservando zeros. CEP e código IBGE são campos diferentes. |
| E-mail (`users.email`, arena e cliente de comanda) | Sem máscara; teclado/validação de e-mail | Espaços externos removidos e minúsculas, conforme a identidade já adotada pelo sistema. Não apagar espaços internos ou tentar corrigir endereços inválidos. |
| Chave Pix | Máscara conforme o tipo selecionado: CPF, CNPJ ou telefone; e-mail e aleatória sem máscara numérica | Validação por tipo no servidor: documento canônico, e-mail normalizado, telefone E.164 brasileiro, EVP/UUID integral. Pix copia e cola e QR code permanecem opacos. |
| Dinheiro em reais (`price`, `value`, `amount`, saldo, mensalidade, crédito, saque, renda) | `R$ 1.234,56`; entrada aceita `1234`, `1234,56`, `1234.56`, `1.234,56`; formata ao sair do campo | Número decimal em reais no contrato existente, sem `R$` ou separador de milhar. Entrada inválida é bloqueada, nunca convertida por `parseFloat` parcial. `1.234` isolado é ambíguo e exige correção; não inferir R$ 1.234,00. |
| Valores em centavos (`*Cents`, `*_cents`) | Exibir BRL após dividir por 100 | Inteiro em centavos. Preservada a unidade de cada API; nunca aplicar a conversão duas vezes. |
| Percentual, desconto, comissão e reajuste | Número com indicação `%`, dentro dos limites de cada operação | Número na unidade existente, sem `%`. Não confundir taxa percentual, valor fixo e comissão em centavos. Limites e regras de comissão permanecem nos schemas/RPCs próprios. |
| Datas civis: nascimento, vencimento, data de lançamento | Calendário / `DD/MM/AAAA` | `date` ou ISO `YYYY-MM-DD`; não transformar nascimento em instante UTC nem aceitar data textual ambígua. Regras existentes de lançamento somente data foram preservadas. |
| Mês de competência | Seletor de mês / mês e ano | Contrato existente `YYYY-MM` ou primeiro dia `YYYY-MM-01`. No app foi corrigido o parsing que deslocava uma data civil para o mês anterior em São Paulo. |
| Instantes: reserva, auditoria, pagamento e histórico | Data/hora pt-BR com fuso definido pelo fluxo | Timestamp ISO com offset/UTC e `timestamptz`. A exibição local não regrava o instante. |
| Horários recorrentes e durações | Seletor `HH:mm`, duração com unidade explícita (`min`, horas) | `time`/string `HH:mm` ou quantidade de minutos conforme contrato. Não usar máscara de data completa em horário recorrente. |
| Quantidade, capacidade, estoque, parcelas e dia do vencimento | Campo numérico nativo, inteiro quando o domínio exige | Número / inteiro com limites de negócio. Não usar máscara de CPF, moeda ou separador de documento. |
| Medidas, distância, latitude e longitude | Unidade explícita; vírgula de apresentação quando pertinente | Número nas unidades atuais (por exemplo, distância da busca em metros). Coordenadas continuam números com ponto no contrato. |
| Nome, razão social, apelido, endereço, número e complemento | Texto Unicode, com acentos e capitalização informados; número pode ser `S/N` ou `12A` | Texto. Sem title case automático ou remoção de caracteres. Trim apenas onde o contrato já prevê. |
| UF, município, esporte, perfil, status e demais enumerações | Seletores e rótulos do catálogo | ID / enumeração do catálogo; UF padronizada pelo catálogo. Não trocar IDs por rótulos formatados. |
| Agência, conta bancária, inscrição estadual e códigos fiscais específicos | Texto / validação específica do provedor ou jurisdição, caso exista campo | Preservar zeros, letras e dígitos verificadores. Não aplicar a regra de CPF indiscriminadamente. Não foram criados campos artificiais. |
| URLs, redes sociais e identificadores de integrações | URL/handle conforme o consumidor | Texto validado no contexto; IDs de canal, `phone_number_id`, SKU/código de barras e identificadores externos não são telefones nem números para arredondar. |
| Senhas, códigos de confirmação, IDs, tokens, payloads assinados e snapshots | Conteúdo conforme a finalidade, com proteção já definida pelo fluxo | Conteúdo opaco integral. Não remover pontuação, zeros ou capitalização, nem aplicar normalização global em logs/auditoria/snapshots. Dados de cartão continuam no fluxo do provedor; esta mudança não passa a armazená-los. |

CNPJ alfanumérico já está em uso. A validação implementada segue os exemplos e o
cálculo ASCII − 48 do [manual oficial da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf).
Telefone canônico segue a estrutura internacional da [ITU E.164](https://www.itu.int/rec/T-REC-E.164/en).

## Onde foi aplicado

- Cadastro de arena/signup, edição de arena, atleta, cliente de comanda,
  local público, subconta Asaas e destino de saque Pix.
- Tabelas de atletas, detalhes de atleta/usuário, relatórios de clientes,
  turmas/professores, seletores de reserva, mensalistas, fidelidade e comprovantes.
- Entradas monetárias de pagamento de comanda, saque, rateios, mensalidades,
  créditos, reajustes, cancelamento, configuração de turma e reservas.
- Links de WhatsApp e `tel:` usam o telefone canônico; o texto visível usa máscara.
- Adaptadores de pagamento respeitam o contrato de cada provedor: Stripe recebe
  E.164; o campo opcional de telefone doméstico do Asaas recebe DDD + número,
  sem o país 55 e sem truncamento. Contato internacional não é convertido em
  telefone brasileiro. Onboarding Asaas que exige celular BR valida essa exigência.

## Código compartilhado e proteção dos dados

`src/lib/brasil-document.ts` centraliza normalização, validação e apresentação.
`MaskedInput` aplica máscara progressiva, mantém cursor em edição e permite
colar valores. Letras inesperadas e entradas longas continuam visíveis para
correção, sem se tornarem outro documento por truncamento. `DecimalInput`
formata somente valores completos ao sair do campo; durante a edição mantém o
texto digitado. `parseBrazilianDecimal` não aceita expoentes ou prefixos parciais.

Os schemas de contato são reutilizados no servidor. Actions usam o resultado
validado/normalizado, em vez de gravar o payload original. Edição parcial não
apaga telefone, e-mail ou CEP omitidos. Autorização por arena permanece antes
de qualquer escrita. Máscara de apresentação não substitui controle de acesso.

A migration aditiva `20261015010000_canonical_contact_fields.sql` pertence ao
repositório DB e normaliza novos cadastros/campos alterados, sem regravação em
massa de dados históricos. Legado inválido permanece visível, sem correção
inventada. Máscaras de exibição já padronizam registros existentes quando seu
formato é reconhecido. RPCs, ACLs, idempotência e snapshots são preservados.

## Inventários complementares e publicação

- Banco/Edge/importadores: `../arenadigital-db/docs/operations/canonical-field-formats.md`.
- App: `../arenadigital-app/docs/field-standardization.md`.
- Testes web: `field-standardization.test.mjs`, `contact-write-normalization.test.mjs`
  e regressões dos fluxos de signup, Asaas, reajuste, rateio e cadastro público.

Ordem da futura publicação: DB → web/app, mantendo compatibilidade com os
clientes anteriores. A primeira validação foi local, sem saneamento remoto. A entrega inclui a
paginação de 25/50 e segue PR de tarefa → main → homolog. A aprovação para
homologação não inclui publicação em produção ou nas lojas.

## Resultado da validação local

- Web: 671 testes passaram, 43 ignorados; segurança 4/4; typecheck e build passaram.
- Browser: componentes reais em prévia isolada com dados fictícios; conferidos
  colagem, CNPJ com letras, CEP pontuado, telefone internacional, máscara,
  exclusão sobre separador, cursor, valor decimal, rejeição sem truncamento
  e apresentação em largura móvel. Sem criação de cliente ou pagamento remoto.
- DB: 188 migrations aplicadas em container Supabase/Postgres 17 isolado;
  170 asserções pgTAP passaram, incluindo as regressões de paginação anteriores;
  288 testes Node passaram, 8 ignorados. Validação e checagem Edge passaram;
  11 testes Asaas passaram com typecheck. Outros 24 testes compartilhados
  passaram em runtime; dois arquivos de teste precisaram de `--no-check`
  por indisponibilidade local de `npm:@types/node`.
- App: 202 testes, typecheck, lint, validação Edge e export Android passaram.
- Limitações anteriores: lint geral web ainda registra 131 erros e 63 avisos;
  o `edge:check` do app falha em `r2-profile-photo/index.ts:46`, intocado nesta
  mudança. QA visual no simulador foi bloqueada por falta de permissão da
  ferramenta de Computer Use. Isso não é evidência de execução visual no app.
- A validação inicial não executou deploy ou alteração remota. Containers e
  bancos de teste isolados foram removidos; não houve reset do banco de
  desenvolvimento. Evidências de promoção são registradas na release.

## Compatibilidade de integrações e versões do app

As assinaturas de RPC, IDs, unidades monetárias, autorização, locks e
idempotência permanecem. Testes de adaptadores interceptaram os payloads reais
montados pelo código para Asaas e Stripe; não foram executadas operações remotas
de cadastro, cobrança, estorno ou webhook. Aprovação local dos testes não é
validação ponta a ponta do ambiente publicado.

A entrega precisa incluir as Edge Functions afetadas pelo helper Asaas
(`arena-financial-operations`, `asaas-booking-webhook`,
`booking-payment-maintenance`, `booking-pix-payment`,
`booking-group-pix-payment`), além das migrations, web e atualização do app.
O pipeline de homologação publica as funções somente depois das migrations
com sucesso, conforme o runbook atual de deploy. Isso não publica o aplicativo.

A versão anterior do perfil do app removia caracteres e cortava o telefone nos
primeiros 11 dígitos. Isso já era incorreto para contatos importados com `+55`.
O app atualizado corrige essa leitura/escrita; não afirmar compatibilidade
completa de versões antigas instaladas apenas porque a assinatura da API é
igual. Validar o app candidato contra homologação antes de distribuir.

Antes da publicação funcionalmente aprovada, conferir em homolog/sandbox:
criação/edição e releitura de contatos pelo web e app, cadastro/reconciliação de
cliente Asaas, pagamentos Pix individual/grupo, checkout do provedor habilitado,
webhook/reentrega, financeiro/Pix e links de contato. Usar os mecanismos de teste
dos provedores; nenhum teste desta tarefa movimentou dinheiro ou disparou mensagens.

## Revisão complementar de 15/10/2026

A revisão reproduziu falhas reais antes da correção, além de conferir o mapa de
campos. As correções desta revisão permanecem locais até uma nova promoção.

- Rotativos/créditos: `1.234,56` podia virar `1.234` e texto parcial podia passar
  pelo `parseFloat`; quantidades fracionárias eram truncadas. O parser comum
  agora valida toda a entrada nos handlers de salvar, prévia e lançamento.
- Produto/serviço, reajuste em lote, lançamento/abertura de caixa, comissões e
  valores de blocos/faixas: entradas monetárias usam o mesmo parser/DecimalInput,
  sem converter campo obrigatório vazio em zero. Zero continua válido quando
  explícito e permitido pelo domínio; desconto opcional vazio continua zero.
- Faixas de preço guardam rascunhos por tabela/dia e bloqueiam salvar enquanto
  houver entrada inválida. Copiar/limpar/remover faixas ou atualizar preços não
  reaproveita um rascunho de outro preço nem oculta erros mantendo a última
  valor válido.
- `DecimalInput` formata somente a apresentação ao sair. Não dispara `onChange`
  por formatação; preços automáticos e flags de edição manual permanecem intactos.
- Telefone com marcas direcionais do WhatsApp, espaços Unicode ou traços conhecidos
  é reconhecido sem alterar dígitos. A limpeza dessas marcas é exclusiva de
  telefone e não se aplica a tokens, senhas ou documentos opacos.
- Cadastro de destino Pix PHONE e celular obrigatório do onboarding aceitam
  somente celular brasileiro completo. Contatos gerais continuam aceitando
  fixos e internacionais; as exigências do destino não são aplicadas globalmente.
- A nova migration DB `20261015020000_review_contact_phone_contracts.sql` corrige
  prefixos `+ 55`/`+(55)`, que podiam inventar DDD 55, e separa a validação de
  signup da normalização que preserva contatos antigos inválidos. Nenhum dado
  histórico foi reescrito e a migration publicada anteriormente continua intacta.
- O padrão de testes nos três `package.json` é passado entre aspas para o Node.
  Sem aspas, o shell podia expandir apenas um subdiretório existente e deixar
  testes da raiz fora do CI; no DB a reprodução executava 21 em vez de 296.

Os testes novos exercitam handlers reais de submissão (com dependências externas
interceptadas), recálculo automático, rascunhos inválidos, moedas/unidades,
telefone original copiado, país/DDD, Pix e migração limpa. Teste de sandbox de
pagamento e QA visual em dispositivo continuam etapas distintas e pendentes;
esta revisão não criou cobrança, transferência, comunicação nem deploy remoto.

Validação complementar: 689 testes web passaram (43 ignorados), segurança 4/4,
typecheck e build aprovados. Lint geral registra baseline de 130 erros/62 avisos;
a comparação dos 27 arquivos de código/teste alterados não encontrou novos
problemas (11 erros/7 avisos anteriores nesses arquivos). Banco limpo: 189
migrations, 288 testes Node aprovados (8 ignorados), 2.003 pgTAP e paridade
aprovados. App: 211 testes, typecheck/lint, validação Edge e export aprovados.

## Segunda revisão adversarial

A segunda revisão cruzou as alterações entre os agentes, com reproduções nos
handlers reais e sem publicação remota:

- Fronteiras de servidor de catálogo, caixa, tabelas de preço, faturamento e
  comissão não transformam mais `null`, booleanos, arrays ou vazio em número.
  Valores numéricos e strings decimais completas continuam aceitos. Quantidades
  e capacidades validam o inteiro completo; unidades em reais, centavos e pontos
  base permanecem as mesmas.
- Normalização de CNPJ converte apenas `a-z` ASCII em `A-Z`. Unicode como `ß`,
  `ı`, `ſ` e ligaduras permanece inválido, sem se transformar em outro documento
  válido por case folding. O banco reconstrói o índice de documento após mudar
  a função indexada; migration já promovida não foi alterada.
- Datas padrão de lançamento/registro seguem o dia civil do calendário local,
  inclusive após as 21h no Brasil. Datas civis já persistidas continuam intactas.
- Copiar a tabela Padrão usa os preços atuais em edição, não o snapshot carregado.
  Copiar/limpar/replicar descarta somente os rascunhos substituídos, inclusive
  quando os preços numéricos são iguais; origem inválida bloqueia a cópia.
  Excluir uma tabela ignora somente os erros da própria tabela descartada.
- A compra de créditos consulta o preço persistido no servidor, independente
  de pacotes ainda em edição. Quantidade, arena e sessão da janela identificam
  cada resposta; respostas atrasadas e duplo envio não reutilizam outra sessão.
  Antes de lançar, uma nova consulta que encontre preço diferente exige revisão
  e confirmação. A prévia é estimativa: não introduz contrato de preço travado
  no banco, e o valor efetivamente pago retornado é apresentado ao concluir.

Os cenários de UI foram exercitados por handlers/effects reais com serviços
interceptados. Isso não substitui navegação visual nem cobrança Sandbox.
As correções continuam locais, na branch `fix/field-standardization-review`.

Validação final desta segunda revisão: 706 testes web passaram, 43 ignorados,
segurança 4/4, typecheck e build aprovados; nenhum novo problema de lint nos
arquivos alterados. Banco limpo: 189 migrations, 288 testes Node aprovados
(8 ignorados), 14 testes Asaas e 2.012 pgTAP aprovados, com paridade. App sem
novas alterações nesta rodada mantém os 211 testes e gates aprovados na anterior.
O teste de idempotência deixou de conferir um detalhe textual do código e agora
exercita retries reais do componente, incluindo erro de rede e rotação do ID
após fechar/reabrir. Não houve cobrança, transferência, deploy ou build EAS.

## Terceira revisão adversarial

- A máscara de telefone preserva o país explícito mesmo quando `+` e `55`
  estão separados por espaços ou parênteses. Um telefone internacional
  incompleto não pode virar um número nacional com DDD inventado.
- Apagar um separador só remove um dígito adjacente quando a máscara realmente
  recoloca esse separador. Texto inválido permanece inválido, inclusive CPF com
  letras. Durante composição pelo teclado, a máscara aguarda o término para
  formatar o texto, sem reescrever a composição a cada render.
- Compra de créditos com resultado desconhecido mantém ID e payload ao
  fechar/reabrir a janela. Repetir a confirmação usa a mesma operação, mesmo
  com mudanças posteriores nos pacotes. Os campos ficam protegidos até resolver
  a pendência. Uma rejeição confirmada da primeira tentativa permite corrigir
  os dados; uma rejeição posterior a resultado desconhecido não prova que a
  primeira compra falhou. Sucesso tardio resolve a pendência sem fechar outra
  janela ou atualizar outra arena.

A retenção da operação pendente dura enquanto o componente está montado;
persistência de recuperação após recarregar a página ou navegar ainda não foi
implementada. A proteção existente no banco continua dependendo do mesmo ID de
operação. Não há novo contrato de preço travado nem mudança de RPC/migration
nesta terceira rodada.

Revisões independentes de cópia/edição de preços e DecimalInput não encontraram
novas divergências reproduzíveis. Verificação de handlers não substitui QA
visual no navegador/app nem teste de integração financeira em Sandbox.

Validação desta terceira rodada: 716 testes web aprovados, 43 ignorados e zero
falhas; segurança 4/4, typecheck e build aprovados. O lint geral permanece com
130 erros e 62 avisos preexistentes, sem novos diagnósticos em comparação com
a primeira revisão. O arquivo final da recuperação de créditos passou 11/11.
Banco/app não foram alterados nesta rodada; os gates da segunda/primeira revisão,
respectivamente, continuam sendo a evidência disponível. Não houve publicação,
commit, cobrança nem build EAS.

## Quarta revisão adversarial

A rodada seguinte não encontrou nova divergência nos formulários nem nos
inputs compartilhados. Uma matriz determinística de 48.000 entradas confirmou
que as máscaras preservam o identificador normalizado e não validam texto
anteriormente inválido. A revisão do app/web também cobriu 888 variações de
telefone, 720 documentos, ordens de eventos IME, trocas de props e cursor
pendente. Os 28 testes de fronteiras web selecionados passaram sem alterações
novas no código web.

Foram reproduzidos e corrigidos dois casos no repositório DB/Edge:

- O normalizador SQL de telefone agora reconhece os mesmos 25 caracteres de
  espaço de ECMAScript, inclusive antes do `+`, e não aceita NEL como se fosse
  um desses espaços. Telefones inválidos e campos históricos inalterados
  continuam preservados. A correção está na migration inédita `020000`.
- O adaptador de cliente Asaas omite um CEP opcional inválido de dados antigos,
  em vez de extrair dígitos de texto com letras e enviar outro CEP. Pontuação
  de apresentação, espaços e zeros iniciais de CEPs válidos são preservados.

Nenhum dado remoto foi alterado. As limitações de recuperação após refresh,
publicação pendente e validação visual/Sandbox descritas acima continuam.

Depois dessas duas correções, a conferência independente não encontrou novos
defeitos reproduzíveis: 131 casos de telefone e 10 de CEP aprovados, além da
matriz de inputs acima. A validação DB completa passou em base isolada: 189
migrations, 288 testes Node aprovados (8 ignorados), paridade e checagem Edge,
16 testes SDK e 2.068 asserções pgTAP em 85 arquivos. O container próprio foi
removido. O teste específico da migration de revisão cobre 95 asserções.
Não houve nova alteração de código web/app nesta rodada; os gates consolidados
da terceira revisão permanecem válidos, com 28 testes web focados reexecutados.

## Quinta revisão adversarial

- Edição de reserva avulsa ainda usava `Number(courtPrice)` em um campo de
  texto com placeholder brasileiro. `12,50` era rejeitado e vazio podia virar
  locação gratuita. A entrada agora usa DecimalInput e o mesmo parser BR na
  validação anterior à consulta de conflitos, submissão, rateio e resumo.
  Vazio/inválido bloqueia; zero explícito continua permitido pelo domínio.
- O quadro de reservas exibia preços com `toFixed(0)`, arredondando centavos.
  Ele e os seletores/resumos de itens de comanda usam o formatador BRL comum,
  com centavos e separadores brasileiros. Essa alteração é só apresentação.
- No app, o fallback da agenda usava chaves UTC enquanto os rotativos usavam
  data civil. O fallback agora compartilha `localCivilDate`, preservando o dia
  local de reservas noturnas e a semana em fusos positivos. Respostas bem
  sucedidas das RPCs atuais/legadas mantêm seu contrato e sua paginação.

A revisão DB/Edge não encontrou novo defeito material. Casos reais de CPF com
zero inicial, CNPJ ASCII/Unicode, telefone internacional, opcionais vazios e
contatos inválidos confirmaram a validação antes da escrita. Não há nova
migration ou alteração de contrato remoto nesta rodada.

Validação consolidada: 719 testes web aprovados (43 ignorados), segurança 4/4,
typecheck e build aprovados. Lint web permanece em 130 erros/62 avisos antigos,
sem novos diagnósticos. App: 213 testes, typecheck, lint e export Android
aprovados. Banco/Edge não sofreram alterações nesta rodada; a evidência SQL da
quarta revisão continua sendo a referência. QA visual/Sandbox e publicação
seguem pendentes; não houve commit, deploy ou build EAS.

A revisão cruzada posterior aos ajustes não reproduziu nova regressão material:
handlers reais de avulso/rateio concordaram em centavos, incluindo zero e sobra
de um centavo, e as mudanças de exibição não alteraram cálculos ou payloads.

## Sexta revisão adversarial

- Política de cancelamento: apagar horas ou reembolso não pode converter o
  vazio em zero. O componente preserva o texto e exige inteiros completos nos
  limites do schema; zero explícito permanece permitido. Testes exercitam os
  eventos e o envio reais, incluindo novo rascunho vazio.
- Teto de tokens: o campo não remove mais caracteres para inventar outro
  limite (`10,5` antes virava `105`). Entrada completa é validada antes do
  envio; vazio continua significando ausência de teto. UI e schema do servidor
  compartilham o máximo de 2.147.483.647 da coluna `integer`.
- Links sociais do app: URLs conhecidas sem protocolo não duplicam domínio.
  URLs completas preservam caminhos, parâmetros e capitalização; handles e
  rótulos permanecem coerentes. Texto inválido fica visível sem abrir um link
  inventado. Essa resolução é apresentação, sem regravar o perfil ou o legado.
- CEP em RPCs: importação e signup ainda extraíam dígitos de entradas com letras.
  A revisão passa a invalidar essas linhas e rejeitar novos cadastros inválidos,
  preservando CEP opcional, pontuação reconhecida e zeros iniciais. A aplicação
  de cargas também revalida itens antigos pendentes contra seu original, sem
  alterar snapshots. Recibos já concluídos e fingerprints legados permanecem.

As correções continuam locais; nenhum dado remoto ou ambiente foi alterado.

Validação final: 726 testes web aprovados (43 ignorados), segurança 4/4,
typecheck/build aprovados e nenhum novo diagnóstico de lint; o baseline geral
continua em 130 erros/62 avisos anteriores. App: 217 testes, typecheck, lint e
export Android aprovados. Banco isolado: 189 migrations, 288 testes Node
aprovados (8 ignorados), 16 testes SDK e 2.107 asserções pgTAP em 86 arquivos,
incluindo 39 dos RPCs de CEP; paridade e checagem Edge aprovadas, container
próprio removido. A revisão cruzada final dos ajustes não encontrou nova
regressão reproduzível. QA visual/Sandbox, publicação e recuperação de compra
após refresh continuam com as limitações já descritas.

## Sétima revisão adversarial

- O gateway Asaas da web passou a omitir CEP opcional inválido nos payloads de
  criação e atualização de cliente, usando a mesma validação de CEP do cadastro.
  CEPs válidos mantêm zeros e normalização; CPF/CNPJ e onboarding obrigatório
  não foram alterados. O teste intercepta a fronteira HTTP real de POST e PUT.
- “Novo jogo aberto” usa o dia civil local como data inicial. O teste exercita
  componente e envio reais após 21h no Brasil, UTC e UTC+14, sem modificar uma
  data escolhida explicitamente.
- O card de resultado de partida no app deriva o dia local de `start_time`,
  que é um instante, em vez de recortar o dia UTC. Cards de vagas que recebem
  datas civis continuam usando seu contrato de data sem conversão de fuso.
- Edição de acesso administrativo carrega os valores da conta inicialmente
  selecionada, inclusive nível, estado e expiração. A data/hora é apresentada
  localmente; salvamentos que não editam a expiração preservam o instante
  original, com segundos, frações e offset. O schema do servidor aceita ISO com
  offset, sem alterar autorização/RPC. Nova data inválida bloqueia antes da
  action; revogação continua revogada ao abrir o formulário.
- O período financeiro de dias encerrados usa datas civis locais. Ao consultar
  após 21h no Brasil, termina ontem em vez de incluir o dia corrente. O teste
  também cobre UTC+14 e mudança de horário de verão.

As mudanças permanecem locais, sem operações remotas ou nova alteração DB/Edge.

Validação final: 735 testes web aprovados (43 ignorados), segurança 4/4,
typecheck e build aprovados; lint geral continua em 130 erros/62 avisos
preexistentes, sem novos diagnósticos. App: 219 testes, typecheck, lint e export
Android aprovados. As revisões cruzadas finais não reproduziram novas regressões
nos ajustes; incluíram preservação de offset/microssegundos, hora repetida na
mudança de fuso, virada de ano e ano bissexto. QA visual/Sandbox, publicação e
recuperação de compra após refresh mantêm as limitações registradas acima.

## Oitava revisão com matriz de cobertura

A revisão foi limitada aos formatos e contratos da tarefa. A matriz de handlers,
DTOs e escritas interceptadas não encontrou novos defeitos de CPF/CNPJ, CEP,
telefone, e-mail, moeda ou edição parcial. A revisão do app inventariou 20
consumidores dos helpers de formato/links e passou 13 testes direcionados, sem
nova alteração de fonte mobile. Casos conhecidos de QA/publicação não foram
contados como achados novos.

Foi reproduzido um defeito de datetime no editor de conteúdo global: ajustar
minutos pelo offset antes de converter para ISO atravessava mudanças de horário
de verão. Abrir e salvar um agendamento podia deslocar o instante em uma ou duas
horas. O editor agora formata diretamente a data local e mantém o ISO original
quando o início/fim não foi editado, preservando offset e microssegundos. Novos
rascunhos capturam um único instante com precisão de minuto, inclusive na hora
repetida; horários locais inexistentes são bloqueados antes da action.

Somente os schemas de início/fim de conteúdo global passaram a aceitar ISO com
offset. Testes exercitam o componente, a action e o schema reais até a escrita
interceptada, incluindo edição, criação, reset, horário repetido, início/fim,
precisão e fim opcional. Nenhuma funcionalidade ou regra de acesso foi adicionada.

Validação final desta rodada: 740 testes web aprovados (43 ignorados), segurança
4/4, typecheck e build aprovados. Nenhum novo diagnóstico de lint; o baseline
geral continua em 130 erros/62 avisos anteriores. A revisão independente do
ajuste não encontrou nova regressão. App e DB/Edge não tiveram nova alteração;
não houve repetição dos respectivos gates gerais. A publicação e a validação
visual/Sandbox continuam pendentes, assim como os demais limites já registrados.

## Nona revisão com escopo fechado

Não foi encontrado novo defeito reproduzível nos formatos e contratos revisados.
Nenhum código de aplicação foi alterado nesta rodada. Foram conferidos os
consumidores restantes de entradas numéricas e datas civis, distinguindo valores
já numéricos vindos do banco de texto digitado em formulário.

Uma matriz executável comparou 10.181 variações de telefone entre normalização,
máscaras e apresentação da web e do app, além da adaptação doméstica do Asaas
na web e no Edge. Incluiu todos os pares de dígitos de DDD, formatos nacionais
e internacionais, caracteres inválidos e 25 caracteres de espaço. Não houve
divergência. Outros 44 casos verificaram valores monetários e sua formatação.
Essas verificações usam módulos reais em processo, sem chamada ao provedor.

Novamente aprovados: 740 testes web (43 ignorados), 219 do app e 288 Node do
banco (8 ignorados), além de segurança web 4/4. `git diff --check` passou nos
três repositórios. Sem alteração de fonte, typecheck/build/lint, banco limpo,
pgTAP e export Android não foram repetidos; suas evidências anteriores continuam
registradas. QA visual/Sandbox, promoção a homologação e recuperação de compra
após refresh continuam pendentes nos termos descritos acima.

## Preservação da decisão do Renan sobre perfis indisponíveis

A revisão histórica identificou que `eebded5` mantinha a lista de atletas
disponível quando a consulta de perfis falhava. A primeira paginação havia
removido essa proteção. O ajuste autorizado restaura somente essa decisão;
o parser de valores/percentuais do item 1 da revisão histórica não foi alterado.

A consulta em homologação de 15/10/2026 confirmou 1.947 atletas com perfis
reconhecidos (1.927 padrão e 20 professores), incluindo páginas de 25/50.
O problema original do limite de 1.000 perfis já estava resolvido. O ajuste
seguinte é contingência para falha da dependência de perfis, não preenchimento
de dados faltantes nem mudança da regra de classificação.

Aplicar primeiro a migration aditiva DB
`20261015030000_resilient_athlete_profile_pagination.sql`, depois a web.
A mesma RPC conserva assinatura, ACL, busca, ordenação e limites. A consulta de
perfis é isolada; se falhar, os itens retornam `perfil: null`, contagens por
perfil ficam desconhecidas e `profilesAvailable: false`. O total e a paginação
permanecem disponíveis. A falha deixa diagnóstico SQLSTATE no log do servidor,
sem mensagem interna/dados pessoais na tela. Erros da consulta básica e de
autorização não são convertidos em lista vazia.

A web mostra “—” e um aviso com opção de tentar novamente, oculta o filtro de
perfil e desabilita somente sua ordenação. Uma seleção anterior de perfil é
removida, preservando busca/tamanho da página; restaurada a dependência, os
perfis reais voltam. A resposta anterior da RPC, sem o novo indicador, continua
compatível. O tutorial recebeu apenas ajuste de tipo, mantendo seu comportamento.

Validação direcionada: componentes reais cobrem degradação, recuperação,
paginação, filtro anterior, busca e erros. pgTAP provoca falha real do helper,
ausência da coluna/função e retorno da dependência, mantendo ACL e isolamento
entre arenas. A inspeção visual usou componentes reais renderizados em fixtures
estáticas locais, em desktop e 390px, nos estados normal, indisponível, loading,
vazio e sem permissão; não equivale a E2E autenticado. Mudanças ainda locais.

## Precisão do reajuste percentual preservada

Após alinhamento explícito com o usuário, o item 1 da revisão histórica foi
corrigido somente no reajuste percentual de produtos/serviços. Percentual usa
entrada decimal completa com ponto ou vírgula e preserva a precisão numérica
já aceita pelo cálculo e pela RPC; não foi criado um limite de três casas.
O campo não aplica formatação monetária ao perder foco. Exemplo: `2,555%` de
reajuste sobre R$ 1.000,00 continua produzindo R$ 1.025,55 no modo de centavos.
Entradas inválidas/não finitas são rejeitadas, sem leitura parcial do texto.

O modo de valor fixo continua usando o contrato de BRL. Os quatro modos de
arredondamento do preço, limites de desconto, autorização, payload/idempotência
da operação e regras de seleção não foram modificados. Comissões em pontos-base
e percentuais inteiros de estorno mantêm seus próprios contratos de precisão.

Seis testes novos exercitam a entrada, saída do campo, resumo, action real e
escrita RPC interceptada, inclusive desconto, produto/serviço, arredondamentos
e retry com o mesmo identificador. Outra comparação verificou 192 combinações
de percentual/preço/arredondamento contra a leitura anterior, 16 arquivos de
regras sem alteração, decisões/efeitos de cotação no BookingModal e 66 migrations
existentes com participação do Renan. Nenhum outro retrocesso novo foi encontrado
nos fluxos revisados; diferenças de validação e limites já registrados acima
continuam identificados separadamente. Correção local, sem nova publicação.
