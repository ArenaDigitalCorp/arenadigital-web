-- Create programa_fidelidade_extrato table
create table if not exists public.programa_fidelidade_extrato (
  id uuid default gen_random_uuid() primary key,
  id_arena uuid references public.arenas(id) on delete cascade not null,
  id_atleta uuid references public.atleta(id) on delete cascade not null,
  valor numeric(10, 2) not null,
  tipo text not null check (tipo in ('crédito', 'resgate', 'vencimento')),
  descricao text,
  data_vencimento date,
  data_registro timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.programa_fidelidade_extrato enable row level security;

-- Basic Policies (allowing all for now as per previous patterns)
drop policy if exists "Allow all for programa_fidelidade_extrato" on public.programa_fidelidade_extrato;
create policy "Allow all for programa_fidelidade_extrato" on public.programa_fidelidade_extrato
  for all using (true) with check (true);

-- Comments
comment on table public.programa_fidelidade_extrato is 'Registro de extrato do programa de fidelidade (moedas virtuais) dos atletas';
comment on column public.programa_fidelidade_extrato.tipo is 'Tipo da transação: crédito, resgate ou vencimento';
comment on column public.programa_fidelidade_extrato.data_vencimento is 'Data em que os créditos expiram (se aplicável)';
