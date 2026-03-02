-- Migration to rename 'web' to 'arena' in origem_vinculo_arena enum
-- and update the default value in arenas_atleta from 'web' to 'arena'

-- 1. Alter default value to avoid issues during enum rename
alter table arenas_atleta alter column origem drop default;

-- 2. Rename the enum value (PostgreSQL does not support deleting or replacing outright directly in a single command, rename is supported)
alter type origem_vinculo_arena rename value 'web' to 'arena';

-- 3. Set the new default value
alter table arenas_atleta alter column origem set default 'arena';
