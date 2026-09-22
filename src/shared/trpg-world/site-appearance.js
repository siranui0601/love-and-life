// Coarse things visible from outside. Internal integrity, causes, schedules and
// casualties are deliberately absent. Callers must enforce perception/range.
export function siteAppearance(state,content,targetId){
 const signs=[];
 for(const spec of content.structures||[])if(spec.targetId===targetId){
  const s=state.structures?.[spec.id];if(!s||s.legacyDormant)continue;
  if(s.fire>0)signs.push('炎と煙が上がっている');
  if(s.blocked)signs.push('残骸が入口を塞いでいる');
  if(s.damageAt!==undefined&&s.integrity<80)signs.push('設備が壊れている');
 }
 if(state.facilities?.[targetId]?.closed)signs.push('入口が閉鎖されている');
 return signs;
}
