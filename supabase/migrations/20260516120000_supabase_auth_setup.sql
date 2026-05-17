-- Supabase Auth setup (web migrates from Clerk → Supabase Auth)
-- Atletas (mobile app) continuam vindo via webhook Clerk com UUIDs próprios;
-- gestores web passam a entrar via auth.users com id = users.id (mesmo UUID).

-- 1. Tornar clerk_user_id opcional (gestores novos não terão; atletas ainda terão)
alter table public.users alter column clerk_user_id drop not null;

-- 2. Garantir índice único em email (defensivo para evitar duplicatas entre os dois fluxos)
create unique index if not exists users_email_unique_idx on public.users (lower(email));

-- 3. Trigger: ao criar usuário em auth.users (signup do gestor web),
--    cria linha correspondente em public.users com mesmo id.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first_name text;
  meta_last_name text;
  computed_name text;
begin
  meta_first_name := new.raw_user_meta_data->>'firstName';
  meta_last_name := new.raw_user_meta_data->>'lastName';

  computed_name := nullif(trim(coalesce(meta_first_name, '') || ' ' || coalesce(meta_last_name, '')), '');
  if computed_name is null then
    computed_name := new.raw_user_meta_data->>'name';
  end if;
  if computed_name is null then
    computed_name := new.email;
  end if;

  insert into public.users (id, email, name, cpf, role)
  values (
    new.id,
    new.email,
    computed_name,
    new.raw_user_meta_data->>'cpf',
    'gestor'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
