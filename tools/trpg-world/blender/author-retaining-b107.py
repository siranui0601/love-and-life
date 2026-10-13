"""B107: repair uncovered retaining-wall perimeter in upper city, civic foot
and western noble terrace without covering existing walls or active entrances.
WIP geometry, not player safety certified. Never overwrites B106.
"""
import sys,json,pathlib,math,collections
from shapely.geometry import shape,LineString,Point,Polygon
from shapely.ops import unary_union
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Refusing existing B107')
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
import shutil
new=[];report=[]
def mesh(name,vertices,faces,mat='stone'):
 if not vertices or not faces:return
 obj=dict(name='b107_'+name,vertices=vertices,faces=faces,material=mat)
 p['meshes'].append(obj);new.append(obj['name'])
def make_shell(zone,segs,zbase,ztop):
 vv=[];ff=[];rv=[];rf=[]
 amount=0
 for segment in segs:
  if segment.length<3:continue
  N=max(1,math.ceil(segment.length/12))
  pts=[segment.interpolate(i/N,normalized=True) for i in range(N+1)]
  for i,(a,b)in enumerate(zip(pts,pts[1:])):
   dx=b.x-a.x;dy=b.y-a.y;ln=math.hypot(dx,dy)
   if ln<.0001:continue
   nx=-dy/ln*.85;ny=dx/ln*.85
   # Quad reinforced wall, thickness 1.7m and close to 70-100m full cliff drop.
   base=len(vv)
   vv.extend([[a.x-nx,a.y-ny,zbase],[b.x-nx,b.y-ny,zbase],
     [b.x+nx,b.y+ny,zbase],[a.x+nx,a.y+ny,zbase],
     [a.x-nx,a.y-ny,ztop+.13],[b.x-nx,b.y-ny,ztop+.13],
     [b.x+nx,b.y+ny,ztop+.13],[a.x+nx,a.y+ny,ztop+.13]])
   ff.extend([[base+j for j in indices] for indices in
     [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]]])
   # Stone roadside lip from top surface up 1.5m, separate mesh.
   base=len(rv)
   rv.extend([[a.x-nx*.65,a.y-ny*.65,ztop+.13],
     [b.x-nx*.65,b.y-ny*.65,ztop+.13],
     [b.x+nx*.65,b.y+ny*.65,ztop+.13],
     [a.x+nx*.65,a.y+ny*.65,ztop+.13],
     [a.x-nx*.65,a.y-ny*.65,ztop+1.4],
     [b.x-nx*.65,b.y-ny*.65,ztop+1.4],
     [b.x+nx*.65,b.y+ny*.65,ztop+1.4],
     [a.x+nx*.65,a.y+ny*.65,ztop+1.4]])
   rf.extend([[base+j for j in ids]for ids in [[0,1,5,4],[2,3,7,6],[4,5,6,7]]])
   amount+=ln
 mesh(zone+'_retaining_reconstruction',vv,ff)
 mesh(zone+'_upper_guard_parapet',rv,rf)
 return amount
for zone,zlow,ztop in [('upper_city',42,112),('civic_foot',14,42),('noble_west',42,78)]:
 domain=shape(next(x['geometry']for x in p['landDomains']if x['id']==zone)).buffer(0)
 border=domain.boundary
 built=[]
 for m in p['meshes']:
  if not (zone in m['name'] and 'retain' in m['name'] and 'contour' not in m['name']):continue
  for face in m['faces']:
   verts=[m['vertices'][i] for i in face]
   if max(q[2]for q in verts)-min(q[2]for q in verts)<3:continue
   # Build a line from first two different projected points
   xy=list(dict.fromkeys((round(q[0],3),round(q[1],3))for q in verts))
   if len(xy)>1:
    seg=LineString(xy[:2])
    if seg.length>.001:built.append(seg)
 existing=unary_union(built) if built else Point(-100000,-100000)
 # Preserve the active traversals at the exact exposed rim. Do NOT block
 # vertical stairs, ramp connections, hoists or at-grade public passages.
 passage=[]
 for r in p['routes']:
  if min(r['z0'],r['z1'])>ztop+.1 or max(r['z0'],r['z1'])<zlow-.1:continue
  pts=r['points']
  if len(pts)<2:continue
  line=LineString([a[:2]for a in pts])
  if not line.intersects(border.buffer(4)):continue
  crosses=line.crosses(border)or not math.isclose(r['z0'],r['z1'],abs_tol=.5)
  if not crosses:continue
  entry=line.intersection(border.buffer(5))
  if entry.is_empty:continue
  passage.append(entry.buffer(max(3,r['width']*.5+2)))
 mask=unary_union(passage)if passage else Point(-10000,-10000)
 originalMissing=border.difference(existing.buffer(1.7))
 retained=originalMissing.difference(mask)
 segments=([retained] if retained.geom_type=='LineString' else
   [x for x in getattr(retained,'geoms',[])if x.geom_type=='LineString'])
 segments=[x for x in segments if x.length>3]
 length=make_shell(zone,segments,zlow,ztop)
 unmasked=border.difference(unary_union([existing.buffer(2),mask]))
 residual=unmasked.difference(unary_union([s.buffer(1.4)for s in segments])) if segments else unmasked
 info=dict(zone=zone,priorPerimeterM=border.length,
   originalWallCoverageM=border.intersection(existing.buffer(2)).length,
   protectedEntranceM=border.intersection(mask).length,
   reconstructedCurtainM=length,sections=len(segments),
   unprotectedWallGapRemainingM=residual.length,
   verticalRange=[zlow,ztop])
 report.append(info)
print(json.dumps(report,ensure_ascii=False,indent=2))
p['retainingClosureB107']=dict(status='REQUIRES_COLLISION_AND_VISUAL_QA',base=src.name,
   areas=report,newMeshes=new,
   warnings=['Some old terrace boundaries have historic cutouts that are intentional',
     'No floor-gap mesh check of newly generated guard parapet against all route materials',
     'Check full walkability along wall edges and long staircase transitions'])
out.mkdir()
for name,value in [('plan.json',p),('retaining-closure-study.json',p['retainingClosureB107'])]:
 (out/name).write_text(json.dumps(value,separators=(',',':')),encoding='utf-8')
shutil.copy2(src/'parcels.json',out/'parcels.json')
