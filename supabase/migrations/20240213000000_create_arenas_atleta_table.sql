-- Create arenas_atleta join table
create table if not exists arenas_atleta (
  id uuid default gen_random_uuid() primary key,
  id_arena uuid references arenas(id) on delete cascade not null,
  id_atleta uuid references atleta(id) on delete cascade not null,
  data_criacao timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Add a unique constraint to prevent duplicate links
  unique(id_arena, id_atleta)
);

-- Enable RLS
alter table arenas_atleta enable row level security;

-- Basic Policies
drop policy if exists "Allow all for arenas_atleta" on arenas_atleta;
create policy "Allow all for arenas_atleta" on arenas_atleta
  for all using (true) with check (true);
