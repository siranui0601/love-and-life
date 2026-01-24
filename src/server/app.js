import express from "express";
import path from "path";

export function createApp() {
  const app = express();

  // JSON
  app.use(express.json());

  // 既存トップページ用（必要なら）
  app.use(express.static("public"));

  // 時々文芸部！を /時々文芸部！ で配信
  app.use(
    "/時々文芸部！",
    express.static(path.join(process.cwd(), "public/時々文芸部！"))
  );

  return app;
}
