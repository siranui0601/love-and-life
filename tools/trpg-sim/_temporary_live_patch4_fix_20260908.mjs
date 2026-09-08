#!/usr/bin/env node
import fs from 'node:fs';

const path = 'tools/trpg-sim/_temporary_live_patch4_20260908.mjs';
const source = fs.readFileSync(path, 'utf8');
const before = '    routeId: `LOCAL:${lornaHub}:${fromFacilityId ?? "@hub"}->${toFacilityId}`,';
const after = '    routeId: "LOCAL:" + lornaHub + ":" + (fromFacilityId ?? "@hub") + "->" + toFacilityId,';
if (!source.includes(before)) throw new Error('staged relay routeId syntax anchor missing');
fs.writeFileSync(path, source.replace(before, after));
console.log('staged relay patch syntax repaired');
