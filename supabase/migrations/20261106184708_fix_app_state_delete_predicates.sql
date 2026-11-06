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

  delete from public.staff_users where true;
  insert into public.staff_users (id, sort_order, data)
  select value ->> 'id', ordinality::integer - 1, value
  from pg_catalog.jsonb_array_elements(p_staff_users) with ordinality as item(value, ordinality);

  delete from public.customers where true;
  insert into public.customers (id, sort_order, data)
  select value ->> 'id', ordinality::integer - 1, value
  from pg_catalog.jsonb_array_elements(p_customers) with ordinality as item(value, ordinality);

  delete from public.products where true;
  insert into public.products (id, sort_order, data)
  select value ->> 'id', ordinality::integer - 1, value
  from pg_catalog.jsonb_array_elements(p_products) with ordinality as item(value, ordinality);

  delete from public.orders where true;
  insert into public.orders (id, sort_order, data)
  select value ->> 'id', ordinality::integer - 1, value
  from pg_catalog.jsonb_array_elements(p_orders) with ordinality as item(value, ordinality);

  return true;
end;
$$;
