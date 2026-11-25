-- BLACKOUT : table de progression joueur
create table if not exists public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Joueur',
  balance integer not null default 2500 check (balance >= 0),
  mission_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

drop policy if exists "Players can read their own save" on public.player_saves;
create policy "Players can read their own save"
on public.player_saves for select
using (auth.uid() = user_id);

drop policy if exists "Players can create their own save" on public.player_saves;
create policy "Players can create their own save"
on public.player_saves for insert
with check (auth.uid() = user_id);

drop policy if exists "Players can update their own save" on public.player_saves;
create policy "Players can update their own save"
on public.player_saves for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);