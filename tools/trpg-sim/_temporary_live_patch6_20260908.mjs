#!/usr/bin/env node
import fs from 'node:fs';

const path = 'src/server/trpg/content/authored-mission-flow-registry.js';
let source = fs.readFileSync(path, 'utf8');
const before = `function mergeLocalPublicProductsBesideAuthoredActions(runtime, actions) {
  if (!Array.isArray(actions) || actions.length === 0 || t01Active(runtime)) return actions;
  if (onlyCanonicalWorldLife(actions)) return actions;`;
const after = `function mergeLocalPublicProductsBesideAuthoredActions(runtime, actions) {
  if (!Array.isArray(actions) || actions.length === 0 || t01Active(runtime)) return actions;
  if (onlyCanonicalWorldLife(actions)) return actions;
  // Routine life has already been normalized by
  // mergePublicProductsBesideRoutineLife(), including time-sensitive canonical
  // labour before broad meal/shop products. Do not run a second product-first
  // merge here and silently push a legal work shift behind the visible cap.
  if (routinePublicLifeOnly(actions)) return actions;`;
if (!source.includes(before)) throw new Error('local public-product merge anchor missing');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('local public-product merge now preserves normalized routine-life ordering');
