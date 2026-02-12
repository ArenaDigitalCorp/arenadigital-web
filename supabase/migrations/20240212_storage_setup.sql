-- Create the storage bucket for courts if it doesn't exist
insert into storage.buckets (id, name, public)
values ('courts', 'courts', true)
on conflict (id) do nothing;

-- Set up security policies for the courts bucket
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'courts' );

create policy "Authenticated users can upload"
on storage.objects for insert
with check ( bucket_id = 'courts' and auth.role() = 'authenticated' );

create policy "Authenticated users can update"
on storage.objects for update
with check ( bucket_id = 'courts' and auth.role() = 'authenticated' );

create policy "Authenticated users can delete"
on storage.objects for delete
using ( bucket_id = 'courts' and auth.role() = 'authenticated' );
