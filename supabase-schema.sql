-- Supabase schema for Cropwise ARM Voice Entry
-- Run this in the Supabase SQL Editor to set up the database

-- Trial configurations
create table if not exists trial_configs (
  id text primary key,
  name text not null,
  treatments integer not null,
  replications integer not null,
  serpentine boolean not null default true,
  variables jsonb not null default '[]',
  created_at bigint not null,
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade
);

-- Trial sessions (one per recording run)
create table if not exists trial_sessions (
  id text primary key, -- config.id + '-' + startedAt
  config_id text not null references trial_configs(id) on delete cascade,
  started_at bigint not null,
  completed_at bigint,
  current_plot_index integer not null default 0,
  current_variable_index integer not null default 0,
  current_sub_sample_index integer not null default 0,
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade
);

-- Plot data (readings, notes per plot per session)
create table if not exists plot_data (
  id bigint generated always as identity primary key,
  session_id text not null references trial_sessions(id) on delete cascade,
  plot_number integer not null,
  readings jsonb not null default '{}',
  notes jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique(session_id, plot_number)
);

-- Plot photos stored as references to Supabase Storage
create table if not exists plot_photos (
  id bigint generated always as identity primary key,
  session_id text not null references trial_sessions(id) on delete cascade,
  plot_number integer not null,
  storage_path text not null,
  timestamp bigint not null,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table trial_configs enable row level security;
alter table trial_sessions enable row level security;
alter table plot_data enable row level security;
alter table plot_photos enable row level security;

-- Policies: users can only access their own data
create policy "Users can manage own configs" on trial_configs
  for all using (auth.uid() = user_id);

create policy "Users can manage own sessions" on trial_sessions
  for all using (auth.uid() = user_id);

create policy "Users can manage own plot data" on plot_data
  for all using (
    session_id in (select id from trial_sessions where user_id = auth.uid())
  );

create policy "Users can manage own photos" on plot_photos
  for all using (
    session_id in (select id from trial_sessions where user_id = auth.uid())
  );

-- Storage bucket for plot photos
insert into storage.buckets (id, name, public)
values ('plot-photos', 'plot-photos', false)
on conflict (id) do nothing;

-- Storage policy: users can upload/read their own photos
create policy "Users can upload photos" on storage.objects
  for insert with check (
    bucket_id = 'plot-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own photos" on storage.objects
  for select using (
    bucket_id = 'plot-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own photos" on storage.objects
  for delete using (
    bucket_id = 'plot-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Index for faster session lookups
create index if not exists idx_trial_sessions_config on trial_sessions(config_id);
create index if not exists idx_plot_data_session on plot_data(session_id);
create index if not exists idx_plot_photos_session on plot_photos(session_id);
