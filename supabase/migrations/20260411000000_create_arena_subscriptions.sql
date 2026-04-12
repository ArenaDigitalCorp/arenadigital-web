create table arena_subscriptions (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references arenas(id),
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  plan_key text not null,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on arena_subscriptions (arena_id);
create index on arena_subscriptions (stripe_customer_id);
create index on arena_subscriptions (stripe_subscription_id);
