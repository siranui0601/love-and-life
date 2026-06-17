import fs from "node:fs";
import path from "node:path";

export function mountBungeiBgmRoutes(app) {
  app.get("/api/bungei/bgm/daily", (req, res) => {
    const bgmPath = process.env.BUNGEI_DAILY_BGM_PATH;

    if (!bgmPath) {
      res.status(404).send("BGM path is not configured.");
      return;
    }

    const resolvedPath = path.resolve(bgmPath);

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).send("BGM file not found.");
      return;
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "private, max-age=86400");

    res.sendFile(resolvedPath);
  });
}
