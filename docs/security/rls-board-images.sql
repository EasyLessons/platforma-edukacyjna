-- ============================================================================
-- URUCHOMIĆ W SUPABASE SQL EDITOR — Patryk
-- ============================================================================
-- Polityki RLS dla storage.objects: bucket `board-images` (obrazy tablic) oraz
-- `avatars` (awatary). Kontekst: docs/security/AUDYT-2026-09.md, SEC-03, SEC-12, 3h.
--
-- Założenia:
--  * `board-images`: zapis/kasowanie WYŁĄCZNIE z backendu kluczem service_role
--    (backend/api/v1/whiteboard/storage.py) — service_role omija RLS, więc nie
--    potrzebuje żadnej polityki. Odczyt publiczny przez URL /object/public/…
--    (bucket `public = true`), nazwy plików to uuid4 — niezgadywalne.
--  * `avatars`: dziś front pisze do bucketu anon key (BasicInfo.tsx:52). Sekcję B
--    wykonać DOPIERO po wdrożeniu PR 3 z planu naprawczego (upload awatara przez
--    backend), inaczej zmiana awatara przestanie działać.
--  * RLS na storage.objects jest w Supabase włączone domyślnie; brak polityki = brak
--    dostępu dla anon/authenticated.
-- Wykonywać sekcjami, po kolei. Każda sekcja jest idempotentna.

-- ============================================================================
-- A. PODGLĄD — co jest teraz (nic nie zmienia). Wklej wynik do raportu sesji.
-- ============================================================================
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('board-images', 'avatars');

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- ============================================================================
-- B. `avatars` — usunięcie zapisu z anon key (po PR 3). Zostaje odczyt publiczny.
-- ============================================================================
-- 1) Skasuj KAŻDĄ politykę INSERT/UPDATE/DELETE na bucket `avatars`, która daje
--    dostęp roli anon lub authenticated (nazwy polityk są nieznane — pętla po pg_policies).
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (coalesce(qual, '') like '%avatars%' or coalesce(with_check, '') like '%avatars%')
      and roles::text ~ '(anon|authenticated|public)'
  loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
    raise notice 'usunieto polityke: %', p.policyname;
  end loop;
end $$;

-- 2) Odczyt publiczny awatarów (potrzebny dla listowania przez API; publiczny URL
--    działa niezależnie, bo bucket jest public).
drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

-- 3) Twarde limity bucketu (Storage egzekwuje je także dla service_role).
update storage.buckets
set public = true,
    file_size_limit = 2 * 1024 * 1024,                       -- 2 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';

-- ============================================================================
-- C. `board-images` — tylko odczyt dla klientów, zapis wyłącznie service_role.
-- ============================================================================
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (coalesce(qual, '') like '%board-images%' or coalesce(with_check, '') like '%board-images%')
      and roles::text ~ '(anon|authenticated|public)'
  loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
    raise notice 'usunieto polityke: %', p.policyname;
  end loop;
end $$;

drop policy if exists "board-images: public read" on storage.objects;
create policy "board-images: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'board-images');

update storage.buckets
set public = true,
    file_size_limit = 15 * 1024 * 1024,                      -- spójne z storage.py MAX_UPLOAD_SIZE_BYTES
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'board-images';

-- ============================================================================
-- D. Bezpiecznik — żadna polityka nie może dawać zapisu na INNE buckety roli anon.
--    Powinno zwrócić 0 wierszy.
-- ============================================================================
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and roles::text ~ '(anon|public)';
