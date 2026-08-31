# arenadigital-web

Backoffice web da Arena Digital em Next.js. O banco e os contratos compartilhados são mantidos em `arenadigital-db`.

## Fluxo de branches

- `main`: integração/desenvolvimento;
- `homolog`: staging;
- `production`: produção.

Crie a branch da tarefa a partir de `main`, abra o primeiro PR para `main` e promova somente `main` → `homolog` → `production`. Os PRs entre branches de ambiente não usam squash/rebase.

No provedor de hosting, a production branch deve ser `production`; `homolog` deve usar variáveis e domínio de staging. `main` pode gerar preview, mas não publica produção.

## Validação

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm test:security
pnpm typecheck
pnpm lint
pnpm build
```
