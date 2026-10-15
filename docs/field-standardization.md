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
