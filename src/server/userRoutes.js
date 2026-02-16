import {
  findUserByEmail,
  addUser,
  findUserByUsername,
  findUserByUsernameAndPassword,
  addCredentialUser,
} from "../foundation/sheets.js";

export function mountUserRoutes(app) {
  app.post("/api/user/lookup", async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "email is required" });

    try {
      const user = await findUserByEmail(email);
      if (!user) return res.json({ exists: false });
      return res.json({ exists: true, username: user.username, displayName: user.displayName });
    } catch (e) {
      console.error("lookup error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/user/register", async (req, res) => {
    const { email, username, googleDisplayName } = req.body || {};
    if (!email || !username) return res.status(400).json({ error: "email and username are required" });

    try {
      const existing = await findUserByEmail(email);
      if (existing) {
        return res.json({ exists: true, username: existing.username, displayName: existing.displayName });
      }
      const user = await addUser({ email, username, displayName: googleDisplayName || "" });
      return res.json({ exists: true, username: user.username, displayName: user.displayName });
    } catch (e) {
      console.error("register error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/user/register-credentials", async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "username and password are required" });

    try {
      const existing = await findUserByUsername(username);
      if (existing) {
        return res.status(409).json({ error: "このユーザーネームは既に使われています" });
      }
      const user = await addCredentialUser({ username, password });
      return res.json({ exists: true, username: user.username });
    } catch (e) {
      console.error("register credential error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/user/login", async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "username and password are required" });

    try {
      const user = await findUserByUsernameAndPassword(username, password);
      if (!user) return res.status(401).json({ exists: false, error: "ユーザーネームかパスワードが違います" });
      return res.json({ exists: true, username: user.username });
    } catch (e) {
      console.error("login error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });
}
