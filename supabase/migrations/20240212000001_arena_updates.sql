-- Add new columns to arenas table
alter table arenas
add column if not exists description text,
add column if not exists banner_url text,
add column if not exists zip_code text;

-- Create arena_sports join table for many-to-many relationship
create table if not exists arena_sports (
  arena_id uuid references arenas(id) on delete cascade,
  sport_id uuid references sports(id) on delete cascade,
  primary key (arena_id, sport_id)
);

-- Enable RLS for arena_sports
alter table arena_sports enable row level security;

-- Policies for arena_sports
create policy "Allow all for arena_sports" on arena_sports for all using (true) with check (true);

-- Migrate existing sports array to arena_sports (optional, but good for data consistency if we want to move away from the array)
-- For now, we keep both or just start using the new table for the UI. 
-- The UI requested selecting multiple sports from the existing sports table.
