# Local preservation checkpoint — 2026-09-11

Starting branch: `feat/persistent-world-rpg`; HEAD `c456805ae426a44d3abcda3696347599a6613aa2`.
The attached inventory classifies every previously untracked file before staging.

Included: production client/server/shared code; the content generator and source snapshots;
generated private runtime content; tests; original licensed runtime assets and provenance;
HTML/CSS; the currently referenced compiled client files from `reports/build.json`;
CI, reconstruction tools and architecture documents. Bundle files are intentionally part
of this preservation commit so `npm start` can serve the exact current browser runtime.
They can be reconstructed with `npm ci` followed by `npm run world:build`.

Excluded, retained on disk: local reports/screenshots and superseded hashed chunks.
Saves, credentials and dependency caches remain ignored. No untracked files were deleted.
Staging uses explicit paths and an exact list of referenced bundle files, not `git add -A`.
No remote push is authorized or performed.

This is a recoverable development checkpoint, not a completion claim. Before this
checkpoint, the 10 new core contracts and the revised 24 simulation/playability tests
passed. A subsequently added physical Finn-return test currently fails `TOO_FAR`
because its target moves during approach; it is retained for correction in PASS 2.
Compiler legacy fields, planner generality, temporal player attacks and actual-save
migration validation remain explicit PASS 2 work.
