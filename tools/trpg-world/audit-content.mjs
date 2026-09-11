import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {canOccupy} from '../../src/shared/trpg-world/navigation.js';
import {combatImportDiagnostics} from '../../src/shared/trpg-world/combat.js';

export function auditWorldContent(content) {
  const errors=[],warnings=[],keys=['regions','routes','npcs','events','skills','items','recipes','jobs','monsters','equipment'];
  const ids=Object.fromEntries(keys.map(key=>[key,new Set((content[key]||[]).map(e=>e.id))]));
  const materialIds=new Set((content.materials||[]).map(item=>item.id));
  for(const key of keys)if(ids[key].size!==(content[key]||[]).length)errors.push(`Duplicate ${key} ID`);
  const evidence=new Set(),facts=new Set();
  for(const region of content.regions||[])for(const object of region.objects||[]){if(object.evidenceId)evidence.add(object.evidenceId);if(object.rumorEvidenceId)evidence.add(object.rumorEvidenceId);}
  for(const event of content.events||[]){evidence.add(`${event.id}:misread`);facts.add(`${event.id}:public-warning`);if(event.opposition){evidence.add(`${event.id}:threat-reduced`);if(!ids.monsters.has(event.opposition.monsterId))errors.push(`${event.id}: unknown opposition monster`);}for(const method of event.mechanisms||[]){for(const id of method.effects?.evidence||[])evidence.add(id);for(const id of method.effects?.setFacts||[])facts.add(id);}facts.add(`resolved:${event.id}`);facts.add(`failure:${event.id}`);}
  for(const region of content.regions||[]) {
    for(const [label,position] of [['spawn',region.spawn],...(region.objects||[]).map(o=>[o.id,o.position]),...(region.portals||[]).map(o=>[o.id,o.position])])
      if(!position||position.length!==3||position.some(v=>!Number.isFinite(v))||!canOccupy(region,position))errors.push(`${region.id}/${label}: invalid or blocked interaction position`);
    for(const portal of region.portals||[]) {
      const route=(content.routes||[]).find(r=>r.id===portal.routeId);
      if(!ids.regions.has(portal.to)||!route)errors.push(`${portal.id}: dangling portal target`);
      else if(![route.from,route.to].includes(region.id)||![route.from,route.to].includes(portal.to))errors.push(`${portal.id}: route endpoint mismatch`);
    }
  }
  for(const npc of content.npcs||[]) {
    const region=(content.regions||[]).find(r=>r.id===npc.region);
    if(!region){errors.push(`${npc.id}: unknown region`);continue;}
    for(const key of ['home','work'])if(!npc[key]||!canOccupy(region,npc[key]))errors.push(`${npc.id}: blocked ${key}`);
  }
  for(const event of content.events||[]) {
    const region=(content.regions||[]).find(r=>r.id===event.region);
    if(!region)errors.push(`${event.id}: unknown region`);
    else if(!event.position||!canOccupy(region,event.position))errors.push(`${event.id}: blocked intervention point`);
    if(!Number.isFinite(event.startsAt)||!Number.isFinite(event.deadline)||event.deadline<=event.startsAt)errors.push(`${event.id}: invalid event timing`);
    if((event.mechanisms||[]).length<2)errors.push(`${event.id}: fewer than two intervention mechanisms`);
    for(const method of event.mechanisms||[]) {
      const req=method.requirements||{};
      for(const id of req.skills||[])if(!ids.skills.has(id)&&!['combat','investigation'].includes(id))errors.push(`${event.id}/${method.id}: unknown skill ${id}`);
      for(const id of Object.keys(req.items||req.inventory||{}))if(!ids.items.has(id))errors.push(`${event.id}/${method.id}: unavailable item ${id}`);
      for(const id of req.evidence||[])if(!evidence.has(id))errors.push(`${event.id}/${method.id}: unreachable evidence ${id}`);
      for(const id of req.facts||[])if(!facts.has(id))errors.push(`${event.id}/${method.id}: unreachable fact ${id}`);
      for(const id of typeof req.trust==='object'?Object.keys(req.trust):req.npcId?[req.npcId]:[])if(!ids.npcs.has(id))errors.push(`${event.id}/${method.id}: unknown relationship target ${id}`);
      if(!Number.isFinite(method.effects?.pressure))warnings.push(`${event.id}/${method.id}: implicit pressure outcome`);
    }
  }
  for(const recipe of content.recipes||[]) {
    if(!recipe.name||!Number.isFinite(recipe.minutes)||recipe.minutes<=0)errors.push(`${recipe.id}: invalid recipe metadata`);
    for(const id of recipe.requirements?.skills||[])if(!ids.skills.has(id))errors.push(`${recipe.id}: unknown skill ${id}`);
    for(const id of Object.keys(recipe.requirements?.items||recipe.requirements?.inventory||{}))if(!ids.items.has(id)&&!materialIds.has(id))errors.push(`${recipe.id}: unavailable ingredient ${id}`);
    for(const id of Object.keys(recipe.outputs?.items||recipe.outputs||{}))if(!ids.items.has(id))errors.push(`${recipe.id}: unavailable output ${id}`);
    for(const facilityId of recipe.facilityIds||[]) {
      const facility=(content.regions||[]).flatMap(region=>region.objects||[]).find(object=>object.id===facilityId);
      if(!facility)errors.push(`${recipe.id}: unknown facility ${facilityId}`);else if(!facility.crafting)errors.push(`${recipe.id}: facility ${facilityId} is not marked crafting`);
    }
  }
  const reached=new Set([content.regions?.[0]?.id]);
  for(let i=0;i<(content.regions||[]).length;i++)for(const route of content.routes||[]){if(reached.has(route.from))reached.add(route.to);if(reached.has(route.to))reached.add(route.from);}
  if(reached.size!==ids.regions.size)errors.push('World topology is disconnected');
  for(const action of content.enemyActions||[])if(!ids.monsters.has(action.monsterId)||!(content.enemySkills||[]).some(s=>s.id===action.skillId))errors.push(`${action.id}: dangling combat reference`);
  for(const shop of content.equipmentShops||[])if(!ids.equipment.has(shop.itemId)||!ids.regions.has(shop.region))errors.push(`${shop.id}: dangling equipment shop reference`);
  return {ok:errors.length===0,counts:Object.fromEntries(keys.map(k=>[k,ids[k].size])),errors,warnings,combat:combatImportDiagnostics(content)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const content=JSON.parse(await readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));
  const report=auditWorldContent(content);process.stdout.write(`${JSON.stringify(report,null,2)}\n`);if(!report.ok)process.exitCode=1;
}
