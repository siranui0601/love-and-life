/** Fast visual iteration, NOT a substitute for the complete route audit. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
const pw=await import(args.playwright?pathToFileURL(args.playwright).href:'playwright');
const out=path.resolve(args.out||'/tmp/capital-sections');await fs.mkdir(out,{recursive:true});
const browser=await pw.chromium.launch({headless:true,executablePath:args.browser,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto((args.url||'http://127.0.0.1:9894')+'/capital-review/?audit=1');await page.locator('#view-3d').click();await page.waitForFunction(()=>!!window.__capitalAudit,{timeout:60000});
 await page.evaluate(()=>{window.__capitalAudit.pauseRealTime();window.__capitalAudit.overview(Math.PI);});await page.screenshot({path:path.join(out,'overview-west.png')});
 await page.locator('#access').selectOption('permitted');
 const reviews=await page.evaluate(async()=>{const {CAPITAL}=await import('/capital-review/capital-data.js');return [{id:'castle-approach',from:'market',to:'castle'},...CAPITAL.walkingReviews.filter(r=>['terrace-stairs','lower-backstreets'].includes(r.id)),...['west','south','east'].map((side,i)=>({id:'gate-'+side,from:['world_R06','world_R12','world_R13'][i],to:side+'_gate',nearGateM:35}))];});
 const sections=[];
 for(const r of reviews){await page.locator('#route-from').selectOption(r.from);await page.locator('#route-to').selectOption(r.to);await page.locator('#walk-route').click();const initial=await page.evaluate(()=>window.__capitalAudit.snapshot());const travel=r.nearGateM?Math.max(0,initial.routeDistanceM-r.nearGateM):initial.routeDistanceM*.5;const middle=await page.evaluate(dt=>window.__capitalAudit.advance(dt),travel/1.4);sections.push({...r,...middle});await page.screenshot({path:path.join(out,r.id+'.png')});await page.locator('#walk-stop').click();}
 const meshes=await page.evaluate(()=>{const scene=BABYLON.Engine.Instances[0].scenes[0];return {meshes:scene.meshes.length,vertices:scene.meshes.reduce((n,m)=>n+m.getTotalVertices(),0)};});
 await fs.writeFile(path.join(out,'section-review.json'),JSON.stringify({method:'Partial eye-height visual review; not full route completion',sections,meshes,errors},null,2));console.log(JSON.stringify({out,meshes,errors}));
}finally{await browser.close();}
if(errors.length)throw Error(errors.join('\n'));
