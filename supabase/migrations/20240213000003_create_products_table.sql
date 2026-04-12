-- Create products table
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  arena_id uuid references arenas(id) on delete cascade not null,
  name text not null,
  item_type text not null check (item_type in ('Alimentação', 'Bebida', 'Vestimenta', 'Acessório')),
  station_type_id uuid references station_types(id) not null,
  price numeric(10, 2) not null,
  status text default 'Em estoque' check (status in ('Em estoque', 'Em falta')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

-- Enable RLS
alter table products enable row level security;

-- Policies
create policy "Owners can manage products" on products for all using (
  auth.uid() in (
    select owner_id from arenas where id = products.arena_id
  )
) with check (
  auth.uid() in (
    select owner_id from arenas where id = products.arena_id
  )
);
