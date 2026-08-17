# Telemetry e observabilidade do web

## Stack adotada

O web usa OpenTelemetry como padrão de instrumentação e Logfire como destino de traces, spans e eventos técnicos.

- `@vercel/otel` registra automaticamente as operações server-side do Next.js em `src/instrumentation.ts`.
- `logfire` cria logs e spans de negócio no servidor, preservando os campos estruturados e a sanitização já existente.
- `@pydantic/logfire-browser` captura traces do navegador, navegação e erros globais.
- O proxy `/logfire-proxy/v1/traces` encaminha os traces do browser para o endpoint OTLP usando `LOGFIRE_TOKEN` somente no servidor.
- Google Analytics 4 ficou opcional e deve ser usado apenas para analytics de produto, caso ainda seja necessário.

Esse desenho segue a integração oficial do Logfire para Next.js: OpenTelemetry no servidor, SDK browser com instrumentações web e um proxy same-origin para não expor o token no cliente. Consulte a [integração do Logfire com Next.js](https://pydantic.dev/docs/logfire/typescript-sdk/frameworks/nextjs/) e a [referência do SDK browser](https://pydantic.dev/docs/logfire/typescript-sdk/packages/browser/).

## Variáveis de ambiente

Defina no ambiente do servidor:

```env
LOGFIRE_TOKEN=seu-write-token
LOGFIRE_SERVICE_NAME=arenadigital-web
LOGFIRE_ENVIRONMENT=local
OTEL_EXPORTER_OTLP_ENDPOINT=https://logfire-api.pydantic.dev
OTEL_EXPORTER_OTLP_HEADERS=Authorization=seu-write-token
```

Para habilitar os traces do browser:

```env
NEXT_PUBLIC_LOGFIRE_ENABLED=true
NEXT_PUBLIC_LOGFIRE_ENVIRONMENT=local
NEXT_PUBLIC_APP_VERSION=0.1.0
```

O token nunca deve usar o prefixo `NEXT_PUBLIC_`. O navegador chama apenas `/logfire-proxy/v1/traces`; o proxy adiciona a autorização no servidor. Em produção, altere `LOGFIRE_ENVIRONMENT` para `production` e configure as variáveis no provedor de hospedagem, sem versioná-las no repositório.

O GA4 é opcional:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Sem essa variável, nenhum script do GA4 é carregado.

## Onde ver as informações

No projeto do Logfire, use a visualização de traces e logs para filtrar por:

- `service.name`: `arenadigital-web` ou `arenadigital-web-browser`;
- `deployment.environment.name`: `local`, `staging` ou `production`;
- `severity`: especialmente `error` e `warning`;
- `correlation_id`: para relacionar uma requisição com o erro observado no browser;
- `component`, `operation`, `route`, `action`, `source` e `outcome`.

Os traces server-side incluem a instrumentação automática do Next.js e spans manuais das operações observadas por `observeHttpRequest` e `observeServerAction`. Os traces browser-side incluem fetch/XHR, navegação e os eventos manuais de tela e ação.

Para os fluxos já mapeados, `TelemetryPageView` registra telas automaticamente e `trackAction` registra os principais resultados de cadastro, autenticação, reservas, comandas, pagamentos, financeiro, catálogo, estoque e assinatura. Os nomes atuais estão mantidos:

| Área | Eventos |
| --- | --- |
| Navegação | `screen_view`, `navigation_click` |
| Cadastro e acesso | `signup_email_check_success/failure`, `signup_submit_success/failure`, `signin_password_success/failure`, `signin_otp_success/failure`, `password_reset_request_success/failure` |
| Reservas | `booking_save_success/failure`, `booking_conflict_detected`, `booking_cancel_success/failure`, `booking_payment_success/failure` |
| Mensalistas | `membership_plan_save_success/failure` |
| Estações/comandas | `order_open_success/failure`, `order_item_add_success/failure`, `order_payment_success/failure`, `order_close_success/failure` |
| Financeiro e catálogo | `finance_transaction_success/failure`, `catalog_item_save_success/failure`, `stock_entry_success/failure` |
| Assinatura | `subscription_setup_success/failure`, `subscription_cancel_success/failure`, `subscription_reactivate_success/failure` |
| Falhas gerais | `client_error`, `action_failure` |

Os parâmetros seguem uma allowlist técnica. IDs de arena, estação, quadra, produto, pedido e entidade são pseudônimos; nomes, e-mails, CPF/CNPJ, telefones, senha, texto livre, tokens e dados de cartão não são enviados.

## Como validar

1. Crie um projeto no Logfire e gere um write token.
2. Configure `LOGFIRE_TOKEN`, `LOGFIRE_SERVICE_NAME`, `LOGFIRE_ENVIRONMENT`, `OTEL_EXPORTER_OTLP_ENDPOINT` e `OTEL_EXPORTER_OTLP_HEADERS` no servidor. O valor do header deve usar o mesmo write token do `LOGFIRE_TOKEN`.
3. Configure `NEXT_PUBLIC_LOGFIRE_ENABLED=true` no build do web.
4. Abra o web, navegue por uma tela e execute uma ação de teste.
5. No Logfire, filtre pelo serviço e ambiente e confirme um trace com `screen_view` ou com a operação executada.
6. Provoque uma falha controlada e confirme um evento `telemetry.client.*` ou um span com `outcome=failed`.
7. Confira no navegador que o token não aparece no bundle nem nas requisições do client; ele deve existir apenas no proxy server-side.

Não é necessário adicionar um OpenTelemetry Collector nesta primeira etapa: o SDK envia diretamente ao endpoint OTLP do Logfire. Um Collector pode ser introduzido depois se a aplicação precisar enviar os mesmos dados para mais de um backend ou aplicar regras centralizadas de retenção e amostragem.

## Privacidade e operação

O Logfire recebe os atributos já filtrados pela allowlist do web. Erros do browser são reportados com tipo e origem sanitizados, sem enviar a mensagem original do erro. A sessão RUM é habilitada para correlacionar eventos da mesma sessão, mas não substitui identificação de usuário nem deve receber PII.

Se a política de privacidade exigir consentimento, condicione `ClientInstrumentation`, os eventos manuais e o GA4 ao mecanismo de consentimento antes de iniciar a coleta.

## Próximos passos

Depois da revisão desta fatia, os próximos ajustes recomendados são:

- criar painéis e alertas no Logfire para erros, falhas de ação e aumento de latência;
- completar a instrumentação manual das áreas de menor prioridade que ainda não têm eventos de negócio;
- adicionar a mesma convenção de atributos no app mobile e no backend, mantendo `arenadigital-db` apenas como fonte dos contratos;
- decidir a política de amostragem e retenção para produção antes de aumentar o volume de tráfego.
