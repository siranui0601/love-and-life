import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1500,height:960},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push('PAGE: '+e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push('CONSOLE: '+m.text()+' URL:'+m.location().url);});
try{
 const response=await page.goto(process.env.ATLAS_URL||'http://127.0.0.1:3103/atlas-review',{waitUntil:'domcontentloaded',timeout:30000});
 console.log('HTTP',response.status());
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('描画済'),{timeout:120000});
 await page.waitForTimeout(1500);
 console.log('SCENE',await page.evaluate(()=>{const v=globalThis.__continuousWorld;const g=v?.scene?.getMeshByName('one-continuous-landmass');return {land:g?.getTotalVertices(),enabled:g?.isEnabled(),ready:g?.isReady(),min:g?.getBoundingInfo()?.boundingBox.minimumWorld?.asArray(),max:g?.getBoundingInfo()?.boundingBox.maximumWorld?.asArray(),cameraRadius:v?.camera.radius,meshCount:v?.scene.meshes.length,trees:v?.scene.getMeshByName('forest-canopies')?.metadata?.treeCount,treeBounds:v?.scene.getMeshByName('forest-canopies')?.getBoundingInfo()?.boundingBox?.maximumWorld?.asArray(),treeStorage:v?.scene.getMeshByName('forest-canopies')?._thinInstanceDataStorage?.instancesCount,treeBuffer:v?.scene.getMeshByName('forest-canopies')?._thinInstanceDataStorage?.matrixData?.length}}));
 await page.screenshot({path:'tools/trpg-world/reports/continuous-world-overview.png'});
 console.log('OVERVIEW',await page.locator('#status').textContent());
 await page.locator('#location').selectOption('capital');
 await page.waitForTimeout(900);
 await page.screenshot({path:'tools/trpg-world/reports/continuous-world-capital.png'});
 await page.locator('#walk').click();
 console.log('CAMERA_WALK',await page.evaluate(()=>({radius:globalThis.__continuousWorld?.camera.radius,target:globalThis.__continuousWorld?.camera.target.asArray(),walking:globalThis.__continuousWorld?.walking})));
 await page.keyboard.down('KeyW');await page.waitForTimeout(900);await page.keyboard.up('KeyW');
 await page.screenshot({path:'tools/trpg-world/reports/continuous-world-walk.png'});
 const status=await page.locator('#status').textContent();
 console.log('WALK',status);
 console.log('ERRORS',JSON.stringify(errors));
 if(errors.length||!status.includes('自由探索中'))process.exitCode=1;
}catch(error){console.log('VISUAL_CHECK_ERROR',error.message);console.log('ERRORS',errors);await page.screenshot({path:'tools/trpg-world/reports/continuous-world-failure.png'});process.exitCode=1;}
finally{await browser.close();}
