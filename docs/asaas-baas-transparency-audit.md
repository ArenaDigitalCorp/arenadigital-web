# Transparência dos serviços Asaas — auditoria web

## Escopo e regra observada

Mudança de apresentação para identificar o Asaas nos serviços financeiros integrados. Nenhuma alteração em cobrança, split, autorização, status de aprovação, credenciais ou contratos do banco. Não declara a Arena Digital homologada e não substitui a aprovação do Asaas.

O playbook e o checklist solicitam identificação do prestador, selo individual hospedado pelo Asaas, canais de suporte e evidências das telas. A implementação preserva o URL individual fornecido e envia apenas a origem da página pelo `referrerPolicy` do selo.

## Superfícies implementadas

| Superfície | Comportamento |
| --- | --- |
| `/servicos-financeiros` | Página pública com identificação do prestador, explicação factual do cadastro e canais Asaas/plataforma; link no rodapé. |
| Cadastro e recebimento da arena | Aviso antes do formulário de criação, também nos estados iniciado/aprovado/recuperação. Documentação pendente sem link orienta consultar novamente e contatar o suporte sem reiniciar. |
| Conta financeira da arena | Aviso nos estados de conta carregada e erro; saldo/recebimento/saques preservados. |
| Destino Pix e confirmação de saque | Aviso dentro dos diálogos, com descrições para o cliente em vez de detalhes internos de cofre/idempotência. |
| Assinatura | Aviso quando o gateway configurado no servidor é Asaas. Stripe e planos continuam com regras existentes. |
| Reserva com Pix pendente do app | Aviso associado à explicação da confirmação pelo Asaas; não marca pagamentos manuais como Asaas. |

Componente reutilizável: `src/components/payments/asaas-provider-notice.tsx`.

## Lacunas e decisões pendentes

- Termos de uso e política de privacidade ainda não identificam especificamente a jornada financeira Asaas. Revisar a cláusula de responsabilidade, compartilhamento de dados/KYC, canais de atendimento e instrumento BaaS com o Asaas e o responsável jurídico antes de publicar textos vinculantes.
- O contrato original de onboarding expõe status agregado e link. A entrega local posterior acrescenta lista e upload para os grupos compatíveis sem link, conforme a documentação oficial; veja [onboarding de documentos](asaas-document-onboarding.md). A ausência de link não comprova ausência de solicitação e não exige aguardar um link por padrão.
- Relatórios, comprovantes e comunicações financeiras precisam de auditoria por origem do pagamento: há registros manuais e outras integrações. Não adicionar selo genericamente em todos os lançamentos nem identificar uma cobrança manual como processada pelo Asaas.
- Ainda faltam análise/contrato/homologação do Asaas, confirmação do aproveitamento da subconta existente e informações empresariais/de volume fornecidas pelos responsáveis.
- Prints locais não são evidências de disponibilidade em produção. Capturar URLs publicadas e telas reais aprovadas após promoção autorizada.

## Compatibilidade e rollback

Nenhuma migration, nova dependência ou variável de ambiente. Web e mobile podem ser publicados independentemente; esta entrega não exige novo backend. Rollback pela remoção das inserções do componente e da página pública, mantendo as operações financeiras intactas.

## Validação local

- `pnpm typecheck`: passou.
- ESLint dos sete arquivos alterados fora de `BookingDetailsModal.tsx`: passou.
- ESLint de `BookingDetailsModal.tsx`: sete erros `no-explicit-any` preexistentes em linhas não alteradas; não corrigidos para evitar ampliar o escopo.
- 21 testes focados existentes de onboarding, credenciais, ownership, self-service e apresentação de assinatura: passaram.
- SSR do componente real de onboarding em seis estados (não iniciado, pendente sem link, pendente com link, aprovado, recusado e recuperação), com ações isoladas e dados de teste locais: todos renderizaram; selo presente em todos e ajuda/botão de envio condicionados corretamente.
- Servidor local `/servicos-financeiros`: HTTP 200; revisão visual e evidências coordenadas pelo Tech Lead/QA.
- `pnpm exec next build --webpack`: passou, incluindo geração estática da nova página pública; CSS compilado copiado para as prévias locais isoladas.
- Gates finais executados com Node 22.19.0: `pnpm test` (491 passaram, 43 ignorados), `pnpm test:security` (4 passaram), `pnpm typecheck` e `pnpm exec next build --webpack` passaram. A primeira rodada em Node 26 não foi usada como evidência final do runtime suportado.
- Revisão visual local: página pública e onboarding com dados sintéticos; quadro de 390 pixels conferido. Capturas locais não comprovam publicação ou aprovação regulatória.

Não foram executadas operações de cobrança, saque, criação de subconta, alteração em produção ou envio do formulário nesta implementação.
