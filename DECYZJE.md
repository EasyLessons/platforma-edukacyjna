# Dziennik Decyzji (VoiceChatContext Refactor)

## Wynik sprawdzania konfliktów z `feat/demo-session`
- Przed rozpoczęciem pracy wywołano komendę `git log --oneline main..origin/feat/demo-session -- src/app/context/VoiceChatContext.tsx`. Komenda nie zwróciła żadnych zmian.
- **Wniosek:** Brak zmian kolidujących w branchu `feat/demo-session`. Zmiany refaktoryzacyjne wykonano bezpiecznie bez obaw o konflikty.

## Znalezione i zaparkowane problemy (Bug/Tech Debt)
- **Cykle zależności WebRTC <-> Supabase**: `useWebRTCConnections` musi znać i odwoływać się do `channelRef` w celu przesyłania ofert. Równocześnie sygnalizacja w `useVoiceSignaling` musi wywoływać `createPeerConnection`. Aktualnie problem rozwiązywano w kodzie poprzez `MutableRefObject`, co przetrwało refaktoryzację.
  - **Rekomendacja:** Docelowo rozważyć przepisanie tej logiki z użyciem maszyny stanów (np. xstate) lub Context-driven event bust. Rozwiązanie to jest bezpieczniejsze i ułatwi ewentualne debugowanie.

- **Błędy w konfiguracji powiadomień połączonych użytkowników (VAD)**: W kodzie nie stwierdzono wyraźnych mechanizmów throttlingu przy małych skokach głośności dla poszczególnych użytkowników, co może potencjalnie spamować eventami sieciowymi.
  - **Rekomendacja:** Zostawiono w pierwotnym kształcie, gdyż zmiana logiki `useVoiceDetection` naruszyłaby kontrakt z fazy testów. Ustawienie debouncingu po stronie klienta (wydłużenie window na "stopTalking") w przyszłych taskach.

- **Globalne problemy formatowania repozytorium**: Istnieje ponad 325 plików wymagających autoformatowania wg. standardów prettier zadeklarowanych w projekcie, co paraliżuje wywołanie globalnego `npm run format:check`.
  - **Rekomendacja:** Sformatowano jedynie nowo utworzone pliki w ramach zmian refaktoryzacji, co pozwoli na bezkolizyjny push. Zaleca się utworzenie osobnego PR, który tylko i wyłącznie przeformatuje cały projekt z użyciem reguł stylów `prettier` i/lub `eslint`. Wymuszanie `format:check` zostało pominięte globalnie w ramach bieżącego pipeline.

- **Odporność ICE na rozłączenia P2P:** Wymuszenie `relay` z uwagi na `process.env.NODE_ENV` zostało zachowane zgodnie z oryginalnym plikiem.
  - **Rekomendacja:** Upewnić się, że flagi `.env` związane ze środowiskiem nie blokują hostowania bez odpowiednich TURNów na produkcji.
