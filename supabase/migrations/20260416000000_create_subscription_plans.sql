-- Tabela de planos disponíveis na aplicação.
-- Os planos são a fonte de verdade para label, preço e limites.
-- O stripe_price_id deve ser atualizado com o ID real do Stripe após rodar a migration.

create table subscription_plans (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,      -- 'starter' | 'pro' | 'max'
  label           text not null,
  price_cents     integer not null,
  max_spaces      integer not null,
  stripe_price_id text not null default '',  -- atualizar com IDs reais via UPDATE após migration
  is_active       boolean not null default true,
  features        jsonb,                     -- array de strings com benefícios do plano
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Seed dos 3 planos existentes
-- IMPORTANTE: substituir os stripe_price_id pelos valores reais das env vars
-- STRIPE_PRICE_START, STRIPE_PRICE_PRO, STRIPE_PRICE_MAX antes de rodar em produção
insert into subscription_plans (key, label, price_cents, max_spaces, stripe_price_id, sort_order, features) values
  (
    'starter',
    'Arena START',
    24900,
    5,
    '',
    1,
    '["Até 5 espaços/quadras", "Gestão de agendamentos", "Relatórios básicos", "Suporte por email"]'
  ),
  (
    'pro',
    'Arena PRO',
    54900,
    15,
    '',
    2,
    '["Até 15 espaços/quadras", "Gestão de agendamentos avançada", "Relatórios completos", "Programa de fidelidade", "Suporte prioritário"]'
  ),
  (
    'max',
    'Arena MAX',
    94900,
    30,
    '',
    3,
    '["Até 30 espaços/quadras", "Tudo do PRO", "Multi-arena", "API de integração", "Gerente de conta dedicado"]'
  );

-- RLS: planos são públicos para leitura, apenas service_role pode escrever
alter table subscription_plans enable row level security;

create policy "public_read_subscription_plans"
  on subscription_plans for select
  to anon, authenticated
  using (true);
