import {
  archiveNowCodingProgram,
  getNowCodingProfile,
  getNowCodingReplay,
  listNowCodingMatches,
  listNowCodingPrograms,
  resolveNowCodingUser,
  saveNowCodingMatch,
  saveNowCodingProgram,
  upsertNowCodingProfile,
} from "./store.js";
import { mountNowCodingSocketHandlers } from "./online.js";

function text(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function trackingIdFrom(req) {
  return text(req.query?.userTrackingId || req.body?.userTrackingId, 128);
}

async function requireKnownUser(req, res) {
  const userTrackingId = trackingIdFrom(req);
  if (!userTrackingId) {
    res.status(401).json({ ok: false, error: "login_required" });
    return null;
  }
  const user = await resolveNowCodingUser(userTrackingId);
  if (!user) {
    res.status(401).json({ ok: false, error: "unknown_user" });
    return null;
  }
  return user;
}

export function mountNowCodingRoutes(app, io = null) {
  if (io) mountNowCodingSocketHandlers(io);

  app.get("/api/now-coding/profile", async (req, res) => {
    try {
      const user = await requireKnownUser(req, res);
      if (!user) return;
      const profile = await getNowCodingProfile(user.userTrackingId);
      res.json({ ok: true, user, profile });
    } catch (error) {
      console.error("now-coding profile read failed", error);
      res.status(500).json({ ok: false, error: "profile_read_failed" });
    }
  });

  app.put("/api/now-coding/profile", async (req, res) => {
    try {
      const user = await requireKnownUser(req, res);
      if (!user) return;
      const profile = await upsertNowCodingProfile({
        userTrackingId: user.userTrackingId,
        usernameSnapshot: user.username,
        tutorialStep: Number(req.body?.tutorialStep || 0),
        tutorialDone: Boolean(req.body?.tutorialDone),
        prefs: req.body?.prefs && typeof req.body.prefs === "object" ? req.body.prefs : {},
      });
      res.json({ ok: true, profile });
    } catch (error) {
      console.error("now-coding profile write failed", error);
      res.status(500).json({ ok: false, error: "profile_write_failed" });
    }
  });

  app.get("/api/now-coding/programs", async (req, res) => {
    try {
      const user = await requireKnownUser(req, res);
      if (!user) return;
      const programs = await listNowCodingPrograms(user.userTrackingId);
      res.json({ ok: true, programs });
    } catch (error) {
      console.error("now-coding programs read failed", error);
      res.status(500).json({ ok: false, error: "programs_read_failed" });
    }
  });

  app.post("/api/now-coding/programs", async (req, res) => {
    try {
      const user = await requireKnownUser(req, res);
      if (!user) return;
      const program = await saveNowCodingProgram({
        userTrackingId: user.userTrackingId,
        programId: text(req.body?.programId, 128),
        name: text(req.body?.name || "無題の駒", 60),
        blocks: Array.isArray(req.body?.blocks) ? req.body.blocks : [],
        notes: text(req.body?.notes, 500),
      });
      res.json({ ok: true, program });
    } catch (error) {
      console.error("now-coding program write failed", error);
      const code = error?.message === "program_too_large" ? 413 : 500;
      res.status(code).json({ ok: false, error: error?.message || "program_write_failed" });
    }
  });

  app.delete("/api/now-coding/programs/:programId", async (req, res) => {
    try {
      const user = await requireKnownUser(req, res);
      if (!user) return;
      const archived = await archiveNowCodingProgram({ userTrackingId: user.userTrackingId, programId: text(req.params.programId, 128) });
      if (!archived) return res.status(404).json({ ok: false, error: "program_not_found" });
      res.json({ ok: true });
    } catch (error) {
      console.error("now-coding program archive failed", error);
      res.status(500).json({ ok: false, error: "program_archive_failed" });
    }
  });

  app.get("/api/now-coding/matches", async (req, res) => {
    try {
      const user = await requireKnownUser(req, res);
      if (!user) return;
      const matches = await listNowCodingMatches(user.userTrackingId, Number(req.query?.limit || 20));
      res.json({ ok: true, matches });
    } catch (error) {
      console.error("now-coding matches read failed", error);
      res.status(500).json({ ok: false, error: "matches_read_failed" });
    }
  });

  app.post("/api/now-coding/matches", async (req, res) => {
    try {
      const user = await requireKnownUser(req, res);
      if (!user) return;
      const participants = Array.isArray(req.body?.participants) ? req.body.participants : [];
      if (!participants.some((participant) => String(participant?.userTrackingId || "") === user.userTrackingId)) {
        participants.unshift({ userTrackingId: user.userTrackingId, username: user.username, color: "blue" });
      }
      const saved = await saveNowCodingMatch({
        mode: text(req.body?.mode || "territory", 40),
        seed: text(req.body?.seed, 128),
        settings: req.body?.settings && typeof req.body.settings === "object" ? req.body.settings : {},
        participants,
        results: Array.isArray(req.body?.results) ? req.body.results : [],
        programs: Array.isArray(req.body?.programs) ? req.body.programs : [],
        spawn: Array.isArray(req.body?.spawn) ? req.body.spawn : [],
        durationTicks: Number(req.body?.durationTicks || 0),
        finishReason: text(req.body?.finishReason || "tick_limit", 80),
        ruleVersion: text(req.body?.ruleVersion || "territory-v2", 80),
      });
      res.json({ ok: true, ...saved });
    } catch (error) {
      console.error("now-coding match write failed", error);
      res.status(500).json({ ok: false, error: "match_write_failed" });
    }
  });

  app.get("/api/now-coding/replays/:replayId", async (req, res) => {
    try {
      const user = await requireKnownUser(req, res);
      if (!user) return;
      const replay = await getNowCodingReplay({ replayId: text(req.params.replayId, 128), userTrackingId: user.userTrackingId });
      if (!replay) return res.status(404).json({ ok: false, error: "replay_not_found" });
      res.json({ ok: true, replay });
    } catch (error) {
      console.error("now-coding replay read failed", error);
      res.status(500).json({ ok: false, error: "replay_read_failed" });
    }
  });
}
