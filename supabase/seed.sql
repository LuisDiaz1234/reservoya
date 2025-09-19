-- seed.sql — Datos demo para visualizar en Table Editor

-- Workspace demo
insert into public.workspaces (name, slug, public_booking_enabled, whatsapp_enabled, payments_enabled)
values ('Demo Salon', 'demo-salon', true, false, false)
on conflict (slug) do nothing;

-- Obtener id del workspace
with ws as (
  select id from public.workspaces where slug = 'demo-salon' limit 1
)
-- Providers
insert into public.providers (workspace_id, name, phone)
select id, 'María González', '+50760000001' from ws
union all
select id, 'José Pérez', '+50760000002' from ws;

-- Services
with ws as (
  select id from public.workspaces where slug = 'demo-salon' limit 1
)
insert into public.services (workspace_id, name, description, duration_minutes, price_cents, deposit_type, deposit_amount_cents, deposit_percent)
select id, 'Corte de cabello', 'Corte clásico', 45, 2000, 'PERCENT', 0, 50 from ws
union all
select id, 'Manicure', 'Servicio básico', 60, 1500, 'FIXED', 500, 0 from ws;

-- Slots semanales (Lunes a Viernes 09:00-17:00)
with ws as (select id from public.workspaces where slug = 'demo-salon' limit 1),
prov as (select id, workspace_id from public.providers where workspace_id in (select id from ws))
insert into public.slots (workspace_id, provider_id, weekday, start_time, end_time, capacity)
select p.workspace_id, p.id, d.wd, time '09:00', time '17:00', 1
from prov p
cross join (values (1),(2),(3),(4),(5)) as d(wd);

-- Ejemplo de booking manual (PENDING) para hoy+1
do $$
declare
  v_ws uuid;
  v_prov uuid;
  v_serv uuid;
  v_start timestamptz;
begin
  select id into v_ws from public.workspaces where slug = 'demo-salon' limit 1;
  select id into v_prov from public.providers where workspace_id = v_ws order by name limit 1;
  select id into v_serv from public.services where workspace_id = v_ws order by name limit 1;

  v_start := (now() at time zone 'America/Panama')::timestamptz + interval '1 day';
  v_start := date_trunc('day', v_start) + interval '10 hours'; -- mañana 10:00

  insert into public.bookings (
    workspace_id, provider_id, service_id,
    customer_name, customer_phone, customer_email,
    start_at, end_at, status, payment_status, deposit_cents, currency
  )
  values (
    v_ws, v_prov, v_serv,
    'Cliente Demo', '+50760000003', 'demo@reservoya.test',
    v_start, v_start + interval '45 minutes', 'PENDING', 'PENDING', 1000, 'USD'
  );
end$$;
