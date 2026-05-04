import { createServer } from "node:http";
import { createApp } from "../app.js";
import { createIO } from "../socket.js";
import { mountBungeiRoutes } from "../bungei/index.js";
import { mountUserRoutes } from "../userRoutes.js";
import { mountSecretToolRoutes } from "../secret-tool/index.js";
import { mountOriginMagicCircleRoutes } from "../origin-magic-circle/index.js";

export function createServerContext() {
  const app = createApp();
  const httpServer = createServer(app);
  const io = createIO(httpServer);

  mountUserRoutes(app);
  mountBungeiRoutes(app);
  mountSecretToolRoutes(app, io);
  mountOriginMagicCircleRoutes(app, io);

  return { app, httpServer, io };
}