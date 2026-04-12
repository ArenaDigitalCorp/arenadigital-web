-- Create organizations table
create table if not exists organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add organization_id to arenas
alter table arenas add column if not exists organization_id uuid references organizations(id) on delete cascade;

-- Enable RLS
alter table organizations enable row level security;

-- Policies for organizations
drop policy if exists "Owners can manage their own organizations" on organizations;
create policy "Owners can manage their own organizations" on organizations 
  for all using (true) with check (true);

-- Update Arena policies (optional, but good for consistency)
drop policy if exists "Owners can manage their own arenas" on arenas;
create policy "Owners can manage their own arenas" on arenas 
  for all using (true) with check (true);
