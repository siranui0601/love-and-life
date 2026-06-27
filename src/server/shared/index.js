import { createServer } from "node:http";
import { createApp } from "../app.js";
import { createIO } from "../socket.js";
import { mountBungeiRoutes } from "../bungei/index.js";
import { mountBungeiBgmRoutes } from "../bungei/bgm.js";
import { mountBungeiResponseSanitizer } from "../bungei/response-sanitizer.js";
import { mountUserRoutes } from "../userRoutes.js";
import { mountSecretToolRoutes } from "../secret-tool/index.js";
import { mountOriginMagicCircleRoutes } from "../origin-magic-circle/index.js";
import { mountHundredOreRoutes } from "../100ore/index.js";
import { mountCompactNoHandSoccerRoutes } from "../nohand-soccer/compact-generation.js";

export function createServerContext() {
  const app = createApp();
  const httpServer = createServer(app);
  const io = createIO(httpServer);

  mountUserRoutes(app);
  mountBungeiResponseSanitizer(app);
  mountBungeiBgmRoutes(app);
  mountBungeiRoutes(app);
  mountSecretToolRoutes(app, io);
  mountOriginMagicCircleRoutes(app, io);
  mountHundredOreRoutes(app);
  mountCompactNoHandSoccerRoutes(app);

  return { app, httpServer, io };
}
