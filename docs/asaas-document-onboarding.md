# Documentos de recebimento da arena — implementação e validação

Implementação validada em `fix/asaas-document-onboarding`. A promoção segue os PRs e pipelines de `main` → `homolog` → `production`; as evidências abaixo registram a validação local, e o estado de publicação deve ser conferido no deployment do SHA promovido.

## Problema e comportamento

O responsável da arena recebia o status agregado de documentação pendente, mas a orientação sem link dependia de `asaasAccountId`, um identificador omitido corretamente do DTO de gestores. Além disso, o painel chamava qualquer cadastro iniciado de “Subconta BaaS”, sem confirmação desse enquadramento.

O painel usa agora `hasPaymentAccount` para apresentar a orientação, exibe “Cadastro iniciado” e consulta os documentos solicitados no contexto financeiro da arena. Cada grupo mostra título, orientação, estado e a ação permitida pelo Asaas:

| Situação | Ação no painel |
| --- | --- |
| `NOT_SENT` ou `REJECTED`, com link válido Asaas | Abrir o envio hospedado pelo Asaas. |
| `NOT_SENT` ou `REJECTED`, tipo conhecido e sem link | Selecionar e enviar um arquivo pela API. |
| `PENDING` ou `AWAITING_APPROVAL` | Aguardar a análise; nenhum novo upload. |
| `APPROVED` ou `IGNORED` | Nenhuma ação necessária para esse documento. |
| Tipo/estado desconhecido ou link inválido | Orientação para confirmar com o suporte; nenhum upload por fallback. |
| Envio em andamento ou resultado desconhecido | Consultar novamente; não reenviar automaticamente. |

`PENDING` no grupo significa documento enviado/em análise. É diferente do status agregado pendente, que pode incluir documentos ainda não enviados. Nenhuma resposta de upload é tratada como aprovação cadastral ou homologação BaaS.

A consulta autorizada de produção que motivou a implementação encontrou `IDENTIFICATION_SELFIE`, `IDENTIFICATION` e `ENTREPRENEUR_REQUIREMENT` em `NOT_SENT`, sem link. Esta entrega não altera esses dados nem envia documentos reais.

## Contrato e segurança

`GET /api/arenas/{arenaId}/asaas/documents` retorna `{ success, data: { groups, uploadAvailable } }`. O POST aceita multipart com `documentGroupId`, `requestId` UUID, `explicitRetry` e `documentFile`. O tipo é determinado pela consulta atual do servidor, nunca pelo formulário.

- Apenas proprietário/Gestor ativo da própria arena ou super admin explícito. A API autentica a sessão e as RPCs revalidam o ator e a arena; atletas e acesso entre arenas são negados.
- A credencial da subconta permanece no servidor. Nenhum token, payload bruto, nome de arquivo ou conteúdo integra logs ou erros. O arquivo fica em memória durante a requisição e segue diretamente ao Asaas, com nome genérico.
- Origem do POST deve ser a mesma da aplicação. O corpo é limitado durante a leitura, incluindo multipart. Arquivos de até 3 MiB em JPG/PNG/PDF são validados por tamanho, MIME, extensão e assinatura; selfie aceita JPG/PNG.
- O limite conservador mantém a requisição abaixo do teto do transporte web. É uma restrição desta interface, não uma afirmação sobre o limite do Asaas.
- URLs hospedadas aceitam apenas HTTPS em domínios Asaas. A chamada ao provedor não segue redirects nem faz retry automático.
- O claim durável precede qualquer upload. Solicitação repetida com o mesmo UUID/conteúdo devolve o estado registrado. Conteúdo diferente com o mesmo UUID é recusado. Uma nova tentativa depois de envio/rejeição exige consentimento explícito e consulta remota fresca.
- Timeout/falha de rede/5xx deixam resultado `unknown`. O painel bloqueia reenvio; uma consulta que confirme documentos recebidos permite reconciliação sem transmitir arquivos. Ausência de confirmação requer conferência operacional.

Contrato completo de persistência e concorrência: `arenadigital-db/schema-contracts/arena.asaas-document-onboarding.md`. O banco guarda apenas metadados operacionais e digest; não guarda documentos nem nomes de arquivo.

## Ordem para publicar

1. Revisar e integrar as branches de DB e web em `main`, pelos PRs próprios.
2. Promover DB `main` → `homolog`; aplicar a migration aditiva antes do consumidor web.
3. Promover web `main` → `homolog`; validar com responsável de teste autorizado: consultar grupos, enviar um documento próprio, acompanhar análise e conferir permissões.
4. Registrar a aprovação da homologação. Promover DB `homolog` → `production` com os gates obrigatórios de backup/preflight/dry-run; depois web `homolog` → `production`, mediante autorização.
5. O responsável de cada arena conclui suas exigências. A aprovação da arena e a homologação BaaS da plataforma continuam etapas distintas.

Não é necessário novo build do app para esta melhoria do backoffice. Consumidores anteriores continuam compatíveis. Sem a migration, a web pode listar as exigências e usar links, mas bloqueia o upload com orientação de configuração. Rollback: reverter o consumidor web, preservando a migration e o histórico de tentativas, para manter a proteção contra repetição.

## Aceite e limites da validação

- Testes automatizados: regressões de orientação/badge, renderização React real, tipos/status/link, arquivos, autorização, rotas, transporte e tentativas duráveis; SQL real e concorrência entre sessões.
- Revisão visual local: componente real com dados e API simulados, incluindo pendente/link/enviado/aprovado/erro/vazio/reenvio e largura reduzida. A simulação não comprova upload upstream ou aprovação de uma subconta.
- Não enviar documentos de identidade fictícios ao Asaas. O teste integrado requer documentos próprios do responsável e ambiente autorizado.
- Textos legais: a redação de termos de uso/privacidade e responsabilidades ainda depende da validação do Asaas e do jurídico. A interface informativa já existente não substitui contrato ou homologação.
- Resultado desconhecido sem confirmação remota e retenção/expurgo de metadados são follow-ups operacionais; esta entrega não cria um reset que permita reenviar sem prova.

Fontes: [documentos via API](https://docs.asaas.com/reference/enviar-documentos), [consulta dos documentos](https://docs.asaas.com/reference/verificar-documentos-pendentes), [envio hospedado](https://docs.asaas.com/docs/onboarding-e-envio-de-documentos-via-link).

## Recusa do método de envio

Uma recusa HTTP do Asaas não comprova erro de extensão ou conteúdo. O transporte preserva somente status HTTP e códigos de uma lista fixa para diagnóstico, sem reter descrições, arquivos ou payloads do provedor. Corpos inválidos, interrompidos ou excessivos não transformam uma recusa HTTP definitiva em resultado desconhecido.

Quando uma resposta 400/422 contém `invalid_object` e informa precisamente que o tipo de documento não pode ser enviado via API, o painel recebe `provider_document_api_unavailable` (409) com orientação fixa para contatar o suporte do Asaas e confirmar o método de envio. A tentativa continua `failed`/`provider_rejected`, compatível com a persistência existente. Outras recusas não são interpretadas como restrição do método.

Na reprodução autorizada em produção, um JPEG válido foi recusado dessa forma para selfie, enquanto o grupo continuava `NOT_SENT` e sem `onboardingUrl`. O requerimento empresarial já estava `PENDING`. Isso confirma a restrição do método para a selfie daquela conta; não confirma erro no arquivo de identificação nem o enquadramento BaaS. Sem um método disponível, o Asaas precisa orientar o responsável ou disponibilizar o fluxo apropriado. Não inventar link, alterar o tipo solicitado ou reenviar em outro grupo.

Testes de regressão cobrem a classificação específica, resposta neutra para outras recusas, limites de leitura, diagnóstico sem dados privados e preservação da confirmação de retry. A correção melhora a orientação e a investigação; não habilita o recebimento de documentos no Asaas.

## Evidências executadas nesta entrega

Gates finais executados com Node 22.19.0:

| Gate | Resultado |
| --- | --- |
| Web `pnpm test` | 600 passaram, 43 ignorados, nenhuma falha. Inclui 109 testes novos desta entrega. |
| Web `pnpm test:security` | Quatro passaram. |
| Web `pnpm typecheck` | Passou; o build final também executou TypeScript. |
| Web `pnpm exec next build --webpack` | Passou, incluindo a nova rota dinâmica. |
| ESLint de todos os arquivos de código/testes alterados | Passou. |
| Web `pnpm lint` global | Não passou: 133 erros e 63 warnings em código fora dos arquivos alterados. Não declarar lint global aprovado. |
| DB `npm run validate` | Passou: 267 testes, oito ignorados; validação/check de Edge Functions e paridade passaram. |
| DB `supabase db reset --local` + `supabase test db` | Passaram: migration aplicada em banco limpo e 1.797 testes SQL em 77 arquivos; 58 cenários novos. |
| DB concorrência local com dois processos `psql` | Sete passaram: três de documentos e quatro regressões de Turmas. |
| `git diff --check`, ambos os repos | Passou. |

A revisão visual usou o componente React real e API local simulada: envio, erro persistente, consentimento/nova solicitação de reenvio, análise, aprovado, link, resultado desconhecido, vazio, indisponibilidade e migration ausente. Conferida largura de 390 pixels e restaurado o viewport. Nenhum documento real foi enviado ao Asaas.

Arquivos principais: `ArenaPixSplitSettingsCard.tsx`, novo `ArenaAsaasDocumentsPanel.tsx`, rota de documentos, DTO/domínios/serviços de autorização/transporte/tentativas, integração em `arenaActions.ts` e `asaas-baas.service.ts`, testes e documentação no web; migration, contrato, pgTAP, concorrência e CI no DB. O app não foi alterado nesta entrega.
