# Dados de recebimento — fluxo e validação

Esta tela usa o HTML `arena_editar_arena_v31.html` como referência de organização e comportamento. A seleção de um arquivo e o clique em um selo do protótipo não equivalem a envio ou aprovação reais: os estados operacionais continuam vindo do Asaas e do banco.

## Ordem DB → web

1. Disponibilizar no ambiente a migration do repositório `arenadigital-db`: `20261108120000_arena_receiving_setup.sql`, após as dependências existentes de política, subconta e documentos.
2. Confirmar as RPCs autenticadas `get_arena_receiving_setup`, `save_arena_receiving_draft` e `set_arena_receiving_booking_mode` e seus testes de autorização/concorrência.
3. Disponibilizar a versão web correspondente e executar os cenários abaixo. O app continua consumindo a modalidade efetiva; não precisa interpretar a intenção pendente.

Sem o contrato novo, a web apresenta erro de configuração e opção de atualizar; não confirma um rascunho ou uma modalidade sem resposta válida. O contrato detalhado está em `arenadigital-db/docs/operations/arena-receiving-setup.md`. O histórico de políticas, tentativas de upload e intenções deve ser preservado em uma eventual reversão do consumidor.

## Fluxo do responsável

- Selecionar **Pagamento online** mostra política e conta de recebimento. Selecionar **Pré-reserva** ou **Desativado** oculta essas etapas; a escolha só passa a valer ao salvar. A navegação entre opções preserva as alterações locais durante a edição.
- A política tem rascunho e publicação independentes da conta. Uma regra de 4h/100% significa 100% com pelo menos quatro horas e 0% abaixo disso. Com 24h/100% e 4h/50%, os intervalos são: pelo menos 24h → 100%; de 4h até menos de 24h → 50%; menos de 4h → 0%. A interface não exige uma regra técnica de 0h/0%; regras legadas explícitas de 0h com reembolso continuam válidas. Reservas anteriores conservam a versão aceita.
- **Salvar rascunho** da conta aceita dados parciais e registra uma revisão. Não cria subconta, envia documentos, publica política ou habilita online. Uma revisão desatualizada é recusada para evitar sobrescrever a edição de outro responsável.
- **Confirmar e iniciar cadastro** envia os dados completos ao fluxo existente de criação da subconta. Depois, os documentos exigidos são consultados no provedor. Não há uma lista fixa de três documentos.
- **Solicitar pagamento online** exige na tela política publicada, cadastro iniciado e confirmação de todos os envios. Apenas selecionar arquivos não libera o botão. Grupos `PENDING`, `AWAITING_APPROVAL`, `APPROVED` ou `IGNORED` contam como concluídos para a solicitação; uma tentativa confirmada como `submitted` também cobre um grupo ainda `NOT_SENT`. Estado desconhecido, carregamento, falha de consulta ou tentativa `unknown`/`processing`/`failed` bloqueiam. Lista vazia não confirma envio; aprovação documental agregada ou conta já habilitada são a exceção confirmada.
- Ao solicitar, a modalidade efetiva permanece como estava (**Desativado** ou **Pré-reserva**) durante a análise. Conta já pronta pode ativar online imediatamente. Caso contrário, a aprovação/sincronização financeira e a consulta de status reavaliam a intenção pendente. O selo de situação é informativo.
- Salvar **Pré-reserva** ou **Desativado** durante a análise mantém a solicitação pendente. Apenas **Cancelar solicitação online** cancela explicitamente a intenção. Rejeição, indisponibilidade financeira ou recuperação de credencial também impedem a ativação automática. Alterar outros dados da arena durante a análise cancela conservadoramente a solicitação; a tela orienta revisar e solicitar de novo. Aprovações posteriores não reativam pedidos cancelados.

## Requisitos do provedor e permissões

A confirmação documental na tela organiza a solicitação; a autorização e a ativação são conferidas no servidor. A ativação exige arena ativa, visível e não demo; política publicada válida; conta Asaas aprovada e operacional; identificadores de conta/carteira, credencial protegida e webhook exclusivo; nenhuma recuperação pendente. Uma aprovação financeira sem intenção explícita não habilita online.

Donos e gestores acessam apenas suas arenas. As ações administrativas de reconciliação e credenciais permanecem exclusivas da plataforma. Chaves financeiras não são enviadas ao navegador. Métodos de upload, links autorizados, limites de arquivo e tratamento de resultados incertos continuam no [fluxo de documentos existente](asaas-document-onboarding.md). Aprovação da conta não comprova homologação BaaS da plataforma.

## QA

| Cenário | Resultado esperado |
| --- | --- |
| Desativado/pré-reserva → selecionar online → voltar | Etapas aparecem/ocultam; nenhuma modalidade muda antes da confirmação. |
| Rascunho financeiro parcial, recarga e duas sessões | Dados persistem; salvar não chama criação de conta; revisão antiga falha sem sobrescrita. |
| Primeira política 4h/100%, múltiplas faixas e regra legada 0h/25% | Resumos sem sobreposição; complemento 0% só quando não há regra explícita; publicação é separada do rascunho. |
| Arquivo escolhido, envio confirmado, rejeição, erro, vazio e resultado desconhecido | Só confirmação real libera a etapa documental; ação permitida acompanha o estado do provedor. |
| Política ausente, conta pendente ou documentos incompletos | Checklist indica a pendência; não há confirmação falsa de pagamento ativo. |
| Solicitar durante análise → recarregar → aprovação real | A modalidade anterior persiste enquanto pendente; online só aparece após todos os requisitos. |
| Cancelar antes de um evento atrasado/duplicado | Modalidade escolhida permanece; nenhuma reativação automática. |
| Alterar a arena enquanto há solicitação pendente | Solicitação cancelada com orientação; novo pedido exige revisão atual. |
| Gestor de outra arena, atleta, sessão ausente | Nenhuma consulta ou alteração não autorizada. |
| Tela estreita, teclado, loading, erro e perda de conexão | Formulários legíveis; foco acessível; mensagens mantidas; recuperação sem nova criação/upload automático. |

## Limites da validação local

Testes de componentes e respostas simuladas comprovam regras de interface e chamadas esperadas. SQL/concorrência em uma stack local comprovam o contrato de persistência. Esses testes não comprovam criação, upload, aprovação de uma subconta no Asaas, homologação BaaS ou publicação em qualquer ambiente.

A validação integrada do provedor requer ambiente autorizado, credenciais configuradas e documentos próprios do responsável. Não enviar documentos fictícios para obter aprovação. Consultar os resultados efetivamente executados desta entrega e os logs antes de declarar um gate aprovado; esta página é o roteiro de validação.
