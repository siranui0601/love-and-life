"""Check edited B100 mage and B101 castle approaches against newly added
architectural geometry at standing body/head height. Discrete probe only.
"""
import bpy,json,math,pathlib,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((out/'plan.json').read_text())
meshverts=[];meshfaces=[];owners=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or not ob.name.startswith(('b100_','b101_')):continue
 if not len(ob.data.polygons):continue
 k=len(meshverts)
 meshverts.extend([ob.matrix_world@v.co for v in ob.data.vertices])
 for f in ob.data.polygons:
  meshfaces.append([k+i for i in f.vertices]);owners.append(ob.name)
tree=BVHTree.FromPolygons(meshverts,meshfaces,all_triangles=False)
hits=[];probes=0
routes=[r for r in p['routes'] if any(q in r['id'] for q in
     ['castle_contour','castle_lane','castle_east_ramp_landing_1',
      'castle_wall_stairs_landing_1','castle_hoist_upper_landing',
      'mage_east_lane','interior_life_design-b52_mage_east'])]
for r in routes:
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];ln=math.hypot(dx,dy)
  if ln<.005:continue
  n=max(1,math.ceil(ln/2))
  for t in range(n):
   for shoulder in (-min(1.,r['width']*.23),0,min(1.,r['width']*.23)):
    x=a[0]+dx*t/n-dy/ln*shoulder;y=a[1]+dy*t/n+dx/ln*shoulder
    xx=a[0]+dx*(t+1)/n-dy/ln*shoulder;yy=a[1]+dy*(t+1)/n+dx/ln*shoulder
    for head in [1.1,1.8]:
     st=Vector((x,y,a[2]+head));en=Vector((xx,yy,b[2]+head))
     vector=en-st
     hit,normal,idx,dist=tree.ray_cast(st,vector.normalized(),vector.length)
     probes+=1
     if hit is not None and .003<dist<vector.length-.003:
      hits.append(dict(route=r['id'],obstacle=owners[idx],at=list(hit)))
report=dict(status='PASS_LOCAL_ARCHITECTURE'if not hits else 'FAIL',
    routeCount=len(routes),probeCount=probes,obstructions=len(hits),
    examples=hits[:35],limitations=['Only geometry added in B100/B101',
       'No existing buildings, railings or character capsule sweep',
       'No actual gameplay traversal or cargo test'])
(out/'castle-mage-route-qa.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items()if k not in('examples','limitations')}))
