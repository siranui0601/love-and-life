#!/usr/bin/env node
import fs from 'node:fs';

const path = 'src/server/trpg/content/authored-mission-flow-registry.js';
let source = fs.readFileSync(path, 'utf8');
const before = `function mergePublicProductsBesideRoutineLife(runtime, actions) {
  if (!routinePublicLifeOnly(actions) || t01Active(runtime)) return actions;
  const products = publicLifeProducts(runtime);
  if (!products.length) return actions;
  const combined = [...products, ...actions];
  return [...new Map(combined.map((action) => [action.id, action])).values()];
}`;
const after = `function mergePublicProductsBesideRoutineLife(runtime, actions) {
  if (!routinePublicLifeOnly(actions) || t01Active(runtime)) return actions;
  const labour = availableCanonicalLabour(runtime);
  const products = publicLifeProducts(runtime);
  if (!labour.length && !products.length) return actions;
  // A legal Sheet-backed shift is time-window constrained while counter meals
  // and goods remain broadly available. Preserve both ordinary-life surfaces,
  // but order currently legal labour first so the final three-choice selector
  // cannot make a valid shift impossible to choose.
  const combined = [...labour, ...products, ...actions];
  return [...new Map(combined.map((action) => [action.id, action])).values()];
}`;
if (!source.includes(before)) throw new Error('routine public-life merge anchor missing');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('routine public-life merge now preserves legal canonical labour');
