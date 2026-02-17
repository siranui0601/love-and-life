import {
  findUserByEmail,
  addUser,
  findUserByUsername,
  findUserByUsernameAndPassword,
  addCredentialUser,
  updateUsernameByIdentity,
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


  app.post("/api/user/update-username", async (req, res) => {
    const { email, currentUsername, nextUsername } = req.body || {};
    if (!currentUsername || !nextUsername) {
      return res.status(400).json({ error: "currentUsername and nextUsername are required" });
    }

    const trimmed = String(nextUsername).trim();
    if (!trimmed) {
      return res.status(400).json({ error: "ユーザーネームを入力してください" });
    }

    try {
      const existing = await findUserByUsername(trimmed);
      if (existing && existing.username !== currentUsername) {
        return res.status(409).json({ error: "そのユーザー名は登録済みです" });
      }

      const updated = await updateUsernameByIdentity({
        email: email || "",
        currentUsername,
        nextUsername: trimmed,
      });
      if (!updated) {
        return res.status(404).json({ error: "ユーザーが見つかりません" });
      }

      return res.json({ username: trimmed, previousUsername: currentUsername });
    } catch (e) {
      console.error("update username error:", e);
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
