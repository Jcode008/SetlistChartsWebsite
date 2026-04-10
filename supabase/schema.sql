-- =============================================
-- BandApp Database Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Bands table
create table if not exists public.bands (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Band members table
create table if not exists public.band_members (
  id uuid default gen_random_uuid() primary key,
  band_id uuid references public.bands(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz default now(),
  unique(band_id, user_id)
);

-- Setlists table (folders)
create table if not exists public.setlists (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  band_id uuid references public.bands(id) on delete cascade not null,
  position integer not null default 0,
  created_at timestamptz default now()
);

-- Charts table (pages within setlists)
create table if not exists public.charts (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null default '',
  notes text not null default '',
  drawing_data text not null default '',
  staff_data text not null default '',
  setlist_id uuid references public.setlists(id) on delete cascade not null,
  position integer not null default 0,
  key_signature text not null default 'C',
  tempo integer,
  time_signature text not null default '4/4',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===================
-- Row Level Security
-- ===================

alter table public.bands enable row level security;
alter table public.band_members enable row level security;
alter table public.setlists enable row level security;
alter table public.charts enable row level security;

-- Bands: members can read their bands
create policy "Band members can view their bands"
  on public.bands for select
  using (
    id in (
      select band_id from public.band_members where user_id = auth.uid()
    )
  );

-- Bands: anyone authenticated can create a band
create policy "Authenticated users can create bands"
  on public.bands for insert
  to authenticated
  with check (true);

-- Bands: anyone can read a band by invite code (for joining)
create policy "Anyone can find band by invite code"
  on public.bands for select
  using (true);

-- Band members: users can view their own memberships
create policy "Band members can view members"
  on public.band_members for select
  using (user_id = auth.uid());

-- Band members: authenticated users can add themselves
create policy "Users can join bands"
  on public.band_members for insert
  to authenticated
  with check (user_id = auth.uid());

-- Setlists: band members can CRUD
create policy "Band members can view setlists"
  on public.setlists for select
  using (
    band_id in (
      select band_id from public.band_members where user_id = auth.uid()
    )
  );

create policy "Band members can create setlists"
  on public.setlists for insert
  to authenticated
  with check (
    band_id in (
      select band_id from public.band_members where user_id = auth.uid()
    )
  );

create policy "Band members can update setlists"
  on public.setlists for update
  to authenticated
  using (
    band_id in (
      select band_id from public.band_members where user_id = auth.uid()
    )
  );

create policy "Band members can delete setlists"
  on public.setlists for delete
  to authenticated
  using (
    band_id in (
      select band_id from public.band_members where user_id = auth.uid()
    )
  );

-- Charts: band members can CRUD via setlist
create policy "Band members can view charts"
  on public.charts for select
  using (
    setlist_id in (
      select s.id from public.setlists s
      join public.band_members bm on bm.band_id = s.band_id
      where bm.user_id = auth.uid()
    )
  );

create policy "Band members can create charts"
  on public.charts for insert
  to authenticated
  with check (
    setlist_id in (
      select s.id from public.setlists s
      join public.band_members bm on bm.band_id = s.band_id
      where bm.user_id = auth.uid()
    )
  );

create policy "Band members can update charts"
  on public.charts for update
  to authenticated
  using (
    setlist_id in (
      select s.id from public.setlists s
      join public.band_members bm on bm.band_id = s.band_id
      where bm.user_id = auth.uid()
    )
  );

create policy "Band members can delete charts"
  on public.charts for delete
  to authenticated
  using (
    setlist_id in (
      select s.id from public.setlists s
      join public.band_members bm on bm.band_id = s.band_id
      where bm.user_id = auth.uid()
    )
  );

-- Function to auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_chart_update
  before update on public.charts
  for each row execute procedure public.handle_updated_at();
