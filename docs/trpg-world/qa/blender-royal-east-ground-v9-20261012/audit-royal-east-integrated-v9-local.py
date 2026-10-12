import bpy,math,json,pathlib,bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
data=json.loads((root/'royal-east-integrated-v9.staged.plan.json').read_text('utf8'))
mnames=data['royalEastIntegratedV9']['meshNames']
rock=bpy.data.objects[mnames[0]];foot=bpy.data.objects[mnames[1]]
bm=bmesh.new();bm.from_mesh(rock.data)
bad=[e for e in bm.edges if not e.is_manifold]
print('ROCK_MANIFOLD','faces',len(bm.faces),'edges',len(bm.edges),
      'nonmanifold',len(bad),'boundary',sum(e.is_boundary for e in bad),flush=True)
bm.free()
v=[];f=[];owner=[]
for ob in [rock]:
 base=len(v);v.extend([ob.matrix_world @ q.co for q in ob.data.vertices])
 for face in ob.data.polygons:
  f.append([base+k for k in face.vertices]);owner.append(ob.name)
tree=BVHTree.FromPolygons(v,f)
routeNames=['current_castle_east_stone_stairs','current_castle_east_winch_ramp',
            'castle_east_ramp_landing_0','current_castle_east_overlook_1','current_castle_east_overlook_2']
routes={r['id']:r for r in data['routes']}
hits=[];tested=0
for rid in routeNames:
 r=routes[rid];width=r.get('width',3.5)
 for a,b in zip(r['points'],r['points'][1:]):
  delta=Vector((b[0]-a[0],b[1]-a[1],0));L=delta.length
  if L<.01:continue
  n=Vector((-delta.y/L,delta.x/L,0))
  N=max(1,math.ceil(L/.75))
  for i in range(N):
   t=(i+.5)/N
   q=Vector((a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t))
   for lateral in(-.42*width,0,.42*width):
    for h in(.25,1.25,2.0):
     loc=q+n*lateral+Vector((0,0,h))
     pt,no,idx,dis=tree.find_nearest(loc,1.1)
     tested+=1
     if pt is not None and dis<.78:
      if len(hits)<35:hits.append(dict(route=rid,point=[round(x,2)for x in loc],distance=round(dis,3)))
print('ROCK_WALKWAY_SCAN','points',tested,'collisionCount',len(hits),hits[:12],flush=True)
report=dict(rockNonManifoldEdges=len(bad),scanPoints=tested,walkwayHits=hits,
 status='PASS'if len(bad)==0 and not hits else 'NEEDS_REPAIR',
 limitations='Static surface samples only; not complete capsule collision or visual acceptance')
(root/'royal-east-integrated-v9.localqa.json').write_text(json.dumps(report,indent=2),encoding='utf8')
