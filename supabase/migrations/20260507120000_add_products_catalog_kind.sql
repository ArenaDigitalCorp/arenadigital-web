-- Separa itens de estoque (produtos) de cobranças sem estoque (serviços), ex.: aluguel de raquete
alter table public.products
  add column if not exists catalog_kind text;

update public.products
set catalog_kind = coalesce(catalog_kind, 'product');

alter table public.products
  alter column catalog_kind set default 'product';

alter table public.products
  alter column catalog_kind set not null;

alter table public.products
  drop constraint if exists products_catalog_kind_check;

alter table public.products
  add constraint products_catalog_kind_check
  check (catalog_kind in ('product', 'service'));

-- Permite tipo de item "Serviço" para linhas catalog_kind = service
alter table public.products
  drop constraint if exists products_item_type_check;

alter table public.products
  add constraint products_item_type_check
  check (
    item_type in ('Alimentação', 'Bebida', 'Vestimenta', 'Acessório', 'Serviço')
  );
