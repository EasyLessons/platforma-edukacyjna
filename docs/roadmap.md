# Roadmap — zaplanowane funkcje (jeszcze nie zaimplementowane)

Rzeczy, które wiadomo że nadejdą, zanim jeszcze jest kod. Cel: żeby architektura dziś nie zamykała drogi do tego co ma przyjść — patrz odpowiednie sekcje w `docs/architecture/*` gdzie już zarezerwowano na to miejsce. Stan na 10.11.2026 (`release/baseline`).

## Plany i płatności

Status: **podstawa zrobiona bez płatności** — plany `free`/`premium` (tabela `user_plans`), limity Free 2 przestrzenie / 3 tablice w przestrzeni / 1000 elementów / 100 MB plików, egzekwowanie w backendzie i w `whiteboard-sync` (limit elementów, `whiteboard-sync/src/element-limit.ts`), `GET /plans/me`, `UpgradeModal` z adresem `kontakt@easylesson.app`. Opis: `docs/plan-subskrypcje.md`. Plan nadaje się dziś ręcznie SQL-em.

Do zrobienia:

- **Płatności (Stripe Checkout + Billing + Customer Portal + webhook)** — zakres „co bierzemy gotowe / co piszemy sami” w `docs/architecture/ADR-silnik-tablicy.md` §7. Warunek: podmiot gospodarczy (Stripe w Polsce wymaga działalności).
- Nadawanie planu z UI (dziś tylko SQL) i limity techniczne Premium (liczby do zmierzenia) — `plan-subskrypcje.md`, sekcja „Do zrobienia”.

Otwarte pytania:

- Polskie faktury przy Stripe: który program do faktur (Fakturownia / inFakt / wFirma) i czy przez pośrednika (Stripto itp.) czy własny webhook — decyzja po założeniu działalności (`ADR-silnik-tablicy.md` §7).

## Etap F — usunięcie starego silnika tablicy

Excalidraw jest na `release/baseline` za flagą `NEXT_PUBLIC_WHITEBOARD_ENGINE=excalidraw`; stary silnik (`features/whiteboard`, `src/app/context/BoardRealtimeContext.tsx`) nadal jest w kodzie i jest domyślny bez flagi. Etap F = osobna gałąź `feat/usun-stary-silnik`, po tygodniu lekcji na Excalidraw bez regresji (`ADR-silnik-tablicy.md`, decyzja 6). Zakres i zależności: `docs/migration-status.md`, „Do zrobienia”. **Nie zrobione.**

## Etap P — infrastruktura płatna

Z backlogu Patryka (01.10.2026), tylko nazwy punktów, bez decyzji i szczegółów: Render bez usypiania backendu, Redis, backupy bazy, monitoring. Dziś: `known-issues.md` #7 opisuje procedurę przywracania tablicy z backupu ręcznie; monitoring = `GET /api/v1/health` i aliasy `/health`, `/healthz` (`backend/main.py`).

## Usunięcie konta (RODO)

Brak endpointu usunięcia konta, a `privacy-policy/page.tsx` obiecuje „prawo do bycia zapomnianym” — znalezisko **SEC-17** w `docs/security/AUDYT-2026-09.md` (propozycja: `DELETE /api/v1/auth/users/me` z kaskadami FK + pliki tablic i awatar). Nie zrobione.

## Pomysł (niezdecydowany): publiczny link tylko do odczytu

Pomysł D5 z backlogu Patryka — link do tablicy bez konta, tylko do oglądania. Dziś najbliższe mechanizmy: rola `viewer` (`connection.readOnly` w `whiteboard-sync/src/auth.ts`, wymaga konta i członkostwa) oraz demo bez konta (`/demo/<id>`, bez zapisu, `pipelines.md` §2d). Brak decyzji, brak kodu.

## Miejsce na kolejne punkty

Ten plik ma rosnąć w miarę ustalania kolejnych funkcji na przyszłość — dopisywać tu od razu jak coś zostanie zdecydowane, nawet zanim ruszy implementacja, żeby dokumentacja architektury mogła to od razu uwzględnić.
