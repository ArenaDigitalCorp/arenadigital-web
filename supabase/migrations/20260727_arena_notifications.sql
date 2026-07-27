-- =============================================================================
-- Notificações da Arena (eventos vindos do app do atleta)
-- Aplicar manualmente no SQL Editor do Supabase (projeto Web Gestor).
-- Idempotente: pode ser executado mais de uma vez sem efeitos colaterais.
--
-- Regra de origem: as triggers só geram notificação quando a escrita veio do
-- APP (JWT de um atleta → auth.uid() resolve para um registro em `atleta`).
-- O backoffice web grava com a service role (auth.uid() = null) e por isso
-- nunca notifica a si mesmo.
-- =============================================================================

-- 1. Tabela de notificações por arena --------------------------------------------------
create table if not exists public.arena_notifications (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  type text not null check (type in ('booking_created', 'rotativo_inscricao', 'open_game_created')),
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  entity_type text,
  entity_id uuid,
  atleta_id uuid references public.atleta(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_arena_notifications_arena_created
  on public.arena_notifications (arena_id, created_at desc);

create index if not exists idx_arena_notifications_unread
  on public.arena_notifications (arena_id)
  where read_at is null;

-- Evita duplicar a notificação caso a trigger rode mais de uma vez para a mesma entidade
create unique index if not exists uq_arena_notifications_entity
  on public.arena_notifications (type, entity_id)
  where entity_id is not null;

comment on table public.arena_notifications is
  'Avisos em tempo real para o backoffice da arena, gerados por ações do app do atleta.';

-- 2. Helper: o usuário autenticado pertence ao backoffice da arena? --------------------
create or replace function public.is_arena_backoffice_member(p_arena_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.arenas a
    join public.users u on u.id = a.owner_id
    where a.id = p_arena_id
      and u.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.arena_users au
    join public.users u on u.id = au.user_id
    where au.arena_id = p_arena_id
      and au.status = 'active'
      and u.auth_user_id = auth.uid()
  );
$$;

-- 3. RLS: só o backoffice da arena lê/marca como lida ---------------------------------
alter table public.arena_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'arena_notifications'
      and policyname = 'arena_notifications_select_members'
  ) then
    create policy "arena_notifications_select_members"
      on public.arena_notifications for select
      using (public.is_arena_backoffice_member(arena_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'arena_notifications'
      and policyname = 'arena_notifications_update_members'
  ) then
    create policy "arena_notifications_update_members"
      on public.arena_notifications for update
      using (public.is_arena_backoffice_member(arena_id))
      with check (public.is_arena_backoffice_member(arena_id));
  end if;
end $$;

-- Sem policy de INSERT: só as triggers (security definer) e a service role escrevem.

-- 4. Helper: atleta dono da sessão atual (null quando a escrita veio do backoffice) ----
create or replace function public.current_app_atleta()
returns table (id uuid, nome_perfil text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.nome_perfil
  from public.atleta a
  join public.users u on u.id = a.id_users
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

-- 5. Trigger: reserva criada pelo atleta no app ---------------------------------------
create or replace function public.notify_arena_booking_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atleta record;
  v_court_name text;
  v_sport_name text;
begin
  select * into v_atleta from public.current_app_atleta();
  if v_atleta.id is null then
    return new; -- reserva registrada pelo backoffice: não notifica
  end if;

  select name into v_court_name from public.courts where id = new.court_id;
  select name into v_sport_name from public.sports where id = new.sport_id;

  insert into public.arena_notifications (
    arena_id, type, title, body, payload, entity_type, entity_id, atleta_id
  )
  values (
    new.arena_id,
    'booking_created',
    'Nova reserva pelo app',
    coalesce(v_atleta.nome_perfil, new.athlete_name, 'Um atleta')
      || ' reservou ' || coalesce(v_court_name, 'um espaço')
      || ' em ' || to_char(new.start_time at time zone 'America/Sao_Paulo', 'DD/MM')
      || ' às ' || to_char(new.start_time at time zone 'America/Sao_Paulo', 'HH24:MI'),
    jsonb_build_object(
      'booking_id', new.id,
      'court_id', new.court_id,
      'court_name', v_court_name,
      'sport_name', v_sport_name,
      'start_time', new.start_time,
      'end_time', new.end_time,
      'price', new.price,
      'status', new.status,
      'athlete_name', coalesce(v_atleta.nome_perfil, new.athlete_name)
    ),
    'booking',
    new.id,
    v_atleta.id
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_notify_arena_booking_created on public.bookings;
create trigger trg_notify_arena_booking_created
  after insert on public.bookings
  for each row execute function public.notify_arena_booking_created();

-- 6. Trigger: confirmação de inscrição em rotativo ------------------------------------
create or replace function public.notify_arena_rotativo_inscricao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atleta record;
  v_rotativo record;
  v_sport_name text;
begin
  select * into v_atleta from public.current_app_atleta();
  if v_atleta.id is null then
    return new; -- inscrição registrada pelo backoffice: não notifica
  end if;

  select id, id_arena, data, hora_inicio, id_esporte
    into v_rotativo
  from public.rotativos
  where id = new.id_rotativo;

  if v_rotativo.id is null then
    return new;
  end if;

  select name into v_sport_name from public.sports where id = v_rotativo.id_esporte;

  insert into public.arena_notifications (
    arena_id, type, title, body, payload, entity_type, entity_id, atleta_id
  )
  values (
    v_rotativo.id_arena,
    'rotativo_inscricao',
    'Nova confirmação em rotativo',
    coalesce(v_atleta.nome_perfil, 'Um atleta')
      || ' confirmou presença no rotativo de ' || coalesce(v_sport_name, 'esporte')
      || ' em ' || to_char(v_rotativo.data, 'DD/MM')
      || ' às ' || to_char(v_rotativo.hora_inicio, 'HH24:MI'),
    jsonb_build_object(
      'inscricao_id', new.id,
      'rotativo_id', v_rotativo.id,
      'sport_name', v_sport_name,
      'data', v_rotativo.data,
      'hora_inicio', v_rotativo.hora_inicio,
      'valor_pago', new.valor_pago,
      'status_pagamento', new.status_pagamento,
      'athlete_name', v_atleta.nome_perfil
    ),
    'rotativo_inscricao',
    new.id,
    v_atleta.id
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_notify_arena_rotativo_inscricao on public.rotativo_inscricoes;
create trigger trg_notify_arena_rotativo_inscricao
  after insert on public.rotativo_inscricoes
  for each row execute function public.notify_arena_rotativo_inscricao();

-- 7. Trigger: game match criado com a arena como local --------------------------------
create or replace function public.notify_arena_open_game_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atleta record;
  v_sport_name text;
begin
  select * into v_atleta from public.current_app_atleta();
  if v_atleta.id is null then
    return new;
  end if;

  select name into v_sport_name from public.sports where id = new.sport_id;

  insert into public.arena_notifications (
    arena_id, type, title, body, payload, entity_type, entity_id, atleta_id
  )
  values (
    new.arena_id,
    'open_game_created',
    'Novo Game Match na arena',
    coalesce(v_atleta.nome_perfil, 'Um atleta')
      || ' abriu um jogo de ' || coalesce(v_sport_name, 'esporte')
      || ' em ' || to_char(new.date, 'DD/MM')
      || ' às ' || to_char(new.start_time, 'HH24:MI'),
    jsonb_build_object(
      'open_game_id', new.id,
      'booking_id', new.booking_id,
      'sport_name', v_sport_name,
      'date', new.date,
      'start_time', new.start_time,
      'end_time', new.end_time,
      'needed_players', new.needed_players,
      'current_players', new.current_players,
      'athlete_name', v_atleta.nome_perfil
    ),
    'open_game',
    new.id,
    v_atleta.id
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_notify_arena_open_game_created on public.open_games;
create trigger trg_notify_arena_open_game_created
  after insert on public.open_games
  for each row execute function public.notify_arena_open_game_created();

-- 8. Realtime: publica a tabela para o canal do Supabase ------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'arena_notifications'
  ) then
    alter publication supabase_realtime add table public.arena_notifications;
  end if;
end $$;
