import crypto from "node:crypto";

const COOKIE_NAME = "siranui_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_VERSION = 1;
const SESSION_SECRET = String(
  process.env.SIRANUI_SESSION_SECRET
    || process.env.SESSION_SECRET
    || crypto.randomBytes(48).toString("base64url"),
);

if (!process.env.SIRANUI_SESSION_SECRET && !process.env.SESSION_SECRET) {
  console.warn("[auth] SESSION_SECRET is not configured. Sessions will reset when the server restarts.");
}

function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function sign(encodedPayload) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(header = "") {
  const result = {};
  for (const item of String(header || "").split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (!key) continue;
    try { result[key] = decodeURIComponent(value); } catch { result[key] = value; }
  }
  return result;
}

export function createUserSessionToken(user, now = Date.now()) {
  const userTrackingId = String(user?.userTrackingId || "").trim();
  const username = String(user?.username || "").trim();
  if (!userTrackingId || !username) throw new Error("invalid_session_user");

  const payload = {
    v: SESSION_VERSION,
    sub: userTrackingId,
    username: username.slice(0, 40),
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = encode(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function verifyUserSessionToken(token, now = Date.now()) {
  try {
    const [encoded, signature, extra] = String(token || "").split(".");
    if (!encoded || !signature || extra !== undefined || !safeEqual(signature, sign(encoded))) return null;
    const payload = decode(encoded);
    if (payload?.v !== SESSION_VERSION) return null;
    if (!payload?.sub || !payload?.username) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(now / 1000)) return null;
    return {
      userTrackingId: String(payload.sub),
      username: String(payload.username),
      issuedAt: Number(payload.iat) || 0,
      expiresAt: Number(payload.exp) * 1000,
    };
  } catch {
    return null;
  }
}

export function setUserSessionCookie(res, user) {
  const token = createUserSessionToken(user);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`,
  );
  return token;
}

export function clearUserSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export function readUserSessionFromCookieHeader(header) {
  return verifyUserSessionToken(parseCookies(header)[COOKIE_NAME]);
}

export function readUserSession(req) {
  return readUserSessionFromCookieHeader(req?.headers?.cookie || "");
}

export function requireUserSession(req, res, next) {
  const session = readUserSession(req);
  if (!session) return res.status(401).json({ ok: false, error: "login_required" });
  req.userSession = session;
  return next();
}
