#!/usr/bin/env node
import fs from 'node:fs';

const path = 'tools/trpg-sim/_temporary_live_patch4_20260908.mjs';
let source = fs.readFileSync(path, 'utf8');
const before = '  const actions = authoredMissionFlowExclusiveActions(state);\\n  assert.equal(actions[0]?.id, "WORK:FACILITY:JOB-FARM-03");';
const after = '  const actions = authoredMissionFlowExclusiveActions(state, { movementActions: [], presentNpcs: [] });\\n  assert.equal(actions[0]?.id, "WORK:FACILITY:JOB-FARM-03");';
if (!source.includes(before)) throw new Error('Day3 production-context test anchor missing');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('Day3 focused test now uses production choice context');
