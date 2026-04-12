-- Create stations table
create table if not exists stations (
  id uuid default gen_random_uuid() primary key,
  arena_id uuid references arenas(id) on delete cascade not null,
  name text not null,
  status text default 'ativo' check (status in ('ativo', 'inativo', 'Em manutenção')),
  description text,
  equipment text, -- Can be a list of equipment
  image_url text, -- To support station images if needed, consistent with courts
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table stations enable row level security;

-- Policies
drop policy if exists "Owners can manage stations" on stations;
create policy "Owners can manage stations" on stations for all using (true) with check (true);
