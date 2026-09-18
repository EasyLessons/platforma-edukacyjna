/**
 * whiteboard-sync -- serwis Hocuspocus do synchronizacji tablicy poprzez Yjs.
 */

import { Server } from "@hocuspocus/server";

const port = Number(process.env.PORT ?? 1234);

const server = Server.configure({
    port,
    onConnect: async ({ documentName }) => {
        console.log(`[whiteboard-sync] connect: ${documentName}`);
    },
    onDisconnect: async ({ documentName }) => {
        console.log(`[whiteboard-sync] disconnect: ${documentName}`);
    },
});

server.listen().then(() => {
    console.log(`[whiteboard-sync] listening on :${port}`);
})