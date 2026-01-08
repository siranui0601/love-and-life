import { findUserByEmail, addUser } from "../foundation/sheets.js";

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
}