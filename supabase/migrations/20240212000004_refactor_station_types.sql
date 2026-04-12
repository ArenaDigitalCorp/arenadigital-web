-- Create station_types table
create table if not exists station_types (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert initial values
insert into station_types (name) values ('Bar'), ('Loja') on conflict (name) do nothing;

-- Enable RLS for station_types
alter table station_types enable row level security;
create policy "Public read access for station_types" on station_types for select using (true);

-- Alter stations table
-- First, drop the old type column (assuming data loss is acceptable or handled manually, for now we just drop)
alter table stations drop column if exists type;

-- Add new foreign key column
alter table stations add column station_type_id uuid references station_types(id);
