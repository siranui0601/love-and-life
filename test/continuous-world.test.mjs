import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 BOUNDS,COAST,SITES,ROUTE_KIND,RIVERS,landness,heightAt,biomeAt,routePoints,assertAtlas,dist
} from '../public/atlas-review/geography.js';

const manifest=JSON.parse(await readFile(new URL('../public/atlas-review/content.json',import.meta.url),'utf8'));
const byId=new Map(manifest.regions.map(r=>[r.id,r]));

test('one continuous world keeps eleven canonical settlements and fifteen connected routes',()=>{
 assert.equal(assertAtlas(manifest),true);
 assert.equal(COAST.length>25,true);
 assert.equal(BOUNDS.step<=3,true);
 assert.equal(Object.keys(SITES).length,11);
 assert.equal(Object.keys(ROUTE_KIND).length,15);
 for(const site of manifest.regions){
  assert.ok(landness(...site.worldPosition)>.78,site.id+' is on land');
  assert.ok(Number.isFinite(heightAt(...site.worldPosition)),site.id+' has finite height');
 }
 for(const route of manifest.routes){
  const path=routePoints(route,byId);
  assert.equal(path.length,97,route.id+' samples');
  assert.deepEqual([path[0][0],path[0][2]],byId.get(route.from).worldPosition);
  assert.deepEqual([path.at(-1)[0],path.at(-1)[2]],byId.get(route.to).worldPosition);
  for(const vertex of path)assert.ok(vertex.every(Number.isFinite),route.id+' has finite coordinates');
 }
});
test('a mainland with a real western coast and physically detached offshore crime city',()=>{
 assert.ok(landness(-155,-30)>.98,'crime metropolis sits on its island');
 assert.ok(landness(-122,-30)<.3,'crime city is separated by deep water');
 assert.ok(landness(-86,-35)<.35,'trade city has a waterfront');
 assert.ok(landness(-65,-35)>.98,'trade city exists on the mainland');
 assert.ok(landness(220,210)<.2,'southeast coastline meets the sea');
 assert.ok(landness(0,80)>.98,'farm-country fields occupy real land');
});
test('regional biomes and vertical relief are not identical platforms',()=>{
 assert.equal(biomeAt(120,-133),'volcanic');
 assert.equal(biomeAt(130,-20),'forest');
 assert.equal(biomeAt(3,167),'arid');
 assert.equal(biomeAt(-22,-156),'alpine');
 assert.ok(heightAt(-22,-155)>heightAt(35,25)+7,'northern mountains rise above capital plains');
 assert.ok(heightAt(132,-158)>heightAt(0,90)+12,'volcanic crest rises above farmland');
 assert.ok(SITES.capital.radius>SITES.trade.radius&&SITES.trade.radius>SITES.farm.radius);
 assert.ok(SITES.forest.radius>SITES.capital.radius,'the forest is an expansive environment, not a node');
});
test('roads are known corridors, and continuous land exists beyond road lines',()=>{
 const [farm,capital]=[byId.get('farm'),byId.get('capital')];
 const route=manifest.routes.find(r=>r.id==='R12');
 const p=routePoints(route,byId,80);
 assert.deepEqual([p[0][0],p[0][2]],farm.worldPosition);
 assert.deepEqual([p.at(-1)[0],p.at(-1)[2]],capital.worldPosition);
 assert.ok(landness(-15,62)>.90,'offroad grassland between farm and capital exists');
 assert.ok(landness(76,43)>.90,'offroad ground to the eastern forest exists');
 assert.ok(landness(20,-74)>.90,'northern mountain valleys connect to the central plains');
 const ferry=manifest.routes.find(r=>r.id==='R08');
 assert.equal(ROUTE_KIND[ferry.id],'sea');
 assert.ok(routePoints(ferry,byId).every(v=>v[1]===-.30),'R08 is maritime, not an artificial road over the sea');
 assert.equal(ROUTE_KIND.R05,'tunnel');assert.equal(ROUTE_KIND.R14,'hidden');
});
test('all land corridors stay above the physical coastline, including R04',()=>{
 for(const route of manifest.routes.filter(r=>r.id!=='R08')){
  const p=routePoints(route,byId,180);
  const lowest=Math.min(...p.map(vertex=>landness(vertex[0],vertex[2])));
  assert.ok(lowest>.63,route.id+' wrongly crosses open water: '+lowest);
 }
});
test('standalone renderer preserves the same scene through region selection and walks',async()=>{
 const source=await readFile(new URL('../public/atlas-review/continuous-world.js',import.meta.url),'utf8');
 assert.match(source,/this\.camera\.target=/);
 assert.match(source,/focus\(id,radius\)/);
 assert.match(source,/walk\(id='farm'\)/);
 assert.match(source,/walkable\(nx,nz,oldX,oldZ\)/);
 assert.match(source,/landness\(nx,nz\)<\.63/);
 assert.doesNotMatch(source,/loadRegion\(|fetch\([^)]*region/i);
});
