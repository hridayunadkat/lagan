create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 32),
  created_at timestamptz not null default now()
);

create table public.level_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.level_data enable row level security;

create policy "Users can read their profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can create their profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their profile"
  on public.profiles for delete
  using (auth.uid() = user_id);

create policy "Users can read their LEVEL data"
  on public.level_data for select
  using (auth.uid() = user_id);

create policy "Users can create their LEVEL data"
  on public.level_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their LEVEL data"
  on public.level_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their LEVEL data"
  on public.level_data for delete
  using (auth.uid() = user_id);
