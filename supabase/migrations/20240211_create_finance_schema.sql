-- Create transactions table
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  arena_id uuid references arenas(id) on delete cascade not null,
  type text not null check (type in ('entrada', 'saída')),
  category text not null,
  description text,
  quantity int default 1 not null,
  unit_value numeric(12,2) default 0 not null,
  discount numeric(12,2) default 0 not null,
  total_value numeric(12,2) default 0 not null,
  registration_date timestamp with time zone default timezone('utc'::text, now()) not null,
  launch_date timestamp with time zone default timezone('utc'::text, now()) not null,
  registered_by uuid references users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table transactions enable row level security;

-- Policies
drop policy if exists "Owners can manage transactions of their arenas" on transactions;
create policy "Enable access for everyone" on transactions
  for all using (true) with check (true);
