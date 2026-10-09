# Preparação da homologação BaaS — Arena Digital

Status: a identificação do Asaas foi publicada na entrega anterior. As melhorias de documentos estão implementadas e validadas; a publicação é acompanhada pelos PRs e deployments dos ambientes. **Não há confirmação da homologação BaaS nem submissão do checklist.**
Data da auditoria: 8 de outubro de 2026.

## Fontes e limites

- Playbook de BaaS para clientes Asaas, fornecido pelo suporte: páginas 4, 6–7, 10–17.
- [Checklist oficial](https://docs.google.com/forms/d/e/1FAIpQLSc6wr8qBnncEo68bAW1SwIE589v2JemGyzZQhJA71v075QdzQ/viewform): 18 perguntas, URLs e arquivos de evidência; inspecionado sem preencher/enviar.
- [Período de avaliação](https://docs.asaas.com/docs/faq-periodo-de-avaliacao).
- [Gestão das chaves de subcontas](https://docs.asaas.com/docs/gerenciamento-de-chaves-de-api-de-subcontas).
- O cadastro comercial aprovado de uma arena não comprova aprovação da sua subconta nem homologação BaaS da plataforma.
- Receber o selo/checklist não comprova contrato assinado ou homologação aprovada.

## Regra observada e escopo

O Pix de reservas é emitido no contexto da subconta da arena, usando sua credencial protegida. O split envia a comissão para a carteira da plataforma. A emissão depende da aprovação/ativação da subconta. Evidência: `arenadigital-db/supabase/functions/booking-pix-payment/index.ts` e `_shared/asaas-runtime.ts`.

A entrega anterior adicionou identificação do prestador e suporte na interface. A entrega atual completa documentos e inclui contrato/RPCs e migration aditiva para tentativas duráveis, sem alterar cobrança, split ou aprovação. Detalhes e ordem de publicação: [onboarding de documentos](asaas-document-onboarding.md).

Não atribuir Asaas a pagamentos manuais/offline, relatórios genéricos ou assinaturas de outros gateways. Um estado de pagamento confirmado não identifica sozinho o provedor.

O playbook classifica a integração direta como **Modelo A — Direto Tomador**. A implementação usa chaves das subcontas, correspondendo à alternativa (a) da pergunta 5. Confirmar o enquadramento com o Asaas antes do envio.

## Pendência de onboarding confirmada

A consulta autorizada em produção, somente leitura, retornou aprovação geral pendente, cadastro comercial aprovado e documentos ainda não enviados, sem `onboardingUrl` nos grupos solicitados. Não houve upload, criação, cobrança ou alteração da conta nesta auditoria.

Os grupos retornados são `IDENTIFICATION_SELFIE`, `IDENTIFICATION` e `ENTREPRENEUR_REQUIREMENT`, em `NOT_SENT`. A documentação oficial permite envio pela API para esses tipos quando não há link dedicado; esse fluxo está implementado localmente. Não é necessário esperar um link para concluir essas solicitações após a publicação e validação da melhoria. Isso não confirma o enquadramento ou a homologação BaaS: o modelo efetivo e as pendências contratuais devem ser confirmados com o Asaas. Não encerrar, recriar ou resetar a conta para tentar resolver.

## Rascunho das respostas do checklist

Não marcar respostas por conveniência. As respostas abaixo são preparatórias; validação empresarial e evidências são necessárias antes de submeter.

| Pergunta | Preparação / responsável |
| --- | --- |
| E-mail; empresa/CNPJ | Informados e conferidos pelo responsável empresarial. Não guardar identificadores pessoais neste documento. |
| 1. Nome/marca com termos reservados | A marca Arena Digital não usa os termos listados. Revisar todos os canais e razão social antes da resposta final. |
| 2. Asaas como prestador; plataforma como canal | Coerente com o fluxo técnico. Depende de validação e formalização contratual e evidências. |
| 3. Clareza nos canais/interfaces | Responder apenas após conferir os fluxos publicados e anexar provas. Patch local não é evidência de produção. |
| 4. Clientes repassam serviços financeiros a terceiros | Decisão empresarial a confirmar com Asaas. Arena oferecendo uma reserva não deve ser automaticamente classificada como revenda de BaaS. |
| 5. Estrutura da operação | Rascunho: (a), Direta Tomador, pois usamos a chave da subconta em nome da arena. |
| 6. Marca Asaas nos fluxos | Identificação implementada e publicada na entrega anterior. Exige evidências reais da tela de criação de conta/subconta e dos outros fluxos protegidos, incluindo app. |
| Evidências: URLs e prints | Links reais publicados; prints limpos de onboarding e telas protegidas, sem PII, valores reais, credenciais ou documentos. |
| 7. Exclusividade do provedor BaaS | Confirmar empresarialmente o serviço abrangido. Outros gateways de assinaturas não devem ser confundidos automaticamente com outro provedor BaaS. |
| 8. Tarifas financeiras próprias | O formulário exclui remuneração via split/overprice desta pergunta. Revisar contratos e cobrança real antes de responder. |
| 9. Apresentação como instituição autorizada | Revisar site, app, redes e materiais comerciais; não presumir conformidade de todos os canais pelo código. |
| 10. Modelo de negócio | Usar o rascunho técnico abaixo, após revisão empresarial. |
| 11. Links públicos | Site/redes sociais oficiais fornecidos pelos responsáveis. |
| 12. Canais da oferta | Backoffice web para gestores e app para atletas; descrever apenas funções reais de cada canal. |
| 13. Volume de clientes/subcontas | Estimativa fornecida pela empresa; não inferir a partir dos usuários do app. |
| 14. Volume financeiro mensal | Estimativa empresarial, diferenciando valor total de reservas e comissão da plataforma. |
| 15. Estrutura operacional | Número de funcionários informado pelo responsável. |
| 16. Faturamento anterior | Valor validado com responsável/contabilidade; não equivale ao volume processado. |
| 17. Avaliação do atendimento | Descrever processo real existente; não afirmar programa inexistente. |
| 18. Modelo de subconta | Confirmar o modelo cadastrado com o Asaas. A capacidade técnica suporta link dedicado quando retornado e API nos grupos compatíveis sem link; não marcar “Subcontas BaaS” apenas porque a criação funcionou. |

### Rascunho técnico — pergunta 10

A Arena Digital é uma plataforma de gestão de arenas e reservas esportivas, com backoffice web para gestores e aplicativo para atletas. Integra o Asaas para criar contas de pagamento de titularidade das arenas, acompanhar seu cadastro e aprovação e emitir cobranças Pix de reservas no contexto de cada subconta, usando sua credencial protegida. A comissão contratual da plataforma é direcionada à conta principal por split; os valores restantes ficam na conta emissora, conforme tarifas e regras do Asaas. A plataforma apresenta a experiência e integra os serviços; o Asaas presta os serviços financeiros e de pagamentos. A documentação cadastral é concluída pela jornada permitida pelo Asaas: link dedicado quando fornecido ou envio pela API para grupos compatíveis sem link. A capacidade de upload está implementada localmente e depende da sua publicação e validação integrada.

Não informar operações em uso ou volumes que ainda não existem. Distinguir capacidade implementada e uso efetivo em produção.

## Textos legais — revisão necessária

A cláusula de referência está na página 11 do playbook. Não alterar termos aceitos pelos clientes nem publicar uma declaração contratual sem revisão. O próprio documento também orienta não criar/alterar documentos relacionados ao processamento financeiro sem o Asaas. Confirmar com eles a redação final, o nome da tomadora e os serviços efetivamente oferecidos; encaminhar para revisão jurídica.

O texto informativo de interface não substitui essa cláusula, contrato BaaS ou aceite dos termos do prestador.

## Evidências e aceite

- Tela de criação de subconta com selo individualizado visível antes do envio.
- Conta de recebimento: estados não iniciado, pendente, documentos sem link, documentos com link, aprovado e falha de sincronismo.
- Saldo/saque Pix e checkout realmente operado pelo Asaas, quando aplicáveis.
- App: Pix individual/grupo, retorno/erro/offline e comprovante associado ao Asaas; pagamentos manuais não devem receber essa atribuição.
- Verificar selo remoto em rede real, legibilidade, foco/área de toque e links de suporte. Preservar identificação textual caso imagem não carregue.
- Não enviar capturas locais como se fossem produção nem marcar documentos pendentes como aprovados.
- Testes reais de cobrança/split/estorno dependem de homologação e dados de teste; não gerar cobrança de produção para obter evidência.

## Ordem de entrega e rollback

A identificação na interface foi publicada anteriormente. A nova capacidade de envio precisa da migration de documentos no DB antes do consumidor web; não exige novo binário do app. O estado dessa promoção deve ser conferido nos PRs e no deployment correspondente ao SHA da branch de ambiente. A [ordem de publicação](asaas-document-onboarding.md) respeita os PRs e gates de cada ambiente.

Próximas etapas: publicar e validar os documentos em homologação; promover DB/web para produção com autorização; obter a redação legal aprovada; concluir KYC da arena; reunir as evidências reais e dados empresariais; revisar o formulário com os responsáveis e enviá-lo com autorização; informar ao Asaas o e-mail utilizado e acompanhar análise/contrato/checklist de segurança. Confirmar com o Asaas em paralelo o modelo e a etapa de avaliação/homologação da conta principal.

Rollback da identificação: reverter apenas os componentes informativos. Rollback do upload: reverter o consumidor web e preservar o histórico durável no DB, evitando reapresentar documentos que já possam ter sido recebidos.

## Perguntas ao suporte antes da submissão

1. Qual a etapa da homologação da conta principal e quais pendências permanecem?
2. A subconta já criada em avaliação pode ser aproveitada no modelo BaaS?
3. Existe alguma restrição específica para concluir os grupos compatíveis sem link pela API nesta conta? A documentação geral confirma esse método; não esperar um link como condição padrão.
4. Quais textos contratuais e evidências mobile são exigidos para este fluxo?

## Resultado da preparação técnica

- Web: página pública de serviços financeiros e componente de identificação/suporte; inserções no onboarding, recebimento, saldo/saque, reserva Pix pendente e assinatura somente quando o gateway é Asaas.
- App: identificação/suporte nas confirmações online e nas jornadas Pix individual/grupo, excluindo grupo gratuito, pré-reservas, pagamentos manuais e assinatura Plus das lojas.
- Notificações de convite/cancelamento e e-mails de autenticação não identificam provedor financeiro. Mantidos sem atribuição genérica ao Asaas.
- Rascunhos e auditorias: este documento, `docs/asaas-baas-transparency-audit.md` no web e `docs/asaas-baas-transparency.md` no app.

Validações da entrega anterior: web 491 testes passaram e 43 ficaram ignorados; quatro testes de segurança passaram. App: 188 testes passaram e exportação Android/Hermes passou. Typecheck web e app passaram. Lint focado passou nos arquivos novos e demais arquivos alterados; o modal de reservas web mantém sete erros preexistentes de `any`. Não declarar lint global aprovado.

QA validou a renderização dos componentes reais de onboarding em seis estados, com fronteiras de ações isoladas e dados fictícios. A página pública e o onboarding foram conferidos no navegador; o onboarding também foi inspecionado em quadro de 390 pixels. Essas capturas são locais e não comprovam publicação/homologação.

Pendências para declarar preparação integral do checklist: revisão e aprovação dos textos legais; publicação e teste integrado do novo envio de documentos; confirmação do modelo efetivo/reaproveitamento da subconta; dados empresariais do formulário; evidências reais do app com binário atualizado e confirmação do selo remoto nativo com o Asaas. O simulador instalado tinha versão anterior; nenhuma captura desse binário foi tratada como prova do patch.
