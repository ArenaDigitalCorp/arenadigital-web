-- Create rotativos table
create table if not exists public.rotativos (
    id uuid default gen_random_uuid() primary key,
    id_arena uuid not null references public.arenas(id) on delete cascade,
    id_esporte uuid not null references public.sports(id),
    data date not null,
    hora_inicio time not null,
    hora_fim time not null,
    valor numeric(10, 2) default 0 not null,
    limitado boolean default false not null,
    limite_participantes integer,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- Create rotativo_inscricoes table
create table if not exists public.rotativo_inscricoes (
    id uuid default gen_random_uuid() primary key,
    id_rotativo uuid not null references public.rotativos(id) on delete cascade,
    id_atleta uuid not null references public.atleta(id) on delete cascade,
    data_inscricao timestamp with time zone default now() not null,
    valor_pago numeric(10, 2) default 0 not null,
    status_pagamento text default 'pendente',
    unique(id_rotativo, id_atleta)
);

-- Enable RLS
alter table public.rotativos enable row level security;
alter table public.rotativo_inscricoes enable row level security;

-- Basic Policies (following the pattern of other tables)
create policy "Allow all for rotativos" on public.rotativos for all using (true) with check (true);
create policy "Allow all for rotativo_inscricoes" on public.rotativo_inscricoes for all using (true) with check (true);

-- Comments
comment on table public.rotativos is 'Sessões de jogo aberto gerenciadas pela arena';
comment on table public.rotativo_inscricoes is 'Inscrições de atletas em sessões de rotativo';
