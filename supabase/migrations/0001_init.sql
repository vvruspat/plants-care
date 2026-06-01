-- Office Plant Care: initial schema, RLS, storage, and domain restriction.

-- 1. Domain restriction: only @coolset.com Google accounts may sign up.
create or replace function public.enforce_coolset_domain()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.email is null or new.email !~* '@coolset\.com$' then
    raise exception 'auth_domain_violation: only @coolset.com accounts may sign in';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_coolset_domain on auth.users;
create trigger enforce_coolset_domain
  before insert on auth.users
  for each row execute function public.enforce_coolset_domain();

-- 2. Helper: human-readable display name for an auth user.
create or replace function public.display_name(uid uuid)
returns text
language sql
stable
security definer
as $$
  select coalesce(
    (raw_user_meta_data ->> 'full_name'),
    (raw_user_meta_data ->> 'name'),
    split_part(email, '@', 1)
  )
  from auth.users where id = uid
$$;

-- 3. Tables.
create table public.plants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text,
  notes text,
  location text,
  primary_photo_path text,
  ai_care_summary text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plant_photos (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  storage_path text not null,
  taken_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id),
  ai_analysis jsonb
);
create index on public.plant_photos (plant_id, taken_at desc);

create table public.care_schedules (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  kind text not null check (kind in ('water', 'fertilize', 'custom')),
  label text not null,
  interval_days int not null check (interval_days > 0),
  next_due_at timestamptz not null default now(),
  last_done_at timestamptz,
  last_done_by uuid references auth.users(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.care_schedules (next_due_at) where active;

create table public.care_actions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.care_schedules(id) on delete cascade,
  plant_id uuid not null references public.plants(id) on delete cascade,
  done_by uuid references auth.users(id),
  done_at timestamptz not null default now(),
  note text
);
create index on public.care_actions (plant_id, done_at desc);

create table public.slack_notifications (
  schedule_id uuid not null references public.care_schedules(id) on delete cascade,
  notified_on date not null,
  primary key (schedule_id, notified_on)
);

-- 4. updated_at trigger for plants.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger plants_touch_updated_at
  before update on public.plants
  for each row execute function public.touch_updated_at();

-- 5. RLS: any authenticated user can read/write the shared office data.
alter table public.plants enable row level security;
alter table public.plant_photos enable row level security;
alter table public.care_schedules enable row level security;
alter table public.care_actions enable row level security;
alter table public.slack_notifications enable row level security;

create policy "authed read plants" on public.plants
  for select to authenticated using (true);
create policy "authed write plants" on public.plants
  for all to authenticated using (true) with check (true);

create policy "authed read photos" on public.plant_photos
  for select to authenticated using (true);
create policy "authed write photos" on public.plant_photos
  for all to authenticated using (true) with check (true);

create policy "authed read schedules" on public.care_schedules
  for select to authenticated using (true);
create policy "authed write schedules" on public.care_schedules
  for all to authenticated using (true) with check (true);

create policy "authed read actions" on public.care_actions
  for select to authenticated using (true);
create policy "authed write actions" on public.care_actions
  for all to authenticated using (true) with check (true);

-- slack_notifications is service-role only — no policies grant access to anon/authenticated.

-- 6. Storage bucket for plant photos (public read so Claude can fetch).
insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', true)
on conflict (id) do nothing;

create policy "public read plant photos"
  on storage.objects for select
  using (bucket_id = 'plant-photos');

create policy "authed upload plant photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'plant-photos');

create policy "authed delete plant photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'plant-photos');
