-- Create comodidades table
create table if not exists comodidades (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed initial comodidades
insert into comodidades (name) values 
  ('Churrasqueira'), 
  ('Salão de Festas'), 
  ('Piscina'), 
  ('Estacionamento Gratuito'), 
  ('Estacionamento Pago'), 
  ('Wifi'),
  ('Clube de Benefícios')
on conflict (name) do nothing;

-- Create arena_comodidades table
create table if not exists arena_comodidades (
  arena_id uuid references arenas(id) on delete cascade,
  comodidade_id uuid references comodidades(id) on delete cascade,
  primary key (arena_id, comodidade_id)
);

-- Enable RLS for the tables
alter table comodidades enable row level security;
alter table arena_comodidades enable row level security;

-- Simple policies for comodidades and arena_comodidades
create policy "Allow all for comodidades" on comodidades for all using (true) with check (true);
create policy "Allow all for arena_comodidades" on arena_comodidades for all using (true) with check (true);
