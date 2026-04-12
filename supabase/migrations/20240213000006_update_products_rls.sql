-- Drop existing restrictive policy
drop policy if exists "Owners can manage products" on products;
drop policy if exists "Organizations can manage products" on products;

-- Create permissive policy to match arenas and stations (unblocks development)
create policy "Allow all for products" on products
for all
using (true)
with check (true);
