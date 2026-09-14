# v3 compiler payload recovery

Source commit: `32dcdbd5121b235e80c186e81426302c602473fe`

The blob `docs/trpg/compile-virtue-route-v3.mjs.gz.b64` is not a complete gzip payload.
Its Git blob is exactly 20,023 bytes and ends inside this JavaScript statement:

```js
if(rt==='LOCAL_INVESTIGATE'&&day===8){m.jobId='JOB-FARM-04';m.facilityId='LOC_FARM_NORTH_FE
```

`base64 --decode` reports `invalid input`; `gzip -dc` reports `unexpected end of file`.
The recoverable prefix expands to 21,179 bytes / 174 lines, but fails `node --check` at line 175.
Therefore the compressed blob cannot be treated as the final source or copied over the valid checkpoint compiler.

The readable prefix was diffed against `tools/trpg-sim/compile-virtue-route-v3.mjs` and used as recovery evidence.
The normal source now incorporates the prefix's safe input/provenance concepts (tracked source input,
optional `.gz.b64` fallback, deterministic source hash metadata, final-status accounting) while preserving
the valid checkpoint tail. Later Phase D changes must be implemented and tested in the normal source file;
the corrupt payload is forensic evidence only.
