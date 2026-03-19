-- ============================================================
-- TAHA TripSplit — Supabase Schema (Optimized)
-- Order: tables → indexes → RLS enable → functions → triggers → policies
-- ============================================================

-- ════════════════════════════════════════════════════════
-- STEP 1: CREATE ALL TABLES
-- ════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
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

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id),
  display_name text not null,
  role text not null default 'member' check (role in ('owner','member')),
  is_guest boolean not null default true,
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  joined_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  paid_by uuid not null references public.trip_members(id),
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

create table if not exists public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  member_id uuid not null references public.trip_members(id),
  amount numeric not null,
  is_settled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════
-- STEP 2: INDEXES
-- ════════════════════════════════════════════════════════

create index if not exists idx_trip_members_trip_id on public.trip_members(trip_id);
create index if not exists idx_transactions_trip_id on public.transactions(trip_id);
create index if not exists idx_splits_transaction_id on public.transaction_splits(transaction_id);

-- ════════════════════════════════════════════════════════
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_splits enable row level security;

-- ════════════════════════════════════════════════════════
-- STEP 4: FUNCTIONS & TRIGGERS
-- ════════════════════════════════════════════════════════

-- Auto-create profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''), '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Helper: returns trip_ids the current user is a member of.
-- Uses SECURITY DEFINER to bypass RLS on trip_members,
-- preventing infinite recursion when trip/member policies call each other.
create or replace function public.get_member_trip_ids()
returns setof uuid as $$
  select trip_id from public.trip_members where user_id = auth.uid()
$$ language sql security definer stable;

-- Triggers setup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create trigger trips_updated_at before update on public.trips for each row execute function public.update_updated_at();
create trigger transactions_updated_at before update on public.transactions for each row execute function public.update_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at();

-- ════════════════════════════════════════════════════════
-- STEP 5: RLS POLICIES (Fixed for 403 & 42501)
-- ════════════════════════════════════════════════════════

-- PROFILES
create policy "profile_select" on public.profiles for select using (auth.uid() = id);
create policy "profile_update" on public.profiles for update using (auth.uid() = id);

-- TRIPS
create policy "trips_insert" on public.trips for insert with check (auth.uid() is not null);
create policy "trips_select" on public.trips for select using (
  created_by = auth.uid() or
  id in (select public.get_member_trip_ids())
);
create policy "trips_update" on public.trips for update using (created_by = auth.uid() or created_by is null);
create policy "trips_delete" on public.trips for delete using (created_by = auth.uid());

-- TRIP MEMBERS
create policy "members_insert" on public.trip_members for insert with check (auth.uid() is not null);
create policy "members_select" on public.trip_members for select using (
  user_id = auth.uid() or
  trip_id in (select public.get_member_trip_ids())
);
create policy "members_update" on public.trip_members for update using (auth.uid() is not null);

-- TRANSACTIONS
create policy "trans_insert" on public.transactions for insert with check (auth.uid() is not null);
create policy "trans_select" on public.transactions for select using (
  trip_id in (select id from public.trips where created_by = auth.uid()) or
  trip_id in (select trip_id from public.trip_members where user_id = auth.uid())
);
create policy "trans_all_actions" on public.transactions for all using (auth.uid() is not null);

-- TRANSACTION SPLITS
create policy "splits_all" on public.transaction_splits for all using (auth.uid() is not null);

-- ════════════════════════════════════════════════════════
-- STEP 6: BACKFILL
-- ════════════════════════════════════════════════════════
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data->>'full_name', email)
from auth.users where id not in (select id from public.profiles)
on conflict (id) do nothing;