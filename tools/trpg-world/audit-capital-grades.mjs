/** Spatial quality diagnostic; connectivity alone does not imply a walkable grade.
 * node tools/trpg-world/audit-capital-grades.mjs [--strict] [--out=report.json]
 * Thresholds are review targets, not additions to canonical world settings.
 */
import fs from 'node:fs';
import {CAPITAL,distance} from '../../public/capital-review/capital-data.js';
import {sampleLine,edgeHeightAt} from '../../public/capital-review/capital-surfaces.js';
const profiles=CAPITAL.edges.filter(e=>!['stairs','roof'].includes(e.class)).map(e=>{
 const points=sampleLine(e.points,2),samples=points.slice(1).map((p,i)=>({position:p,grade:Math.abs(edgeHeightAt(e,p)-edgeHeightAt(e,points[i]))/distance(p,points[i])}));
 const worst=samples.reduce((a,b)=>b.grade>a.grade?b:a,{grade:0});
 return {id:e.id,class:e.class,role:e.role,maxGrade:worst.grade,worstPosition:worst.position,targetGrade:.20,exceedsReviewTarget:worst.grade>.20};
}).sort((a,b)=>b.maxGrade-a.maxGrade);
const report={version:CAPITAL.version,method:'2m physical street-surface samples; 20% ordinary-street review ceiling; stairs and roof routes assessed separately',checked:profiles.length,exceedances:profiles.filter(p=>p.exceedsReviewTarget).length,profiles};
const output=process.argv.find(a=>a.startsWith('--out='));if(output)fs.writeFileSync(output.slice(6),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,profiles:profiles.slice(0,20)},null,2));
if(process.argv.includes('--strict')&&report.exceedances)process.exitCode=1;
