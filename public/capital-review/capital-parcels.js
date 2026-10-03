/** Surveyed street-facing plots. Shared facades, doors and setbacks are geometry,
 * not a nearest-road label added to an arbitrary building after placement. */
export function buildFrontageRows({streets,edges,districtsAt,distance,distanceToLine,add}){
 const rows=[];
 for(const e of streets.filter(e=>!e.bridgeId&&!['world','roof'].includes(e.class)))for(let segment=1;segment<e.points.length;segment++){
  const a=e.points[segment-1],b=e.points[segment],length=distance(a,b);if(length<14)continue;
  const dx=(b[0]-a[0])*1000/length,dy=(b[1]-a[1])*1000/length;
  const d=districtsAt([(a[0]+b[0])/2,(a[1]+b[1])/2]);
  const grain=d.id==='noble'?25:d.id==='lower'?11:d.id==='market'?15:18;
  const depth=d.id==='noble'?48:d.id==='lower'?38:d.id==='quay'?43:44;
  const floors=d.id==='lower'?3:d.id==='market'?5:d.id==='noble'?6:4;
  const gap=.85,setbackM=1.25;
  for(const side of [-1,1]){
   const row={id:e.id+':'+segment+':'+side,streetId:e.id,side,parcels:[],segment:[a,b]};
   const count=Math.max(1,Math.floor((length-12)/(grain+gap))),widthM=(length-12)/count-gap;
   for(let i=0;i<count;i++){
    const along=6+(widthM+gap)*i+widthM/2,offset=e.widthM/2+setbackM+depth/2;
    const position=[a[0]+(dx*along-dy*offset*side)/1000,a[1]+(dy*along+dx*offset*side)/1000];
    const front=[a[0]+(dx*along-dy*(e.widthM/2+setbackM)*side)/1000,a[1]+(dy*along+dx*(e.widthM/2+setbackM)*side)/1000];
    const street=edges.find(q=>(q.parentEdgeId||q.id)===e.id&&distanceToLine(front,q.points)<e.widthM/2+setbackM+.1);if(!street)continue;
    const profile=districtsAt(position),heightM=Math.max(profile.heightRangeM[0],Math.min(profile.heightRangeM[1],floors*3.2+(i%5===0?3.2:0)));
    const parcel={id:'plot_'+row.id+':'+i,frontageEdgeId:street.id,rowId:row.id,position,widthM,depthM:depth,heightM,rotationRad:Math.atan2(dy,dx),district:profile.id,color:profile.color,roofHeightM:5+(i%3),frontage:{position:front,side,setbackM,tangent:[dx,dy],doorWidthM:1.6}};
    if(add(parcel))row.parcels.push(parcel.id);
   }
   if(row.parcels.length)rows.push(row);
  }
 }
 return rows;
}
