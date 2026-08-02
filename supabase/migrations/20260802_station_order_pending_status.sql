-- =============================================================================
-- Status "Pendente" para comandas de Estações (station_orders)
-- Aplicar manualmente no SQL Editor do Supabase (projeto Web Gestor).
-- Idempotente: pode ser executado mais de uma vez sem efeitos colaterais.
--
-- IMPORTANTE — conferir antes de aplicar:
-- 1) O nome do CHECK constraint de station_orders.status abaixo
--    (`station_orders_status_check`) é uma suposição — a tabela foi criada
--    direto no Supabase Studio e não há migration local para ela. Rode
--      select conname, pg_get_constraintdef(oid)
--      from pg_constraint
--      where conrelid = 'public.station_orders'::regclass and contype = 'c';
--    para confirmar o nome real e ajustar o DROP CONSTRAINT se necessário.
-- 2) A função close_station_order (não versionada aqui) hoje só é chamada a
--    partir de comandas 'open'. Depois de aplicar esta migration, teste
--    registrar um pagamento que zera o saldo de uma comanda 'pending' — se
--    ela não fechar, a função precisa ser ajustada para aceitar também
--    status = 'pending'.
-- =============================================================================

-- 1. Novo status 'pending' no CHECK constraint -----------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.station_orders'::regclass
      and conname = 'station_orders_status_check'
  ) then
    alter table public.station_orders drop constraint station_orders_status_check;
  end if;

  alter table public.station_orders
    add constraint station_orders_status_check
    check (status in ('open', 'pending', 'closed', 'cancelled'));
end $$;

-- 2. Coluna para exibir "pendente desde" sem precisar de join --------------------------
alter table public.station_orders
  add column if not exists pending_marked_at timestamptz;

-- 3. Histórico de mudanças de status ----------------------------------------------------
create table if not exists public.station_order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.station_orders(id) on delete cascade,
  arena_id uuid not null references public.arenas(id) on delete cascade,
  previous_status text not null,
  new_status text not null,
  changed_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_station_order_status_history_order
  on public.station_order_status_history (order_id, created_at desc);

comment on table public.station_order_status_history is
  'Auditoria de mudanças manuais de status de comandas de estação (ex: aberta -> pendente -> aberta).';

alter table public.station_order_status_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'station_order_status_history'
      and policyname = 'station_order_status_history_select_members'
  ) then
    create policy "station_order_status_history_select_members"
      on public.station_order_status_history for select
      using (public.is_arena_backoffice_member(arena_id));
  end if;
end $$;

-- Sem policy de INSERT: só as RPCs abaixo (security definer) escrevem.

-- 4. RPC: marcar comanda aberta como pendente -------------------------------------------
create or replace function public.set_station_order_pending(
  p_arena_id uuid,
  p_order_id uuid,
  p_registered_by uuid
)
returns public.station_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.station_orders;
begin
  select * into v_order
  from public.station_orders
  where id = p_order_id and arena_id = p_arena_id
  for update;

  if v_order.id is null then
    raise exception 'Comanda não encontrada para esta arena';
  end if;

  if v_order.status <> 'open' then
    raise exception 'Só é possível marcar como pendente uma comanda aberta (status atual: %)', v_order.status;
  end if;

  update public.station_orders
    set status = 'pending',
        pending_marked_at = now(),
        updated_at = now()
    where id = p_order_id
    returning * into v_order;

  insert into public.station_order_status_history (
    order_id, arena_id, previous_status, new_status, changed_by
  )
  values (p_order_id, p_arena_id, 'open', 'pending', p_registered_by);

  return v_order;
end;
$$;

-- 5. RPC: reverter comanda pendente para aberta ------------------------------------------
create or replace function public.revert_station_order_to_open(
  p_arena_id uuid,
  p_order_id uuid,
  p_registered_by uuid
)
returns public.station_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.station_orders;
begin
  select * into v_order
  from public.station_orders
  where id = p_order_id and arena_id = p_arena_id
  for update;

  if v_order.id is null then
    raise exception 'Comanda não encontrada para esta arena';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Só é possível reverter para aberta uma comanda pendente (status atual: %)', v_order.status;
  end if;

  update public.station_orders
    set status = 'open',
        pending_marked_at = null,
        updated_at = now()
    where id = p_order_id
    returning * into v_order;

  insert into public.station_order_status_history (
    order_id, arena_id, previous_status, new_status, changed_by
  )
  values (p_order_id, p_arena_id, 'pending', 'open', p_registered_by);

  return v_order;
end;
$$;

-- 6. Permissões de execução das RPCs -----------------------------------------------------
-- Sem isso, o erro "permission denied for function ..." ocorre ao chamar via
-- PostgREST/service role, mesmo a function sendo security definer.
grant execute on function public.set_station_order_pending(uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function public.revert_station_order_to_open(uuid, uuid, uuid)
  to authenticated, service_role;
