/**
 * Serwer Yjs dla PROTOTYPU tablicy Excalidraw (bez auth, bez bazy).
 *
 * Uruchomienie: `npm run proto:yjs` (port z PROTO_YJS_PORT, domyślnie 1234).
 * To celowo NIE jest `whiteboard-sync/` (tam jest auth przez FastAPI i zapis
 * do /doc) - prototyp ma działać bez backendu. Ten sam pakiet (@hocuspocus/server)
 * i ten sam protokół co w whiteboard-sync, więc przy migracji zmienia się tylko
 * wiązanie Excalidraw<->Y.Doc, nie transport.
 *
 * Dokumenty żyją w pamięci procesu; klient trzyma dodatkowo kopię w IndexedDB
 * (y-indexeddb), więc po restarcie serwera tablica wraca z przeglądarki.
 */

import { Server } from '@hocuspocus/server';

const port = Number(process.env.PROTO_YJS_PORT ?? process.env.PORT ?? 1234);

const server = Server.configure({
  port,
  quiet: true,
  onConnect: async ({ documentName }) => {
    console.log(`[proto-yjs] connect: ${documentName}`);
  },
  onDisconnect: async ({ documentName }) => {
    console.log(`[proto-yjs] disconnect: ${documentName}`);
  },
});

server.listen().then(() => {
  console.log(`[proto-yjs] Hocuspocus (bez auth) nasłuchuje na ws://localhost:${port}`);
});
