import json,pathlib,math
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union,nearest_points
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
raw=(root/'royal-east-pocket-20261012.v4.staged.plan.json').read_bytes()
plan=json.loads(raw);M={m['name']:m for m in plan['meshes']}
def surface(name):
 o=M[name];v=o['vertices'];q=[]
 for f in o['faces']:
  verts=[v[i]for i in f]
  if max(t[2]for t in verts)-min(t[2]for t in verts)>.08:continue
  g=Polygon([t[:2]for t in verts])
  if g.is_valid and g.area>.1:q.append(g)
 return unary_union(q)
higher={'royal':surface('castle_ground'),'court':surface('forecourt_ground')}
rows=plan['royalEastPocketRock20261012']['rows']
ridge=[];anchors=[];source=[]
for i,(y,x,z,lowX)in enumerate(rows):
 where='court'if i<=2 else 'royal'
 p=Point(x,y)
 q=nearest_points(p,higher[where])[1]
 anchor=q.coords[0]
 dist=p.distance(q)
 print('LINK',i,where,(x,y,z),tuple(round(t,2)for t in anchor),'gap',round(dist,2),flush=True)
 if dist>70:raise RuntimeError('Too long mount '+str(i))
 ridge.append((x,y,z));anchors.append((anchor[0],anchor[1],156 if where=='court'else 204))
 source.append(where)
# Generate a rock prism between native terrace and the detached cap.
rock=dict(name='repair_royal_east_pocket_terrace_rim_anchors_20261012',vertices=[],faces=[],material='royal_east_bedrock_dark')
floor=dict(name='repair_royal_east_pocket_rim_underfloor_20261012',vertices=[],faces=[],material='ground')
def emit(g,V,faces):
 j=len(g['vertices']);g['vertices'].extend([list(map(float,q))for q in V])
 g['faces'].extend([[j+k for k in f]for f in faces])
for i in range(len(rows)-1):
 a,b=ridge[i],ridge[i+1];c,d=anchors[i+1],anchors[i]
 # 3D connected masonry infill. No slender pylons or bare floating roofs.
 a0=(a[0],a[1],112);b0=(b[0],b[1],112);c0=(c[0],c[1],112);d0=(d[0],d[1],112)
 vs=[a,b,c,d,a0,b0,c0,d0]
 emit(rock,vs,[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])
 emit(floor,[a0,b0,c0,d0],[[0,1,2],[0,2,3]])
plan['meshes'].extend([rock,floor])
meta=plan['royalEastPocketRock20261012']
meta['status']='V5_UNDER_REVIEW'
meta['newMeshes']=[(m['name'],len(m['vertices']),len(m['faces']))for m in plan['meshes']if m['name'].startswith('repair_royal_east_pocket_')]
meta['connections']=[dict(which=s,at=[round(a[0],2),round(a[1],2),a[2]],gapM=round(math.dist(r[:2],a[:2]),2))
 for s,r,a in zip(source,ridge,anchors)]
(root/'royal-east-pocket-20261012.v5.staged.plan.json').write_text(json.dumps(plan,separators=(',',':')),encoding='utf8')
(root/'royal-east-pocket-20261012.v5.study.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
print('V5_STAGED',meta['newMeshes'])
