-- Add new address and social media columns to arenas table
alter table public.arenas
add column if not exists "number" text,
add column if not exists "complement" text,
add column if not exists "city" text,
add column if not exists "state" text,
add column if not exists "facebook" text,
add column if not exists "instagram" text,
add column if not exists "tiktok" text;

comment on column public.arenas.number is 'Address number';
comment on column public.arenas.complement is 'Address complement';
comment on column public.arenas.city is 'Address city';
comment on column public.arenas.state is 'Address state (UF)';
comment on column public.arenas.facebook is 'Facebook URL or handle';
comment on column public.arenas.instagram is 'Instagram URL or handle';
comment on column public.arenas.tiktok is 'TikTok URL or handle';
