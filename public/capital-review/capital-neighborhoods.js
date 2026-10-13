import {buildStreetBlocks} from './capital-blocks.js';

/** Lowland lanes are subdivisions of land enclosed by the inherited streets.
 * The castle's contour rings are not extended over flat river neighbourhoods.
 * Re-survey faces after each subdivision round, so no street is placed through
 * a fictional rectangular block or added after building generation.
 */
export function subdivideLowland({edges,walls,core,inside,distance,legal,node,edge,district,added}){
 let serial=0;
 for(let pass=0;pass<6;pass++){
  const blocks=buildStreetBlocks({edges,walls,core,inside});let changed=0;
  for(const block of blocks){
   const ps=block.polygon,centre=ps.reduce((s,p)=>s.map((v,i)=>v+p[i]/ps.length),[0,0]);
   if(centre[1]>21.92||!inside(centre,ps))continue;
   const id=district(centre),target=id==='lower'||id==='ajin'?6500:id==='market'?9000:13000;
   if(block.areaM2<target)continue;
   let longest=0,angle=0;
   for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],len=distance(a,b);if(len>longest){longest=len;angle=Math.atan2(b[1]-a[1],b[0]-a[0]);}}
   // A local frame inherited from the block edge, not a city-wide grid.
   const normal=[Math.cos(angle),Math.sin(angle)],tangent=[-normal[1],normal[0]],projection=p=>p[0]*normal[0]+p[1]*normal[1],values=ps.map(projection),lo=Math.min(...values),hi=Math.max(...values),fraction=[.44,.55,.48,.59][(serial+pass)%4],cut=lo+(hi-lo)*fraction,hits=[];
   for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],u=projection(a)-cut,v=projection(b)-cut;if((u<0)===(v<0))continue;const t=u/(u-v);hits.push(a.map((x,k)=>x+(b[k]-x)*t));}
   hits.sort((a,b)=>(a[0]-b[0])*tangent[0]+(a[1]-b[1])*tangent[1]);
   for(let i=1;i<hits.length;i+=2){const a=hits[i-1],b=hits[i],len=distance(a,b);if(len<28||len>1000)continue;
    const mid=a.map((v,k)=>(v+b[k])/2+normal[k]*((serial%3)-1)*.004),points=[a,mid,b];
    if(!inside(mid,ps)||!legal(points))continue;
    const from=node('lowland_'+serial+'_a','街区裏の生活辻',a,district(a),'junction'),to=node('lowland_'+serial+'_b','街区裏の生活辻',b,district(b),'junction');
    added.push(edge(from.id,to.id,'街区を分ける生活路・荷解き裏道',serial%4===0?'service':'alley',{id:'lowland_lane_'+serial,via:[mid],widthM:serial%4===0?5.5:id==='lower'?3.6:4.2,fabric:true,fabricRole:'block-subdivision',designRole:serial%4===0?'service-logistics':'optional-life',reason:'門・河岸・既存幹線で囲まれた土地を分け、住宅入口と店舗裏口をつなぐ。'}));serial++;changed++;
   }
  }
  if(!changed)break;
 }
 return serial;
}
