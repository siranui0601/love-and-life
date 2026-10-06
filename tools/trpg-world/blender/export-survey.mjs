/** Existing-city survey only; never the authored Blender replacement. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {CAPITAL,toLocal,groundElevationAt} from '../../../public/capital-review/capital-data.js';
import {sampleLine,edgeHeightAt} from '../../../public/capital-review/capital-surfaces.js';
const output=path.resolve(process.argv[2]||'artifacts/capital-blender/survey.json');
const xyz=(p,h)=>{const [x,z]=toLocal(p);return [x,-z,h];};
const streets=CAPITAL.edges.map(e=>({id:e.id,from:e.from,to:e.to,kind:e.class,widthM:e.widthM,role:e.designRole,gateTag:e.gateTag,points:sampleLine(e.points,4).map(p=>xyz(p,edgeHeightAt(e,p)))}));
const core=CAPITAL.core.polygon,xs=core.map(p=>p[0]),ys=core.map(p=>p[1]);
const terrain={vertices:[],faces:[]},n=160;
for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const p=[Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*i/n,Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*j/n];terrain.vertices.push(xyz(p,groundElevationAt(...p)));}
for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;terrain.faces.push([a,a+1,b+1,b]);}
const survey={status:'EXISTING SURVEY — NOT ACCEPTED DESIGN',units:'metres',axis:'X east, Y north, Z up',coreAreaKm2:CAPITAL.core.areaKm2,streets,terrain,
 facilities:CAPITAL.facilities.map(f=>({id:f.id,position:xyz(f.buildingPosition||f.position,groundElevationAt(...(f.buildingPosition||f.position)))})),
 walls:CAPITAL.walls.map(w=>({id:w.id,widthM:w.widthM,heightM:w.heightM,points:sampleLine(w.points,5).map(p=>xyz(p,groundElevationAt(...p)))})),
 rivers:CAPITAL.rivers.map(r=>({id:r.id,widthM:r.widthM,points:sampleLine(r.points,8).map(p=>xyz(p,groundElevationAt(...p)))}))};
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(survey));console.log(JSON.stringify({output,streets:streets.length,facilities:survey.facilities.length}));
