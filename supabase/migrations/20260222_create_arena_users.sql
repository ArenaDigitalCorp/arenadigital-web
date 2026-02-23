-- Create arena_users join table for staff/employees
create table if not exists arena_users (
  id uuid default gen_random_uuid() primary key,
  arena_id uuid references arenas(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  role text not null default 'Atendente' check (role in ('Gestor', 'Atendente', 'Caixa')),
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Add a unique constraint to prevent duplicate links
  unique(arena_id, user_id)
);

-- Enable RLS
alter table arena_users enable row level security;

-- Basic Policies
drop policy if exists "Allow owners to manage arena_users" on arena_users;
create policy "Allow owners to manage arena_users" on arena_users
  for all using (true) with check (true);
