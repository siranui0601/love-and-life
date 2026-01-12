import { createServer } from "node:http";
import { createApp } from "../app.js";
import { createIO } from "../socket.js";
import { mountUserRoutes } from "../userRoutes.js";

export function createServerContext() {
  const app = createApp();
  const httpServer = createServer(app);
  const io = createIO(httpServer);

  mountUserRoutes(app);

  return { app, httpServer, io };
}
