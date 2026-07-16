import express from "express";
import path from "path";
import { mountFloodNoHandSoccerVisualRoutes } from "./nohand-soccer/visual-cache-flood.js";

export function createApp() {
  const app = express();

  // JSON
  app.use(express.json({ limit: "12mb" }));
  mountFloodNoHandSoccerVisualRoutes(app);

  // 既存トップページ用（必要なら）
  app.use(express.static("public"));

  // TRPG(仮題) スキルJSON β版。
  // Git上ではgzip実体を保持し、公開URLでは通常のJSONとして参照できるようにする。
  const trpgSkillCatalogPath = path.join(
    process.cwd(),
    "public/TRPG/data/skills.beta.json.gz"
  );

  app.get("/TRPG/data/skills.beta.json", (req, res, next) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Vary", "Accept-Encoding");
    res.sendFile(trpgSkillCatalogPath, (error) => {
      if (error) next(error);
    });
  });

  // 部分ツイートの新しい画像パス(/2D画像)を既存素材ディレクトリへ紐づける
  const twoDImagePath = "/2D画像";
  const twoDImageEncodedPath = encodeURI(twoDImagePath);
  const twoDImageAssets = express.static(
    path.join(process.cwd(), "public/2D素材")
  );

  app.use(twoDImagePath, twoDImageAssets);
  app.use(twoDImageEncodedPath, twoDImageAssets);

  // 時々文芸部！を /時々文芸部！ で配信
  app.use(
    "/時々文芸部！",
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


    // 部分ツイートを /部分ツイート で配信
  const partialTweetPath = "/部分ツイート";
  const partialTweetEncodedPath = encodeURI(partialTweetPath);
  const partialTweetAssets = express.static(
    path.join(process.cwd(), "public/partial-tweet")
  );

  app.use(partialTweetPath, partialTweetAssets);
  app.use(partialTweetEncodedPath, partialTweetAssets);

  const hundredOrePath = "/100日後も生きる俺";
  const hundredOreEncodedPath = encodeURI(hundredOrePath);
  const hundredOreAssets = express.static(
    path.join(process.cwd(), "public/100ore")
  );

  app.use("/100ore", hundredOreAssets);
  app.use(hundredOrePath, hundredOreAssets);
  app.use(hundredOreEncodedPath, hundredOreAssets);

  return app;
}
