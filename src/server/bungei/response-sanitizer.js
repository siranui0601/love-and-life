const PLAYER_NAME_LEAK_TOKENS = Object.freeze([
  "setUsername",
  "SetUsername",
  "setusername",
  "userName",
  "UserName",
  "playerName",
  "PlayerName",
  "PLAYER_NAME",
  "USERNAME_TOKEN",
  "username",
]);

function replaceAllLiteral(text, from, to) {
  if (!from || from === to) return text;
  return String(text).split(from).join(to);
}

function sanitizePlayerNameLeaks(value, playerName) {
  if (!playerName) return value;

  if (typeof value === "string") {
    return PLAYER_NAME_LEAK_TOKENS.reduce(
      (text, token) => replaceAllLiteral(text, token, playerName),
      value
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePlayerNameLeaks(item, playerName));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizePlayerNameLeaks(item, playerName)])
    );
  }

  return value;
}

export function mountBungeiResponseSanitizer(app) {
  app.use("/api/bungei", (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      const playerName = String(req.body?.username || req.query?.username || "").trim();
      const sanitizedBody = playerName ? sanitizePlayerNameLeaks(body, playerName) : body;
      return originalJson(sanitizedBody);
    };

    next();
  });
}
