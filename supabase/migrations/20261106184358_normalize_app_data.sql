create table if not exists public.app_db_state (
  id text primary key check (id = 'main'),
  version bigint not null default 0 check (version >= 0),
  order_seq bigint not null default 1040 check (order_seq >= 0),
  updated_at timestamptz not null default now()
);

insert into public.app_db_state (id) values ('main')
on conflict (id) do nothing;

create table if not exists public.restaurant_settings (
  id text primary key check (id = 'main'),
  data jsonb not null check (jsonb_typeof(data) = 'object')
);

create table if not exists public.staff_users (
  id text primary key,
  sort_order integer not null,
  data jsonb not null check (jsonb_typeof(data) = 'object')
);

create table if not exists public.customers (
  id text primary key,
  sort_order integer not null,
  data jsonb not null check (jsonb_typeof(data) = 'object')
);

create table if not exists public.products (
  id text primary key,
  sort_order integer not null,
  data jsonb not null check (jsonb_typeof(data) = 'object')
);

create table if not exists public.orders (
  id text primary key,
  sort_order integer not null,
  data jsonb not null check (jsonb_typeof(data) = 'object')
);

alter table public.app_db_state enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.staff_users enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

revoke all on table public.app_db_state, public.restaurant_settings, public.staff_users,
  public.customers, public.products, public.orders from public, anon, authenticated;
grant select, insert, update, delete on table public.app_db_state, public.restaurant_settings,
  public.staff_users, public.customers, public.products, public.orders to service_role;

create or replace function public.save_app_state(
  p_expected_version bigint,
  p_order_seq bigint,
  p_restaurant jsonb,
  p_staff_users jsonb,
  p_customers jsonb,
  p_products jsonb,
  p_orders jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if p_order_seq < 0
    or pg_catalog.jsonb_typeof(p_restaurant) <> 'object'
    or pg_catalog.jsonb_typeof(p_staff_users) <> 'array'
    or pg_catalog.jsonb_typeof(p_customers) <> 'array'
    or pg_catalog.jsonb_typeof(p_products) <> 'array'
    or pg_catalog.jsonb_typeof(p_orders) <> 'array'
  then
    raise exception 'Invalid application state';
  end if;

  update public.app_db_state
  set version = version + 1, order_seq = p_order_seq, updated_at = pg_catalog.now()
  where id = 'main' and version = p_expected_version;
  get diagnostics affected = row_count;
  if affected = 0 then
    return false;
  end if;

  insert into public.restaurant_settings (id, data)
  values ('main', p_restaurant)
  on conflict (id) do update set data = excluded.data;

  delete from public.staff_users;
  insert into public.staff_users (id, sort_order, data)
  select value ->> 'id', ordinality::integer - 1, value
  from pg_catalog.jsonb_array_elements(p_staff_users) with ordinality as item(value, ordinality);

  delete from public.customers;
  insert into public.customers (id, sort_order, data)
  select value ->> 'id', ordinality::integer - 1, value
  from pg_catalog.jsonb_array_elements(p_customers) with ordinality as item(value, ordinality);

  delete from public.products;
  insert into public.products (id, sort_order, data)
  select value ->> 'id', ordinality::integer - 1, value
  from pg_catalog.jsonb_array_elements(p_products) with ordinality as item(value, ordinality);

  delete from public.orders;
  insert into public.orders (id, sort_order, data)
  select value ->> 'id', ordinality::integer - 1, value
  from pg_catalog.jsonb_array_elements(p_orders) with ordinality as item(value, ordinality);

  return true;
end;
$$;

revoke all on function public.save_app_state(bigint, bigint, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_app_state(bigint, bigint, jsonb, jsonb, jsonb, jsonb, jsonb)
  to service_role;
