-- Create a view to calculate the current loyalty balance per athlete per arena
create or replace view public.athlete_loyalty_balance as
select 
    id_arena,
    id_atleta,
    sum(case when tipo = 'crédito' then valor else -valor end) as balance
from 
    public.programa_fidelidade_extrato
group by 
    id_arena, id_atleta;

-- Enable RLS (views don't have RLS themselves in the same way, but they respect underlying table RLS)
-- However, we can grant select access
grant select on public.athlete_loyalty_balance to anon, authenticated;
