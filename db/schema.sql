-- ============================================================
-- ValueGol — Esquema Postgres (Supabase) · Fase 2
-- Aplícalo en Supabase → SQL Editor → New query → Run.
-- Incluye RLS (cada usuario solo ve lo suyo) y catálogo semilla.
-- ============================================================

-- ---------- PERFIL (1:1 con auth.users) ----------
create table if not exists public.profile (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text,
  plan             text not null default 'free',         -- 'free' | 'pro'
  telegram_chat_id text,
  created_at       timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- ESTRATEGIAS ----------
create table if not exists public.strategy (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profile(id) on delete cascade,
  name        text not null,
  enabled     boolean not null default true,
  scope       text not null default 'live',              -- 'live' | 'prematch'
  definition  jsonb not null,                            -- árbol de condiciones (motor)
  notify      jsonb not null default '{"telegram":true}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_strategy_user on public.strategy(user_id);
create index if not exists idx_strategy_enabled on public.strategy(enabled) where enabled;

-- ---------- CATÁLOGO DE MÉTRICAS (dirige el editor visual) ----------
create table if not exists public.metric_catalog (
  key       text primary key,
  label     text not null,
  category  text not null,                               -- 'historico' | 'odds' | 'live'
  unit      text,
  supports  jsonb not null default '{}'                  -- ventanas/venue/agg válidos
);

-- ---------- PARTIDOS + STATS ----------
create table if not exists public.match (
  id          text primary key,
  league_id   text,
  league_name text,
  home_team   text,
  away_team   text,
  status      text,
  minute      int,
  score_home  int,
  score_away  int,
  kickoff_at  timestamptz,
  updated_at  timestamptz default now()
);

create table if not exists public.match_stat (
  match_id  text references public.match(id) on delete cascade,
  ts        timestamptz not null default now(),
  payload   jsonb not null,
  primary key (match_id, ts)
);

-- Stats históricas precalculadas por equipo (condiciones "media últ. N")
create table if not exists public.team_form (
  team_id     text not null,
  venue       text not null,                             -- 'home' | 'away' | 'overall'
  window_n    int  not null,                             -- 5 | 10
  metrics     jsonb not null,                            -- {fh_goals_for_avg:0.6, ht05_pct:70,...}
  computed_at timestamptz not null default now(),
  primary key (team_id, venue, window_n)
);

-- Cuotas pre-partido por mercado
create table if not exists public.odds (
  match_id   text references public.match(id) on delete cascade,
  market     text not null,                              -- 'fh_over_0_5' | 'fh_over_1_5'
  value      numeric,
  updated_at timestamptz default now(),
  primary key (match_id, market)
);

-- ---------- ALERTAS (histórico + export) ----------
create table if not exists public.alert (
  id          uuid primary key default gen_random_uuid(),
  strategy_id uuid references public.strategy(id) on delete cascade,
  user_id     uuid references public.profile(id) on delete cascade,
  match_id    text,
  fired_at    timestamptz not null default now(),
  snapshot    jsonb,
  delivered   jsonb
);
create index if not exists idx_alert_user on public.alert(user_id, fired_at desc);

-- ============================================================
-- RLS — cada usuario solo accede a SUS datos
-- ============================================================
alter table public.profile  enable row level security;
alter table public.strategy enable row level security;
alter table public.alert    enable row level security;

drop policy if exists "perfil propio" on public.profile;
create policy "perfil propio" on public.profile
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "estrategias propias" on public.strategy;
create policy "estrategias propias" on public.strategy
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "alertas propias" on public.alert;
create policy "alertas propias" on public.alert
  for select using (auth.uid() = user_id);

-- match / match_stat / team_form / odds / metric_catalog son datos
-- públicos de solo lectura: el backend (service role) los escribe.
alter table public.metric_catalog enable row level security;
drop policy if exists "catalogo lectura" on public.metric_catalog;
create policy "catalogo lectura" on public.metric_catalog for select using (true);

alter table public.match enable row level security;
drop policy if exists "match lectura" on public.match;
create policy "match lectura" on public.match for select using (true);

-- ============================================================
-- SEMILLA — catálogo de métricas (lo usa el builder)
-- ============================================================
insert into public.metric_catalog (key, label, category, unit, supports) values
  ('fh_goals_for',      'Goles 1ª parte marcados',            'historico', 'goles', '{"agg":["avg"],"window":[5,10],"venue":["home","away","overall"]}'),
  ('fh_goals_against',  'Goles 1ª parte encajados',           'historico', 'goles', '{"agg":["avg"],"window":[5,10],"venue":["home","away","overall"]}'),
  ('ht05_pct',          '% partidos con 0.5+ goles al descanso','historico','pct',   '{"agg":["pct"],"window":[5,10],"venue":["home","away","overall"]}'),
  ('odds_fh_over_0_5',  'Cuota 1ª parte Over 0.5',            'odds',      'cuota', '{"agg":["value"]}'),
  ('odds_fh_over_1_5',  'Cuota 1ª parte Over 1.5',            'odds',      'cuota', '{"agg":["value"]}'),
  ('goals_at_ht',       'Goles al descanso (actual)',         'live',      'goles', '{"agg":["value"]}'),
  ('red_cards',         'Tarjetas rojas (actual)',            'live',      'count', '{"agg":["value"]}'),
  ('shots_on_target',   'Tiros a puerta',                     'live',      'count', '{"agg":["value"]}'),
  ('corners',           'Córners',                            'live',      'count', '{"agg":["value"]}'),
  ('dangerous_attacks', 'Ataques peligrosos',                 'live',      'count', '{"agg":["value"]}'),
  ('momentum',          'Índice de presión (momentum)',       'live',      'index', '{"agg":["value"]}')
on conflict (key) do update set label = excluded.label, supports = excluded.supports;
