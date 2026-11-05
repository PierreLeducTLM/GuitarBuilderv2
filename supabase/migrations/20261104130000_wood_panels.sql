-- Wood panels (wood-panel-properties): the user's library of measured tonewood samples.
-- The results snapshot is generated from the stored inputs by the formula functions below,
-- so it always matches them and clients cannot write it.

-- The formulas, in the spec's units: lengths in mm, mass in g, frequencies in Hz, the
-- stiffness parameter dimensionless. Each converts to SI, applies the spec's formula and
-- returns kg/m³, GPa, mm or g. Generated columns are computed before check constraints,
-- so the functions return null for inputs that are not positive and the checks report them.
create function public.wood_density_kg_m3(
  l double precision, w double precision, h double precision, m double precision
) returns double precision
language sql immutable set search_path = ''
as $$
  select case when least(l, w, h, m) > 0
              then (m * 1e-3) / ((l * 1e-3) * (w * 1e-3) * (h * 1e-3)) end
$$;

create function public.wood_e_long_gpa(
  l double precision, w double precision, h double precision, m double precision,
  fl double precision
) returns double precision
language sql immutable set search_path = ''
as $$
  select 0.94146 * public.wood_density_kg_m3(l, w, h, m) * (l * 1e-3) ^ 4 * fl ^ 2
         / (h * 1e-3) ^ 2 / 1e9
$$;

create function public.wood_e_cross_gpa(
  l double precision, w double precision, h double precision, m double precision,
  fc double precision
) returns double precision
language sql immutable set search_path = ''
as $$
  select 0.94146 * public.wood_density_kg_m3(l, w, h, m) * (w * 1e-3) ^ 4 * fc ^ 2
         / (h * 1e-3) ^ 2 / 1e9
$$;

create function public.wood_g_lc_gpa(
  l double precision, w double precision, h double precision, m double precision,
  fd double precision
) returns double precision
language sql immutable set search_path = ''
as $$
  select 1.21585 * public.wood_density_kg_m3(l, w, h, m) * (l * 1e-3) ^ 2 * (w * 1e-3) ^ 2
         * fd ^ 2 / (h * 1e-3) ^ 2 / 1e9
$$;

create function public.wood_target_thickness_mm(
  l double precision, w double precision, h double precision, m double precision,
  fl double precision, fc double precision, fd double precision,
  a double precision, b double precision, f double precision
) returns double precision
language sql immutable set search_path = ''
as $$
  select case when least(l, w, h, m, fl, fc, fd, a, b, f) > 0 then
         0.95977 * f * (a * 1e-3) ^ 2 * sqrt(public.wood_density_kg_m3(l, w, h, m))
         / sqrt(
             public.wood_e_long_gpa(l, w, h, m, fl) * 1e9
             + (a / b) ^ 4 * public.wood_e_cross_gpa(l, w, h, m, fc) * 1e9
             + (a / b) ^ 2 * (0.02857 * public.wood_e_long_gpa(l, w, h, m, fl) * 1e9
                              + 1.12 * public.wood_g_lc_gpa(l, w, h, m, fd) * 1e9)
           ) * 1e3 end
$$;

create function public.wood_estimated_mass_g(
  l double precision, w double precision, h double precision, m double precision,
  fl double precision, fc double precision, fd double precision,
  a double precision, b double precision, f double precision
) returns double precision
language sql immutable set search_path = ''
as $$
  select public.wood_density_kg_m3(l, w, h, m) * (a * 1e-3) * (b * 1e-3)
         * public.wood_target_thickness_mm(l, w, h, m, fl, fc, fd, a, b, f) * 1e-3 * 0.755 * 1e3
$$;

-- Stored spectra: an object keyed by frequency field, each a valid tap-tone record.
create function public.wood_panel_spectra_is_valid(p_spectra jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(p_spectra) = 'object'
     and not exists (
       select 1 from jsonb_each(p_spectra) as s (key, value)
        where s.key not in ('longitudinal', 'crossGrain', 'diagonal')
           or not public.spectrum_record_is_valid(s.value)
     )
$$;

create table public.wood_panels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (name ~ '\S'),
  sample_length_mm double precision not null check (sample_length_mm > 0 and sample_length_mm < 'Infinity'),
  sample_width_mm double precision not null check (sample_width_mm > 0 and sample_width_mm < 'Infinity'),
  sample_thickness_mm double precision not null check (sample_thickness_mm > 0 and sample_thickness_mm < 'Infinity'),
  sample_mass_g double precision not null check (sample_mass_g > 0 and sample_mass_g < 'Infinity'),
  freq_longitudinal_hz double precision not null check (freq_longitudinal_hz > 0 and freq_longitudinal_hz < 'Infinity'),
  freq_cross_grain_hz double precision not null check (freq_cross_grain_hz > 0 and freq_cross_grain_hz < 'Infinity'),
  freq_diagonal_hz double precision not null check (freq_diagonal_hz > 0 and freq_diagonal_hz < 'Infinity'),
  plate_length_mm double precision not null check (plate_length_mm > 0 and plate_length_mm < 'Infinity'),
  plate_width_mm double precision not null check (plate_width_mm > 0 and plate_width_mm < 'Infinity'),
  stiffness_parameter double precision not null default 75
    check (stiffness_parameter > 0 and stiffness_parameter < 'Infinity'),
  e_long_gpa double precision generated always as (public.wood_e_long_gpa(
    sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g, freq_longitudinal_hz)) stored,
  e_cross_gpa double precision generated always as (public.wood_e_cross_gpa(
    sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g, freq_cross_grain_hz)) stored,
  g_lc_gpa double precision generated always as (public.wood_g_lc_gpa(
    sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g, freq_diagonal_hz)) stored,
  target_thickness_mm double precision generated always as (public.wood_target_thickness_mm(
    sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g,
    freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
    plate_length_mm, plate_width_mm, stiffness_parameter)) stored,
  estimated_mass_g double precision generated always as (public.wood_estimated_mass_g(
    sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g,
    freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
    plate_length_mm, plate_width_mm, stiffness_parameter)) stored,
  spectra jsonb not null default '{}' check (public.wood_panel_spectra_is_valid(spectra)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wood_panels is
  'A user''s measured wood panels (wood-panel-properties); results are generated from the inputs.';

create index wood_panels_owner_created_idx on public.wood_panels (owner_id, created_at desc);

create trigger wood_panels_set_updated_at
  before update on public.wood_panels
  for each row execute function public.set_updated_at();

-- Access: owners do everything with their panels; administrators read every panel but
-- change none (Panel Ownership and Access). Clients write only the name, the ten inputs
-- and the spectra, so the owner, the timestamps and the snapshot stay server-controlled.
alter table public.wood_panels enable row level security;

create policy "Owners and administrators read panels" on public.wood_panels
  for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "Owners create their panels" on public.wood_panels
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Owners change their panels" on public.wood_panels
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Owners delete their panels" on public.wood_panels
  for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke all on table public.wood_panels from public, anon, authenticated, service_role;
grant select on table public.wood_panels to authenticated, service_role;
grant insert (name, sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g,
              freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
              plate_length_mm, plate_width_mm, stiffness_parameter, spectra)
  on table public.wood_panels to authenticated;
grant update (name, sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g,
              freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
              plate_length_mm, plate_width_mm, stiffness_parameter, spectra)
  on table public.wood_panels to authenticated;
grant delete on table public.wood_panels to authenticated;

-- The shared reference set (Reference Panel Set): every signed-in user reads it, only
-- administrators change it. It holds no owner and no spectra.
create table public.default_wood_panels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name ~ '\S'),
  sample_length_mm double precision not null check (sample_length_mm > 0 and sample_length_mm < 'Infinity'),
  sample_width_mm double precision not null check (sample_width_mm > 0 and sample_width_mm < 'Infinity'),
  sample_thickness_mm double precision not null check (sample_thickness_mm > 0 and sample_thickness_mm < 'Infinity'),
  sample_mass_g double precision not null check (sample_mass_g > 0 and sample_mass_g < 'Infinity'),
  freq_longitudinal_hz double precision not null check (freq_longitudinal_hz > 0 and freq_longitudinal_hz < 'Infinity'),
  freq_cross_grain_hz double precision not null check (freq_cross_grain_hz > 0 and freq_cross_grain_hz < 'Infinity'),
  freq_diagonal_hz double precision not null check (freq_diagonal_hz > 0 and freq_diagonal_hz < 'Infinity'),
  plate_length_mm double precision not null check (plate_length_mm > 0 and plate_length_mm < 'Infinity'),
  plate_width_mm double precision not null check (plate_width_mm > 0 and plate_width_mm < 'Infinity'),
  stiffness_parameter double precision not null default 75
    check (stiffness_parameter > 0 and stiffness_parameter < 'Infinity'),
  e_long_gpa double precision generated always as (public.wood_e_long_gpa(
    sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g, freq_longitudinal_hz)) stored,
  e_cross_gpa double precision generated always as (public.wood_e_cross_gpa(
    sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g, freq_cross_grain_hz)) stored,
  g_lc_gpa double precision generated always as (public.wood_g_lc_gpa(
    sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g, freq_diagonal_hz)) stored,
  target_thickness_mm double precision generated always as (public.wood_target_thickness_mm(
    sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g,
    freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
    plate_length_mm, plate_width_mm, stiffness_parameter)) stored,
  estimated_mass_g double precision generated always as (public.wood_estimated_mass_g(
    sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g,
    freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
    plate_length_mm, plate_width_mm, stiffness_parameter)) stored,
  created_at timestamptz not null default now()
);

comment on table public.default_wood_panels is
  'Reference wood panels copied into empty libraries (wood-panel-properties); curated by administrators.';

alter table public.default_wood_panels enable row level security;

create policy "Signed-in users read the reference set" on public.default_wood_panels
  for select to authenticated using (true);
create policy "Administrators add reference panels" on public.default_wood_panels
  for insert to authenticated with check ((select public.is_admin()));
create policy "Administrators change reference panels" on public.default_wood_panels
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Administrators delete reference panels" on public.default_wood_panels
  for delete to authenticated using ((select public.is_admin()));

revoke all on table public.default_wood_panels from public, anon, authenticated, service_role;
grant select on table public.default_wood_panels to authenticated, service_role;
grant insert (name, sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g,
              freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
              plate_length_mm, plate_width_mm, stiffness_parameter)
  on table public.default_wood_panels to authenticated;
grant update (name, sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g,
              freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
              plate_length_mm, plate_width_mm, stiffness_parameter)
  on table public.default_wood_panels to authenticated;
grant delete on table public.default_wood_panels to authenticated;

-- "Load Default Panels": copies every reference panel into the caller's library when it is
-- empty and returns how many it copied, 0 for an empty reference set, or null when the
-- library already holds panels. A per-user advisory lock serializes double clicks and two
-- tabs, so the copy happens at most once. It runs as the caller, so the normal insert
-- policy and grants apply.
create function public.load_default_wood_panels()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('load_default_wood_panels:' || v_user::text, 0));
  if exists (select 1 from public.wood_panels w where w.owner_id = v_user) then
    return null;
  end if;
  insert into public.wood_panels (name, sample_length_mm, sample_width_mm, sample_thickness_mm,
    sample_mass_g, freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
    plate_length_mm, plate_width_mm, stiffness_parameter)
  select d.name, d.sample_length_mm, d.sample_width_mm, d.sample_thickness_mm,
         d.sample_mass_g, d.freq_longitudinal_hz, d.freq_cross_grain_hz, d.freq_diagonal_hz,
         d.plate_length_mm, d.plate_width_mm, d.stiffness_parameter
    from public.default_wood_panels d
   order by d.created_at, d.name;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.load_default_wood_panels() is
  'Copies the reference panels into the caller''s empty library, once (wood-panel-properties).';

revoke execute on function public.load_default_wood_panels() from public, anon;
grant execute on function public.load_default_wood_panels() to authenticated;
