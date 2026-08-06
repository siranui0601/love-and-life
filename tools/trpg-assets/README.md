# TRPG visual asset generator

This admin-only CLI fills missing TRPG portraits and facility backgrounds with Gemini while keeping gameplay independent from image generation.

```powershell
# Preview the next batch without an API call
npm run trpg:assets -- --type portrait --limit 12 --dry-run

# Generate missing portraits/backgrounds in deterministic cached batches
$env:TRPG_GEMINI_ASSET_GENERATION_ENABLED = "true"
npm run trpg:assets -- --type portrait --limit 12
npm run trpg:assets -- --type background --limit 12

# Regenerate one approved spreadsheet entity
npm run trpg:assets -- --type portrait --id NPC005 --force
```

`GEMINI_API_KEY` stays server-side. Paid generation requires both that key and the explicit `TRPG_GEMINI_ASSET_GENERATION_ENABLED=true` opt-in. The CLI accepts only NPC/facility IDs loaded from the pinned spreadsheet fixtures and local reference images under `public/TRPG/assets`; it does not expose arbitrary prompts or URLs.

Portrait prompts request a solid `#00FF00` or `#FF00FF` background. The key color is selected deterministically to avoid the character palette, then removed with an edge-connected flood fill, a 3px feather, and color-spill reduction. Originals, full prompts, failures, and generation metadata stay under the ignored private directory `runtime-data/TRPG/assets`; only validated UI-ready files and the small path-only UI manifest are public. Every Gemini result is MIME/magic checked and decoded under pixel limits; backgrounds are normalized to PNG too. `sharp` handles WebP/JPEG or unusual PNG input; a missing decoder marks that asset failed without stopping the game or changing the current UI manifest.

Generation cache keys include the spreadsheet content revision, prompt version, model list, prompt, visual profile, and reference-image hashes. Ready files are reused on later runs.
