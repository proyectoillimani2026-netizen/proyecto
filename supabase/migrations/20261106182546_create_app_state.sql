create table if not exists public.app_state (
  id text primary key check (id = 'main'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

revoke all on table public.app_state from public, anon, authenticated;
grant select, insert, update, delete on table public.app_state to service_role;
