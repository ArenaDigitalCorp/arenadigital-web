alter table atleta
  add column if not exists cep           text,
  add column if not exists endereco      text,
  add column if not exists endereco_numero text,
  add column if not exists bairro        text,
  add column if not exists complemento   text;
