"""B100: first structural repair of mage east missing terrace floor, plus
court-linked arcane research precinct. Existing B99 is read-only; changes
are provisional and require visual + collision validation.
"""
import json,pathlib,sys,math,random
from shapely.geometry import shape,Polygon,box,LineString,Point
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('B100 already exists')
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
existing={m['name']for m in p['meshes']}
def mesh(name,vertices,faces,material):
 name='b100_'+name
 if name in existing:raise RuntimeError('Duplicate '+name)
 p['meshes'].append(dict(name=name,vertices=vertices,faces=faces,material=material))
def wall(name,a,b,z,h=6,t=.8,mat='stone'):
 dx=b[0]-a[0];dy=b[1]-a[1];l=math.hypot(dx,dy)
 if l<.05:return
 nx=-dy/l*t/2;ny=dx/l*t/2
 q=[[a[0]-nx,a[1]-ny,z],[b[0]-nx,b[1]-ny,z],
    [b[0]+nx,b[1]+ny,z],[a[0]+nx,a[1]+ny,z]]
 v=q+[[x,y,z+h]for x,y,_ in q]
 fs=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
 mesh(name,v,fs,mat)
def slab_poly(name,poly,z,mat):
 if poly.is_empty:return 0
 pieces=[poly]if poly.geom_type=='Polygon'else [g for g in getattr(poly,'geoms',[]) if g.geom_type=='Polygon']
 verts=[];faces=[]
 for piece in pieces:
  if piece.area<.05:continue
  triangles=constrained_delaunay_triangles(piece)
  for tri in triangles.geoms:
   if tri.area<.01:continue
   k=len(verts)
   verts.extend([[x,y,z]for x,y in list(tri.exterior.coords)[:3]])
   faces.append([k,k+1,k+2])
 mesh(name,verts,faces,mat)
 return len(faces)
def roofed_hall(name,cx,cy,w,depth,height=12):
 z=70
 # Distinguishable institutional masonry, narrow pilasters, a pitched ridge.
 a=(cx-w/2,cy-depth/2);b=(cx+w/2,cy-depth/2)
 c=(cx+w/2,cy+depth/2);f=(cx-w/2,cy+depth/2)
 for idx,(u,v) in enumerate([(a,b),(b,c),(c,f),(f,a)]):
  wall(name+'_wall_'+str(idx),u,v,z,height,1.0)
 vertices=[[a[0]-1,a[1]-1,z+height],[b[0]+1,b[1]-1,z+height],
   [b[0]+1,c[1]+1,z+height],[a[0]-1,c[1]+1,z+height],
   [cx,a[1]-1,z+height+5],[cx,c[1]+1,z+height+5]]
 mesh(name+'_gabled_roof',vertices,[[0,1,4],[3,5,2],[0,4,5,3],[4,1,2,5]],'wood')
 for idx,xx in enumerate([a[0]+3,b[0]-3]):
  for yy in [a[1]+3,c[1]-3]:
   wall(name+'_buttress_'+str(idx)+'_'+str(round(yy)),(xx,yy),(xx+.45,yy),z,height+1.4,1.2)
 for idx in range(2):
  x=cx-w/4*(1 if idx==0 else -1)
  wall(name+'_gable_pier_'+str(idx),(x,a[1]-1.25),(x+.55,a[1]-1.25),z,height-2,1.1)
def mark_post(name,x,y,z=70,h=8):
 wall(name,(x-.5,y),(x+.5,y),z,h,1.05,'stone')
def line_segment(a,b,forbid,opening):
 seg=LineString([a,b])
 div=seg.difference(forbid.buffer(opening))
 return [g for g in ([div]if div.geom_type=='LineString'else getattr(div,'geoms',[])) if g.geom_type=='LineString'and g.length>1.6]
zone='mage_east';z=70
domain=shape(next(v['geometry']for v in p['landDomains']if v['id']==zone)).buffer(0)
surfaces=[]
for m in p['meshes']:
 vs=m['vertices']
 if not vs or len(vs)>35000:continue
 if max(q[2]for q in vs)<z-.15 or min(q[2]for q in vs)>z+.5:continue
 if max(q[0]for q in vs)<750 or min(q[0]for q in vs)>1350:continue
 if max(q[1]for q in vs)<350 or min(q[1]for q in vs)>980:continue
 for f in m['faces']:
  q=[vs[i]for i in f]
  if min(a[2]for a in q)<z-.15 or max(a[2]for a in q)>z+.5:continue
  g=Polygon([a[:2]for a in q])
  if g.area>.01 and g.is_valid:surfaces.append(g)
missing=domain.difference(unary_union(surfaces)).buffer(0)
areas=sorted([g for g in (list(missing.geoms)if hasattr(missing,'geoms')else [missing])if g.geom_type=='Polygon'and g.area>100],key=lambda q:-q.area)
filled=0
for i,q in enumerate(areas):
 slab_poly('mage_missing_terrace_floor_'+str(i),q,z+.02,'ground')
 filled+=q.area
 # Supported reconstituted plateau section, not a zero-thickness floating sheet.
 # Vertical perimeter into the bedrock with a continuous underdeck.
 outlines=[q.exterior]+list(q.interiors)
 for j,ring in enumerate(outlines):
  coords=list(ring.coords)
  verts=[];faces=[]
  for a,b in zip(coords,coords[1:]):
   k=len(verts)
   verts.extend([[a[0],a[1],14],[b[0],b[1],14],[b[0],b[1],z+.02],[a[0],a[1],z+.02]])
   faces.append([k,k+1,k+2,k+3])
  mesh('mage_missing_terrace_foundation_'+str(i)+'_'+str(j),verts,faces,'stone')
# Institution campus with multiple paths retained and ceremonial landmarks, not a standalone retail tower.
precinct=box(990,570,1130,735)
routes=[(r,LineString([q[:2]for q in r['points']])) for r in p['routes']
        if r['z0']==70 and r['z1']==70 and LineString([q[:2]for q in r['points']]).intersects(precinct.buffer(25))]
street_union=unary_union([line.buffer(r['width']/2+5,cap_style=2)for r,line in routes])
tower=box(1021,621,1079,679)
footprints=[];candidate=[]
for cx in range(1006,1125,6):
 for cy in range(586,728,6):
  for w,depth in [(30,20),(25,23),(20,18)]:
   test=box(cx-w/2-3,cy-depth/2-3,cx+w/2+3,cy+depth/2+3)
   if not precinct.buffer(-6).contains(test)or tower.buffer(8).intersects(test):continue
   if street_union.intersects(test):continue
   if any(g.buffer(10).intersects(test)for g in footprints):continue
   candidate.append((test.distance(street_union)+.003*(cx-1050)**2,cx,cy,w,depth,test))
candidate.sort(reverse=True)
for rank,(_,cx,cy,w,depth,test)in enumerate(candidate):
 if any(test.buffer(13).intersects(a)for a in footprints):continue
 footprints.append(test)
 roofed_hall(['scribe_archive','royal_ritual_annex','court_guard_station','arcane_barracks'][len(footprints)-1],
            cx,cy,w,depth,10+len(footprints)*1.5)
 if len(footprints)>=4:break
if len(footprints)<2:raise RuntimeError('Insufficient royal campus halls; never ship a tower-only campus')
# Grand open court and processional approach preserve centreline roads.
# Institutional guard posts are on plotted open locations away from streets.
posts=[]
for cx,cy in [(986,577),(1133,579),(987,730),(1134,732)]:
 if Point(cx,cy).distance(street_union)<4:continue
 mark_post('royal_precinct_marker_'+str(len(posts)),cx,cy)
 posts.append((cx,cy))
# Perimeter stone colonnade; passageways break the fence at every public route.
bounds=list(precinct.exterior.coords)
for j,(a,b) in enumerate(zip(bounds,bounds[1:])):
 for idx,seg in enumerate(line_segment(a,b,street_union,3)):
  p0,p1=list(seg.coords)
  wall('royal_perimeter_'+str(j)+'_'+str(idx),p0,p1,z,4.2,1.1)
# Significance marker in front of tower, symbolic plinth, not an invented plot item.
openpoints=[]
for cx in range(1025,1080,8):
 for cy in range(580,734,8):
  t=Point(cx,cy)
  if tower.buffer(6).contains(t) or street_union.buffer(3).intersects(t):continue
  if any(t.distance(g)<5 for g in footprints):continue
  openpoints.append((t.distance(Point(1050,650)),cx,cy))
if openpoints:
 _,cx,cy=sorted(openpoints)[0]
 verts=[[cx-3,cy-3,70.15],[cx+3,cy-3,70.15],[cx+3,cy+3,70.15],[cx-3,cy+3,70.15]]
 mesh('mage_royal_emblem_pedestal',verts,[[0,1,2,3]],'stone')
# Remove generic massing only from the building programme's buildable plots.
# Preserve every route, all canonical IDs, and B99 scripts.
removed=[]
for parcel in d['parcels']:
 if shape(parcel['geometry']).intersects(precinct):
  if parcel.get('canonicalFacilityId'):raise RuntimeError('Canonical parcel in royal precinct')
  removed.append(parcel['id'])
removedset=set(removed)
d['parcels']=[q for q in d['parcels']if q['id'] not in removedset]
for block in d['blocks']:block['parcelIds']=[i for i in block['parcelIds']if i not in removedset]
d['audit']['parcelCount']=len(d['parcels'])
report=dict(status='WIP_REQUIRES_3D_QA',base=src.name,
    sourceProblem='Terrace voids visible from Blender screenshots near mage_east and royal terraces',
    mageTerraceMissingBeforeM2=sum(g.area for g in areas),
    mageTerraceFloorFilledM2=filled,componentsRebuilt=len(areas),
    campusBounds=list(precinct.bounds),mageTowerId='LOC_CAP_MAGE_TOWER',
    campusModules=['existing main tower','scribe archives','ritual annex','guard service','stone ceremonial frontage'],
    halls=len(footprints),removedOrdinaryParcels=removed,
    streetRoutesPreserved=[r['id']for r,line in routes],
    newMeshes=[m['name']for m in p['meshes']if m['name'] not in existing],
    limitations=['Upper_city sidewall remains separately unresolved',
      'Castle geometry requires fundamental redesign',
      'Old long ramps remain unresolved','No NPC/runtime',
      'Campus modules are layout proposals, not newly canonized facilities'])
p['courtAndTerrainB100']=report
out.mkdir()
for n,v in [('plan.json',p),('parcels.json',d),('court-terrain-study.json',report)]:
 (out/n).write_text(json.dumps(v,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(out=str(out),terraceArea=round(filled),holes=len(areas),
   halls=len(footprints),plotsRemoved=len(removed),newMeshes=len(report['newMeshes']))))
