-- Create station_payments table
create table if not exists station_payments (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references station_orders(id) on delete cascade not null,
  paid_by_name text, -- Name of the person who paid (manual or from customer/athlete)
  payment_method text not null, -- 'Dinheiro', 'Pix', 'Crédito', 'Débito', etc.
  observation text,
  amount numeric(12, 2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table station_payments enable row level security;

-- Policies for station_payments
create policy "Owners can manage station payments" on station_payments for all using (true) with check (true);
