import test from 'node:test';
import { loadBattleData } from '../lib/battle-model.mjs';

const data=await loadBattleData();
test('Checkpoint C deterministic build candidate IDs',()=>{
  const families=['COUNTER','REFLECT','LUCK_SCALING','COMBAT_LOCAL_WEATHER','SUMMON','SUBSTITUTE','ALLOW_HP_FOR_MP','ALL_MP_COST','RESOURCE_TECHNIQUE','TRAP','MAGIC_SUPPRESSION'];
  const out={};
  for(const family of families)out[family]=data.playerSkills.filter((skill)=>(skill.runtimeMechanics??[]).some((m)=>m.family===family)).map((skill)=>({id:skill.id,name:skill.name,kind:skill.kind,acquisitionCode:skill.acquisitionCode,target:skill.target,costs:skill.costs,activationConditions:skill.activationConditions})).slice(0,12);
  console.log(`CHECKPOINT_C_BUILD_CANDIDATES ${JSON.stringify(out)}`);
});
