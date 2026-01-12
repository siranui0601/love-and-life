import { createServerContext } from "./src/server/shared/index.js";
import { mountJudgementRoutes, registerJudgementSocketHandlers } from "./src/server/judgement/index.js";
import { registerLifeSocketHandlers } from "./src/server/life/index.js";
import { PORT } from "./src/foundation/env.js";

const { app, httpServer, io } = createServerContext();

mountJudgementRoutes(app, io);

io.on("connection", (socket) => {
  console.log("✅ client connected:", socket.id);

  registerJudgementSocketHandlers(socket, io);
  registerLifeSocketHandlers(socket);

  socket.on("disconnect", () => {
    console.log("❌ client disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 http://localhost:${PORT}`);
});
