import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 ATLAS_SITES,ATLAS_ROUTE_STYLES,atlasHeight,atlasLandness,atlasBiome,atlasRoadPoints,auditAtlasContent
} from '../../src/shared/trpg-world/world-atlas-data.js';
const content=JSON.parse(await readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));
const regions=new Map(content.regions.map(region=>[region.id,region]));
test('3D world overview consumes the actual 11 sites and R01-R15, without replacing their IDs',()=>{
 assert.equal(content.regions.length,11);
 assert.equal(content.routes.length,15);
 assert.equal(Object.keys(ATLAS_SITES).length,11);
 assert.equal(Object.keys(ATLAS_ROUTE_STYLES).length,15);
 assert.equal(auditAtlasContent(content),true);
 for(const region of content.regions)assert.deepEqual(region.worldPosition.map(Number).length,2);
 assert.ok(ATLAS_SITES.capital.size>ATLAS_SITES.trade.size);
 assert.ok(ATLAS_SITES.trade.size>ATLAS_SITES.farm.size);
 assert.notEqual(ATLAS_SITES.capital.type,ATLAS_SITES.fortress.type);
});
test('continents, coast, criminal island and differentiated mountains form one finite heightfield',()=>{
 const points=[...content.regions.map(r=>r.worldPosition),[-120,-30],[-205,-35],[-15,-150],[35,25]];
 for(const [x,z] of points){assert.ok(Number.isFinite(atlasHeight(x,z)));assert.ok(atlasLandness(x,z)>=0&&atlasLandness(x,z)<=1);}
 for(const r of content.regions)assert.ok(atlasLandness(...r.worldPosition)>.5,'settlement is on land: '+r.id);
 assert.ok(atlasLandness(-155,-30)>.8,'criminal island is inhabitable');
 assert.ok(atlasLandness(-130,-30)<.3,'there is sea between island and mainland');
 assert.ok(atlasHeight(-15,-150)>atlasHeight(35,25)+3,'northern ridge rises above the capital');
 assert.equal(atlasBiome(99,-135),'volcanic');
 assert.equal(atlasBiome(117,7),'forest');
});
test('each published journey connects canonical region coordinates, with a sea lane only for R08',()=>{
 for(const route of content.routes){
  const from=regions.get(route.from),to=regions.get(route.to);
  assert.ok(from&&to,'route endpoints are existing places: '+route.id);
  const points=atlasRoadPoints(route,from.worldPosition,to.worldPosition);
  assert.equal(points.length,25);
  assert.deepEqual([points[0][0],points[0][2]],from.worldPosition);
  assert.deepEqual([points.at(-1)[0],points.at(-1)[2]],to.worldPosition);
  for(const point of points)assert.ok(point.every(Number.isFinite),'finite atlas route '+route.id);
  if(route.id==='R08'){
   assert.equal(ATLAS_ROUTE_STYLES[route.id],'sea');
   assert.ok(points.every(point=>point[1]===-.22));
  }
 }
});
test('player maps accept knowledge-filtered geography and reject accidental new IDs',()=>{
 const farm=regions.get('farm');
 assert.equal(auditAtlasContent({regions:[farm],routes:[]}),true,'new player sees only farm');
 assert.throws(()=>auditAtlasContent({regions:[farm,{...farm,id:'unknown'}],routes:[]}),/region IDs/);
 assert.throws(()=>auditAtlasContent({regions:[farm,farm],routes:[]}),/region IDs/);
 assert.throws(()=>auditAtlasContent({regions:[farm],routes:[content.routes.find(r=>r.id==='R12')]}),/undiscovered/);
 assert.throws(()=>auditAtlasContent({regions:[farm],routes:[{id:'R99',from:'farm',to:'farm'}]}),/route/);
});
