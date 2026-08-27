-- =============================================================================
-- Pescalie · Esquema de reservas
-- Ejecútalo una vez desde la sección Scripts de v0 (o el editor SQL de Supabase).
-- =============================================================================

-- Tabla principal de reservas
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_date date not null,
  reservation_time text not null,
  party_size integer not null check (party_size > 0 and party_size <= 120),
  name text not null,
  phone text not null,
  email text not null,
  notes text,
  status text not null default 'confirmada'
    check (status in ('confirmada', 'cancelada')),
  created_at timestamptz not null default now()
);

create index if not exists reservations_turn_idx
  on public.reservations (reservation_date, reservation_time);

alter table public.reservations enable row level security;

-- Solo usuarios autenticados (el equipo/admin) pueden leer y actualizar.
drop policy if exists "reservations_select_authenticated" on public.reservations;
create policy "reservations_select_authenticated"
  on public.reservations for select
  to authenticated
  using (true);

drop policy if exists "reservations_update_authenticated" on public.reservations;
create policy "reservations_update_authenticated"
  on public.reservations for update
  to authenticated
  using (true)
  with check (true);

-- El público NO inserta ni lee directamente: usa las funciones de abajo.

-- -----------------------------------------------------------------------------
-- Aforo disponible para un turno (fecha + hora). Máximo 120 plazas.
-- -----------------------------------------------------------------------------
create or replace function public.available_capacity(p_date date, p_time text)
returns integer
language sql
security definer
set search_path = ''
as $$
  select 120 - coalesce(sum(party_size), 0)::int
  from public.reservations
  where reservation_date = p_date
    and reservation_time = p_time
    and status = 'confirmada';
$$;

-- -----------------------------------------------------------------------------
-- Crea una reserva validando el aforo de forma atómica (evita sobreventa).
-- Devuelve JSON: { ok, id?, remaining?, error? }
-- -----------------------------------------------------------------------------
create or replace function public.create_reservation(
  p_date date,
  p_time text,
  p_party_size integer,
  p_name text,
  p_phone text,
  p_email text,
  p_notes text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used int;
  v_remaining int;
  v_id uuid;
begin
  if p_party_size is null or p_party_size <= 0 or p_party_size > 120 then
    return json_build_object('ok', false, 'error', 'party_size_invalid');
  end if;

  if coalesce(trim(p_name), '') = ''
     or coalesce(trim(p_phone), '') = ''
     or coalesce(trim(p_email), '') = '' then
    return json_build_object('ok', false, 'error', 'missing_fields');
  end if;

  -- Serializa las reservas del mismo turno para que el conteo sea fiable.
  perform pg_advisory_xact_lock(hashtextextended(p_date::text || '|' || p_time, 0));

  select coalesce(sum(party_size), 0) into v_used
  from public.reservations
  where reservation_date = p_date
    and reservation_time = p_time
    and status = 'confirmada';

  v_remaining := 120 - v_used;

  if p_party_size > v_remaining then
    return json_build_object('ok', false, 'error', 'no_capacity', 'remaining', v_remaining);
  end if;

  insert into public.reservations
    (reservation_date, reservation_time, party_size, name, phone, email, notes)
  values
    (p_date, p_time, p_party_size, trim(p_name), trim(p_phone), trim(p_email), nullif(trim(p_notes), ''))
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'remaining', v_remaining - p_party_size);
end;
$$;

-- Permite que el público (anon) ejecute solo estas dos funciones controladas.
grant execute on function public.available_capacity(date, text) to anon, authenticated;
grant execute on function public.create_reservation(date, text, integer, text, text, text, text) to anon, authenticated;
