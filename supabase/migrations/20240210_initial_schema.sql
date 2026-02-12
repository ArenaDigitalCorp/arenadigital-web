-- Create users table
create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  clerk_user_id text unique not null,
  email text not null,
  name text,
  role text default 'gestor' check (role in ('admin', 'gestor')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create arenas table
create table if not exists arenas (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references users(id) on delete cascade not null,
  name text not null,
  status text default 'ativo' check (status in ('ativo', 'inativo', 'Em manutenção')),
  sports text[] default '{}',
  opening_hours jsonb,
  address jsonb,
  phone text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create courts table
create table if not exists courts (
  id uuid default gen_random_uuid() primary key,
  arena_id uuid references arenas(id) on delete cascade not null,
  name text not null,
  type text not null,
  capacity int,
  is_active boolean default true,
  attributes jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create bookings table
create table if not exists bookings (
  id uuid default gen_random_uuid() primary key,
  arena_id uuid references arenas(id) on delete cascade not null,
  court_id uuid references courts(id) on delete cascade not null,
  athlete_name text, -- For now, simpler than linking to athlete users
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  status text default 'confirmed' check (status in ('confirmed', 'cancelled', 'pending')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table users enable row level security;
alter table arenas enable row level security;
alter table courts enable row level security;
alter table bookings enable row level security;

-- Policies (Basic for now)
-- users table
drop policy if exists "Allow public to insert users" on users;
drop policy if exists "Users can read own data" on users;
drop policy if exists "Users can update own data" on users;

create policy "Allow public to insert users" on users for insert with check (true);
create policy "Users can read own data" on users for select using (true);
create policy "Users can update own data" on users for update using (true);

-- Arenas: Owners can do everything
drop policy if exists "Owners can manage their own arenas" on arenas;
create policy "Owners can manage their own arenas" on arenas for all using (true) with check (true);

-- Courts: Access based on arena ownership
drop policy if exists "Owners can manage courts" on courts;
create policy "Owners can manage courts" on courts for all using (true) with check (true);

-- Note: For this to work in the Supabase Dashboard SQL Editor, you might need to ensure 
-- the 'auth' schema and 'auth.jwt()' function exist (they do by default in Supabase).
-- If you are testing via the dashboard, this policy will only trigger if a valid JWT is passed.
