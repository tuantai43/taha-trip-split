-- ============================================================
-- TAHA TripSplit — Supabase Schema (Optimized)
-- Order: tables → indexes → RLS enable → functions → triggers → policies
-- ============================================================

-- ════════════════════════════════════════════════════════
-- STEP 1: CREATE ALL TABLES
-- ════════════════════════════════════════════════════════
-- STEP 0: DROP ALL CUSTOM TRIGGERS & FUNCTIONS (for clean init)
-- Drop triggers (if exist)
drop trigger if exists tripsplit_user_profile on auth.users;
drop trigger if exists tripsplit_trips_updated_at on public.tripsplit_trips;
drop trigger if exists tripsplit_transactions_updated_at on public.tripsplit_transactions;
drop trigger if exists tripsplit_profiles_updated_at on public.tripsplit_profiles;

-- Drop functions (if exist)
drop function if exists public.tripsplit_handle_new_user cascade;
drop function if exists public.tripsplit_update_updated_at cascade;
drop function if exists public.tripsplit_get_member_trip_ids cascade;
-- ════════════════════════════════════════════════════════

create table public.tripsplit_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tripsplit_trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  currency_code text not null default 'VND',
  status text not null default 'active' check (status in ('draft','active','settled','archived')),
  start_date date,
  end_date date,
  invite_code text unique,
  share_enabled boolean not null default false,
  share_token text unique,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tripsplit_trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.tripsplit_trips(id) on delete cascade,
  user_id uuid references auth.users(id),
  display_name text not null,
  role text not null default 'member' check (role in ('owner','member')),
  is_guest boolean not null default true,
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  joined_at timestamptz not null default now()
);

create table public.tripsplit_transactions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.tripsplit_trips(id) on delete cascade,
  paid_by uuid not null references public.tripsplit_trip_members(id),
  amount numeric not null,
  currency_code text not null default 'VND',
  exchange_rate numeric not null default 1.0,
  description text not null,
  category text not null default 'other',
  type text not null default 'shared_expense' check (type in ('shared_expense','personal_expense','transfer','income')),
  split_method text not null default 'equal' check (split_method in ('equal','exact','percentage','shares')),
  paid_from_fund boolean not null default false,
  transaction_date date not null default current_date,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tripsplit_transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.tripsplit_transactions(id) on delete cascade,
  member_id uuid not null references public.tripsplit_trip_members(id),
  amount numeric not null,
  is_settled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════
-- STEP 2: INDEXES
-- ════════════════════════════════════════════════════════

create index tripsplit_idx_trip_members_trip_id on public.tripsplit_trip_members(trip_id);
create index tripsplit_idx_transactions_trip_id on public.tripsplit_transactions(trip_id);
create index tripsplit_idx_splits_transaction_id on public.tripsplit_transaction_splits(transaction_id);

-- ════════════════════════════════════════════════════════
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════

-- Removed: old tables do not exist after namespacing
alter table public.tripsplit_profiles enable row level security;
alter table public.tripsplit_trips enable row level security;
alter table public.tripsplit_trip_members enable row level security;
alter table public.tripsplit_transactions enable row level security;
alter table public.tripsplit_transaction_splits enable row level security;
-- ════════════════════════════════════════════════════════

-- Auto-create profile
create or replace function public.tripsplit_handle_new_user()
returns trigger as $$
begin
  insert into public.tripsplit_profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''), '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_catalog;

create or replace function public.tripsplit_update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public, pg_catalog;

create or replace function public.tripsplit_get_member_trip_ids()
returns setof uuid as $$
  select trip_id from public.tripsplit_trip_members where user_id = auth.uid();
$$ language sql security definer stable set search_path = public, pg_catalog;

create trigger tripsplit_user_profile after insert on auth.users for each row execute function public.tripsplit_handle_new_user();
create trigger tripsplit_trips_updated_at before update on public.tripsplit_trips for each row execute function public.tripsplit_update_updated_at();
create trigger tripsplit_transactions_updated_at before update on public.tripsplit_transactions for each row execute function public.tripsplit_update_updated_at();
create trigger tripsplit_profiles_updated_at before update on public.tripsplit_profiles for each row execute function public.tripsplit_update_updated_at();

-- ════════════════════════════════════════════════════════
-- STEP 5: RLS POLICIES (Fixed for 403 & 42501)
-- ════════════════════════════════════════════════════════

create policy "tripsplit_profile_select" on public.tripsplit_profiles for select using (auth.uid() = id);
create policy "tripsplit_profile_update" on public.tripsplit_profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "tripsplit_trips_insert" on public.tripsplit_trips for insert with check (auth.uid() is not null);
create policy "tripsplit_trips_select" on public.tripsplit_trips for select using (
  created_by = auth.uid() or
  id in (select public.tripsplit_get_member_trip_ids())
);
create policy "tripsplit_trips_update" on public.tripsplit_trips for update
  using (created_by = auth.uid() or created_by is null)
  with check (created_by = auth.uid() or created_by is null);
create policy "tripsplit_trips_delete" on public.tripsplit_trips for delete using (created_by = auth.uid());

create policy "tripsplit_members_insert" on public.tripsplit_trip_members for insert with check (auth.uid() is not null);
create policy "tripsplit_members_select" on public.tripsplit_trip_members for select using (
  user_id = auth.uid() or
  trip_id in (select public.tripsplit_get_member_trip_ids())
);
create policy "tripsplit_members_update" on public.tripsplit_trip_members for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
create policy "tripsplit_members_delete" on public.tripsplit_trip_members for delete using (
  trip_id in (select id from public.tripsplit_trips where created_by = auth.uid())
);

create policy "tripsplit_trans_insert" on public.tripsplit_transactions for insert with check (auth.uid() is not null);
create policy "tripsplit_trans_select" on public.tripsplit_transactions for select using (
  trip_id in (select id from public.tripsplit_trips where created_by = auth.uid()) or
  trip_id in (select trip_id from public.tripsplit_trip_members where user_id = auth.uid())
);
create policy "tripsplit_trans_update" on public.tripsplit_transactions for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
create policy "tripsplit_trans_delete" on public.tripsplit_transactions for delete using (auth.uid() is not null);

create policy "tripsplit_splits_insert" on public.tripsplit_transaction_splits for insert with check (auth.uid() is not null);
create policy "tripsplit_splits_select" on public.tripsplit_transaction_splits for select using (auth.uid() is not null);
create policy "tripsplit_splits_update" on public.tripsplit_transaction_splits for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
create policy "tripsplit_splits_delete" on public.tripsplit_transaction_splits for delete using (auth.uid() is not null);

-- ════════════════════════════════════════════════════════
-- STEP 6: BACKFILL
-- ════════════════════════════════════════════════════════
insert into public.tripsplit_profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data->>'full_name', email)
from auth.users where id not in (select id from public.tripsplit_profiles)
on conflict (id) do nothing;