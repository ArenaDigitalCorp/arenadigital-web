# Arena Digital Web — instruções para agentes

Este repositório contém o backoffice Next.js. O schema, RLS, RPCs e migrations pertencem a `arenadigital-db`; não crie um segundo caminho de banco aqui.

## Fluxo Git obrigatório

- `main`: integração/desenvolvimento.
- `homolog`: ambiente de homologação.
- `production`: código aprovado para produção.
- Crie branches de tarefa a partir da `main` atualizada e abra o primeiro PR para `main`.
- Promova somente `main` → `homolog` → `production`.
- PR para `homolog` só pode vir de `main`; PR para `production` só pode vir de `homolog`.
- Não use squash ou rebase nos PRs de promoção. Nunca envie branch de tarefa diretamente para `homolog` ou `production`.

## Deploy e contratos

- O projeto de produção do hosting deve rastrear exclusivamente `production`; `homolog` usa o ambiente/configuração de staging.
- `main` não pode publicar produção.
- Mudança que dependa de backend novo declara a ordem DB → web/app e mantém compatibilidade com a versão anterior.
- Não faça commit, push, merge, deploy, mudança de environment ou operação destrutiva sem autorização explícita.

## Gates mínimos

Execute `pnpm test`, `pnpm test:security`, `pnpm typecheck`, `pnpm lint` e `pnpm build` conforme o risco. Mudança visual também exige verificação no navegador dos estados de loading, vazio, erro, permissão e responsividade.
