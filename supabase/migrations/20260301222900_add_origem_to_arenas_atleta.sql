-- Migration to add 'origem' column to 'arenas_atleta' table

-- Define an enum type for 'origem' to ensure data integrity
do $$ begin
    create type origem_vinculo_arena as enum ('web', 'aplicativo');
exception
    when duplicate_object then null;
end $$;

-- Add the column with a default value of 'web' temporarily (or not default, since existing might be web)
-- Since the system existed before, all current records are from 'web' (invited by manager)
alter table arenas_atleta 
add column if not exists origem origem_vinculo_arena default 'web';

-- Se quisermos remover o default depois para novas inserções precisarem ser explicitas, podemos fazer:
-- alter table arenas_atleta alter column origem drop default;
