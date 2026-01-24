import express from "express";
import path from "path";

export function createApp() {
  const app = express();

  // JSON
  app.use(express.json());

  // 既存トップページ用（必要なら）
  app.use(express.static("public"));

  // 文芸部を /bungei-bu で配信
  app.use(
    "/bungei-bu",
    express.static(path.join(process.cwd(), "public/bungei-bu"))
  );

  // 時々文芸部！を /時々文芸部！ で配信
  const literaryClubPath = "/時々文芸部！";
  const literaryClubEncodedPath = encodeURI(literaryClubPath);
  const literaryClubAssets = express.static(
    path.join(process.cwd(), "public/bungei-bu")
  );

  app.use(literaryClubPath, literaryClubAssets);
  app.use(literaryClubEncodedPath, literaryClubAssets);

  return app;
}
