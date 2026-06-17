import { createServerContext } from "./src/server/shared/index.js";
import fs from "fs";
import path from "path";
import { mountJudgementRoutes, registerJudgementSocketHandlers } from "./src/server/judgement/index.js";
import { registerLifeSocketHandlers } from "./src/server/life/index.js";
import { PORT } from "./src/foundation/env.js";
import { registerSecretToolSocketHandlers, startSecretToolTtlCleanup } from "./src/server/secret-tool/index.js";

const { app, httpServer, io } = createServerContext();

app.get("/api/bungei/bgm/daily", (req, res) => {
  const bgmPath = process.env.BUNGEI_DAILY_BGM_PATH;

  if (!bgmPath) {
    return res.status(404).send("BGM path is not configured.");
  }

  const resolvedPath = path.resolve(bgmPath);

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).send("BGM file not found.");
  }

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "private, max-age=86400");

  return res.sendFile(resolvedPath);
});

mountJudgementRoutes(app, io);

io.on("connection", (socket) => {
  console.log("✅ client connected:", socket.id);

  registerJudgementSocketHandlers(socket, io);
  registerLifeSocketHandlers(socket);
  registerSecretToolSocketHandlers(socket, io);

  socket.on("disconnect", () => {
    console.log("❌ client disconnected:", socket.id);
  });
});

startSecretToolTtlCleanup();

httpServer.listen(PORT, () => {
  console.log(`🚀 http://localhost:${PORT}`);
});
