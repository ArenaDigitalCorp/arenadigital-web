-- Create sports table
create table if not exists sports (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed initial sports
insert into sports (name) values 
  ('Beach Tennis'), 
  ('Futebol'), 
  ('Vôlei'), 
  ('Futevôlei'), 
  ('Tênis'), 
  ('Paddle')
on conflict (name) do nothing;

-- Create court_sports join table for many-to-many relationship
create table if not exists court_sports (
  court_id uuid references courts(id) on delete cascade,
  sport_id uuid references sports(id) on delete cascade,
  primary key (court_id, sport_id)
);

-- Update courts table with new fields
alter table courts 
add column if not exists is_covered boolean default false,
add column if not exists observations text,
add column if not exists available_days text[] default '{}',
add column if not exists price numeric(10, 2) default 0,
add column if not exists booking_type text default 'hourly' check (booking_type in ('unique', 'hourly')),
add column if not exists image_url text,
add column if not exists status text default 'ativo';

-- Update status check constraint to match image
alter table courts drop constraint if exists courts_status_check;
alter table courts add constraint courts_status_check 
check (status in ('ativo', 'inativo', 'Em manutenção', 'Desativado'));

-- Enable RLS for sports
alter table sports enable row level security;
alter table court_sports enable row level security;

-- Simple policies for sports
create policy "Allow all for sports" on sports for all using (true) with check (true);
create policy "Allow all for court_sports" on court_sports for all using (true) with check (true);
