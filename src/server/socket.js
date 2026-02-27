import { Server } from "socket.io";

export function createIO(httpServer) {
  const io = new Server(httpServer);

  io.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    socket.data.clientId = String(auth.userTrackingId || auth.clientId || "").trim();
    socket.data.username = String(auth.username || "guest").trim() || "guest";
    socket.data.roomId = String(auth.roomId || "").trim() || null;
    next();
  });

  return io;
}
