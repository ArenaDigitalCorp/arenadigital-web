alter table arena_subscriptions
  add constraint arena_subscriptions_arena_id_key unique (arena_id);
