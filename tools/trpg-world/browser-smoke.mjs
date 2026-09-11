import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=process.env.WORLD_BASE_URL||'http://127.0.0.1:3100';
const output=path.resolve('tools/trpg-world/reports');
let executablePath=process.env.WORLD_BROWSER;
if(!executablePath&&process.platform==='win32'){
 for(const folder of [process.env['ProgramFiles(x86)'],process.env.ProgramFiles,process.env.LOCALAPPDATA].filter(Boolean)){
  const candidate=path.join(folder,'Microsoft/Edge/Application/msedge.exe');
  if(await fs.access(candidate).then(()=>true,()=>false)){executablePath=candidate;break;}
 }
}
const browser=await chromium.launch({...(executablePath?{executablePath}:{}),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()}));
await fs.mkdir(output,{recursive:true});
const state=()=>page.evaluate(async()=>await(await fetch('/TRPG/api/world/state')).json());
const result={renderer:'Chromium SwiftShader software WebGL',errors,failed};
try{
 await page.goto(`${base}/TRPG/`);await page.locator('#name').fill('旅人');await page.locator('#startButton').click();await page.locator('#loading').waitFor({state:'hidden',timeout:90000});
 await expect(page.locator('#regionName')).toHaveText('田園の村');await expect(page.locator('#hud')).toBeVisible();
 await page.waitForTimeout(2000);await page.screenshot({path:path.join(output,'world-farm.png')});
 const before=await state();assert.equal(before.ok,true);assert.equal(before.view.player.region,'farm');
 await page.keyboard.down('KeyW');await page.waitForTimeout(1300);await page.keyboard.up('KeyW');await page.waitForTimeout(700);
 const after=await state();const travelled=Math.hypot(after.view.player.position[0]-before.view.player.position[0],after.view.player.position[2]-before.view.player.position[2]);
 assert(travelled>1,`Keyboard input must move the server player: ${travelled}`);
 await page.locator('#bagButton').click();await expect(page.locator('#panelTitle')).toHaveText('持ち物と身につけたこと');await expect(page.locator('#panelBody')).toContainText('技能');await page.screenshot({path:path.join(output,'inventory.png')});
 await page.locator('#closePanel').click();await page.locator('#mapButton').click();await expect(page.locator('#panelBody .history')).toHaveCount(11);await page.screenshot({path:path.join(output,'map.png')});
 await page.reload();await expect(page.locator('#resumeButton')).toBeVisible();await page.locator('#resumeButton').click();await page.locator('#loading').waitFor({state:'hidden',timeout:90000});
 const resumed=await state();assert.equal(resumed.view.player.name,'旅人');assert.equal(resumed.view.player.region,after.view.player.region);assert(resumed.view.time>=after.view.time);assert.equal(resumed.view.player.gold,after.view.player.gold);
 Object.assign(result,{before:before.view.player.position,after:after.view.player.position,travelled,region:resumed.view.region.name,npcs:resumed.view.npcs.length,fps:await page.locator('#fps').textContent(),resumed:true});
 assert.deepEqual(errors,[],'No browser console or JavaScript errors');assert.deepEqual(failed,[],'All assets and requests must load');result.passed=true;
}catch(error){result.passed=false;result.failure=error.stack;process.exitCode=1;await page.screenshot({path:path.join(output,'browser-failure.png')}).catch(()=>{});}
finally{await fs.writeFile(path.join(output,'browser-smoke.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await browser.close();}
