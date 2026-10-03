#!/usr/bin/env node
import fs from 'node:fs';

const path = 'src/server/trpg/content/canonical-world-life-actions.js';
let source = fs.readFileSync(path, 'utf8');
const patches = [
  ['canonicalWorldLifeKind: "buy_provision", productId, price, portions,', 'canonicalWorldLifeKind: "buy_provision", productId, price, portions, targetFacilityId: facilityId,'],
  ['canonicalWorldLifeKind: "eat_meal", productId, price,', 'canonicalWorldLifeKind: "eat_meal", productId, price, targetFacilityId: facilityId,'],
  ['canonicalWorldLifeKind: "sleep", productId, price, lodging: kind !== "camp",', 'canonicalWorldLifeKind: "sleep", productId, price, lodging: kind !== "camp", targetFacilityId: facilityId,'],
  ['canonicalWorldLifeKind: kind, productId, price,', 'canonicalWorldLifeKind: kind, productId, price, targetFacilityId: facilityId,'],
];
for (const [before, after] of patches) {
  if (!source.includes(before)) throw new Error(`missing product metadata anchor: ${before}`);
  source = source.replace(before, after);
}
fs.writeFileSync(path, source);
console.log('facility-local canonical product metadata refined');
