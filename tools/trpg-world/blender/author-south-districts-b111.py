"""B111 South lower-city experience replan. Transform repetitive residential
massing into four located, street-connected civic/craft places. No canonical
facility IDs are created or deleted. Based on B107, not rejected B108/B109.
"""
import json,math,pathlib,sys,shutil
from shapely.geometry import shape,box,Polygon,Point,LineString
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Refuse overwriting existing B111')
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
Z=14.0
sites=[
 dict(id='south_arrival',label='south gate caravan arrival court',center=(-92,-990),half=(72,60),theme='ochre',size=7),
 dict(id='western_commons',label='lower western commons well and public bell',center=(-500,-920),half=(65,57),theme='civic',size=5),
 dict(id='ajin_craft',label='south eastern metal and cloth artisans work yard',center=(300,-990),half=(71,60),theme='craft',size=6),
 dict(id='river_works',label='river-adjacent timber rope and cargo work yard',center=(650,-750),half=(68,58),theme='river',size=5)]
new=[]
def mesh(name,verts,faces,mat):
 if not verts or not faces:return
 title='b111_'+name
 p['meshes'].append(dict(name=title,vertices=verts,faces=faces,material=mat));new.append(title)
def prism(name,cx,cy,w,d,z,h,mat='civic_stone'):
 a=cx-w/2;b=cx+w/2;c=cy-d/2;e=cy+d/2
 v=[[a,c,z],[b,c,z],[b,e,z],[a,e,z],[a,c,z+h],[b,c,z+h],[b,e,z+h],[a,e,z+h]]
 f=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
 mesh(name,v,f,mat)
def hall(name,cx,cy,w,d,h,roofmat):
 prism(name+'_walls',cx,cy,w,d,Z,h,'civic_stone')
 x0=cx-w/2-1;x1=cx+w/2+1
 y0=cy-d/2-1;y1=cy+d/2+1;zt=Z+h
 v=[[x0,y0,zt],[x1,y0,zt],[x1,y1,zt],[x0,y1,zt],
   [cx,y0,zt+min(9,w*.3)],[cx,y1,zt+min(9,w*.3)]]
 mesh(name+'_roof',v,[[0,1,4],[3,5,2],[0,4,5,3],[4,1,2,5]],roofmat)
 # distinctive piers and load-bearing bays; different from anonymous houses
 for k,xx in enumerate([cx-w*.35,cx+w*.35]):
  prism(name+'_piers_'+str(k),xx,y0,1.6,1.6,Z,h+1.8,'civic_light')
def paved(name,poly,mat):
 if poly.is_empty:return 0
 vv=[];ff=[];area=0.
 pieces=[poly]if poly.geom_type=='Polygon'else [g for g in getattr(poly,'geoms',[])if g.geom_type=='Polygon']
 for part in pieces:
  if part.area<3:continue
  for tri in constrained_delaunay_triangles(part).geoms:
   if tri.area<.15:continue
   idx=len(vv);vv.extend([[x,y,Z+.12]for x,y in list(tri.exterior.coords)[:3]])
   ff.append([idx,idx+1,idx+2]);area+=tri.area
 mesh(name,vv,ff,mat);return area
def choose_rect(buildable,target,w,d,taken):
 bx,by=target;opts=[]
 minx,miny,maxx,maxy=buildable.bounds
 for x in range(math.floor(minx+8),math.ceil(maxx-8),4):
  for y in range(math.floor(miny+8),math.ceil(maxy-8),4):
   rect=box(x-w/2-1.5,y-d/2-1.5,x+w/2+1.5,y+d/2+1.5)
   if not buildable.contains(rect):continue
   if any(rect.intersects(prior.buffer(.75))for prior in taken):continue
   opts.append((math.dist([x,y],[bx,by]),x,y))
 if not opts:return None
 _,x,y=min(opts)
 taken.append(box(x-w/2-1.5,y-d/2-1.5,x+w/2+1.5,y+d/2+1.5))
 return (x,y)
# Existing road geometry remains exactly as it was. New landmarks must not
# interrupt any existing route, from alleys to arterial.
roads=[]
for rr in p['routes']:
 if min(rr['z0'],rr['z1'])>14.5 or max(rr['z0'],rr['z1'])<13.5:continue
 if not rr['points'] or len(rr['points'])<2:continue
 roads.append((rr,LineString([v[:2]for v in rr['points']])))
removals=set();meta=[]
for site in sites:
 cx,cy=site['center'];hw,hd=site['half']
 domain=box(cx-hw,cy-hd,cx+hw,cy+hd)
 running=[(rr,line)for rr,line in roads if line.intersects(domain.buffer(10))]
 if len(running)<3:raise RuntimeError('Public-site not connected '+site['id'])
 corridors=unary_union([line.buffer(rr['width']/2+2.5,cap_style=2)for rr,line in running])
 open_area=domain.difference(corridors).buffer(0)
 main_route_ids=[rr['id']for rr,line in running]
 # Intentional negative space; stone plaza is limited to building-free plots,
 # road surfaces stay unclipped and unchanged at ground Z14.
 paved_area=paved(site['id']+'_permeable_square',open_area,'b111_paving_'+site['theme'])
 if paved_area<250:raise RuntimeError('Too little public space '+site['id'])
 affected=[]
 for lot in d['parcels']:
  geom=shape(lot['geometry'])
  if not geom.intersects(domain):continue
  if lot.get('canonicalFacilityId'):raise RuntimeError('No canonical removal: '+lot['id'])
  removals.add(lot['id']);affected.append(lot['id'])
 # Crown is one street-connected landmark, not stockhouses scattered densely.
 taken=[Point(cx,cy).buffer(14)]
 b=choose_rect(open_area,(cx+hw*.54,cy+hd*.50),24,16,taken)
 if not b:b=choose_rect(open_area,(cx-hw*.54,cy-hd*.55),19,15,taken)
 if b:hall(site['id']+'_public_work_hall',*b,24 if b[0]>cx else 19,16 if b[0]>cx else 15,15+site['size'], 'b111_roof_'+site['theme'])
 else:raise RuntimeError('No room for landmark hall '+site['id'])
 # Handcrafted district-specific objects, only on walkable non-road lots.
 modules=[]
 def position(dx,dy,w=3,d=3):
  point=choose_rect(open_area,(cx+dx,cy+dy),w,d,taken)
  if point is None:raise RuntimeError('Module placement unavailable '+site['id'])
  return point
 if site['id']=='south_arrival':
  # Two distinct gatehouse flanks, road itself remains uninterrupted.
  for j,dx in enumerate((-34,34)):
   x,y=position(dx,18,12,12)
   prism(site['id']+'_guard_lodge_'+str(j),x,y,12,12,Z,20,'civic_stone')
   prism(site['id']+'_slate_top_'+str(j),x,y,13,13,Z+20,3,'b111_roof_ochre')
   modules.append((x,y))
  x,y=position(-42,-25,18,6)
  hall(site['id']+'_caravan_hitching_shed',x,y,18,6,6,'b111_roof_craft')
  for j in range(4):
   x,y=position(-53+j*11,-33,2,2)
   prism(site['id']+'_hitching_block_'+str(j),x,y,2,2,Z,1.4,'civic_light')
 elif site['id']=='western_commons':
  x,y=position(0,4,8,8)
  prism(site['id']+'_stone_well',x,y,8,8,Z,1.6,'civic_light')
  for j in range(4):
   x,y=position(-45+j*27,-25,8,6)
   prism(site['id']+'_trading_table_'+str(j),x,y,8,6,Z,1.2,'civic_wood')
  x,y=position(42,32,3,3)
  prism(site['id']+'_public_bell_pier',x,y,3,3,Z,28,'civic_stone')
  prism(site['id']+'_bell_crown',x,y,7,7,Z+27,3,'b111_roof_civic')
 elif site['id']=='ajin_craft':
  x,y=position(34,-24,14,14)
  prism(site['id']+'_foundry_kiln_core',x,y,14,14,Z,8,'b111_baked_clay')
  prism(site['id']+'_brick_chimney',x,y,4,4,Z+8,21,'b111_baked_clay')
  x,y=position(-44,22,19,10)
  hall(site['id']+'_clothworkers_loft',x,y,19,10,10,'b111_roof_craft')
  for j in range(6):
   x,y=position(-58+j*18,-45,2,12)
   prism(site['id']+'_drying_frame_'+str(j),x,y,2,12,Z,4.2,'civic_wood')
 elif site['id']=='river_works':
  x,y=position(30,30,25,12)
  hall(site['id']+'_boatwright_long_shed',x,y,25,12,11,'b111_roof_river')
  for j in range(6):
   x,y=position(-54+j*18,10,3,11)
   prism(site['id']+'_rope_trestle_'+str(j),x,y,3,11,Z,2.3,'civic_wood')
  x,y=position(42,-30,16,11)
  prism(site['id']+'_cargo_pile_platform',x,y,16,11,Z,.8,'civic_light')
 # Purposeful perimeter urban mass: craft homes, offices, side ateliers, stores.
 # Street-facing frontage is rebuilt before placing small props; site-specific
 # civic identity is expressed by street-edge masses, height and roof rhythm.
 linked_frontage=[]
 targets=[(-.78,-.76),(-.50,-.78),(-.18,-.82),(.18,-.81),(.52,-.77),(.80,-.70),
          (-.79,-.38),(.79,-.38),(-.80,.04),(.80,.04),(-.77,.45),(.76,.43),
          (-.74,.78),(-.38,.76),(.05,.76),(.43,.74),(.74,.73)]
 for j,(u,v) in enumerate(targets):
  # Architectural rhythm: small service doors interspersed with large lofts.
  w=11+(j%3)*2;dep=8+((j+site['size'])%3)*2
  spot=choose_rect(open_area,(cx+u*hw*.83,cy+v*hd*.83),w,dep,taken)
  if not spot:continue
  h=9+(j%4)*3+(3 if site['id']=='ajin_craft' and j%3==0 else 0)
  hall(site['id']+'_street_front_'+str(j),*spot,w,dep,h,
       ['b111_roof_'+site['theme'],'b111_roof_civic','b111_roof_craft'][j%3])
  linked_frontage.append(dict(plot=spot,width=w,depth=dep,height=h))
 if len(linked_frontage)<6:raise RuntimeError('Insufficient mixed-use frontage '+site['id'])
 # Navigational hooks and play-space intentions are metadata, not fake NPCs.
 meta.append(dict(id=site['id'],label=site['label'],bbox=list(domain.bounds),
  location=site['center'],preservedRoutes=len(running),routeIds=main_route_ids,
  removedOrdinaryPlots=len(affected),pavedSqM=round(paved_area),
  landmarkHall=b,addedModules=modules,streetFrontBuildings=linked_frontage))
drop=removals
d['parcels']=[q for q in d['parcels'] if q['id'] not in drop]
for block in d['blocks']:block['parcelIds']=[pid for pid in block['parcelIds']if pid not in drop]
d['audit']['parcelCount']=len(d['parcels'])
report=dict(base=src.name,status='WIP_VISUAL_AND_TRAVERSAL_QA_REQUIRED',areas=meta,
 removedOrdinaryPlots=len(removals),removedCanonicalFacilities=0,addedMeshes=new,
 intendedLoop='south gate→caravan arrival→western commons→ajin craft hall→river work yard',
 preservedRouteCount=len(p['routes']),
 limits=['No placed NPC/quests/interactions; landmarks are scenic and spatial concepts',
         'Courtyards need night/eye-view/collision testing, internal furnishing',
         'Old castle/mage and other unanswered areas remain WIP'])
p['southernCityB111']=report
out.mkdir()
for name,val in [('plan.json',p),('parcels.json',d),('south-district-plan.json',report)]:
 (out/name).write_text(json.dumps(val,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(output=str(out),removedOrdinaryPlots=len(removals),canonicalRemoved=0,meshCount=len(new),
 plazas=[(q['id'],q['pavedSqM'])for q in meta])))

