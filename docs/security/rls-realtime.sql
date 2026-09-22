-- ============================================================================
-- URUCHOMIĆ W SUPABASE SQL EDITOR — Patryk (DOPIERO po merge'u PR 11 z planu)
-- ============================================================================
-- Supabase Realtime Authorization: kanały prywatne + polityki na realtime.messages.
-- Kontekst: docs/security/AUDYT-2026-09.md, SEC-02, sekcja 3j.
--
-- Jak to działa:
--  * Front łączy się z kanałem z `config: { private: true }` po wywołaniu
--    `supabase.realtime.setAuth(<jwt>)`. JWT wystawia NASZ backend (FastAPI), podpisany
--    sekretem JWT projektu Supabase (Settings → API → JWT Secret; do env backendu jako
--    SUPABASE_JWT_SECRET — nigdy do repo). Claims:
--      role = 'authenticated', sub = '<user_id>', board_id = '<id>' (opcjonalnie), exp = +1h
--  * Polityki poniżej porównują realtime.topic() z claimami z auth.jwt().
--  * Broadcast z backendu (notifications/realtime.py) idzie kluczem service_role
--    przez REST /realtime/v1/api/broadcast — omija RLS, bez zmian.
--  * Kanały demo (`board:demo-…`, `voice:demo-…`) zostają PUBLICZNE (bez `private`),
--    dopóki nie zapadnie decyzja produktowa (audyt, 5. Akcje, pkt 6c).
--  * Po wdrożeniu WYŁĄCZ w panelu: Realtime → Settings → "Allow public channels"
--    (jeśli demo ma zostać publiczne — zostaw włączone, polityki i tak chronią
--    kanały prywatne).

-- Idempotentnie.
alter table realtime.messages enable row level security;

-- Pomocnicze: id usera i board_id z JWT (tekst; puste gdy brak claimu).
create or replace function realtime_jwt_sub() returns text
language sql stable as $$ select coalesce(auth.jwt() ->> 'sub', '') $$;

create or replace function realtime_jwt_board_id() returns text
language sql stable as $$ select coalesce(auth.jwt() ->> 'board_id', '') $$;

-- ============================================================================
-- 1. Tablica: `board:<board_id>` — odczyt i nadawanie tylko z tokenem dla tej tablicy.
-- ============================================================================
drop policy if exists "board: read own board" on realtime.messages;
create policy "board: read own board"
  on realtime.messages for select
  to authenticated
  using (
    realtime_jwt_board_id() <> ''
    and realtime.topic() = 'board:' || realtime_jwt_board_id()
    and extension in ('broadcast', 'presence')
  );

drop policy if exists "board: write own board" on realtime.messages;
create policy "board: write own board"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime_jwt_board_id() <> ''
    and realtime.topic() = 'board:' || realtime_jwt_board_id()
    and extension in ('broadcast', 'presence')
  );

-- ============================================================================
-- 2. Głos: `voice:<board_id>` — ten sam token co tablica.
-- ============================================================================
drop policy if exists "voice: read own board" on realtime.messages;
create policy "voice: read own board"
  on realtime.messages for select
  to authenticated
  using (
    realtime_jwt_board_id() <> ''
    and realtime.topic() = 'voice:' || realtime_jwt_board_id()
    and extension in ('broadcast', 'presence')
  );

drop policy if exists "voice: write own board" on realtime.messages;
create policy "voice: write own board"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime_jwt_board_id() <> ''
    and realtime.topic() = 'voice:' || realtime_jwt_board_id()
    and extension in ('broadcast', 'presence')
  );

-- ============================================================================
-- 3. Powiadomienia: `notifications:<user_id>` — tylko odczyt własnego kanału.
--    Nadaje wyłącznie backend (service_role), więc brak polityki INSERT.
-- ============================================================================
drop policy if exists "notifications: read own" on realtime.messages;
create policy "notifications: read own"
  on realtime.messages for select
  to authenticated
  using (
    realtime_jwt_sub() <> ''
    and realtime.topic() = 'notifications:' || realtime_jwt_sub()
    and extension = 'broadcast'
  );

-- ============================================================================
-- 4. Kontrola — lista polityk (powinno być 5 powyższych).
-- ============================================================================
select policyname, cmd, roles
from pg_policies
where schemaname = 'realtime' and tablename = 'messages'
order by policyname;

-- Uwagi wdrożeniowe (dla PR 11):
--  * Token per tablica: GET /api/v1/whiteboard/{board_id}/realtime-token (po require_membership),
--    token per user: GET /api/v1/auth/realtime-token. TTL 1 h; front odświeża w
--    onAuthenticationFailed / co 50 min i woła supabase.realtime.setAuth(nowyToken).
--  * Kanał prywatny: supabase.channel('board:123', { config: { private: true, ... } }).
--  * Rola 'authenticated' w claimie `role` jest wymagana, żeby polityki `to authenticated`
--    zadziałały; anon key w createClient zostaje bez zmian (identyfikuje projekt).
