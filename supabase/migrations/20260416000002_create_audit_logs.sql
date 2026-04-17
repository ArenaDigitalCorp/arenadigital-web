-- Tabela de auditoria append-only para rastrear eventos relevantes do sistema.
-- Nunca deve ser atualizada ou deletada — imutável por design.
-- service_role bypassa RLS e pode inserir livremente.
-- Roles autenticadas/anon são bloqueadas de update/delete via RLS + triggers.

create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,      -- 'arena_subscription' | 'arena' | 'user' | ...
  entity_id   text not null,      -- UUID (como texto) da entidade afetada
  action      text not null,      -- ex: 'subscription.created', 'subscription.canceled'
  actor_id    text,               -- clerk_user_id, stripe event ID, ou null para sistema
  actor_type  text not null check (actor_type in ('user', 'system', 'stripe_webhook')),
  old_value   jsonb,              -- estado anterior (quando aplicável)
  new_value   jsonb,              -- novo estado
  metadata    jsonb,              -- contexto extra: stripe_event_id, invoice_id, etc.
  created_at  timestamptz not null default now()
);

-- Índices para consultas comuns: histórico por entidade, por ator, por data
create index idx_audit_logs_entity on audit_logs (entity_type, entity_id);
create index idx_audit_logs_actor  on audit_logs (actor_id) where actor_id is not null;
create index idx_audit_logs_created_at on audit_logs (created_at desc);

-- RLS: bloquear tudo para anon
alter table audit_logs enable row level security;

create policy "block_anon_audit_logs"
  on audit_logs for all
  to anon
  using (false);

-- Bloquear update e delete para role autenticada (service_role bypassa RLS)
create policy "no_update_audit_logs"
  on audit_logs for update
  to authenticated
  using (false);

create policy "no_delete_audit_logs"
  on audit_logs for delete
  to authenticated
  using (false);

-- Trigger de imutabilidade: impede UPDATE e DELETE mesmo via service_role
create or replace function fn_prevent_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs é append-only: updates e deletes não são permitidos';
end;
$$;

create trigger trg_audit_logs_no_update
  before update on audit_logs
  for each row
  execute function fn_prevent_audit_log_mutation();

create trigger trg_audit_logs_no_delete
  before delete on audit_logs
  for each row
  execute function fn_prevent_audit_log_mutation();
