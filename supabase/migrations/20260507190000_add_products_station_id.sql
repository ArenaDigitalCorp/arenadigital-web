-- Vincula produto/serviço a uma estação concreta da arena (além do tipo, usado no PDV).
alter table public.products
  add column if not exists station_id uuid references public.stations (id) on delete set null;

create index if not exists idx_products_station_id on public.products (station_id);

comment on column public.products.station_id is
  'Quando preenchido, o item aparece só nessa estação; quando nulo, vale o escopo por station_type_id (legado).';
