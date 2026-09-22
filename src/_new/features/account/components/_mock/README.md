# Makiety panelu konta (bez backendu)

`AddressBook`, `PaymentMethods` i `SecurityCenter` to interfejs bez zaplecza: dane
biora sie z tablic `mock*` w komponentach (`useState`), zaden endpoint FastAPI ich nie
obsluguje i nic nie jest zapisywane. Zostawione jako zalazek sekcji konta (decyzja P2
w `docs/architecture/REFAKTOR-PLAN.md`), opisane w `docs/known-issues.md` #5.

Zanim ktores z tego stanie sie prawdziwa funkcja: endpointy + `api/` + hooki w tym
feature, a folder `_mock/` znika.
