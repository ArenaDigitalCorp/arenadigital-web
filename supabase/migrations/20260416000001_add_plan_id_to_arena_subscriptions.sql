-- Adiciona FK plan_id em arena_subscriptions apontando para subscription_plans.
-- Mantém plan_key (texto) para compatibilidade com metadata do Stripe e chaves de idempotência.
-- O plan_id fica nullable inicialmente para compatibilidade com o fluxo de create-setup-intent
-- que cria a row antes de confirmar o plano. Pode ser tornado NOT NULL em migration futura.

alter table arena_subscriptions
  add column plan_id uuid references subscription_plans(id);

-- Back-fill: preencher plan_id para rows existentes a partir do plan_key
update arena_subscriptions sub
set plan_id = sp.id
from subscription_plans sp
where sp.key = sub.plan_key
  and sub.plan_id is null;

create index idx_arena_subscriptions_plan_id on arena_subscriptions (plan_id);
