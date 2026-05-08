-- Tipos de serviço exibidos no cadastro (Figma: ex. "Aluguel"), além do legado "Serviço".
alter table public.products
  drop constraint if exists products_item_type_check;

alter table public.products
  add constraint products_item_type_check
  check (
    item_type in (
      'Alimentação',
      'Bebida',
      'Vestimenta',
      'Acessório',
      'Serviço',
      'Aluguel',
      'Aula',
      'Taxa',
      'Outro'
    )
  );
