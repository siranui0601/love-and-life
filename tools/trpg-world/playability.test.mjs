import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import express from 'express';
import {createWorld, advanceWorld, applyCommand} from '../../src/shared/trpg-world/simulation.js';
import {canOccupy, findPath, moveBody, distance, hasLineOfSight} from '../../src/shared/trpg-world/navigation.js';
import {MOVEMENT, priceOf} from '../../src/shared/trpg-world/progression.js';
import {PersistentWorldService} from '../../src/server/trpg/world/service.js';
import {MemoryWorldStore} from '../../src/server/trpg/world/store.js';
import {mountPersistentWorldRoutes} from '../../src/server/trpg/world/routes.js';

// These journeys use the actual private source-derived world. No fixture,
// teleport, injected skill, balance override, rewarded flag or edited save.
const content = JSON.parse(await readFile(new URL('../../src/server/trpg/world/content/world-content.json', import.meta.url), 'utf8'));
const DAY = 86400;
const regionById = new Map(content.regions.map(region => [region.id, region]));

class Journey {
  constructor(seed = 4) { this.state = createWorld(content, {seed}); this.commands = 0; this.travelModes = new Set(); }
  get player() { return this.state.player; }
  get region() { return regionById.get(this.player.region); }
  command(command) { this.commands++; return applyCommand(this.state, content, command); }
  object(id) {
    const object = this.region.objects.find(candidate => candidate.id === id);
    assert(object, `${id} must be a real local facility in ${this.region.id}`);
    return object;
  }
  walk(target) {
    this.command({type:'resume'});
    if (this.player.mode !== 'foot') this.command({type:'mount', mode:'foot'});
    const points = findPath(this.region, this.player.position, target);
    assert(points.length, `No walkable path in ${this.region.id}: ${this.player.position} -> ${target}`);
    for (const point of points) {
      for (let step = 0; distance(this.player.position, point) > .08; step++) {
        assert(step < 1000, `Movement stalled in ${this.region.id}: ${this.player.position} -> ${point}`);
        const before = [...this.player.position], d = distance(before, point);
        this.command({type:'input', x:(point[0]-before[0])/d, z:(point[2]-before[2])/d});
        advanceWorld(this.state, content, Math.min(.4, d / MOVEMENT.foot.speed));
        assert(canOccupy(this.region, this.player.position), 'Authoritative movement entered a wall');
        if (this.player.hp < this.player.maxHp * .4 && this.player.inventory.medicine > 0) this.command({type:'use', itemId:'medicine'});
      }
    }
    this.command({type:'input', x:0, z:0});
    assert(distance(this.player.position, target) < .09);
  }
  approach(id) { const target = this.object(id); this.walk(target.position); return target; }
  inspect(id) { this.approach(id); return this.command({type:'interact', targetId:id}); }
  earn(gold) {
    const jobs = content.jobs.filter(job => job.region === this.region.id).sort((a,b) => b.pay/b.minutes-a.pay/a.minutes);
    assert(jobs.length, `No ordinary paid work in ${this.region.id}`);
    const job = jobs[0];
    this.approach(job.facilityId);
    for (let shifts = 0; this.player.gold < gold; shifts++) {
      assert(shifts < 100, 'Wage cannot fund this itinerary');
      const before = {gold:this.player.gold, time:this.state.time, xp:this.player.xp};
      this.command({type:'work', targetId:job.facilityId, jobId:job.id});
      assert.equal(this.player.gold-before.gold, job.pay);
      assert(Math.abs(this.state.time-before.time-job.minutes*60) < .001);
      assert(this.player.xp >= before.xp);
    }
  }
  buy(items, reserve = 0) {
    const shop = this.region.objects.find(object => object.kind === 'shop');
    assert(shop, `No supplies shop in ${this.region.id}; provision before departure`);
    const needs = Object.entries(items).map(([id, amount]) => [content.items.find(item => item.id === id), Math.max(0, amount-(this.player.inventory[id]||0))]).filter(([,amount]) => amount > 0);
    const estimate = needs.reduce((sum,[item,amount]) => sum + priceOf(this.state,item,this.region.id)*amount, reserve);
    if (this.player.gold < estimate) this.earn(estimate+20);
    this.approach(shop.id);
    for (const [item, quantity] of needs) this.command({type:'buy', targetId:shop.id, itemId:item.id, quantity});
  }
  train(id) {
    if (this.player.skills.includes(id)) return;
    const skill = content.skills.find(item => item.id === id);
    for (const prerequisite of skill.requires || []) this.train(prerequisite);
    if (this.player.gold < skill.goldCost) this.earn(skill.goldCost+20);
    const trainer = this.region.objects.find(object => object.kind === 'trainer' && (!object.skills || object.skills.includes(id)));
    assert(trainer, `No source trainer for ${id}`);
    this.approach(trainer.id);
    for(let lesson=0;!this.player.skills.includes(id)&&lesson<10;lesson++)this.command({type:'train', targetId:trainer.id, skillId:id});
    assert(this.player.skills.includes(id));
  }
  travel(destination) {
    const queue = [{id:this.region.id, path:[]}], visited = new Set();
    let route;
    while (queue.length) {
      const current = queue.shift();
      if (current.id === destination) { route = current.path; break; }
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      for (const portal of regionById.get(current.id).portals) queue.push({id:portal.to, path:[...current.path,portal]});
    }
    assert(route, `No physical route to ${destination}`);
    for (const portal of route) {
      this.walk(portal.position);
      const road = content.routes.find(candidate => candidate.id === portal.routeId);
      const mode = road.modes.includes('foot') ? 'foot' : 'boat';
      const before = this.state.time;
      this.command({type:'travel', portalId:portal.id, mode});
      this.travelModes.add(mode);
      assert.equal(this.player.region, portal.to);
      assert(this.state.time > before, 'Travel must advance the entire world');
    }
  }

}

test('all source facilities, NPC homes/workplaces, clues, incident sites and physical exits have executable collision-safe paths', () => {
  let checked = 0;
  for (const region of content.regions) {
    assert(canOccupy(region,region.spawn));
    const npcSites = content.npcs.filter(npc => npc.region === region.id).flatMap(npc => ['home','work'].map(kind => ({id:`${npc.id}:${kind}`,position:npc[kind]})));
    const sites = [...region.objects,...region.portals,...content.events.filter(event => event.region === region.id),...npcSites];
    for (const site of sites) {
      const path = findPath(region,region.spawn,site.position);
      assert(path.length, `${region.id}/${site.id} is unreachable`);
      let position = [...region.spawn];
      for (const point of path) {
        position = moveBody(region,position,point.map((value,axis) => value-position[axis]));
        assert(canOccupy(region,position), `${region.id}/${site.id} crosses collision`);
        assert(distance(position,point) < .001, `${region.id}/${site.id} path is blocked before ${point}`);
      }
      assert(distance(position,site.position) < .001);
      checked++;
    }
  }
  assert(checked >= 390);
});

test('navigation rejects non-finite vectors and routes around walls thinner than the path grid', () => {
  const region = {size:30,obstacles:[{x:1,z:0,width:.1,depth:8,height:4}]};
  for (const invalid of [[NaN,0,0],[0,0,Infinity],[0,undefined,0],[0,0],null]) {
    assert.equal(canOccupy(region,invalid),false);
    assert.equal(hasLineOfSight(region,[0,0,0],invalid),false);
    assert.deepEqual(findPath(region,[0,0,0],invalid),[]);
  }
  assert.throws(() => moveBody(region,[0,0,0],[Infinity,0,0]),TypeError);
  const target = [2,0,0], path = findPath(region,[0,0,0],target);
  assert(path.some(point => Math.abs(point[2]) > 4));
  let position = [0,0,0];
  for (const point of path) position = moveBody(region,position,point.map((value,axis) => value-position[axis]));
  assert(distance(position,target) < .001);
});

// The former eight-crisis certification selected generic mechanism outcomes.
// It is replaced by physical economic and causal paths under the new contracts.
test('ordinary work, timed training, meals and owned transport are playable without outcome rewards',t=>{
 const journey=new Journey();journey.train('riding');journey.train('magic');
 journey.buy({supplies:4},20);journey.command({type:'eat',itemId:'supplies'});
 const inn=journey.region.objects.find(o=>o.kind==='inn');journey.approach(inn.id);journey.command({type:'rest',targetId:inn.id,hours:6});
 journey.earn(400);journey.train('broom');
 const stable=journey.region.objects.find(o=>o.kind==='stable');journey.approach(stable.id);
 for(const id of ['horse','broom'])journey.command({type:'buy',targetId:stable.id,itemId:id});
 journey.walk(journey.region.spawn);journey.command({type:'mount',mode:'horse'});
 const before=[...journey.player.position];journey.command({type:'input',x:0,z:1});advanceWorld(journey.state,content,.4);
 assert(distance(before,journey.player.position)>MOVEMENT.foot.speed*.4);
 journey.command({type:'input',x:0,z:0});journey.command({type:'mount',mode:'foot'});journey.command({type:'mount',mode:'broom'});
 journey.command({type:'input',x:0,z:0,ascend:1});advanceWorld(journey.state,content,2);assert(journey.player.position[1]>5);
 assert.throws(()=>journey.command({type:'mount',mode:'foot'}),{code:'LAND_FIRST'});
 journey.command({type:'input',x:0,z:0,ascend:-1});advanceWorld(journey.state,content,3);
 journey.command({type:'input',x:0,z:0});journey.command({type:'mount',mode:'foot'});
 assert(journey.state.activityHistory.some(a=>a.kind==='training'&&a.endedAt-a.startedAt===1800));
 assert(journey.state.activityHistory.some(a=>a.kind==='eating'));assert(journey.player.fatigue<100);
 t.diagnostic(`Ordinary needs/transport path: ${journey.commands} commands, ${Math.round(journey.state.time/3600)} world hours.`);
});

test('an actual road and ferry journey preserves all-region access without resolving events by menu',t=>{
 const journey=new Journey(7);
 for(const destination of ['capital','trade','crime','trade','fortress','dwarf','blackridge','elf','forest','farm','temple','frontier']) {
   if(journey.player.hunger>45){journey.buy({supplies:3},20);journey.command({type:'eat',itemId:'supplies'});}
   if(journey.player.fatigue>50){const inn=journey.region.objects.find(o=>o.kind==='inn');if(inn){journey.approach(inn.id);journey.command({type:'rest',targetId:inn.id,hours:6});}}
   if(journey.player.gold<30)journey.earn(60);
   journey.travel(destination);
 }
 assert.equal(new Set(journey.state.visits).size,11);assert(journey.travelModes.has('boat'));
 assert(!Object.values(journey.state.events).some(e=>e.interventions.some(i=>i.mechanismId)));
 t.diagnostic(`Regional travel path: ${journey.commands} commands, ${Math.round(journey.state.time/3600)} world hours.`);
});

test('Finn is found in the world, accompanied on foot and returned to his living family',t=>{
  const journey=new Journey(19);
  journey.earn(150); // Ordinary paid work while the boy independently leaves the village.
  const child=journey.state.npcs.NPC001;
  assert(child.causalAssignment,'Finn must have independently started his excursion');
  for(let chase=0;distance(journey.player.position,child.position)>3&&chase<12;chase++)journey.walk([...child.position]);
  if(child.injury&&!child.injury.treated)journey.command({type:'causal',targetId:child.id,action:'tend'});
  journey.command({type:'causal',targetId:child.id,action:'escort'});
  const home=content.npcs.find(n=>n.id==='NPC002').home;
  journey.walk(home);
  for(let seconds=0;journey.state.events['lost-road'].causal.phase!=='reunited'&&seconds<120;seconds++)advanceWorld(journey.state,content,1);
  assert.equal(journey.state.events['lost-road'].causal.phase,'reunited');
  assert(distance(child.position,home)<6);assert(journey.state.npcs.NPC002.hp>0);
  assert(journey.state.socialFacts.some(f=>f.kind==='family-reunion'&&f.actorId==='NPC001'&&f.targetId==='NPC002'));
  assert(!child.companionOf);t.diagnostic(`Physical rescue: ${journey.commands} commands, no position or skill injection.`);
});

test('the real HTTP simulation rejects coordinate injection and remote actions without mutating an owned life', async t => {
  let now = 1000;
  const service = new PersistentWorldService({content,store:new MemoryWorldStore(),autoStart:false,now:() => now});
  const app = express(); mountPersistentWorldRoutes(app,{service});
  const server = createServer(app);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async () => { await service.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  const post = (path,body) => fetch(`${base}/TRPG/api/world/${path}`,{method:'POST',headers:{'content-type':'application/json',origin:base,...(cookie?{cookie}:{})},body:JSON.stringify(body)});
  let response = await post('session',{name:'実データ検証'});
  assert.equal(response.status,200); cookie = response.headers.get('set-cookie').split(';')[0];
  const start = (await response.json()).view;
  const farm = regionById.get('farm'), shop = farm.objects.find(object => object.kind === 'shop'), portal = farm.portals[0];
  const denied = [
    [{type:'input',x:0,z:0,position:[999,0,999]},'authoritative_state_rejected'],
    [{type:'input',x:0,z:0,time:99*DAY},'authoritative_state_rejected'],
    [{type:'input',x:999,z:0},'INVALID_INPUT'],
    [{type:'input',x:null,z:0},'INVALID_INPUT'],
    [{type:'buy',targetId:shop.id,itemId:'supplies'},'TOO_FAR'],
    [{type:'buy',targetId:'LOC_CAP_MARKET',itemId:'supplies'},'TARGET_MISSING'],
    [{type:'train',targetId:'capital:trainer',skillId:'magic'},'TARGET_MISSING'],
    [{type:'work',targetId:'LOC_CAP_MARKET',jobId:'JOB-CAP-01'},'TARGET_MISSING'],
    [{type:'interact',targetId:'event:lost-road',action:'intervene',option:'logistics'},'TOO_FAR'],
    [{type:'travel',portalId:portal.id,mode:'foot'},'TOO_FAR'],
  ];
  for (const [command,error] of denied) {
    response = await post('command',{seq:1,command});
    assert(response.status >= 400 && response.status < 500,JSON.stringify(command));
    assert.equal((await response.json()).error,error);
  }
  let view = (await (await fetch(`${base}/TRPG/api/world/state`,{headers:{cookie}})).json()).view;
  assert.deepEqual(view.player,start.player); assert.equal(view.time,start.time); assert.equal(view.lastSeq,0);
  response = await post('command',{seq:1,command:{type:'input',x:1,z:0}}); assert.equal(response.status,200);
  now += 400;
  view = (await (await fetch(`${base}/TRPG/api/world/state`,{headers:{cookie}})).json()).view;
  assert(distance(view.player.position,start.player.position) > 1);
  assert(distance(view.player.position,start.player.position) < 2);
  assert.equal(view.player.region,'farm'); assert.equal(view.player.gold,start.player.gold);
  assert.equal(view.lastSeq,1);
  assert(!JSON.stringify(view).includes(content.events.find(event => event.region !== 'farm').cause));
  assert.deepEqual((await (await fetch(`${base}/TRPG/api/world/session`)).json()),{ok:true,session:null});
});
