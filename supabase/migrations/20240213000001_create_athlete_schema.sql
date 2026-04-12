-- Create atleta table
create table if not exists atleta (
  id uuid default gen_random_uuid() primary key,
  id_users uuid references public.users(id) on delete cascade not null,
  nome_perfil text not null,
  cpf text,
  telefone text,
  data_nascimento date,
  descricao_perfil text,
  esportes_preferido text,
  instagram text,
  facebook text,
  tiktok text,
  compartilha_info boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create atleta_esportes table
create table if not exists atleta_esportes (
  id uuid default gen_random_uuid() primary key,
  id_atleta uuid references atleta(id) on delete cascade not null,
  id_esporte uuid references sports(id) on delete cascade not null,
  nivel_habilidade text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table atleta enable row level security;
alter table atleta_esportes enable row level security;

-- Basic Policies
-- Note: Using simple policies for now as the project is in early development
-- and specific auth mappings might be required for production.
drop policy if exists "Allow all for atleta" on atleta;
create policy "Allow all for atleta" on atleta
  for all using (true) with check (true);

drop policy if exists "Allow all for atleta_esportes" on atleta_esportes;
create policy "Allow all for atleta_esportes" on atleta_esportes
  for all using (true) with check (true);

-- Trigger for updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

drop trigger if exists update_atleta_updated_at on atleta;
create trigger update_atleta_updated_at
    before update on atleta
    for each row
    execute procedure update_updated_at_column();
