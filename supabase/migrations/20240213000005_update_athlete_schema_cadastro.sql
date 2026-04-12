-- Add origem_cadastro and id_arena_cadastro to atleta table
alter table atleta 
add column if not exists origem_cadastro text default 'arena' check (origem_cadastro in ('arena', 'aplicativo')),
add column if not exists id_arena_cadastro uuid references public.arenas(id);

comment on column atleta.origem_cadastro is 'Indica se o atleta foi cadastrado via arena ou via aplicativo';
comment on column atleta.id_arena_cadastro is 'ID da arena onde o atleta foi cadastrado pela primeira vez';
