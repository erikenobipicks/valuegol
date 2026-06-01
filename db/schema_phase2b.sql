-- ============================================================
-- ValueGol — Fase 2b: vinculación de Telegram
-- Aplícalo en Supabase → SQL Editor → Run (without RLS).
-- ============================================================

-- Token temporal para vincular la cuenta con el bot de Telegram.
alter table public.profile add column if not exists tg_link_token text;

-- El usuario puede leer/escribir su propio token (ya cubierto por la
-- política "perfil propio"); el backend lo lee con la service key.
