-- Aggregated finance metrics for dashboard scalability (single round-trip, no full table scans to the client).
-- Bucketing uses America/Sao_Paulo to align with typical arena operations in Brazil.

create or replace function public.get_arena_finance_summary(p_arena_id uuid)
returns table (
  lifetime_entradas numeric,
  lifetime_saidas numeric,
  current_month_entradas numeric,
  current_month_saidas numeric,
  prev_month_entradas numeric,
  prev_month_saidas numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      extract(year from timezone('America/Sao_Paulo', now()))::int as cy,
      extract(month from timezone('America/Sao_Paulo', now()))::int as cm
  ),
  prev_month as (
    select
      case when p.cm = 1 then p.cy - 1 else p.cy end as py,
      case when p.cm = 1 then 12 else p.cm - 1 end as pm
    from params p
  )
  select
    coalesce(sum(t.total_value) filter (where t.type = 'entrada'), 0)::numeric as lifetime_entradas,
    coalesce(sum(t.total_value) filter (where t.type = 'saída'), 0)::numeric as lifetime_saidas,
    coalesce(sum(t.total_value) filter (
      where t.type = 'entrada'
        and extract(year from timezone('America/Sao_Paulo', t.launch_date)) = (select cy from params)
        and extract(month from timezone('America/Sao_Paulo', t.launch_date)) = (select cm from params)
    ), 0)::numeric as current_month_entradas,
    coalesce(sum(t.total_value) filter (
      where t.type = 'saída'
        and extract(year from timezone('America/Sao_Paulo', t.launch_date)) = (select cy from params)
        and extract(month from timezone('America/Sao_Paulo', t.launch_date)) = (select cm from params)
    ), 0)::numeric as current_month_saidas,
    coalesce(sum(t.total_value) filter (
      where t.type = 'entrada'
        and extract(year from timezone('America/Sao_Paulo', t.launch_date)) = (select py from prev_month)
        and extract(month from timezone('America/Sao_Paulo', t.launch_date)) = (select pm from prev_month)
    ), 0)::numeric as prev_month_entradas,
    coalesce(sum(t.total_value) filter (
      where t.type = 'saída'
        and extract(year from timezone('America/Sao_Paulo', t.launch_date)) = (select py from prev_month)
        and extract(month from timezone('America/Sao_Paulo', t.launch_date)) = (select pm from prev_month)
    ), 0)::numeric as prev_month_saidas
  from transactions t
  where t.arena_id = p_arena_id;
$$;

comment on function public.get_arena_finance_summary(uuid) is
  'Lifetime + current/previous calendar month totals (America/Sao_Paulo) for finance dashboard cards.';

create or replace function public.get_arena_finance_daily_totals(
  p_arena_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  bucket_date date,
  entradas numeric,
  saidas numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (timezone('America/Sao_Paulo', t.launch_date))::date as bucket_date,
    coalesce(sum(t.total_value) filter (where t.type = 'entrada'), 0)::numeric as entradas,
    coalesce(sum(t.total_value) filter (where t.type = 'saída'), 0)::numeric as saidas
  from transactions t
  where t.arena_id = p_arena_id
    and (timezone('America/Sao_Paulo', t.launch_date))::date >= p_start_date
    and (timezone('America/Sao_Paulo', t.launch_date))::date <= p_end_date
  group by 1
  order by 1;
$$;

comment on function public.get_arena_finance_daily_totals(uuid, date, date) is
  'Per-day entrada/saída sums for chart (bucket by America/Sao_Paulo local date).';

grant execute on function public.get_arena_finance_summary(uuid) to anon, authenticated, service_role;
grant execute on function public.get_arena_finance_daily_totals(uuid, date, date) to anon, authenticated, service_role;

create index if not exists idx_transactions_arena_launch_date
  on public.transactions (arena_id, launch_date);
