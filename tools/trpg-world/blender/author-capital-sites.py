"""Canonical everyday-site pilot. Coordinates are proposals, never spreadsheet facts.
Run against an existing plan/parcels pair into a NEW directory, preserving evidence.
"""
import json,sys,pathlib,math,importlib.util
from shapely.geometry import shape,Polygon,Point,LineString,mapping
from shapely.ops import nearest_points,unary_union
from shapely.geometry.polygon import orient
from shapely import constrained_delaunay_triangles
src=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
if (out/'plan.json').exists():raise RuntimeError('Existing study protected')
plan=json.loads((src/'plan.json').read_text());data=json.loads((src/'parcels.json').read_text())
spec=importlib.util.spec_from_file_location('arch',pathlib.Path(__file__).with_name('architectural-geometry.py'));arch=importlib.util.module_from_spec(spec);spec.loader.exec_module(arch)
source='https://docs.google.com/spreadsheets/d/15slftR2b-76VKaUqTisYolhN1iCpHeB7asUBoyMnmRk/edit'
proposals=[('LOC_CAP_ORPHANAGE','白鈴孤児院',(-330,-150),36,28,8,'west_market_life',['NPC021','NPC022','NPC071','NPC072'],23),('LOC_CAP_LOWER_INN','下層の安宿',(-660,-890),32,28,9,'lower_daily_loop',['NPC064','NPC025','NPC018'],19)]
facilities=[];removed=set()
for fid,name,target,width,depth,h,preferred,npcs,row in proposals:
 candidates=[]
 for p in data['parcels']:
  if p['groundM']!=14 or Point(shape(p['geometry']).centroid).distance(Point(target))>350:continue
  block=next(b for b in data['blocks']if b['id']==p['blockId']);boundary=shape(block['geometry'])
  a,b=p['frontagePoints'];length=math.dist(a,b);ux=(b[0]-a[0])/length;uy=(b[1]-a[1])/length
  cx=(a[0]+b[0])/2;cy=(a[1]+b[1])/2
  def rect(x0,x1,y0,y1):return Polygon([(cx+ux*x-uy*y,cy+uy*x+ux*y)for x,y in [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]])
  lot=rect(-width/2,width/2,.1,depth)
  if lot.difference(boundary.buffer(.02)).area>.01:continue
  candidates.append((Point(cx,cy).distance(Point(target))+(0 if p['frontageRouteId']==preferred else 80),p,cx,cy,ux,uy,lot))
 if not candidates:raise RuntimeError('No street-contained site for '+fid)
 _,p,cx,cy,ux,uy,lot=min(candidates,key=lambda q:q[0])
 def rect(x0,x1,y0,y1):return Polygon([(cx+ux*x-uy*y,cy+uy*x+ux*y)for x,y in [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]])
 wings=[rect(-width/2+1,width/2-1,depth-10,depth-1),rect(-width/2+1,-width/2+9,8,depth-10),rect(width/2-9,width/2-1,8,depth-10)]
 wings=[orient(w,sign=-1)for w in wings]
 road=next(r for r in plan['routes']if r['id']==p['frontageRouteId']);line=LineString([q[:2]for q in road['points']]);end=Point(cx-uy*(depth-10),cy+ux*(depth-10));front=Point(cx,cy);start=nearest_points(line,front)[0]
 walk=LineString([start,front,Point(cx-uy*(depth-12.1),cy+ux*(depth-12.1))]);corridor=walk.buffer(2,cap_style=2)
 if unary_union(wings).intersection(corridor).area>.01:raise RuntimeError('Entrance blocked')
 reservation=lot.union(corridor)
 for old in data['parcels']:
  if old['groundM']==14 and shape(old['geometry']).intersects(reservation):removed.add(old['id'])
 rid=fid+'_public_entry';points=[[x,y,14]for x,y in walk.coords]
 plan['routes'].append(dict(id=rid,kind='lane',width=4,points=points,z0=14,z1=14,lengthM=walk.length,grade=0,role='optional-life',canonicalFacilityId=fid))
 # Paved approach/court is actual geometry; the courtyard stays open to its street.
 paving=lot.difference(unary_union(wings)).union(corridor);v=[];f=[]
 for tri in constrained_delaunay_triangles(paving).geoms:
  i=len(v);v.extend([[x,y,14.15]for x,y in list(tri.exterior.coords)[:3]]);f.append([i,i+1,i+2])
 plan['meshes'].append(dict(name=fid+'_public_court',vertices=v,faces=f,material='lane'))
 entry=dict(id=fid,canonicalFacilityId=fid,blockId=p['blockId'],district='lower',frontageRouteId=p['frontageRouteId'],groundM=14,heightM=h,architecture='canonical-courtyard-study',frontageM=width,depthM=depth,frontagePoints=[[cx-ux*width/2,cy-uy*width/2],[cx+ux*width/2,cy+uy*width/2]],geometry=mapping(lot),footprint=mapping(wings[0]),footprints=[mapping(w)for w in wings],roofs=[arch.pitched_roof(w,14+h,'lower')for w in wings],door=dict(point=[end.x,end.y,14],along=[ux,uy],outward=[uy,-ux]))
 facilities.append(dict(id=fid,name=name,plot=mapping(lot),entryRouteId=rid,streetRouteId=p['frontageRouteId'],mainNpcIds=npcs,sourceRange=f"王都!A{row}:N{row}",coordinateStatus='PROPOSED',entry=entry))
 # State alternative shares exactly the orphanage plot; never duplicate it spatially.
 if fid=='LOC_CAP_ORPHANAGE':facilities[-1]['stateAlternative']={'id':'LOC_CAP_BIG_STORE','when':'T10 failure; after eviction','plot':mapping(lot),'sourceRange':'王都!A24:N24','implemented':False}
data['parcels']=[p for p in data['parcels']if p['id']not in removed]+[f['entry']for f in facilities]
for b in data['blocks']:b['parcelIds']=[i for i in b['parcelIds']if i not in removed]+[f['id']for f in facilities if f['entry']['blockId']==b['id']]
# Check every replacement footprint against all same-level public roads.
roads=unary_union([LineString([q[:2]for q in r['points']]).buffer(r['width']/2,join_style=2)for r in plan['routes']if r['z0']==r['z1']==14])
for facility in facilities:
 for footprint in facility['entry']['footprints']:
  if shape(footprint).intersection(roads).area>.01:raise RuntimeError('Facility obstructs street: '+facility['id'])
report=dict(status='UNACCEPTED TWO-SITE PILOT',sourceWorkbook=source,sourceReadDate='2026-10-07',facilities=[{k:v for k,v in f.items()if k!='entry'}for f in facilities],removedParcelCount=len(removed),limitations=['No NPC schedule implemented','Rear alley and office connection require further design','No enterable interiors','T10 alternate geometry not implemented','Remaining canonical facilities not placed by this pilot'])
data['facilityStudy']=report;data['audit']['parcelCount']=len(data['parcels']);plan['facilityStudy']=report
for name,value in [('plan.json',plan),('parcels.json',data),('canonical-sites-audit.json',report)]: (out/name).write_text(json.dumps(value,ensure_ascii=True,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(facilities=[f['id']for f in facilities],removed=len(removed),parcels=len(data['parcels']))))
