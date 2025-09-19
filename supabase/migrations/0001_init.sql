-- 0001_init.sql
-- ReservoYA: esquema base con RLS, funciones y vista de utilización
-- Ejecutar en Supabase → SQL Editor

-- Extensiones necesarias
create extension if not exists pgcrypto;

-- ======================
-- Enums
-- ======================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_enum') then
    create type role_enum as enum ('admin','operator');
  end if;
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type booking_status as enum ('PENDING','CONFIRMED','CANCELLED','NO_SHOW');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('PENDING','PAID','FAILED','REFUNDED');
  end if;
  if not exists (select 1 from pg_type where typname = 'outbox_status') then
    create type outbox_status as enum ('PENDING','SENT','RETRY','DEAD');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_provider') then
    create type payment_provider as enum ('YAPPY','PAGUELOFACIL');
  end if;
end$$;

-- ======================
-- Tablas
-- ======================

-- Workspaces (tenants)
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Panama',
  currency text not null default 'USD',
  public_booking_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  payments_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slug_lowercase check (slug = lower(slug))
);

-- Miembros (relación con auth.users)
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role role_enum not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

-- Profesionales / Proveedores de servicios
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Servicios
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int not null check (duration_minutes > 0),
  price_cents int not null default 0 check (price_cents >= 0),
  deposit_type text not null default 'FIXED' check (deposit_type in ('FIXED','PERCENT')),
  deposit_amount_cents int not null default 0 check (deposit_amount_cents >= 0),
  deposit_percent numeric(5,2) not null default 0 check (deposit_percent >= 0 and deposit_percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Slots (disponibilidad semanal recurrente)
create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0=domingo ... 6=sábado
  start_time time not null,
  end_time time not null,
  capacity int not null default 1 check (capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slot_time_check check (end_time > start_time)
);

-- Bookings (reservas)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider_id uuid not null references public.providers(id),
  service_id uuid not null references public.services(id),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status booking_status not null default 'PENDING',
  payment_status payment_status not null default 'PENDING',
  deposit_cents int not null default 0,
  currency text not null default 'USD',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pagos (depósitos)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider payment_provider not null,
  status payment_status not null default 'PENDING',
  amount_cents int not null check (amount_cents >= 0),
  external_payment_id text,       -- id transacción del proveedor
  external_reference text,        -- referencia/orden propia o del proveedor
  idempotency_key text unique,    -- para evitar duplicados en webhooks
  raw_payload jsonb,              -- payload del proveedor (auditoría)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Outbox de notificaciones (WhatsApp)
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  channel text not null default 'WHATSAPP',
  to_phone text not null,
  body text not null,
  template_name text,
  status outbox_status not null default 'PENDING',
  attempts int not null default 0,
  last_error text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Event log (auditoría simple)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null,  -- e.g., 'api','webhook','system'
  type text not null,    -- e.g., 'booking.created','payment.paid'
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ======================
-- Índices
-- ======================
create index if not exists idx_workspaces_slug on public.workspaces(slug);
create index if not exists idx_providers_ws on public.providers(workspace_id);
create index if not exists idx_services_ws on public.services(workspace_id);
create index if not exists idx_slots_ws on public.slots(workspace_id);
create index if not exists idx_bookings_ws_start on public.bookings(workspace_id, start_at);
create index if not exists idx_bookings_provider_start on public.bookings(provider_id, start_at);
create index if not exists idx_payments_ws_status on public.payments(workspace_id, status);
create index if not exists idx_outbox_status_sched on public.notification_outbox(status, scheduled_at);

-- ======================
-- Triggers updated_at
-- ======================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tg_workspaces_updated') then
    create trigger tg_workspaces_updated
      before update on public.workspaces
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tg_members_updated') then
    create trigger tg_members_updated
      before update on public.members
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tg_providers_updated') then
    create trigger tg_providers_updated
      before update on public.providers
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tg_services_updated') then
    create trigger tg_services_updated
      before update on public.services
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tg_slots_updated') then
    create trigger tg_slots_updated
      before update on public.slots
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tg_bookings_updated') then
    create trigger tg_bookings_updated
      before update on public.bookings
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tg_payments_updated') then
    create trigger tg_payments_updated
      before update on public.payments
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tg_outbox_updated') then
    create trigger tg_outbox_updated
      before update on public.notification_outbox
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- ======================
-- Funciones de utilidad / seguridad
-- ======================

-- is_member_of: verifica si el usuario actual (auth.uid()) pertenece al workspace
create or replace function public.is_member_of(ws uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
  );
$$;

grant execute on function public.is_member_of(uuid) to anon, authenticated;

-- Normalizar teléfono panameño básico: +507XXXXXXXX (permite otros con +)
create or replace function public.normalize_phone(raw text)
returns text
language plpgsql
as $$
declare
  digits text;
begin
  if raw is null then
    return null;
  end if;
  digits := regexp_replace(raw, '\D', '', 'g'); -- quitar no dígitos
  if digits like '507%' then
    return '+' || digits;
  elsif length(digits) = 8 then
    return '+507' || digits;
  elsif digits like '00%' then
    return '+' || substr(digits, 3);
  else
    return '+' || digits;
  end if;
end;
$$;

grant execute on function public.normalize_phone(text) to anon, authenticated;

-- Queue WhatsApp en outbox
create or replace function public.queue_whatsapp(
  p_workspace_id uuid,
  p_to text,
  p_body text,
  p_scheduled_at timestamptz default now(),
  p_template_name text default null,
  p_booking_id uuid default null
) returns uuid
language sql
security definer
set search_path = public
as $$
  insert into public.notification_outbox (workspace_id, booking_id, to_phone, body, template_name, scheduled_at)
  values (p_workspace_id, p_booking_id, public.normalize_phone(p_to), p_body, p_template_name, p_scheduled_at)
  returning id;
$$;

grant execute on function public.queue_whatsapp(uuid, text, text, timestamptz, text, uuid) to authenticated;

-- Crear reserva pública (para front público). Devuelve objeto con id y depósito.
create or replace function public.create_booking_public(
  p_workspace_slug text,
  p_service_id uuid,
  p_provider_id uuid,
  p_start_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_duration int;
  v_price int;
  v_dep_type text;
  v_dep_amt int;
  v_dep_pct numeric(5,2);
  v_end_at timestamptz;
  v_deposit_cents int;
  v_booking_id uuid;
begin
  -- 1) workspace por slug y habilitado públicamente
  select w.id
    into v_workspace_id
  from public.workspaces w
  where w.slug = lower(p_workspace_slug)
    and w.public_booking_enabled = true
  limit 1;

  if v_workspace_id is null then
    raise exception 'Workspace no encontrado o no permite reservas públicas';
  end if;

  -- 2) datos de servicio (mismo workspace)
  select s.duration_minutes, s.price_cents, s.deposit_type, s.deposit_amount_cents, s.deposit_percent
    into v_duration, v_price, v_dep_type, v_dep_amt, v_dep_pct
  from public.services s
  where s.id = p_service_id
    and s.workspace_id = v_workspace_id;

  if v_duration is null then
    raise exception 'Servicio inválido para este workspace';
  end if;

  v_end_at := p_start_at + make_interval(mins => v_duration);

  -- 3) calcular depósito
  if v_dep_type = 'PERCENT' then
    v_deposit_cents := greatest(1, round((v_price * coalesce(v_dep_pct,0))::numeric / 100.0)::int);
  else
    v_deposit_cents := coalesce(v_dep_amt,0);
  end if;

  -- 4) insertar booking
  insert into public.bookings (
    workspace_id, provider_id, service_id,
    customer_name, customer_phone, customer_email,
    start_at, end_at, status, payment_status, deposit_cents, currency
  )
  values (
    v_workspace_id, p_provider_id, p_service_id,
    p_customer_name, public.normalize_phone(p_customer_phone), p_customer_email,
    p_start_at, v_end_at, 'PENDING', 'PENDING', v_deposit_cents, 'USD'
  )
  returning id into v_booking_id;

  -- 5) evento
  insert into public.events (workspace_id, source, type, payload)
  values (v_workspace_id, 'api', 'booking.created', jsonb_build_object(
    'booking_id', v_booking_id,
    'start_at', p_start_at,
    'deposit_cents', v_deposit_cents
  ));

  return jsonb_build_object('booking_id', v_booking_id, 'deposit_cents', v_deposit_cents);
end;
$$;

-- Nota: SECURITY DEFINER + el owner de la función (tabla owner) permite insertar aunque el caller sea anon.
-- Restringiremos permisos de INSERT directos para anon/authenticated y usaremos esta RPC como puerta.
grant execute on function public.create_booking_public(text, uuid, uuid, timestamptz, text, text, text) to anon;

-- Marcar pago como PAID y confirmar booking (para uso desde webhooks)
create or replace function public.mark_payment_paid(
  p_payment_id uuid,
  p_external_payment_id text,
  p_raw_payload jsonb default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_booking uuid;
  v_changed boolean := false;
begin
  -- Actualizar pago
  update public.payments
     set status = 'PAID',
         external_payment_id = p_external_payment_id,
         raw_payload = coalesce(p_raw_payload, raw_payload),
         updated_at = now()
   where id = p_payment_id
     and status <> 'PAID'
  returning workspace_id, booking_id into v_ws, v_booking;

  if v_ws is null then
    -- ya estaba pagado o no existe
    return false;
  end if;

  v_changed := true;

  -- Actualizar booking
  update public.bookings
     set payment_status = 'PAID',
         status = 'CONFIRMED',
         updated_at = now()
   where id = v_booking;

  -- Eventos
  insert into public.events (workspace_id, source, type, payload)
  values
    (v_ws, 'webhook', 'payment.paid', jsonb_build_object('payment_id', p_payment_id, 'external_payment_id', p_external_payment_id)),
    (v_ws, 'system', 'booking.confirmed', jsonb_build_object('booking_id', v_booking));

  return v_changed;
end;
$$;

grant execute on function public.mark_payment_paid(uuid, text, jsonb) to anon, authenticated;

-- ======================
-- RLS (Row Level Security)
-- ======================

-- Habilitar RLS en tablas de negocio
alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.slots enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.events enable row level security;

-- Políticas: solo miembros del workspace pueden ver/gestionar datos
-- Nota: NO forzamos RLS (no usamos FORCE), para que SECURITY DEFINER (dueño) pueda operar donde corresponde.

-- WORKSPACES
drop policy if exists p_ws_select on public.workspaces;
create policy p_ws_select
  on public.workspaces
  for select
  to authenticated
  using (public.is_member_of(id));

-- MEMBERS
drop policy if exists p_members_all on public.members;
create policy p_members_all
  on public.members
  for all
  to authenticated
  using (public.is_member_of(workspace_id))
  with check (public.is_member_of(workspace_id));

-- PROVIDERS
drop policy if exists p_providers_all on public.providers;
create policy p_providers_all
  on public.providers
  for all
  to authenticated
  using (public.is_member_of(workspace_id))
  with check (public.is_member_of(workspace_id));

-- SERVICES
drop policy if exists p_services_all on public.services;
create policy p_services_all
  on public.services
  for all
  to authenticated
  using (public.is_member_of(workspace_id))
  with check (public.is_member_of(workspace_id));

-- SLOTS
drop policy if exists p_slots_all on public.slots;
create policy p_slots_all
  on public.slots
  for all
  to authenticated
  using (public.is_member_of(workspace_id))
  with check (public.is_member_of(workspace_id));

-- BOOKINGS
drop policy if exists p_bookings_select on public.bookings;
create policy p_bookings_select
  on public.bookings
  for select
  to authenticated
  using (public.is_member_of(workspace_id));

drop policy if exists p_bookings_modify on public.bookings;
create policy p_bookings_modify
  on public.bookings
  for update
  to authenticated
  using (public.is_member_of(workspace_id))
  with check (public.is_member_of(workspace_id));

-- No concedemos insert directo a anon/authenticated: se hace vía create_booking_public()
-- PAYMENTS
drop policy if exists p_payments_all on public.payments;
create policy p_payments_all
  on public.payments
  for all
  to authenticated
  using (public.is_member_of(workspace_id))
  with check (public.is_member_of(workspace_id));

-- OUTBOX
drop policy if exists p_outbox_all on public.notification_outbox;
create policy p_outbox_all
  on public.notification_outbox
  for all
  to authenticated
  using (public.is_member_of(workspace_id))
  with check (public.is_member_of(workspace_id));

-- EVENTS
drop policy if exists p_events_select on public.events;
create policy p_events_select
  on public.events
  for select
  to authenticated
  using (public.is_member_of(workspace_id));

-- ======================
-- Permisos de tabla (evitar inserciones directas desde el cliente)
-- ======================
revoke all on all tables in schema public from anon;
revoke insert, update, delete on all tables in schema public from authenticated;

-- Permitimos solo SELECT a authenticated; escritura pasa por RPCs/funciones con SECURITY DEFINER
grant select on public.workspaces, public.members, public.providers, public.services, public.slots, public.bookings, public.payments, public.notification_outbox, public.events to authenticated;

-- ======================
-- Vista de utilización (simple por día)
-- ======================
create or replace view public.v_slot_utilization as
select
  b.workspace_id,
  b.provider_id,
  date_trunc('day', b.start_at) as day,
  count(*) filter (where b.status = 'CONFIRMED') as confirmed_count,
  count(*) filter (where b.status = 'PENDING') as pending_count,
  count(*) as total_bookings
from public.bookings b
group by 1,2,3;
