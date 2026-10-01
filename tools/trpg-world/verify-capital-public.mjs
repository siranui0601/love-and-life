/** Verify deployed static sources plus the saved physical walking audit.
 * node tools/trpg-world/verify-capital-public.mjs --url=https://siranui.jp --report=/path/to/browser-audit.json
 * Source paths and the default committed report resolve independently of cwd.
 */
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const args=Object.fromEntries(process.argv.slice(2).map(v=>{const i=v.indexOf('=');return [v.slice(2,i),v.slice(i+1)];}));
const source=new URL('../../public/capital-review/',import.meta.url);
const reportPath=args.report?pathToFileURL(path.resolve(args.report)):new URL('../../docs/trpg-world/qa/capital-pass-4/production/browser-audit.json',import.meta.url);
for(const name of (await fs.readdir(source)).filter(n=>/\.(js|css|html)$/.test(n))){
 const result=await fetch((args.url||'https://siranui.jp').replace(/\/$/,'')+'/capital-review/'+name+'?verify=capital-pass-4');
 const actual=Buffer.from(await result.arrayBuffer()),expected=Buffer.from((await fs.readFile(new URL(name,source),'utf8')).replace(/\r\n/g,'\n')); // Git text files deploy with canonical LF, including from Windows checkouts.
 if(result.status!==200||!actual.equals(expected))throw Error(name+' content mismatch '+result.status);
 console.log('PUBLIC MATCH',name,crypto.createHash('sha256').update(actual).digest('hex'));
}
const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
if(report.errors.length||report.routes.length!==14||report.states.length!==8||!report.routes.every(r=>r.complete&&!r.blocked)||!report.invalidRouteStopsGuide||!report.roadSurfacesMatch||Math.abs(report.lowFpsDistanceM-1.4)>.001)throw Error('Production walking audit failed');
console.log('PRODUCTION PASS',JSON.stringify({url:report.url,routes:report.routes.length,states:report.states.length,lowFpsDistanceM:report.lowFpsDistanceM,invalidRouteStopsGuide:report.invalidRouteStopsGuide}));
