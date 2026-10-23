/**
 * whiteboard-sync -- serwis Hocuspocus do synchronizacji tablicy poprzez Yjs.
 */

import { Server } from '@hocuspocus/server';
import { onAuthenticate } from './auth';
import { database } from './database';
import { elementLimit } from './element-limit';
import { demoSessions } from './demo';

const port = Number(process.env.PORT ?? 1234);

const server = Server.configure({
  port,
  onAuthenticate,
  extensions: [database, elementLimit],
  onConnect: async ({ documentName }) => {
    console.log(`[whiteboard-sync] connect: ${documentName}`);
  },
  onDisconnect: async ({ documentName }) => {
    console.log(`[whiteboard-sync] disconnect: ${documentName}`);
  },
});

server.listen().then(() => {
  console.log(`[whiteboard-sync] listening on :${port}`);
  // Wygasanie sesji demo i zwalnianie pustych (demo.ts).
  setInterval(() => demoSessions.sweep(server), 30_000).unref();
});
