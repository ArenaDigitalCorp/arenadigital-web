-- Remove unused columns
alter table stations 
drop column if exists description,
drop column if exists equipment,
drop column if exists image_url;

-- Add type column
alter table stations 
add column if not exists type text check (type in ('Bar', 'Loja', 'Outro'));

-- Update status check constraint
alter table stations 
drop constraint if exists stations_status_check;

alter table stations 
add constraint stations_status_check 
check (status in ('ativo', 'inativo', 'Em manutenção'));
