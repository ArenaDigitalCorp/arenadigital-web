# Preparação da homologação BaaS — Arena Digital

Status: preparação técnica local; **não submetido, não homologado e não publicado**.
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

Tipo de mudança: identificação do prestador e orientação de suporte na interface, sem alterações no modelo financeiro, taxas, RLS, autenticação, contratos de API, migrations ou dados.

Não atribuir Asaas a pagamentos manuais/offline, relatórios genéricos ou assinaturas de outros gateways. Um estado de pagamento confirmado não identifica sozinho o provedor.

O playbook classifica a integração direta como **Modelo A — Direto Tomador**. A implementação usa chaves das subcontas, correspondendo à alternativa (a) da pergunta 5. Confirmar o enquadramento com o Asaas antes do envio.

## Pendência de onboarding confirmada

A consulta autorizada em produção, somente leitura, retornou aprovação geral pendente, cadastro comercial aprovado e documentos ainda não enviados, sem `onboardingUrl` nos grupos solicitados. Não houve upload, criação, cobrança ou alteração da conta nesta auditoria.

Isso não prova que o Asaas habilitou ou desabilitou BaaS. Não encerrar, recriar ou resetar a conta para tentar resolver. Solicitar ao suporte o modelo efetivo da subconta existente e a forma de concluir seus documentos; verificar se o link dedicado depende de habilitação/migração.

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
| 6. Marca Asaas nos fluxos | Adequação técnica em preparação. Exige evidências da tela de criação de conta/subconta e outros fluxos sem acesso público. |
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
| 18. Modelo de subconta | Pretendido: Subcontas BaaS com envio pela URL dedicada. Confirmar habilitação e reaproveitamento da subconta existente com Asaas. |

### Rascunho técnico — pergunta 10

A Arena Digital é uma plataforma de gestão de arenas e reservas esportivas, com backoffice web para gestores e aplicativo para atletas. Integra o Asaas para criar contas de pagamento de titularidade das arenas, acompanhar seu cadastro e aprovação e emitir cobranças Pix de reservas no contexto de cada subconta, usando sua credencial protegida. A comissão contratual da plataforma é direcionada à conta principal por split; os valores restantes ficam na conta emissora, conforme tarifas e regras do Asaas. A plataforma apresenta a experiência e integra os serviços; o Asaas presta os serviços financeiros e de pagamentos. O onboarding BaaS pretendido utiliza o link de documentação fornecido pelo Asaas.

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

Nenhum contrato backend novo é necessário para a identificação na interface. Web e app podem ser promovidos independentemente, respeitando seu fluxo Git e autorização. Não houve commit/push/deploy nesta preparação.

Após validação local: revisão dos textos; publicação autorizada em homologação; teste integrado; publicação autorizada de web e app; reunião de evidências reais; preenchimento e revisão humana do formulário; envio autorizado; informar ao Asaas o e-mail utilizado e acompanhar análise/contrato/checklist de segurança.

Rollback: remover/reverter apenas os componentes informativos e suas inserções. Nenhuma transição financeira, credencial ou dado precisa ser desfeito.

## Perguntas ao suporte antes da submissão

1. Qual a etapa da homologação da conta principal e quais pendências permanecem?
2. A subconta já criada em avaliação pode ser aproveitada no modelo BaaS?
3. Como concluir os documentos exigidos enquanto a consulta da subconta não retorna link de onboarding?
4. Quais textos contratuais e evidências mobile são exigidos para este fluxo?

## Resultado da preparação técnica

- Web: página pública de serviços financeiros e componente de identificação/suporte; inserções no onboarding, recebimento, saldo/saque, reserva Pix pendente e assinatura somente quando o gateway é Asaas.
- App: identificação/suporte nas confirmações online e nas jornadas Pix individual/grupo, excluindo grupo gratuito, pré-reservas, pagamentos manuais e assinatura Plus das lojas.
- Notificações de convite/cancelamento e e-mails de autenticação não identificam provedor financeiro. Mantidos sem atribuição genérica ao Asaas.
- Rascunhos e auditorias: este documento, `docs/asaas-baas-transparency-audit.md` no web e `docs/asaas-baas-transparency.md` no app.

Validações executadas: web 491 testes passaram e 43 ficaram ignorados; quatro testes de segurança passaram. App: 188 testes passaram e exportação Android/Hermes passou. Typecheck web e app passaram. Lint focado passou nos arquivos novos e demais arquivos alterados; o modal de reservas web mantém sete erros preexistentes de `any`. Não declarar lint global aprovado.

QA validou a renderização dos componentes reais de onboarding em seis estados, com fronteiras de ações isoladas e dados fictícios. A página pública e o onboarding foram conferidos no navegador; o onboarding também foi inspecionado em quadro de 390 pixels. Essas capturas são locais e não comprovam publicação/homologação.

Pendências bloqueantes para declarar preparação integral do checklist: revisão e aprovação dos textos legais; orientação do Asaas sobre documentos solicitados sem link; confirmação do modelo efetivo/reaproveitamento da subconta; dados empresariais do formulário; publicação autorizada; evidências reais do app com binário atualizado e confirmação do selo remoto nativo com o Asaas. O simulador instalado tinha versão anterior; nenhuma captura desse binário foi tratada como prova do patch.
