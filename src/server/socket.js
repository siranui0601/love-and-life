import { Server } from "socket.io";

export function createIO(httpServer) {
  return new Server(httpServer);
}