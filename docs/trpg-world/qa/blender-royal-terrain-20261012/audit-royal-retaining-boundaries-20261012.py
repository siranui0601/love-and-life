import json,pathlib,math,collections
from shapely.geometry import Polygon,Point,LineString,MultiLineString
from shapely.ops import unary_union
from shapely.strtree import STRtree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
data=json.loads((root/'plan.json').read_text('utf8'));ms={m['name']:m for m in data['meshes']}
def ground(n):
 m=ms[n];V=m['vertices'];P=[]
 for f in m['faces']:
  vs=[V[i] for i in f]
  if max(v[2]for v in vs)-min(v[2]for v in vs)>.1:continue
  g=Polygon([v[:2]for v in vs])
  if g.is_valid and g.area>.1:P.append(g)
 return unary_union(P)
levels={n:ground(n)for n in ['castle_ground','forecourt_ground','upper_city_ground','civic_foot_ground','low_city_ground','noble_west_ground']}
for n,g in levels.items():print('LEVEL',n,g.geom_type,len(getattr(g,'geoms',[g])),'area',round(g.area),'bounds',tuple(round(v)for v in g.bounds),flush=True)
walls=collections.defaultdict(list)
cnt=collections.Counter()
for m in data['meshes']:
 vs=m['vertices'];faces=m['faces'];name=m['name']
 if not vs or not faces:continue
 b=(min(q[0]for q in vs),min(q[1]for q in vs),max(q[0]for q in vs),max(q[1]for q in vs))
 if b[2]<-80 or b[0]>600 or b[3]<740 or b[1]>1390:continue
 z0=min(v[2]for v in vs);z1=max(v[2]for v in vs)
 if z1-z0<12:continue
 if z1<153:continue
 for f in faces:
  if len(f)<3:continue
  v=[vs[i] for i in f]
  zv=[x[2] for x in v]
  if max(zv)-min(zv)<12:continue
  top=max(zv);bot=min(zv)
  for target in (204,156,112,78):
   if top<target-1.0 or bot>target-1.0:continue
   near=[q for q in v if abs(q[2]-target)<1.0]
   if len(near)!=2:continue
   if math.dist(near[0][:2],near[1][:2])<.15:continue
   seg=LineString([near[0][:2],near[1][:2]])
   if seg.length>.1:walls[target].append((seg,name,bot,top));cnt[(target,name)]+=1
for target in walls:
 print('WALL_LEVEL',target,'SEGMENTS',len(walls[target]),'TOP_NAMES',cnt.most_common(20))
for target,gn in ((204,'castle_ground'),(156,'forecourt_ground'),(112,'upper_city_ground')):
 g=levels[gn]; b=g.boundary
 parts=[b]if b.geom_type=='LineString' else list(b.geoms)
 perimeter=sum(z.length for z in parts)
 wallsegments=[x[0]for x in walls.get(target,[])]
 if not wallsegments:continue
 cover=unary_union(wallsegments)
 samples=[]
 for comp in parts:
  for i in range(math.ceil(comp.length/2)):
   pt=comp.interpolate(min(comp.length,i*2+1))
   nearest=cover.distance(pt)
   samples.append([round(pt.x,1),round(pt.y,1),round(nearest,1),round(comp.length)])
 far=[x for x in samples if x[2]>3]
 grouped=collections.Counter((int(x[0]//50)*50,int(x[1]//50)*50)for x in far)
 print('PERIMETER',gn,round(perimeter),'samples',len(samples),'uncovered',len(far),'ratio',round(len(far)/len(samples),3),'GROUPED',grouped.most_common(18),'sampleFar',far[:20])
 (root/f'audit-royal-exposed-boundary-{target}-20261012.json').write_text(json.dumps({'ground':gn,'sampled':len(samples),'uncoveredDistanceGt3m':far},indent=2))
