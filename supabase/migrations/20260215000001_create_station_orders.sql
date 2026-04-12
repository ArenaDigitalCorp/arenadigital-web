-- Create station_customers table
create table if not exists station_customers (
  id uuid default gen_random_uuid() primary key,
  arena_id uuid references arenas(id) on delete cascade not null,
  name text not null,
  cpf text,
  phone text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create station_orders table
create table if not exists station_orders (
  id uuid default gen_random_uuid() primary key,
  arena_id uuid references arenas(id) on delete cascade not null,
  station_id uuid references stations(id) on delete cascade not null,
  atleta_id uuid references atleta(id) on delete set null,
  customer_id uuid references station_customers(id) on delete set null,
  order_number serial not null,
  customer_name text, -- Manual entry or fallback
  status text default 'open' check (status in ('open', 'closed', 'cancelled')),
  total_value numeric(12, 2) default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  closed_at timestamp with time zone
);

-- Create station_order_items table
create table if not exists station_order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references station_orders(id) on delete cascade not null,
  product_id uuid references products(id) on delete restrict not null,
  quantity int default 1 not null,
  unit_price numeric(12, 2) not null,
  total_price numeric(12, 2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table station_customers enable row level security;
alter table station_orders enable row level security;
alter table station_order_items enable row level security;

-- Policies for station_customers
create policy "Owners can manage station customers" on station_customers for all using (true) with check (true);

-- Policies for station_orders
create policy "Owners can manage station orders" on station_orders for all using (true) with check (true);

-- Policies for station_order_items
create policy "Owners can manage station order items" on station_order_items for all using (true) with check (true);

-- Trigger for updated_at on station_orders
create trigger update_station_orders_updated_at
    before update on station_orders
    for each row
    execute procedure update_updated_at_column();
