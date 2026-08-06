import { createTrpgNarrator } from "./gemini-narrator.js";

const ALLOWED_MISSION_TEMPLATES = Object.freeze([
  "local-rescue",
  "local-investigation",
  "local-delivery",
  "local-escort",
  "local-negotiation",
]);

export function mountTrpgNarrativeRoutes(app, options = {}) {
  const narrator = options.narrator ?? createTrpgNarrator(options);

  app.get("/TRPG/api/narrative/health", (req, res) => {
    const provider = narrator.providerStatus ?? {
      enabled: false,
      configured: false,
      paidOptIn: false,
      injected: false,
      name: null,
      mode: "replay_cache_with_deterministic_fallback",
    };
    res.json({
      ok: true,
      model: narrator.model,
      promptVersion: narrator.promptVersion,
      mode: provider.mode,
      provider,
      cache: narrator.cache.snapshot(),
      audit: narrator.auditLog?.snapshot?.() ?? { enabled: false },
      previewEnabled: process.env.TRPG_NARRATIVE_PREVIEW_ENABLED === "true",
      authority: "narrative-only; server resolver owns state",
    });
  });

  app.post("/TRPG/api/narrative/preview", async (req, res) => {
    if (process.env.TRPG_NARRATIVE_PREVIEW_ENABLED !== "true") {
      return res.status(404).json({
        ok: false,
        error: "narrative preview is disabled",
      });
    }
    try {
      if (!req.body?.action || !req.body?.authoritativeState) {
        return res.status(400).json({
          ok: false,
          error: "action and authoritativeState are required",
        });
      }
      const result = await narrator.generate(req.body, {
        allowedMissionTemplateIds: ALLOWED_MISSION_TEMPLATES,
        allowedTroubleIds: req.body.authoritativeState.missions
          ?.map((mission) => mission.troubleId)
          .filter(Boolean) ?? [],
      });
      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error("TRPG narrative generation failed", error);
      return res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return narrator;
}
