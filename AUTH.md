# Autenticação — Supabase Auth

A aplicação web usa **Supabase Auth** (`@supabase/ssr`) como provedor de autenticação único. O Clerk foi removido do web.

## Stack

- `@supabase/ssr` — clientes Supabase para Next.js App Router (cookies)
- `@supabase/supabase-js` — SDK oficial
- Service-role admin client em `src/lib/supabase-server.ts` para operações privilegiadas

## Clientes Supabase

- `src/lib/supabase/server.ts` — `createSupabaseServerClient()` para Server Components, Route Handlers e Server Actions. Lê cookies via `next/headers`.
- `src/lib/supabase/browser.ts` — `createSupabaseBrowserClient()` para Client Components.
- `src/lib/supabase/middleware.ts` — `updateSession()` chamado pelo proxy para refresh de cookies + guard de rotas.
- `src/lib/supabase-server.ts` — `getSupabaseAdmin()` (service-role) para operações administrativas.

## Proxy (`src/proxy.ts`)

- Faz refresh dos cookies de sessão em todo request.
- Se a rota começa com `/dashboard` e não há sessão → redirect para `/sign-in?redirect_to=<path>`.
- Se a rota é `/sign-in` ou `/sign-up` e há sessão → redirect para `/dashboard`.

## Fluxo de cadastro do gestor

1. Usuário preenche `CustomSignUp` (`src/components/auth/CustomSignUp.tsx`).
2. `startSignUpAction()` (`src/modules/auth/actions/authActions.ts`) chama `supabase.auth.signUp({ email, password, options.data: { firstName, lastName, cpf, phone, arenaName, addressData } })`.
3. Supabase envia OTP de confirmação para o email.
4. O trigger `on_auth_user_created` insere automaticamente a linha em `public.users` com `id = auth.users.id`, `role = 'gestor'`, nome/cpf vindos do metadata.
5. Usuário verifica OTP via `supabase.auth.verifyOtp({ type: 'email', email, token })` — isso já cria a sessão.
6. `provisionAfterSignUpAction()` cria a `arenas` + `arena_users` para o gestor.

## Fluxo de login

`src/app/sign-in/[[...sign-in]]/page.tsx` oferece dois modos:

- **Senha:** `supabase.auth.signInWithPassword({ email, password })`
- **OTP por email:** `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })` → `verifyOtp({ type: 'email', email, token })`

Login social (Google etc.) está desabilitado por ora — para reativar, habilitar provider no painel Supabase e reintroduzir o botão + handler `signInWithOAuth` na página de sign-in.

## Auth callback

`src/app/auth/callback/route.ts` recebe o `?code=` do OAuth/magic link, chama `supabase.auth.exchangeCodeForSession(code)`, executa `provisionAfterSignUpAction()` (para garantir provisionamento de arena quando há `arenaName` no metadata) e redireciona para `next` (ou `/dashboard`).

## Reset de senha

- `/sign-in` → "Esqueci minha senha" → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/callback?next=/reset-password' })`
- `/reset-password` valida sessão e chama `supabase.auth.updateUser({ password })`.

## Helpers server-side (`src/lib/server-auth.ts`)

- `requireAuthenticatedDbUser()` — lê `supabase.auth.getUser()` e busca `public.users` pelo `id` (que é igual ao `auth.users.id`). Throw `AuthorizationError` se não autenticado ou não provisionado.
- `assertArenaAccess`, `assertArenaBackofficeAccess`, `assertArenaAdminAccess`, `assertArenaOwnerAccess`, `assertArenaSubscriptionAccess` — validações de roles por arena.
- `assertCourtAccess`, `assertBookingAccess`, `assertProductAccess`, `assertStationAccess`, `assertStationOrderAccess`, `assertRotativoAccess` — validações de recursos escopados por arena.

## CRUD de usuários da arena (`src/modules/users/actions/userActions.ts`)

Quando o gestor cria Gestor/Atendente/Caixa pelo backoffice (`/dashboard/settings/users/[arenaId]`):

- `createArenaUserAction` → `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata })` + insere linha em `public.users` (via trigger ou upsert) + cria `arena_users`.
- `updateArenaUserAction` → atualiza `public.users` + (se senha) `supabase.auth.admin.updateUserById(id, { password })`.
- `deleteArenaUserAction` → remove `arena_users` + (se for usuário com `id = auth.users.id`) `supabase.auth.admin.deleteUser(id)`.

## Tabela `public.users` durante a coexistência com mobile

| Origem | `id` | `clerk_user_id` |
|--------|------|-----------------|
| Gestor/Atendente/Caixa (web) | igual ao `auth.users.id` | `NULL` |
| Atleta | igual ao `auth.users.id` | `NULL` |

A coluna `clerk_user_id` é `nullable` e tem `unique constraint`. A coluna `email` ganhou índice único case-insensitive (`lower(email)`).

Nao ha mais webhook do Clerk no web. A coluna `clerk_user_id` permanece apenas como compatibilidade temporaria de schema e pode ser removida em uma migration futura quando os tipos Supabase forem regenerados.

## Variáveis de ambiente

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Configuração no painel Supabase

- **Auth → Providers → Email:** habilitado (com ou sem confirmação de email conforme preferência).
- **Auth → Providers → Google:** desabilitado por ora.
- **Auth → URL Configuration:**
  - `Site URL`: domínio de produção (`https://...`).
  - `Redirect URLs`: incluir `http://localhost:3000/**` (dev), domínio de prod com `/**`, e explicitamente `/auth/callback`.
- **Auth → Email Templates:** confirmation, magic link, recovery em PT-BR.
