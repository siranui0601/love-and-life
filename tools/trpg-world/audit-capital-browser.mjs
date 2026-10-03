/** Run with a separately installed Playwright. No game server/API credentials required.
 * node tools/trpg-world/audit-capital-browser.mjs --url=http://localhost:9893 --out=/tmp/capital-qa
 * Optional: --playwright=/absolute/path/to/playwright/index.mjs --browser=/path/to/chrome
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
const pw=await import(args.playwright?pathToFileURL(args.playwright).href:'playwright');
const output=path.resolve(args.out||'/tmp/capital-qa');await fs.mkdir(output,{recursive:true});
const browser=await pw.chromium.launch({headless:true,executablePath:args.browser,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const url=(args.url||'http://127.0.0.1:9893').replace(/\/$/,'')+'/capital-review/?audit=1';
const report={url,generatedAt:new Date().toISOString(),method:'Continuous eye-height walking with shared swept collision; diagnostic simulation time is accelerated, screenshots use the actual Babylon renderer.',routes:[],states:[],errors};
try{
 await page.goto(url);await page.locator('#capital-map [data-edge]').first().waitFor();
 const before=await page.locator('#route-options').innerText();
 for(const hour of ['7','12','18','12'])await page.locator('#hour').selectOption(hour);
 const after=await page.locator('#route-options').innerText();if(before!==after)throw new Error('Repeated state rendering changed route metrics');
 await page.screenshot({path:path.join(output,'urban-form.png')});await page.locator('#topology-debug').click();await page.screenshot({path:path.join(output,'topology.png')});await page.locator('#urban-form').click();
 await page.locator('#view-3d').click();await page.waitForFunction(()=>!!window.__capitalAudit,{timeout:30000});
 await page.evaluate(()=>window.__capitalAudit.pauseRealTime());
 const invalidGround=await page.evaluate(async()=>{const {CAPITAL}=await import('/capital-review/capital-data.js');const names=new Set(['core-ground',...CAPITAL.negativeSpaces.map(s=>s.id)]);return BABYLON.Engine.Instances[0].scenes[0].meshes.filter(m=>names.has(m.name)).filter(m=>{const n=m.getVerticesData('normal');return !n||n.some(v=>!Number.isFinite(v))||n.filter((_,i)=>i%3===1).reduce((a,b)=>a+b,0)<=0;}).map(m=>m.name);});
 if(invalidGround.length)throw new Error('Invalid ground-facing normals: '+invalidGround.join(','));
 const badRoadVertices=await page.evaluate(async()=>{const {CAPITAL,fromLocal}=await import('/capital-review/capital-data.js'),{edgeHeightAt}=await import('/capital-review/capital-surfaces.js'),scene=BABYLON.Engine.Instances[0].scenes[0],bad=[];
  for(const e of CAPITAL.edges){const mesh=scene.getMeshByName('road:'+e.id),positions=mesh?.getVerticesData('position');if(!positions){bad.push(e.id+':missing');continue;}for(let i=0;i<positions.length;i+=3*53){const p=fromLocal([positions[i],positions[i+2]]),expected=edgeHeightAt(e,p);if(Math.abs(positions[i+1]-expected)>.001){bad.push(e.id);break;}}}return bad;});
 if(badRoadVertices.length)throw Error('Street ribbon diverges from physical cross slope: '+badRoadVertices.join(','));report.roadSurfacesMatch=true;
 await page.screenshot({path:path.join(output,'overview.png')});
 for(const [name,angle]of [['south',Math.PI/2],['west',Math.PI],['east',0]]){await page.evaluate(a=>window.__capitalAudit.overview(a),angle);await page.screenshot({path:path.join(output,'overview-'+name+'.png')});}
 await page.locator('#route-from').selectOption('west_gate');await page.locator('#route-to').selectOption('market');await page.locator('#walk-route').click();
 const clockStart=await page.evaluate(()=>window.__capitalAudit.snapshot());let clockEnd;for(let i=0;i<10;i++)clockEnd=await page.evaluate(()=>window.__capitalAudit.frame(.1));report.lowFpsDistanceM=clockEnd.travelledM-clockStart.travelledM;if(Math.abs(report.lowFpsDistanceM-1.4)>.001)throw Error('10 FPS walking speed drift');
 const guidedBefore=await page.evaluate(()=>window.__capitalAudit.advance(5));await page.locator('#route-to').selectOption('castle');
 const cancelled=await page.evaluate(()=>window.__capitalAudit.snapshot());const guidedAfter=await page.evaluate(()=>window.__capitalAudit.advance(10));
 if(guidedAfter.travelledM!==cancelled.travelledM)throw Error('No-route selection failed to stop old guided walk');
 report.invalidRouteStopsGuide=true;await page.locator('#walk-stop').click();
 const pairs=[['west_gate','market'],['south_gate','market'],['east_gate','market'],['market','castle'],['market','lower_court'],['market','ajin'],['ajin','east_gate'],['inn','castle'],['lower_court','south_cross'],['west_gate','world_R06'],['south_gate','world_R12'],['east_gate','world_R13'],['south_gate','world_R11'],['lower_court','roof_landing']];
 for(const [from,to]of pairs){
  await page.locator('#access').selectOption(to==='castle'?'permitted':'public');
  await page.locator('#route-from').selectOption(from);await page.locator('#route-to').selectOption(to);
  await page.locator('#walk-route').click();let snapshot,samples=[],captured=new Set();
  await page.screenshot({path:path.join(output,from+'-'+to+'-start.png')});
  for(let step=0;step<100;step++){
   snapshot=await page.evaluate(()=>window.__capitalAudit.advance(30));
   const visible=await page.evaluate(()=>window.__capitalAudit.visibility());samples.push({...snapshot,visible});
   for(const [label,fraction]of [['quarter',.25],['middle',.5],['three-quarter',.75]])if(!captured.has(label)&&snapshot.travelledM>=snapshot.routeDistanceM*fraction){captured.add(label);await page.screenshot({path:path.join(output,from+'-'+to+'-'+label+'.png')});}
   if(snapshot.blocked||snapshot.complete)break;
  }
  report.routes.push({from,to,...snapshot,samples});console.log('ROUTE',from,to,JSON.stringify(snapshot));
  await page.screenshot({path:path.join(output,from+'-'+to+'-end.png')});await page.locator('#walk-stop').click();
  if(snapshot.blocked||!snapshot.complete)errors.push(from+'→'+to+': '+(snapshot.blocked||'incomplete'));
 }
 // Walk the new neighbourhood lanes, the largest public stair ascent, and
 // the actual quays in addition to the original major-route acceptance set.
 report.microRoutes=[];
 const micro=await page.evaluate(async()=>{const {CAPITAL}=await import('/capital-review/capital-data.js');return CAPITAL.walkingReviews||[];});
 for(const review of micro){
  await page.locator('#access').selectOption('public');await page.locator('#route-from').selectOption(review.from);await page.locator('#route-to').selectOption(review.to);await page.locator('#walk-route').click();let result;
  await page.screenshot({path:path.join(output,'micro-'+review.id+'-start.png')});
  for(let i=0;i<90;i++){result=await page.evaluate(()=>window.__capitalAudit.advance(15));if(i===2)await page.screenshot({path:path.join(output,'micro-'+review.id+'-walking.png')});if(result.complete||result.blocked)break;}
  report.microRoutes.push({...review,...result});if(!result.complete||result.blocked)errors.push(review.id+': '+(result.blocked||'incomplete'));
  await page.screenshot({path:path.join(output,'micro-'+review.id+'-end.png')});await page.locator('#walk-stop').click();console.log('MICRO',review.id,JSON.stringify(result));
 }
 report.entryRoutes=[];
 for(const [from,to]of [['world_R06','west_gate'],['world_R12','south_gate'],['world_R13','east_gate']]){
  await page.locator('#route-from').selectOption(from);await page.locator('#route-to').selectOption(to);await page.locator('#walk-route').click();let result;
  await page.screenshot({path:path.join(output,'entry-'+to+'-start.png')});
  for(let i=0;i<120;i++){result=await page.evaluate(()=>window.__capitalAudit.advance(15));if(i===Math.floor((result.routeDistanceM/1.4/15)*.85))await page.screenshot({path:path.join(output,'entry-'+to+'-approach.png')});if(result.complete||result.blocked)break;}
  report.entryRoutes.push({from,to,...result});if(!result.complete||result.blocked)errors.push('entry '+to+': '+(result.blocked||'incomplete'));
  await page.screenshot({path:path.join(output,'entry-'+to+'-end.png')});await page.locator('#walk-stop').click();console.log('ENTRY',to,JSON.stringify(result));
 }
 // Detours physically walked under the same weather/event state as routing and barriers.
 for(const setting of [{id:'flood',from:'stable',to:'inn',weather:'flood'},{id:'T16',from:'ajin',to:'market',event:'T16'},{id:'T11',from:'market',to:'castle',event:'T11',access:'permitted'},{id:'T17',from:'office',to:'mage_tower',event:'T17',access:'permitted'},{id:'T10',from:'orphanage',to:'office',event:'T10'}]){
  await page.locator('#weather').selectOption(setting.weather||'clear');await page.locator('#access').selectOption(setting.access||'public');
  if(setting.event){await page.locator('#events-controls').evaluate(el=>el.open=true);await page.locator('#event-'+setting.event).selectOption('active');}
  await page.locator('#route-from').selectOption(setting.from);await page.locator('#route-to').selectOption(setting.to);await page.locator('#walk-route').click();let result;
  for(let i=0;i<90;i++){result=await page.evaluate(()=>window.__capitalAudit.advance(30));if(result.complete||result.blocked)break;}
  report.states.push({id:setting.id,...result});console.log('STATE',setting.id,JSON.stringify(result));if(result.blocked||!result.complete)errors.push(setting.id+': '+(result.blocked||'incomplete'));
  await page.screenshot({path:path.join(output,'state-'+setting.id+'.png')});await page.locator('#walk-stop').click();if(setting.event)await page.locator('#event-'+setting.event).selectOption('idle');
 }
 await page.locator('#weather').selectOption('clear');
 for(const hour of ['7','12','18']){await page.locator('#hour').selectOption(hour);const result=await page.evaluate(()=>window.__capitalAudit.advance(0));report.states.push({hour,agentCount:result.agentCount});}
 // Mobile load + free walking control, and world context retained.
 await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('#view-3d').click();await page.waitForFunction(()=>!!window.__capitalAudit);await page.locator('#walk-start').click();
 await page.locator('[data-walk="ArrowUp"]').dispatchEvent('pointerdown',{pointerId:1});await page.waitForTimeout(500);await page.locator('[data-walk="ArrowUp"]').dispatchEvent('pointerup',{pointerId:1});
 report.mobile={width:390,telemetry:await page.locator('#telemetry').innerText()};await page.screenshot({path:path.join(output,'mobile.png')});
 await page.goto((args.url||'http://127.0.0.1:9893')+'/world-blueprint/');report.worldTitle=await page.title();
}finally{await fs.writeFile(path.join(output,'browser-audit.json'),JSON.stringify(report,null,2));await browser.close();}
if(errors.length)throw new Error(errors.join('\n'));
console.log('PASS',report.routes.length,'routes,',report.states.length,'states',output);
