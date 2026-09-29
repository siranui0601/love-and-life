# 3D World Atlas — integrated graybox overview (2026-09-29)

Base: `feat/persistent-world-rpg` at `f65a93a7a5dd9a78e235ee56bb7a9aa930a2261d`.

This PR adds a **real Babylon.js 3D geographic overview** behind the existing in-game **M / 世界の地図** control. It replaces the initial flat-node overview with continuous sculpted land and sea, without replacing the authoritative regional simulation. The old 2D map remains a manual fallback.

## The reference image, translated into spatial rules

The supplied illustrated map is used as *art direction and geography composition*, not as an unverified kilometre scale or a list of invented locations. Canonical `region.worldPosition` and the 15 actual R01–R15 route endpoints are read directly from the generated world content. Region IDs and route IDs are not duplicated as a new causal truth.

- North: mountain ridges, **北陵要塞** with defensible walls / watch towers and **ドワーフ洞窟** with a mine mouth, workshops and chimney.
- North-east: inhabited **黒嶺連合領** amid black ridges / volcanic peaks. Not an uninhabited monster arena.
- Central: **王都** is the largest constructed settlement, with a visible royal keep, four wall towers, streetside housing and a hierarchy of building scale.
- West: **交易都市** has warehouses, visible quays, harbour office and lighthouse; **犯罪都市** is a separated inhabited island reached by R08 sea lane.
- South: the fertile **田園の村** has cultivated plots and small houses; **古代神殿** has columns and a sanctum; **辺境の村** remains much smaller than a city.
- East: a broad **森** with tree cover and river, and an **エルフの隠れ里** organized around a much larger world tree.
- A continuous procedural overview height-field, sea, rivers and connecting routes make the regions read as one world rather than eleven identically sized floor pads.

Roads are **legible preferential travel corridors, not exclusive walkable strips**. The empty land between them is intentional ground, not a teleport-only gap. Restricted/hidden/tunnel corridors are styled differently in this illustration; game access permissions continue to belong to the runtime.

## Implementation boundaries

- `world-atlas-data.js`: deterministic replaceable terrain appearance and archetype scale, plus guards against missing canonical regions/routes.
- `world-atlas.js`: lazy-loaded Babylon viewer; pointer orbit, zoom and responsive resize; no NPC spawn, event simulation, movement command, save mutation or omniscient event marker.
- `client.js`: M opens the 3D overview; optional original 2D fallback. Dispose the second WebGL engine when the panel closes, preventing renderer accumulation.
- `world.css`: larger responsive map panel.
- `world-atlas.test.mjs`: site, sea/island, northern relief, route endpoint and variant-scale contracts.

**Important:** This is a 3D macro-world map, not yet the final seamless traversable overworld. The current gameplay still loads a local region and performs a canonical corridor journey when crossing exits. Do not certify continuous walking, intermediate route encounters, all NPC world-space pathing, or the five all-crisis spider-thread solutions on the basis of this visual PR alone.

The next spatial stage should derive a single shared coordinate frame, open-field collisions, region streaming, route section traversal, actual travel timing, NPC/cargo continuity, monster habitats and save migrations **from the existing canonical simulation**. The 3D overview is a spatial reference and inspection surface for that effort.

## Review instructions

1. Run `npm run world:build` and `npm run world:test` (or `npm run world:check`) after pulling the PR branch.
2. Start `npm run world:serve`, open `/TRPG/`, begin/resume and press **M**.
3. Orbit and zoom the 3D map. Confirm the capital has a keep and occupies notably more area than the village; verify the harbour, criminal island, ancient temple, eastern tree and northern ranges.
4. Switch to **軽量な2D表示へ**. Close/reopen the atlas several times; the map should reinitialize without growing WebGL context count.
5. Check that no player movement, clock advance, event knowledge, source IDs or existing 3D local-region assets changed simply by opening the map.

No live/paid narrative provider is needed.
