-- Add nome_moeda_virtual to arenas table
alter table public.arenas 
add column if not exists nome_moeda_virtual text;

comment on column public.arenas.nome_moeda_virtual is 'Nome personalizado da moeda virtual desta arena (ex: ArenaCoins, Pontos, etc)';
