"""Royal east pocket v6: unified, closed rock revetment UNDER extant eastern
escarpment/castle masonry base (156 m) and native Z112 low quarter ground.
Staging ONLY. Do not alter original roads or original structural meshes.
"""
import json,pathlib,math,hashlib
from shapely.geometry import Polygon,LineString,Point
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
raw=(root/'plan.json').read_bytes();plan=json.loads(raw)
meshes={x['name']:x for x in plan['meshes']}
def planar(name):
 m=meshes[name];v=m['vertices'];ps=[]
 for f in m['faces']:
  q=[v[i]for i in f]
  if max(a[2]for a in q)-min(a[2]for a in q)>.06:continue
  poly=Polygon([a[:2]for a in q])
  if poly.is_valid and poly.area>.05:ps.append(poly)
 return unary_union(ps)
low=planar('upper_city_ground')
castle=planar('castle_ground')
forecourt=planar('forecourt_ground')
knots=[(950,417.2),(967,417.2),(985,417.2),(1000,417.2),
       (1008,414.3),(1017,405.0),(1027,392.0),(1036,401.1),
       (1045,412.5),(1054,422.8),(1063,434.5),(1073,446.0),(1085,447.0)]
def crestAt(y):
 for (ya,xa),(yb,xb) in zip(knots,knots[1:]):
  if ya<=y<=yb:return xa+(xb-xa)*(y-ya)/(yb-ya)
 raise ValueError(y)
def toeAt(y):
 # Find physical native Z112 city ground along the SAME Y station,
 # not an unconstrained nearest neighbor that could turn the surface inside-out.
 ls=LineString([(425,y),(530,y)])
 part=low.intersection(ls)
 lines=([part]if part.geom_type=='LineString'
        else [a for a in getattr(part,'geoms',[]) if a.geom_type=='LineString'])
 if not lines:raise RuntimeError('Native ground unavailable at y='+str(y))
 x=min(min(a.coords[0][0],a.coords[-1][0])for a in lines)
 return x+2.0
stations=[]
for y in range(950,1086,3):
 crest=crestAt(y);toe=toeAt(y)
 assert crest+7.0<toe<(crest+95),(y,crest,toe)
 stations.append((float(y),float(crest),float(toe)))
if stations[-1][0]!=1085:stations.append((1085.,crestAt(1085),toeAt(1085)))
print('STATIONS',len(stations),'BOUNDS',stations[0],stations[-1],flush=True)
U=14
out=dict(name='repair_royal_east_pocket_integrated_rock_v7',material='royal_east_rock',
         vertices=[],faces=[])
under=dict(name='repair_royal_east_pocket_integrated_footbed_v7',material='ground',
         vertices=[],faces=[])
def append(m,verts,faces):
 k=len(m['vertices']);m['vertices'].extend([[float(x) for x in a]for a in verts])
 m['faces'].extend([[k+j for j in a]for a in faces])
def profile(y,u):
 z=112+44*(1-u)**1.28
 if u>0 and u<1:
  # Small coherent rock stratification; heights stay below castle parapet.
  wav=(1.1*math.sin(.21*y+17*u)+.85*math.sin(.087*y-33*u))
  z+=wav*math.sin(math.pi*u)**1.3
 return max(112,min(156,z))
top=[];bottom=[]
for i,(y,crest,toe) in enumerate(stations):
 a=[];b=[]
 for j in range(U+1):
  u=j/U;x=crest+(toe-crest)*u
  # Nonoverlapping XY grid, no direct connections to nearest foreign polygons.
  a.append(len(out['vertices']))
  out['vertices'].append([x,y,profile(y,u)])
  b.append(len(out['vertices']))
  out['vertices'].append([x,y,110.0])
 top.append(a);bottom.append(b)
def quad(a,b,c,d):
 # top triangulation orient consistent with +Z in local XY.
 out['faces'].extend([[a,d,b],[b,d,c]])
for i in range(len(stations)-1):
 for j in range(U):
  a=top[i][j];b=top[i+1][j];c=top[i+1][j+1];d=top[i][j+1]
  quad(a,b,c,d)
  e=bottom[i][j];f=bottom[i+1][j];g=bottom[i+1][j+1];h=bottom[i][j+1]
  out['faces'].extend([[e,f,h],[f,g,h]])
  append(under,[(out['vertices'][a][0],out['vertices'][a][1],112),
                (out['vertices'][b][0],out['vertices'][b][1],112),
                (out['vertices'][c][0],out['vertices'][c][1],112),
                (out['vertices'][d][0],out['vertices'][d][1],112)],
               [[0,1,3],[1,2,3]])
# Continuous lower Z110 plinth makes a SOLID under the exposed rock surface.
for i in range(len(stations)-1):
 for j in (0,U):
  a=top[i][j];b=top[i+1][j];c=bottom[i+1][j];d=bottom[i][j]
  out['faces'].extend([[a,d,b],[b,d,c]]if j==0 else [[a,b,d],[b,c,d]])
for i in (0,len(stations)-1):
 for j in range(U):
  a=top[i][j];b=top[i][j+1];c=bottom[i][j+1];d=bottom[i][j]
  out['faces'].extend([[a,b,d],[b,c,d]]if i==0 else [[a,d,b],[b,d,c]])
# Footprint audit and structural boundary checks before a pilot Blender scene.
from shapely.geometry import shape
parcels=json.loads((root/'parcels.json').read_text('utf8'))['parcels']
v2=[(row[1],row[0])for row in stations]+[(row[2],row[0])for row in reversed(stations)]
footprint=Polygon(v2)
assert footprint.is_valid,footprint.is_valid
overlap=footprint.intersection(low).area
assert overlap>25,overlap
buildings=[]
for parcel in parcels:
 geometry=shape(parcel['geometry'])
 if not geometry.intersects(footprint):continue
 area=geometry.intersection(footprint).area
 if area>10:
  buildings.append((parcel['id'],round(area,2),parcel.get('district')))
print('FOOTPRINT',round(footprint.area,1),'NATIVE_LOW_OVERLAP',round(overlap,1),'BUILDING_PARCELS',len(buildings),buildings[:30],flush=True)
# Geometry ends on original upper rock and castle, not a free-floating artificial loft.
route_ids=['current_castle_east_stone_stairs','current_castle_east_winch_ramp']
original_routes={r['id']:r for r in plan['routes']}
assert all(k in original_routes for k in route_ids)
assert all(112<=z[2]<=204 for z in out['vertices'] if z[2]!=110)
assert len(stations)>=40
# Save precisely to staged files, never to current/plan.json or current live .blend.
plan['meshes'].extend([out,under])
plan['royalEastIntegratedV7']={
 'status':'PENDING_156M_FOUNDATION_QA','sourcePlanSHA256':hashlib.sha256(raw).hexdigest(),
 'target':'castle east escarpment X竕・90..475, Y950..1085',
 'meshNames':[out['name'],under['name']],
 'meshCounts':[(len(q['vertices']),len(q['faces'])) for q in (out,under)],
 'nativeLowOverlapM2':round(overlap,1),'constructionFootprintM2':round(footprint.area,1),
 'intersectingParcelAreaGt10m2':buildings,
 'crestSegments':knots,'rowCount':len(stations),
 'risks':['Z156 wall footing to Z112 city foundation; needs silhouette and stonework design acceptance',
          'Existing building overlap requires examination before any promotion',
          'Existing retaining asset overlap requires 3D inspection',
          'Static local route clearance plus ground contact are not NPC swept capsule'],
 'unchangedRouteCount':len(plan['routes'])}
(root/'royal-east-integrated-v7.staged.plan.json').write_text(json.dumps(plan,separators=(',',':')),encoding='utf8')
(root/'royal-east-integrated-v7.study.json').write_text(json.dumps(plan['royalEastIntegratedV7'],indent=2,ensure_ascii=False),encoding='utf8')
print('V6_READY',plan['royalEastIntegratedV7']['meshCounts'],flush=True)
