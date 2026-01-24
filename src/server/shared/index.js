import { createServer } from "node:http";
import { createApp } from "../app.js";
import { createIO } from "../socket.js";
import { mountBungeiRoutes } from "../bungei/index.js";
import { mountUserRoutes } from "../userRoutes.js";

export function createServerContext() {
  const app = createApp();
  const httpServer = createServer(app);
  const io = createIO(httpServer);

  mountUserRoutes(app);
  mountBungeiRoutes(app);

  return { app, httpServer, io };
}
