import { createServer } from "node:http";
import { Server } from "socket.io";
import * as Y from "yjs";

type Presence = {
  id: string;
  name: string;
  color: string;
  socketId: string;
  mode: "editing" | "viewing";
  line: number;
  column: number;
};

const port = Number(process.env.PORT || process.env.REALTIME_PORT || 4000);
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins
  }
});

const docs = new Map<string, Y.Doc>();
const presence = new Map<string, Presence[]>();
const colors = ["#0f766e", "#2563eb", "#b45309", "#7c3aed", "#be123c"];

function getDoc(documentId: string) {
  let doc = docs.get(documentId);
  if (!doc) {
    doc = new Y.Doc();
    docs.set(documentId, doc);
  }
  return doc;
}

function emitPresence(documentId: string) {
  io.to(documentId).emit(
    "presence",
    (presence.get(documentId) ?? []).map(({ socketId: _socketId, ...user }) => user)
  );
}

io.on("connection", (socket) => {
  const documentId = String(socket.handshake.query.documentId || "default");
  const userId = String(socket.handshake.query.userId || socket.id);
  const name = String(socket.handshake.query.name || "Reviewer");
  const doc = getDoc(documentId);

  socket.join(documentId);
  const current = presence.get(documentId) ?? [];
  presence.set(documentId, [
    ...current,
    {
      id: userId,
      name,
      socketId: socket.id,
      color: colors[current.length % colors.length],
      mode: "viewing",
      line: 1,
      column: 1
    }
  ]);

  socket.emit("sync:init", { update: Y.encodeStateAsUpdate(doc) });
  emitPresence(documentId);

  socket.on("sync:update", (payload: { documentId: string; update: Uint8Array }) => {
    const target = getDoc(payload.documentId || documentId);
    Y.applyUpdate(target, new Uint8Array(payload.update));
    socket.to(payload.documentId || documentId).emit("sync:update", {
      update: payload.update
    });
  });

  socket.on("cursor:update", (payload: { documentId: string; line: number; column: number; mode: "editing" | "viewing" }) => {
    const roomId = payload.documentId || documentId;
    const users = presence.get(roomId) ?? [];
    presence.set(
      roomId,
      users.map((user) =>
        user.socketId === socket.id
          ? {
              ...user,
              line: payload.line,
              column: payload.column,
              mode: payload.mode
            }
          : user
      )
    );
    emitPresence(roomId);
  });

  socket.on("activity:new", (payload: { documentId: string; actorName: string; action: string; target: string; createdAt: string }) => {
    socket.to(payload.documentId || documentId).emit("activity:new", payload);
  });

  socket.on("disconnect", () => {
    const users = presence.get(documentId) ?? [];
    presence.set(
      documentId,
      users.filter((user) => user.socketId !== socket.id)
    );
    emitPresence(documentId);
  });
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`ReviewSync realtime server listening on port ${port}`);
});
