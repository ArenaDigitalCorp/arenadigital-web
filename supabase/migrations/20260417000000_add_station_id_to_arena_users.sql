alter table arena_users
  add column if not exists station_id uuid references stations(id) on delete set null;

create index if not exists arena_users_station_id_idx on arena_users(station_id);
