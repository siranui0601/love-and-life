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
 await page.screenshot({path:path.join(output,'topology.png')});
 await page.locator('#view-3d').click();await page.waitForFunction(()=>!!window.__capitalAudit,{timeout:30000});
 const invalidGround=await page.evaluate(async()=>{const {CAPITAL}=await import('/capital-review/capital-data.js');const names=new Set(['core-ground',...CAPITAL.negativeSpaces.map(s=>s.id)]);return BABYLON.Engine.Instances[0].scenes[0].meshes.filter(m=>names.has(m.name)).filter(m=>{const n=m.getVerticesData('normal');return !n||n.some(v=>!Number.isFinite(v))||n.filter((_,i)=>i%3===1).reduce((a,b)=>a+b,0)<=0;}).map(m=>m.name);});
 if(invalidGround.length)throw new Error('Invalid ground-facing normals: '+invalidGround.join(','));
 await page.screenshot({path:path.join(output,'overview.png')});
 const pairs=[['west_gate','market'],['south_gate','market'],['east_gate','market'],['market','castle'],['market','lower_court'],['market','ajin'],['ajin','east_gate'],['inn','castle'],['lower_court','south_cross'],['west_gate','world_R06'],['south_gate','world_R12'],['east_gate','world_R13'],['south_gate','world_R11'],['lower_court','roof_landing']];
 for(const [from,to]of pairs){
  await page.locator('#access').selectOption(to==='castle'?'permitted':'public');
  await page.locator('#route-from').selectOption(from);await page.locator('#route-to').selectOption(to);
  await page.locator('#walk-route').click();let snapshot,samples=[];
  await page.screenshot({path:path.join(output,from+'-'+to+'-start.png')});
  for(let step=0;step<100;step++){
   snapshot=await page.evaluate(()=>window.__capitalAudit.advance(30));
   const visible=await page.evaluate(()=>window.__capitalAudit.visibility());samples.push({...snapshot,visible});
   if(step===5)await page.screenshot({path:path.join(output,from+'-'+to+'-middle.png')});
   if(snapshot.blocked||snapshot.complete)break;
  }
  report.routes.push({from,to,...snapshot,samples});console.log('ROUTE',from,to,JSON.stringify(snapshot));
  await page.screenshot({path:path.join(output,from+'-'+to+'-end.png')});await page.locator('#walk-stop').click();
  if(snapshot.blocked||!snapshot.complete)errors.push(from+'→'+to+': '+(snapshot.blocked||'incomplete'));
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
